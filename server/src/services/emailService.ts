import { Resend } from 'resend';
import { db } from '../db/client';
import type { Alert, EmailType } from '../types';

const resend = new Resend(process.env.RESEND_API_KEY);
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
