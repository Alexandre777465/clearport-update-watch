import cron from 'node-cron';
import { db } from '../db/client';
import { checkFeed } from '../services/feedFetcher';
import { processUnprocessedDocuments } from '../services/summarizer';
import { generateAlertsForDocument } from '../services/alertGenerator';
import { sendDailyDigest, sendWeeklyDigest, sendInstantAlert, sendWatchlistAlerts } from '../services/emailService';
import type { SourceFeed, Alert } from '../types';

export function startScheduler(): void {
  // ── Every 30 min: RSS and CSMS feeds only ─────────────────────────────────
  cron.schedule('*/30 * * * *', async () => {
    console.log('[cron] 30-min feed check');
    await runFeedChecks(30);
  });

  // ── Every 6 hours: official pages and Federal Register API feeds ───────────
  cron.schedule('0 */6 * * *', async () => {
    console.log('[cron] 6-hour feed check');
    await runFeedChecks(360);
  });

  // ── Daily at 02:00 UTC: HTS dataset sources ───────────────────────────────
  cron.schedule('0 2 * * *', async () => {
    console.log('[cron] Daily HTS feed check');
    await runFeedChecks(1440);
  });

  // ── Every 5 min: LLM summarization + alert dispatch ───────────────────────
  cron.schedule('*/5 * * * *', async () => {
    await processUnprocessedDocuments(5);
    await dispatchAlerts();
  });

  // ── Daily at 08:00 UTC: daily digest emails + watchlist alerts ───────────
  cron.schedule('0 8 * * *', async () => {
    console.log('[cron] Daily digest + watchlist emails');
    await sendAllDigests('daily');
    await sendWatchlistAlerts();
  });

  // ── Monday at 08:00 UTC: weekly digest emails ─────────────────────────────
  cron.schedule('0 8 * * 1', async () => {
    console.log('[cron] Weekly digest emails');
    await sendAllDigests('weekly');
  });

  console.log('[cron] Scheduler started — 6 jobs active');
}

// Use exact interval match so each feed only runs in one cron bucket
async function runFeedChecks(intervalMinutes: number): Promise<void> {
  const { data: feeds } = await db
    .from('source_feeds')
    .select('*')
    .eq('is_active', true)
    .eq('check_interval_minutes', intervalMinutes);

  if (!feeds?.length) return;

  // Parallel in batches of 3 to avoid overwhelming sources
  for (const chunk of chunkArray(feeds as SourceFeed[], 3)) {
    const results = await Promise.allSettled(chunk.map((feed) => checkFeed(feed)));
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[cron] Feed check failed for ${chunk[i].name}:`, r.reason?.message);
      }
    });
  }
}

async function dispatchAlerts(): Promise<void> {
  // Find processed docs that have not yet generated any alerts
  const { data: docs } = await db
    .from('source_documents')
    .select('id')
    .eq('is_processed', true)
    .is('processing_error', null)
    .not('id', 'in', '(SELECT DISTINCT source_document_id FROM alerts)')
    .order('created_at', { ascending: true })
    .limit(20);

  if (!docs?.length) return;

  for (const doc of docs) {
    try {
      await generateAlertsForDocument(doc.id);
    } catch (err: any) {
      console.error(`[cron] Alert generation failed for doc ${doc.id}:`, err.message);
    }
  }

  await sendInstantAlerts();
}

async function sendInstantAlerts(): Promise<void> {
  // Look for high/critical alerts created in the last 10 minutes that haven't been emailed
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: alerts } = await db
    .from('alerts')
    .select('*')
    .gte('created_at', cutoff)
    .in('severity', ['critical', 'high'])
    .limit(50);

  if (!alerts?.length) return;

  for (const alert of alerts as Alert[]) {
    const { data: members } = await db
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', alert.organization_id);

    if (!members?.length) continue;

    const userIds = (members as any[]).map((m) => m.user_id);

    const { data: prefs } = await db
      .from('user_preferences')
      .select('user_id')
      .in('user_id', userIds)
      .eq('alert_frequency', 'instant')
      .eq('email_notifications', true);

    if (!prefs?.length) continue;

    const instantUserIds = new Set((prefs as any[]).map((p) => p.user_id));

    const { data: users } = await db.auth.admin.listUsers();
    for (const user of users?.users ?? []) {
      if (!user.email || !instantUserIds.has(user.id)) continue;

      // Deduplicate: skip if already sent
      const { data: existing } = await db
        .from('email_alert_logs')
        .select('id')
        .contains('alert_ids', [alert.id])
        .eq('user_id', user.id)
        .eq('email_type', 'instant')
        .maybeSingle();

      if (!existing) {
        await sendInstantAlert(alert, user.email, user.id);
      }
    }
  }
}

async function sendAllDigests(frequency: 'daily' | 'weekly'): Promise<void> {
  const { data: orgs } = await db.from('organizations').select('id');
  if (!orgs?.length) return;

  for (const org of orgs) {
    try {
      if (frequency === 'daily') await sendDailyDigest(org.id);
      else await sendWeeklyDigest(org.id);
    } catch (err: any) {
      console.error(`[cron] Digest failed for org ${org.id}:`, err.message);
    }
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
