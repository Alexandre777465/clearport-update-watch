import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client';
import type { AuthedRequest } from '../middleware/auth';
import { normalizeHts, formatHts } from '../services/htsBaseline';

export const htsCodesRouter = Router();

const HtsCodeSchema = z.object({
  // Accept any separator variant (dots, spaces, hyphens, bare digits) and
  // normalize to canonical dotted form: "9503 00 8900" → "9503.00.8900".
  hts_code: z.string().transform((val, ctx) => {
    const digits = normalizeHts(val);
    if (digits.length < 4 || digits.length > 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'HTS code must contain 4–10 digits (e.g. 9503.00.8900, 9503 00 8900, or 9503008900)',
      });
      return z.NEVER;
    }
    return formatHts(digits);
  }),
  description: z.string().optional(),
});

// ── List monitored HTS codes ──────────────────────────────────────────────────
htsCodesRouter.get('/', async (req, res) => {
  const { orgId } = req as unknown as AuthedRequest;
  const { data, error } = await db
    .from('monitored_hts_codes')
    .select('*')
    .eq('organization_id', orgId)
    .order('hts_code');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data: data ?? [] });
});

// ── Add HTS code ──────────────────────────────────────────────────────────────
htsCodesRouter.post('/', async (req, res) => {
  const { orgId, userId } = req as unknown as AuthedRequest;

  const parsed = HtsCodeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() });

  const { data, error } = await db
    .from('monitored_hts_codes')
    .insert({ ...parsed.data, organization_id: orgId, created_by: userId })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'HTS code already monitored' });
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
});

// ── Delete HTS code ───────────────────────────────────────────────────────────
htsCodesRouter.delete('/:id', async (req, res) => {
  const { orgId } = req as unknown as AuthedRequest;
  const { error } = await db
    .from('monitored_hts_codes')
    .delete()
    .eq('id', req.params.id)
    .eq('organization_id', orgId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── Recent alerts for a monitored HTS code ────────────────────────────────────
htsCodesRouter.get('/:id/alerts', async (req, res) => {
  const { orgId } = req as unknown as AuthedRequest;

  const { data: hts } = await db
    .from('monitored_hts_codes')
    .select('hts_code')
    .eq('id', req.params.id)
    .eq('organization_id', orgId)
    .single();
  if (!hts) return res.status(404).json({ error: 'HTS code not found' });

  // Find source documents that mention this HTS prefix
  const { data: docs } = await db
    .from('source_documents')
    .select('id')
    .contains('affected_hts_codes', [(hts as any).hts_code]);

  const docIds = (docs ?? []).map((d: any) => d.id);
  if (!docIds.length) return res.json({ data: [] });

  const { data, error } = await db
    .from('alerts')
    .select('*, source_document:source_documents(id, title, source_name, published_at, affected_hts_codes)')
    .eq('organization_id', orgId)
    .in('source_document_id', docIds)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data: data ?? [] });
});
