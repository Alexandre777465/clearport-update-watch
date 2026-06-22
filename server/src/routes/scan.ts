/**
 * Public scan endpoint — retrieves a previously generated risk scan by
 * watchlist entry ID. No authentication required.
 */

import { Router } from 'express';
import { db } from '../db/client';

const router = Router();

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
