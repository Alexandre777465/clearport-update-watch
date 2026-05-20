import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db/client';
import type { MonitoredProduct, Alert, SourceDocument } from '../types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Phrases that signal the user wants a binding legal determination
const LEGAL_TRIGGERS = [
  'legal advice', 'legally required', 'guaranteed', 'guarantee',
  'compliance determination', 'will i be fined', 'can i import',
  'is it legal', 'customs ruling', 'binding ruling', 'final determination',
  'am i allowed', 'am i compliant', 'is this compliant',
];

const SYSTEM_TEXT = `You are the ClearPort trade information assistant. You help importers understand
how recent U.S. trade rule updates relate to their monitored products.

STRICT RULES:
1. Only answer based on the provided context (user's products, source documents, alerts).
2. Do NOT provide legal advice, final customs determinations, or guarantee import clearance.
3. If the question asks for a final legal determination or binding ruling, use the exact deflection message.
4. Keep answers factual, grounded in the context, and cite source document titles where possible.
5. Always remind the user to verify details with their licensed customs broker.`;

const DEFLECTION =
  'ClearPort cannot provide final legal interpretation. This update may be relevant based on your ' +
  'monitored products and should be verified with your customs broker.';

export async function askClearport(
  query: string,
  orgId: string,
  userId: string,
): Promise<{ response: string; sourceDocumentIds: string[]; alertIds: string[]; isLegalDeflection: boolean }> {
  const queryLower = query.toLowerCase();
  const isLegalQuery = LEGAL_TRIGGERS.some((t) => queryLower.includes(t));

  if (isLegalQuery) {
    await saveQuery(query, DEFLECTION, orgId, userId, [], [], true);
    return { response: DEFLECTION, sourceDocumentIds: [], alertIds: [], isLegalDeflection: true };
  }

  const [products, recentAlerts, recentDocs] = await Promise.all([
    fetchProducts(orgId),
    fetchRecentAlerts(orgId),
    fetchRecentDocuments(orgId),
  ]);

  const context = buildContext(products, recentAlerts, recentDocs);
  const sourceDocIds = recentDocs.map((d) => d.id);
  const alertIds     = recentAlerts.map((a) => a.id);

  // Cache the static system prompt; the per-query context goes in the user message
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: [
      {
        type: 'text',
        text: SYSTEM_TEXT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Here is the context for this importer:\n\n${context}\n\n---\n\nUser question: ${query}`,
      },
    ],
  });

  const content = message.content[0];
  const response = content.type === 'text' ? content.text : DEFLECTION;

  await saveQuery(query, response, orgId, userId, sourceDocIds, alertIds, false);
  return { response, sourceDocumentIds: sourceDocIds, alertIds, isLegalDeflection: false };
}

async function fetchProducts(orgId: string): Promise<MonitoredProduct[]> {
  const { data } = await db
    .from('monitored_products')
    .select('*')
    .eq('organization_id', orgId)
    .limit(20);
  return (data as MonitoredProduct[]) ?? [];
}

async function fetchRecentAlerts(orgId: string): Promise<Alert[]> {
  const { data } = await db
    .from('alerts')
    .select('id, title, summary, severity, match_type, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(10);
  return (data as Alert[]) ?? [];
}

async function fetchRecentDocuments(orgId: string): Promise<SourceDocument[]> {
  // Fetch docs that are relevant to this org (either they generated an alert,
  // or they're recent global documents)
  const { data: alertDocs } = await db
    .from('alerts')
    .select('source_document_id')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(10);

  const alertDocIds = (alertDocs ?? []).map((r: any) => r.source_document_id);

  // Also grab recent globally processed documents
  const { data: recentDocs } = await db
    .from('source_documents')
    .select('id, title, plain_english_summary, source_name, published_at, affected_hts_codes, affected_categories, affected_origin_countries')
    .eq('is_processed', true)
    .order('published_at', { ascending: false })
    .limit(15);

  const allDocs = (recentDocs as SourceDocument[]) ?? [];

  // Put alert-related docs first
  allDocs.sort((a, b) => (alertDocIds.includes(a.id) ? -1 : alertDocIds.includes(b.id) ? 1 : 0));

  return allDocs.slice(0, 15);
}

function buildContext(products: MonitoredProduct[], alerts: Alert[], docs: SourceDocument[]): string {
  const productStr = products.length
    ? products.map((p) =>
        `- ${p.name}: HTS [${p.hts_codes.join(', ') || 'none'}], origin [${p.origin_countries.join(', ') || 'any'}], categories [${p.categories.join(', ') || 'unspecified'}]`
      ).join('\n')
    : '(No products configured)';

  const alertStr = alerts.length
    ? alerts.map((a) =>
        `- [${a.severity?.toUpperCase()}] ${a.title} (${a.match_type}): ${(a.summary ?? '').slice(0, 200)}`
      ).join('\n')
    : '(No recent alerts)';

  const docStr = docs.length
    ? docs.map((d) =>
        `- "${d.title}" (${d.source_name}, ${d.published_at?.slice(0, 10) ?? 'unknown'}): ${(d.plain_english_summary ?? 'Not yet summarized').slice(0, 150)}`
      ).join('\n')
    : '(No recent documents)';

  return `MONITORED PRODUCTS:\n${productStr}\n\nRECENT ALERTS:\n${alertStr}\n\nRECENT SOURCE DOCUMENTS:\n${docStr}`;
}

async function saveQuery(
  query: string,
  response: string,
  orgId: string,
  userId: string,
  sourceDocumentIds: string[],
  alertIds: string[],
  isLegalDeflection: boolean,
): Promise<void> {
  await db.from('assistant_queries').insert({
    organization_id: orgId,
    user_id: userId,
    query,
    response,
    source_document_ids: sourceDocumentIds,
    alert_ids: alertIds,
    is_legal_deflection: isLegalDeflection,
  });
}
