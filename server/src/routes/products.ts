import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client';
import type { AuthedRequest } from '../middleware/auth';
import { normalizeHts, formatHts } from '../services/htsBaseline';

export const productsRouter = Router();

// Normalize a single HTS code to canonical dotted form; reject structurally invalid inputs.
const htsCodeField = z.string().transform((val, ctx) => {
  const digits = normalizeHts(val);
  if (digits.length < 4 || digits.length > 10) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'HTS code must contain 4–10 digits (e.g. 9503.00.8900, 9503 00 8900, or 9503008900)',
    });
    return z.NEVER;
  }
  return formatHts(digits);
});

const ProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  hts_codes: z.array(htsCodeField).default([]),
  categories: z.array(z.string().min(1)).default([]),
  origin_countries: z.array(z.string().min(1)).default([]),
  destination_countries: z.array(z.string().min(1)).default([]),
});

// ── List products ─────────────────────────────────────────────────────────────
productsRouter.get('/', async (req, res) => {
  const { orgId } = req as unknown as AuthedRequest;
  const { data, error } = await db
    .from('monitored_products')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data: data ?? [] });
});

// ── Get product ───────────────────────────────────────────────────────────────
productsRouter.get('/:id', async (req, res) => {
  const { orgId } = req as unknown as AuthedRequest;
  const { data, error } = await db
    .from('monitored_products')
    .select('*')
    .eq('id', req.params.id)
    .eq('organization_id', orgId)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Product not found' });
  res.json(data);
});

// ── Create product ────────────────────────────────────────────────────────────
productsRouter.post('/', async (req, res) => {
  const { orgId, userId } = req as unknown as AuthedRequest;

  const parsed = ProductSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() });

  const { data, error } = await db
    .from('monitored_products')
    .insert({ ...parsed.data, organization_id: orgId, created_by: userId })
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// ── Update product ────────────────────────────────────────────────────────────
productsRouter.put('/:id', async (req, res) => {
  const { orgId } = req as unknown as AuthedRequest;

  const parsed = ProductSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() });

  const { data, error } = await db
    .from('monitored_products')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('organization_id', orgId)
    .select('*')
    .single();
  if (error || !data) return res.status(404).json({ error: 'Product not found' });
  res.json(data);
});

// ── Delete product ────────────────────────────────────────────────────────────
productsRouter.delete('/:id', async (req, res) => {
  const { orgId } = req as unknown as AuthedRequest;
  const { error } = await db
    .from('monitored_products')
    .delete()
    .eq('id', req.params.id)
    .eq('organization_id', orgId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── Recent alerts for a product ───────────────────────────────────────────────
productsRouter.get('/:id/alerts', async (req, res) => {
  const { orgId } = req as unknown as AuthedRequest;

  // Verify ownership
  const { data: product } = await db
    .from('monitored_products')
    .select('id')
    .eq('id', req.params.id)
    .eq('organization_id', orgId)
    .single();
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const { data, error } = await db
    .from('alert_matches')
    .select('alert:alerts(*, source_document:source_documents(id, title, source_name, published_at))')
    .eq('product_id', req.params.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data: (data ?? []).map((r: any) => r.alert) });
});
