import { Resend } from 'resend';
import { db } from '../db/client';
import { htsCodesRelated } from './matchingEngine';
import type { Alert, EmailType, WatchlistEntry } from '../types';

// Lazy init — the server must start even when RESEND_API_KEY is not set
// (emails are simply skipped until the key is configured).
let resendClient: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY) && process.env.ENABLE_EMAIL_ALERTS === 'true';
}

// Send with one retry on transient failure.
async function sendWithRetry(opts: { to: string; subject: string; html: string }): Promise<void> {
  const resend = getResend();
  if (!resend) throw new Error('Resend not configured');
  let lastErr: any;
  for (let i = 0; i < 2; i++) {
    try {
      await resend.emails.send({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html });
      return;
    } catch (err) {
      lastErr = err;
      if (i === 0) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr;
}

// Confirmation email when a product is registered for monitoring.
export async function sendWatchlistConfirmation(entry: WatchlistEntry): Promise<void> {
  if (!emailEnabled()) {
    console.log(`[watchlist] (email disabled) would confirm monitoring to ${entry.email}`);
    return;
  }
  const subject = `ClearPort is now monitoring: ${entry.product_name}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;">
      <h2 style="color:#1a1a2e;">Monitoring is active ✅</h2>
      <p>ClearPort is now monitoring official U.S. trade sources for updates relevant to:</p>
      <p style="font-size:16px;"><strong>${escHtml(entry.product_name)}</strong>${entry.hts_code ? ` <span style="color:#666;">(HTS ${escHtml(entry.hts_code)})</span>` : ''}</p>
      <p>We'll email you only when a newly published official document genuinely matches this product or its HTS code. Each alert links to the official source.</p>
      ${DISCLAIMER_HTML}
    </div>`;
  try {
    await sendWithRetry({ to: entry.email, subject, html });
    console.log(`[watchlist] Sent monitoring confirmation to ${entry.email}`);
  } catch (err: any) {
    console.error(`[watchlist] Confirmation email failed for ${entry.email}:`, err?.message);
  }
}
const FROM = `${process.env.RESEND_FROM_NAME ?? 'ClearPort Alerts'} <${process.env.RESEND_FROM_EMAIL ?? 'alerts@clearport.io'}>`;
const APP_URL = process.env.APP_URL ?? 'https://app.clearport.io';

const DISCLAIMER_HTML = `
<p style="font-size:12px;color:#888;border-top:1px solid #eee;padding-top:12px;margin-top:24px;">
  ⚠️ ClearPort provides informational summaries only. This is not legal advice and does not guarantee
  import clearance or customs compliance. Always verify updates with your licensed customs broker.
</p>`;

// ── Instant alert (one email per alert) ────────────────────────────────────────
export async function sendInstantAlert(alert: Alert, recipientEmail: string, userId: string): Promise<void> {
  const subject = `[ClearPort] New Trade Alert: ${alert.title}`;
  const html = buildSingleAlertHtml(alert);

  await sendEmail({ to: recipientEmail, subject, html, alertIds: [alert.id], orgId: alert.organization_id, userId, emailType: 'instant' });
}

// ── Daily digest ───────────────────────────────────────────────────────────────
export async function sendDailyDigest(orgId: string): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await sendDigest(orgId, since, 'daily_digest', 'Daily');
}

// ── Weekly digest ──────────────────────────────────────────────────────────────
export async function sendWeeklyDigest(orgId: string): Promise<void> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await sendDigest(orgId, since, 'weekly_digest', 'Weekly');
}

async function sendDigest(
  orgId: string,
  since: string,
  emailType: EmailType,
  label: string,
): Promise<void> {
  const { data: alerts } = await db
    .from('alerts')
    .select('*')
    .eq('organization_id', orgId)
    .gte('created_at', since)
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20);

  if (!alerts?.length) return;

  const recipients = await getOrgRecipients(orgId, emailType);
  if (!recipients.length) return;

  const alertIds = (alerts as Alert[]).map((a) => a.id);
  const subject = `[ClearPort] ${label} Trade Update Digest — ${alerts.length} alert${alerts.length !== 1 ? 's' : ''}`;
  const html = buildDigestHtml(alerts as Alert[], label);

  for (const { email, userId } of recipients) {
    await sendEmail({ to: email, subject, html, alertIds, orgId, userId, emailType });
  }
}

