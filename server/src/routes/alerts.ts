import { Router } from 'express';
import { db } from '../db/client';
import type { AuthedRequest } from '../middleware/auth';

export const alertsRouter = Router();

// ── List alerts for the org ──────────────────────────────────────────────────
// GET /api/alerts?page=1&limit=20&severity=high&match_type=direct_hts&is_read=false&search=
alertsRouter.get('/', async (req, res) => {
  const { orgId } = req as AuthedRequest;
  const page    = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const limit   = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
  const from    = (page - 1) * limit;

  let query = db
    .from('alerts')
    .select(`
      *,
      source_document:source_documents(
        id, title, source_name, source_url, published_at,
        affected_hts_codes, affected_categories, affected_origin_countries,
        document_type, effective_date, confidence_level
      ),
      alert_matches(
        id, product_id, hts_code, match_reason, match_confidence,
        product:monitored_products(id, name)
      )
    `, { count: 'exact' })
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (req.query.severity)   query = query.eq('severity', req.query.severity);
  if (req.query.match_type) query = query.eq('match_type', req.query.match_type);
  if (req.query.is_read !== undefined) {
    query = query.eq('is_read', req.query.is_read === 'true');
  }

  const { data, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Attach user-specific saved/dismissed flags
  const { userId } = req as AuthedRequest;
  const alertIds = (data ?? []).map((a: any) => a.id);

  const [{ data: saved }, { data: dismissed }] = await Promise.all([
    db.from('saved_alerts').select('alert_id').eq('user_id', userId).in('alert_id', alertIds),
    db.from('dismissed_alerts').select('alert_id').eq('user_id', userId).in('alert_id', alertIds),
  ]);

  const savedSet     = new Set((saved ?? []).map((r: any) => r.alert_id));
  const dismissedSet = new Set((dismissed ?? []).map((r: any) => r.alert_id));

  const enriched = (data ?? []).map((a: any) => ({
    ...a,
    is_saved:     savedSet.has(a.id),
    is_dismissed: dismissedSet.has(a.id),
  }));

  res.json({
    data: enriched,
    pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
  });
});

// ── Single alert ─────────────────────────────────────────────────────────────
alertsRouter.get('/:id', async (req, res) => {
  const { orgId, userId } = req as AuthedRequest;

  const { data: alert, error } = await db
    .from('alerts')
    .select(`
      *,
      source_document:source_documents(*),
      alert_matches(*, product:monitored_products(id, name, hts_codes, categories, origin_countries))
    `)
    .eq('id', req.params.id)
    .eq('organization_id', orgId)
    .single();

  if (error || !alert) return res.status(404).json({ error: 'Alert not found' });

  const [{ data: saved }, { data: dismissed }] = await Promise.all([
    db.from('saved_alerts').select('id, notes').eq('alert_id', alert.id).eq('user_id', userId).maybeSingle(),
    db.from('dismissed_alerts').select('id').eq('alert_id', alert.id).eq('user_id', userId).maybeSingle(),
  ]);

  res.json({ ...alert, is_saved: !!saved, saved_notes: (saved as any)?.notes ?? null, is_dismissed: !!dismissed });
});

// ── Mark read ────────────────────────────────────────────────────────────────
alertsRouter.patch('/:id/read', async (req, res) => {
  const { orgId } = req as AuthedRequest;
  const { error } = await db
    .from('alerts')
    .update({ is_read: true })
    .eq('id', req.params.id)
    .eq('organization_id', orgId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── Save alert ───────────────────────────────────────────────────────────────
alertsRouter.post('/:id/save', async (req, res) => {
  const { orgId, userId } = req as AuthedRequest;

  // Verify alert belongs to org
  const { data: alert } = await db.from('alerts').select('id').eq('id', req.params.id).eq('organization_id', orgId).single();
  if (!alert) return res.status(404).json({ error: 'Alert not found' });

  const { error } = await db.from('saved_alerts').upsert(
    { alert_id: req.params.id, user_id: userId, notes: req.body?.notes ?? null },
    { onConflict: 'alert_id,user_id' },
  );
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── Unsave alert ─────────────────────────────────────────────────────────────
alertsRouter.delete('/:id/save', async (req, res) => {
  const { userId } = req as AuthedRequest;
  const { error } = await db.from('saved_alerts').delete().eq('alert_id', req.params.id).eq('user_id', userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── Dismiss alert ────────────────────────────────────────────────────────────
alertsRouter.post('/:id/dismiss', async (req, res) => {
  const { orgId, userId } = req as AuthedRequest;

  const { data: alert } = await db.from('alerts').select('id').eq('id', req.params.id).eq('organization_id', orgId).single();
  if (!alert) return res.status(404).json({ error: 'Alert not found' });

  const { error } = await db.from('dismissed_alerts').upsert(
    { alert_id: req.params.id, user_id: userId },
    { onConflict: 'alert_id,user_id' },
  );
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── Undismiss alert ──────────────────────────────────────────────────────────
alertsRouter.delete('/:id/dismiss', async (req, res) => {
  const { userId } = req as AuthedRequest;
  const { error } = await db.from('dismissed_alerts').delete().eq('alert_id', req.params.id).eq('user_id', userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── Saved alerts list ────────────────────────────────────────────────────────
alertsRouter.get('/saved/list', async (req, res) => {
  const { userId } = req as AuthedRequest;
  const { data, error } = await db
    .from('saved_alerts')
    .select('*, alert:alerts(*, source_document:source_documents(id, title, source_name, published_at))')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data: data ?? [] });
});
