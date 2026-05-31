/**
 * Public watchlist endpoint — no authentication required.
 * Saves an email + product entry, generates an AI risk scan, and returns both.
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client';
import { generateRiskScan } from '../services/riskScanner';

const router = Router();

const watchlistSchema = z.object({
  email: z.string().email('A valid email address is required'),
  product_name: z.string().min(1, 'Product name is required').max(200),
  product_description: z.string().max(1000).optional(),
  hts_code: z.string().max(20).optional(),
  origin_country: z.string().max(100).default('China'),
  destination_country: z.string().max(100).default('United States'),
  alert_frequency: z.enum(['instant', 'daily', 'weekly']).default('weekly'),
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

  const { data: entry, error } = await db
    .from('watchlist_entries')
    .insert({
      email: data.email.toLowerCase().trim(),
      product_name: data.product_name.trim(),
      product_description: data.product_description?.trim() ?? null,
      hts_code: data.hts_code?.trim() ?? null,
      origin_country: data.origin_country.trim(),
      destination_country: data.destination_country.trim(),
      alert_frequency: data.alert_frequency,
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

  // Run risk scan and source document preview in parallel
  const [riskScanResult, previewDocs] = await Promise.all([
    generateRiskScan(entry as any),
    getMatchingDocuments(data.hts_code, data.origin_country),
  ]);

  // Persist the risk scan if generated
  let riskScan = null;
  if (riskScanResult) {
    const { data: savedScan } = await db
      .from('product_risk_scans')
      .insert({
        watchlist_entry_id: entry.id,
        overall_risk: riskScanResult.overall_risk,
        overall_summary: riskScanResult.overall_summary,
        risk_categories: riskScanResult.risk_categories,
        document_checklist: riskScanResult.document_checklist,
        broker_questions: riskScanResult.broker_questions,
        supplier_questions: riskScanResult.supplier_questions,
        next_actions: riskScanResult.next_actions,
        readiness_score: riskScanResult.readiness_score,
        confidence_level: riskScanResult.confidence_level,
      })
      .select('*')
      .single();

    riskScan = savedScan ?? { ...riskScanResult, id: 'unsaved', watchlist_entry_id: entry.id, created_at: new Date().toISOString() };
  }

  return res.status(201).json({ id: entry.id, preview: previewDocs, risk_scan: riskScan });
});

async function getMatchingDocuments(
  htsCode: string | undefined,
  originCountry: string,
): Promise<unknown[]> {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const conditions: string[] = [];
    if (htsCode) conditions.push(`affected_hts_codes.cs.{"${htsCode}"}`);
    conditions.push(`affected_origin_countries.cs.{"${originCountry}"}`);

    const { data } = await db
      .from('source_documents')
      .select(
        'id, title, source_name, source_url, published_at, plain_english_summary, broker_questions, effective_date',
      )
      .eq('is_processed', true)
      .gte('published_at', since)
      .or(conditions.join(','))
      .order('published_at', { ascending: false })
      .limit(5);

    return data ?? [];
  } catch {
    return [];
  }
}

export const watchlistRouter = router;
