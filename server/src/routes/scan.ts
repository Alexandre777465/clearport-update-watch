/**
 * Public scan endpoint — retrieves a previously generated risk scan by
 * watchlist entry ID. No authentication required.
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client';
import { askAboutProduct } from '../services/askClearportGrounded';

const router = Router();

// POST /api/public/scan/:entryId/ask — product-grounded Assistant
const askSchema = z.object({ question: z.string().min(1).max(1000) });
router.post('/:entryId/ask', async (req, res) => {
  const parsed = askSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'A question is required.' });
  try {
    const result = await askAboutProduct(req.params.entryId, parsed.data.question);
    if (!result) {
      return res.status(503).json({
        answer: 'The ClearPort Assistant is not available right now.',
        grounded: false,
        sources: [],
      });
    }
    return res.json(result);
  } catch {
    return res.status(500).json({
      answer: 'Something went wrong answering your question. Please try again.',
      grounded: false,
      sources: [],
    });
  }
});

// GET /api/public/scan/:entryId/context — product details for the Assistant header
router.get('/:entryId/context', async (req, res) => {
  const { data: entry } = await db
    .from('watchlist_entries')
    .select('id, product_name, hts_code, origin_country, destination_country')
    .eq('id', req.params.entryId)
    .maybeSingle();
  if (!entry) return res.status(404).json({ error: 'Not found' });
  return res.json(entry);
});

// GET /api/public/scan/:entryId
// Status-aware so the frontend can poll an async scan:
//   { status: 'ready',   scan }   — scan completed and saved
//   { status: 'pending' }         — still running
//   { status: 'failed',  error }  — scan errored
router.get('/:entryId', async (req, res) => {
  const { entryId } = req.params;

  const { data: entry } = await db
    .from('watchlist_entries')
    .select('id, scan_status, scan_error')
    .eq('id', entryId)
    .maybeSingle();

  if (!entry) {
    return res.status(404).json({ error: 'No entry found' });
  }

  const { data: scan, error } = await db
    .from('product_risk_scans')
    .select('*')
    .eq('watchlist_entry_id', entryId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: 'Failed to retrieve scan' });
  }

  if (scan) {
    return res.json({ status: 'ready', scan });
  }

  const status = entry.scan_status === 'failed' ? 'failed' : 'pending';
  return res.json({ status, error: entry.scan_error ?? undefined });
});

// GET /api/public/scan/:entryId/documents
router.get('/:entryId/documents', async (req, res) => {
  const { entryId } = req.params;

  const { data: docs } = await db
    .from('product_documents')
    .select('*')
    .eq('watchlist_entry_id', entryId)
    .order('uploaded_at', { ascending: false });

  return res.json({ data: docs ?? [] });
});

export const scanRouter = router;