async function getOrgRecipients(
  orgId: string,
  emailType: EmailType,
): Promise<Array<{ email: string; userId: string }>> {
  const freq = emailType === 'daily_digest' ? 'daily' : 'weekly';

  const { data: members } = await db
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId);

  if (!members?.length) return [];

  const userIds = members.map((m: any) => m.user_id);

  const { data: prefs } = await db
    .from('user_preferences')
    .select('user_id')
    .in('user_id', userIds)
    .eq('alert_frequency', freq)
    .eq('email_notifications', true);

  if (!prefs?.length) return [];

  const prefUserIds = (prefs as any[]).map((p) => p.user_id);

  // Fetch emails from auth.users via service role
  const { data: users } = await db.auth.admin.listUsers();
  return (users?.users ?? [])
    .filter((u) => prefUserIds.includes(u.id) && u.email)
    .map((u) => ({ email: u.email!, userId: u.id }));
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  alertIds: string[];
  orgId: string;
  userId: string;
  emailType: EmailType;
}): Promise<void> {
  if (process.env.ENABLE_EMAIL_ALERTS !== 'true') {
    console.log(`[email] Would send "${opts.subject}" to ${opts.to}`);
    return;
  }

  const resend = getResend();
  if (!resend) {
    console.log(`[email] RESEND_API_KEY not set — skipped "${opts.subject}" to ${opts.to}`);
    return;
  }

  try {
    await resend.emails.send({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html });

    await db.from('email_alert_logs').insert({
      organization_id: opts.orgId,
      user_id: opts.userId,
      alert_ids: opts.alertIds,
      email_type: opts.emailType,
      recipient_email: opts.to,
      subject: opts.subject,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });
  } catch (err: any) {
    await db.from('email_alert_logs').insert({
      organization_id: opts.orgId,
      user_id: opts.userId,
      alert_ids: opts.alertIds,
      email_type: opts.emailType,
      recipient_email: opts.to,
      subject: opts.subject,
      status: 'failed',
      error_message: err.message,
    });
  }
}

// ── Watchlist alerts (auth-free email monitoring) ──────────────────────────────

export async function sendWatchlistAlerts(): Promise<void> {
  // Find entries not alerted in the last 6 days (daily cron runs daily, 1-day buffer)
  const cutoff = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();

  const { data: entries } = await db
    .from('watchlist_entries')
    .select('*')
    .or(`last_alerted_at.is.null,last_alerted_at.lt.${cutoff}`)
    .limit(200);

  if (!entries?.length) return;

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  for (const entry of entries as WatchlistEntry[]) {
    try {
      await sendWatchlistEntryAlert(entry, since);
    } catch (err: any) {
      console.error(`[watchlist] Alert failed for ${entry.email}:`, err.message);
    }
  }
}

async function sendWatchlistEntryAlert(entry: WatchlistEntry, since: string): Promise<void> {
  // Alerts require an HTS code — match the same way the report does (no
  // origin-only matching, which produced irrelevant alerts).
  const digits = (entry.hts_code ?? '').replace(/[^0-9]/g, '');
  if (digits.length < 4) return;

  const { data: candidates } = await db
    .from('source_documents')
    .select('id, title, source_name, source_url, published_at, plain_english_summary, effective_date, affected_hts_codes')
    .eq('is_processed', true)
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(100);

  const matched = (candidates ?? []).filter(
    (d: any) => Array.isArray(d.affected_hts_codes) && d.affected_hts_codes.some((c: string) => htsCodesRelated(c, entry.hts_code!)),
  );
  if (!matched.length) return;

  // Per-event dedup: drop documents already logged for this entry.
  const { data: already } = await db
    .from('watchlist_alert_log')
    .select('source_document_id')
    .eq('watchlist_entry_id', entry.id);
  const sentIds = new Set((already ?? []).map((r: any) => r.source_document_id));
  const fresh = matched.filter((d: any) => !sentIds.has(d.id));
  if (!fresh.length) return;

  if (!emailEnabled()) {
    console.log(`[watchlist] (email disabled) would send ${fresh.length} matched update(s) to ${entry.email} for "${entry.product_name}"`);
    return; // do NOT mark as sent while disabled, so they go out once enabled
  }

  const count = fresh.length;
  const subject = `[ClearPort] ${count} official update${count !== 1 ? 's' : ''} may affect: ${entry.product_name}`;
  const html = buildWatchlistEmailHtml(entry, fresh as any[]);

  let status = 'sent';
  let error: string | null = null;
  try {
    await sendWithRetry({ to: entry.email, subject, html });
  } catch (err: any) {
    status = 'failed';
    error = err?.message ?? 'send failed';
    console.error(`[watchlist] Alert send failed for ${entry.email}:`, error);
  }

  // Log each document so it is never re-sent (and failures are visible).
  const rows = fresh.map((d: any) => ({
    watchlist_entry_id: entry.id, source_document_id: d.id, email: entry.email,
    kind: 'alert', status, error_message: error,
  }));
  await db.from('watchlist_alert_log').insert(rows).then(() => {}, () => {});
  if (status === 'sent') {
    await db.from('watchlist_entries').update({ last_alerted_at: new Date().toISOString() }).eq('id', entry.id);
  }
}

