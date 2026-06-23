/**
 * Public watchlist endpoint — no authentication required.
 *
 * Saves the entry and returns IMMEDIATELY with a scan_status of "pending", then
 * runs the Anthropic risk scan in the background. The frontend polls
 * GET /api/public/scan/:id until status is "ready" or "failed". This avoids
 * holding a 30–45s HTTP request open (which proxies aborted with HTTP 499).
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client';
import { generateRiskScan } from '../services/riskScanner';
import { htsCodesRelated } from '../services/matchingEngine';
import { evaluateBaselines } from '../services/baselines';
import { sendWatchlistConfirmation } from '../services/emailService';

// Email is only truthfully "active" when a Resend key is present AND alerts
// are enabled. The frontend uses this to avoid promising emails it can't send.
function emailAlertsEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY) && process.env.ENABLE_EMAIL_ALERTS === 'true';
}

const router = Router();

const watchlistSchema = z.object({
  email: z.string().email('A valid email address is required'),
  product_name: z.string().min(1, 'Product name is required').max(200),
  product_description: z.string().max(1000).optional(),
  hts_code: z.string().max(20).optional(),
  origin_country: z.string().max(100).default('China'),
  destination_country: z.string().max(100).default('United States'),
  alert_frequency: z.enum(['instant', 'daily', 'weekly']).default('weekly'),
  // Optional estimated customs value of the shipment (USD). Used only to
  // compute a dollar impact from a verified rate — never persisted.
  estimated_value_usd: z.number().positive().max(1_000_000_000).optional(),
  // Product attribute flags (used for risk scan generation)
  is_children: z.boolean().default(false),
  has_battery: z.boolean().default(false),
  is_electronic: z.boolean().default(false),
  is_textile: z.boolean().default(false),
  is_cosmetic: z.boolean().default(false),
  is_food_contact: z.boolean().default(false),
  is_supplement: z.boolean().default(false),
  sold_on_amazon: z.boolean().default(false),
  sold_on_tiktok: z.boolean().default(false),
  sold_in_eu: z.boolean().default(false),
});

// POST /api/public/watchlist
router.post('/', async (req, res) => {
  const parsed = watchlistSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }

  const data = parsed.data;
  const email = data.email.toLowerCase().trim();
  const productName = data.product_name.trim();
  const htsCode = data.hts_code?.trim() || null;
  const origin = data.origin_country.trim();

  // ── Dedupe retries ──────────────────────────────────────────────────────────
  // If the same email submitted the same product+origin+HTS in the last 10
  // minutes, reuse that entry instead of creating a duplicate row. This makes
  // a client retry (e.g. after an aborted request) idempotent.
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: existing } = await db
    .from('watchlist_entries')
    .select('id')
    .eq('email', email)
    .eq('product_name', productName)
    .eq('origin_country', origin)
    .eq('hts_code', htsCode as any)
    .gte('created_at', tenMinAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const previewDocs = await getMatchingDocuments(data.hts_code);

  if (existing) {
    return res.status(200).json({
      id: existing.id,
      preview: previewDocs,
      scan_status: 'pending',
      email_enabled: emailAlertsEnabled(),
      deduped: true,
    });
  }

  const { data: entry, error } = await db
    .from('watchlist_entries')
    .insert({
      email,
      product_name: productName,
      product_description: data.product_description?.trim() ?? null,
      hts_code: htsCode,
      origin_country: origin,
      destination_country: data.destination_country.trim(),
      alert_frequency: data.alert_frequency,
      scan_status: 'pending',
      is_children: data.is_children,
      has_battery: data.has_battery,
      is_electronic: data.is_electronic,
      is_textile: data.is_textile,
      is_cosmetic: data.is_cosmetic,
      is_food_contact: data.is_food_contact,
      is_supplement: data.is_supplement,
      sold_on_amazon: data.sold_on_amazon,
      sold_on_tiktok: data.sold_on_tiktok,
      sold_in_eu: data.sold_in_eu,
    })
    .select('*')
    .single();

  if (error || !entry) {
    console.error('[watchlist] Insert failed:', error?.message);
    return res.status(500).json({ error: 'Failed to save your monitoring entry. Please try again.' });
  }

  // Kick off the scan in the background — do NOT await. Respond immediately.
  void runScanInBackground(entry, previewDocs, data.estimated_value_usd);
  // Confirmation email (no-op unless Resend + ENABLE_EMAIL_ALERTS are configured).
  void sendWatchlistConfirmation(entry as any);

  return res.status(201).json({
    id: entry.id,
    preview: previewDocs,
    scan_status: 'pending',
    email_enabled: emailAlertsEnabled(),
  });
});

// Runs the Anthropic scan after the response has been sent, then persists the
// result and updates scan_status. Errors are recorded, never thrown.
async function runScanInBackground(
  entry: any,
  previewDocs: unknown[],
  estimatedValueUsd?: number,
): Promise<void> {
  try {
    // Deterministic, source-backed baselines first (USITC HTS + curated registry).
    const baselineCategories = await evaluateBaselines(entry, estimatedValueUsd).catch(() => []);

    const result = await generateRiskScan(entry, {
      documents: previewDocs as any,
      estimatedValueUsd,
      baselineCategories,
    });

    if (!result) {
      // No API key (or transient null) — mark failed so the client stops polling.
      await db
        .from('watchlist_entries')
        .update({ scan_status: 'failed', scan_error: 'Scan unavailable' })
        .eq('id', entry.id);
      return;
    }

    await db.from('product_risk_scans').insert({
      watchlist_entry_id: entry.id,
      overall_risk: result.overall_risk,
      overall_summary: result.overall_summary,
      risk_categories: result.risk_categories,
      document_checklist: result.document_checklist,
      broker_questions: result.broker_questions,
      supplier_questions: result.supplier_questions,
      next_actions: result.next_actions,
      readiness_score: result.readiness_score,
      confidence_level: result.confidence_level,
    });

    await db.from('watchlist_entries').update({ scan_status: 'ready' }).eq('id', entry.id);
  } catch (err: any) {
    console.error(`[watchlist] Background scan failed for ${entry.id}:`, err?.message);
    await db
      .from('watchlist_entries')
      .update({ scan_status: 'failed', scan_error: err?.message ?? 'Unknown error' })
      .eq('id', entry.id);
  }
}

// Returns recent official documents that are genuinely relevant to THIS
// product, judged by HTS code only. A document is never included merely
// because it shares an origin country (that produced unrelated AD/CVD
// notices in earlier tests). If no HTS code is provided, or no document's
// affected HTS codes are related to it, an empty list is returned and the
// frontend shows a "no relevant updates" message.
async function getMatchingDocuments(htsCode: string | undefined): Promise<unknown[]> {
  const normalized = (htsCode ?? '').replace(/[^0-9]/g, '');
  if (normalized.length < 4) return []; // need at least heading-level to match defensibly

  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Pull recent processed documents that carry at least one HTS code, then
    // confirm relevance in JS using the shared, guarded prefix matcher.
    const { data } = await db
      .from('source_documents')
      .select(
        'id, title, source_name, source_url, published_at, plain_english_summary, broker_questions, effective_date, affected_hts_codes',
      )
      .eq('is_processed', true)
      .gte('published_at', since)
      .order('published_at', { ascending: false })
      .limit(100);

    const relevant = (data ?? []).filter((doc: any) =>
      Array.isArray(doc.affected_hts_codes) &&
      doc.affected_hts_codes.some((code: string) => htsCodesRelated(code, htsCode!)),
    );

    // Strip the helper field before returning to the client.
    return relevant.slice(0, 5).map(({ affected_hts_codes, ...rest }: any) => rest);
  } catch {
    return [];
  }
}

export const watchlistRouter = router;
