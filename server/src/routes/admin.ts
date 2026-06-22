/**
 * Protected admin endpoints (NOT public, NOT behind Supabase user auth).
 *
 * Guarded by a shared secret: requests must send `x-admin-token` matching the
 * ADMIN_REFRESH_TOKEN env var. If that var is unset the endpoints are disabled
 * (503) so the trigger is never exposed without protection.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db/client';
import { checkFeed } from '../services/feedFetcher';
import { processUnprocessedDocuments } from '../services/summarizer';
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

export const adminRouter = router;
