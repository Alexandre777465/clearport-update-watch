import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client';
import type { AuthedRequest } from '../middleware/auth';

export const notificationsRouter = Router();

const PreferencesSchema = z.object({
  alert_frequency: z.enum(['instant', 'daily', 'weekly']).optional(),
  email_notifications: z.boolean().optional(),
});

// ── Get preferences ───────────────────────────────────────────────────────────
notificationsRouter.get('/preferences', async (req, res) => {
  const { userId } = req as AuthedRequest;

  const { data, error } = await db
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });

  // Return defaults if not yet set
  res.json(data ?? { user_id: userId, alert_frequency: 'daily', email_notifications: true });
});

// ── Upsert preferences ────────────────────────────────────────────────────────
notificationsRouter.put('/preferences', async (req, res) => {
  const { userId } = req as AuthedRequest;

  const parsed = PreferencesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() });
  if (!Object.keys(parsed.data).length) return res.status(400).json({ error: 'No fields to update' });

  const { data, error } = await db
    .from('user_preferences')
    .upsert(
      { user_id: userId, ...parsed.data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Email history for the user ────────────────────────────────────────────────
notificationsRouter.get('/email-history', async (req, res) => {
  const { userId } = req as AuthedRequest;
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));

  const { data, error } = await db
    .from('email_alert_logs')
    .select('id, email_type, subject, status, sent_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data: data ?? [] });
});
