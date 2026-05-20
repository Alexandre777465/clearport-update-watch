import { Router } from 'express';
import { db } from '../db/client';
import { getSourceStatuses } from '../services/sourceStatus';

export const sourcesRouter = Router();

// ── Source status overview ────────────────────────────────────────────────────
// GET /api/sources/status
sourcesRouter.get('/status', async (_req, res) => {
  try {
    const statuses = await getSourceStatuses();
    res.json({ data: statuses, checked_at: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── List all source feeds ─────────────────────────────────────────────────────
sourcesRouter.get('/', async (_req, res) => {
  const { data, error } = await db
    .from('source_feeds')
    .select('id, name, url, feed_type, check_interval_minutes, is_active, last_checked_at, last_successful_sync_at')
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data: data ?? [] });
});

// ── Recent documents from a source ───────────────────────────────────────────
// GET /api/sources/:id/documents?page=1&limit=20
sourcesRouter.get('/:id/documents', async (req, res) => {
  const page  = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
  const from  = (page - 1) * limit;

  // Verify feed exists
  const { data: feed } = await db.from('source_feeds').select('id, name').eq('id', req.params.id).single();
  if (!feed) return res.status(404).json({ error: 'Source not found' });

  const { data, count, error } = await db
    .from('source_documents')
    .select(
      'id, title, source_name, source_url, published_at, fetched_at, document_type, ' +
      'official_reference, effective_date, affected_origin_countries, affected_categories, ' +
      'affected_hts_codes, plain_english_summary, confidence_level, is_processed',
      { count: 'exact' },
    )
    .eq('feed_id', req.params.id)
    .order('fetched_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error) return res.status(500).json({ error: error.message });
  res.json({
    feed,
    data: data ?? [],
    pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
  });
});

// ── Single source document ────────────────────────────────────────────────────
sourcesRouter.get('/documents/:docId', async (req, res) => {
  const { data, error } = await db
    .from('source_documents')
    .select('*')
    .eq('id', req.params.docId)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Document not found' });
  res.json(data);
});

// ── Recent check logs for a source ───────────────────────────────────────────
sourcesRouter.get('/:id/logs', async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10)));

  const { data, error } = await db
    .from('source_check_logs')
    .select('*')
    .eq('feed_id', req.params.id)
    .order('checked_at', { ascending: false })
    .limit(limit);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data: data ?? [] });
});
