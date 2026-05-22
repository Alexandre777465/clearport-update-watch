/**
 * Public watchlist endpoint — no authentication required.
 * Accepts an email + product details and creates a watchlist_entries row.
 * Returns a preview of recent matching source documents as an instant scan.
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client';

const router = Router();

const watchlistSchema = z.object({
  email: z.string().email('A valid email address is required'),
  product_name: z.string().min(1, 'Product name is required').max(200),
  product_description: z.string().max(1000).optional(),
  hts_code: z.string().max(20).optional(),
  origin_country: z.string().max(100).default('China'),
  destination_country: z.string().max(100).default('United States'),
  alert_frequency: z.enum(['instant', 'daily', 'weekly']).default('weekly'),
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
    })
    .select('id')
    .single();

  if (error || !entry) {
    console.error('[watchlist] Insert failed:', error?.message);
    return res.status(500).json({ error: 'Failed to save your monitoring entry. Please try again.' });
  }

  // Best-effort: return matching recent source documents as an instant scan preview.
  // Errors here are swallowed — the entry is already saved.
  const preview = await getMatchingDocuments(data.hts_code, data.origin_country);

  return res.status(201).json({ id: entry.id, preview });
});

async function getMatchingDocuments(
  htsCode: string | undefined,
  originCountry: string,
): Promise<unknown[]> {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Build OR filter: match on HTS code first, then origin country as fallback
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
