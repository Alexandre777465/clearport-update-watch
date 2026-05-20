import { Router } from 'express';
import { z } from 'zod';
import { askClearport } from '../services/askClearport';
import { db } from '../db/client';
import type { AuthedRequest } from '../middleware/auth';

export const askRouter = Router();

const AskSchema = z.object({
  query: z.string().min(3).max(2000),
});

// ── Ask ClearPort a question ──────────────────────────────────────────────────
// POST /api/ask
askRouter.post('/', async (req, res) => {
  const { orgId, userId } = req as AuthedRequest;

  const parsed = AskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() });

  try {
    const result = await askClearport(parsed.data.query, orgId, userId);
    res.json({
      response: result.response,
      is_legal_deflection: result.isLegalDeflection,
      source_document_ids: result.sourceDocumentIds,
      alert_ids: result.alertIds,
      disclaimer: 'ClearPort provides informational summaries only. This is not legal advice. Verify with your licensed customs broker.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Query history for the user ────────────────────────────────────────────────
// GET /api/ask/history?page=1&limit=20
askRouter.get('/history', async (req, res) => {
  const { userId } = req as AuthedRequest;
  const page  = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
  const from  = (page - 1) * limit;

  const { data, count, error } = await db
    .from('assistant_queries')
    .select('id, query, response, is_legal_deflection, created_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error) return res.status(500).json({ error: error.message });
  res.json({
    data: data ?? [],
    pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
  });
});