function buildWatchlistEmailHtml(entry: WatchlistEntry, docs: any[]): string {
  const rows = docs
    .map(
      (d) => `
    <div style="border-left:4px solid #4361ee;padding:12px 16px;margin-bottom:16px;background:#f8f9fa;border-radius:0 4px 4px 0;">
      <strong>${escHtml(d.title ?? 'Trade Update')}</strong>
      ${d.published_at ? `<span style="font-size:12px;color:#666;margin-left:8px;">${String(d.published_at).slice(0, 10)}</span>` : ''}
      ${d.source_name ? `<span style="font-size:12px;color:#888;margin-left:6px;">— ${escHtml(d.source_name)}</span>` : ''}
      ${d.plain_english_summary ? `<p style="margin:8px 0;font-size:14px;">${escHtml(String(d.plain_english_summary).slice(0, 400))}${String(d.plain_english_summary).length > 400 ? '…' : ''}</p>` : ''}
      ${
        Array.isArray(d.broker_questions) && d.broker_questions.length
          ? `<div style="font-size:13px;color:#444;margin-top:6px;"><strong>Ask your broker:</strong><ul style="margin:4px 0;">${(d.broker_questions as string[]).slice(0, 3).map((q) => `<li>${escHtml(q)}</li>`).join('')}</ul></div>`
          : ''
      }
      ${d.source_url ? `<a href="${escHtml(d.source_url)}" style="font-size:13px;color:#4361ee;">View official source →</a>` : ''}
    </div>`,
    )
    .join('');

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
<h2 style="color:#1a1a2e;">Trade updates that may affect your product</h2>
<p style="color:#555;">We found <strong>${docs.length} update${docs.length !== 1 ? 's' : ''}</strong> from official U.S. trade sources that may be relevant to <strong>${escHtml(entry.product_name)}</strong>.</p>
<p style="font-size:13px;color:#888;">
  Monitoring: ${entry.hts_code ? `HTS ${escHtml(entry.hts_code)} · ` : ''}${escHtml(entry.origin_country)} → ${escHtml(entry.destination_country)}
</p>
<hr style="border:none;border-top:1px solid #eee;margin:16px 0;"/>
${rows}
<p style="margin-top:24px;">
  <a href="${APP_URL}" style="background:#4361ee;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;font-size:14px;">Open ClearPort</a>
</p>
${DISCLAIMER_HTML}</body></html>`;
}

// ── HTML builders ──────────────────────────────────────────────────────────────
function buildSingleAlertHtml(alert: Alert): string {
  const severityColor: Record<string, string> = {
    critical: '#d00000', high: '#e85d04', medium: '#f48c06', low: '#4361ee',
  };
  const color = severityColor[alert.severity] ?? '#4361ee';

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
<h2 style="color:${color};">${escHtml(alert.title)}</h2>
<p><strong>Severity:</strong> <span style="color:${color};text-transform:uppercase;">${alert.severity}</span></p>
<p><strong>Relevance:</strong> ${escHtml(alert.relevance_reason)}</p>
<hr/>
<h3>Summary</h3>
<p>${escHtml(alert.summary)}</p>
${alert.broker_questions?.length ? `
<h3>Questions for your Customs Broker</h3>
<ul>${alert.broker_questions.map((q) => `<li>${escHtml(q)}</li>`).join('')}</ul>` : ''}
${alert.official_source_url ? `<p><a href="${alert.official_source_url}">View Official Source →</a></p>` : ''}
<p><a href="${APP_URL}/alerts/${alert.id}" style="background:#4361ee;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;">View in ClearPort</a></p>
${DISCLAIMER_HTML}</body></html>`;
}

function buildDigestHtml(alerts: Alert[], label: string): string {
  const rows = alerts.map((a) => `
    <div style="border-left:4px solid #4361ee;padding:12px 16px;margin-bottom:16px;background:#f8f9fa;border-radius:0 4px 4px 0;">
      <strong>${escHtml(a.title)}</strong>
      <span style="font-size:12px;color:#666;margin-left:8px;text-transform:uppercase;">${a.severity}</span>
      <p style="margin:8px 0;font-size:14px;">${escHtml(a.summary.slice(0, 300))}${a.summary.length > 300 ? '…' : ''}</p>
      <a href="${APP_URL}/alerts/${a.id}" style="font-size:13px;color:#4361ee;">View alert →</a>
    </div>`).join('');

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
<h2>${label} Trade Update Digest</h2>
<p>${alerts.length} new alert${alerts.length !== 1 ? 's' : ''} relevant to your monitored products.</p>
<hr/>
${rows}
<p><a href="${APP_URL}/alerts" style="background:#4361ee;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none;">View all alerts in ClearPort</a></p>
${DISCLAIMER_HTML}</body></html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
