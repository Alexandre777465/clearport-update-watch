/**
 * Protected admin endpoints (NOT public, NOT behind Supabase user auth).
 *
 * Guarded by a shared secret: requests must send `x-admin-token` matching the
 * ADMIN_REFRESH_TOKEN env var. If that var is unset the endpoints are disabled
 * (503) so the trigger is never exposed without protection.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Resend } from 'resend';
import { db } from '../db/client';
import { checkFeed } from '../services/feedFetcher';
import { processUnprocessedDocuments } from '../services/summarizer';
import { sendWatchlistAlerts } from '../services/emailService';
import type { SourceFeed } from '../types';

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_REFRESH_TOKEN;
  if (!expected) {
    res.status(503).json({ error: 'Admin refresh is disabled. Set ADMIN_REFRESH_TOKEN to enable it.' });
    return;
  }
  const provided = req.headers['x-admin-token'];
  if (typeof provided !== 'string' || provided !== expected) {
    res.status(401).json({ error: 'Invalid or missing admin token.' });
    return;
  }
  next();
}

// POST /api/admin/refresh
// Fetches the latest documents from every active source, summarizes the new
// ones, and reports source-by-source results.
router.post('/refresh', requireAdmin, async (_req, res) => {
  const { data: feeds } = await db
    .from('source_feeds')
    .select('*')
    .eq('is_active', true);

  if (!feeds?.length) {
    return res.json({ refreshed_at: new Date().toISOString(), sources: [], documents_summarized: 0 });
  }

  const sources: Array<{
    name: string;
    status: string;          // 'success' | 'error'
    documents_fetched: number;
    documents_stored: number;
    duplicates_skipped: number;
    last_refresh: string | null;
    error: string | null;
  }> = [];

  for (const feed of feeds as SourceFeed[]) {
    const now = new Date().toISOString();
    try {
      const r = await checkFeed(feed);
      const ok = r.status !== 'error';
      sources.push({
        name: feed.name,
        status: ok ? 'success' : 'error',
        documents_fetched: r.documentsFound,
        documents_stored: r.documentsNew,
        duplicates_skipped: Math.max(0, r.documentsFound - r.documentsNew),
        last_refresh: ok ? now : null,
        error: r.error ?? null,
      });
    } catch (err: any) {
      sources.push({
        name: feed.name,
        status: 'error',
        documents_fetched: 0,
        documents_stored: 0,
        duplicates_skipped: 0,
        last_refresh: null,
        error: err?.message ?? 'unknown error',
      });
    }
  }

  // Summarize the documents that were just fetched (and any prior backlog).
  const { count: before } = await db
    .from('source_documents')
    .select('id', { count: 'exact', head: true })
    .eq('is_processed', false)
    .is('processing_error', null);

  await processUnprocessedDocuments(50);

  const { count: after } = await db
    .from('source_documents')
    .select('id', { count: 'exact', head: true })
    .eq('is_processed', false)
    .is('processing_error', null);

  const documents_summarized = Math.max(0, (before ?? 0) - (after ?? 0));

  return res.json({
    refreshed_at: new Date().toISOString(),
    sources,
    documents_summarized,
  });
});

// POST /api/admin/send-watchlist-alerts
// Manually triggers the watchlist alert cron logic and returns dispatch stats.
router.post('/send-watchlist-alerts', requireAdmin, async (_req, res) => {
  try {
    const stats = await sendWatchlistAlerts();
    return res.json({ triggered_at: new Date().toISOString(), ...stats });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'unknown error' });
  }
});

// POST /api/admin/test-email
// Sends a plain diagnostic email to verify the Resend integration is wired up.
// Body: { "to": "email@example.com" }
router.post('/test-email', requireAdmin, async (req, res) => {
  const to = req.body?.to;
  if (typeof to !== 'string' || !to.includes('@')) {
    return res.status(400).json({ error: 'Body must include a valid "to" email address.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'RESEND_API_KEY is not set — email is not configured.' });
  }

  const from = `${process.env.RESEND_FROM_NAME ?? 'ClearPort Alerts'} <${process.env.RESEND_FROM_EMAIL ?? 'alerts@clearport.io'}>`;
  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from,
      to,
      subject: '[ClearPort] Email delivery test',
      html: `<p>This is a test email from ClearPort admin. If you received it, the Resend integration is working correctly.</p><p style="font-size:12px;color:#888;">Sent at ${new Date().toISOString()}</p>`,
    });
    return res.json({ sent: true, to, sent_at: new Date().toISOString() });
  } catch (err: any) {
    return res.status(502).json({ sent: false, error: err?.message ?? 'send failed' });
  }
});

export const adminRouter = router;
