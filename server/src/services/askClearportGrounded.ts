/**
 * Product-grounded ClearPort Assistant.
 *
 * Answers a customer's question about THEIR submitted product using ONLY:
 *  - the stored product details + attributes,
 *  - the supported findings from the latest saved scan (verified_applicable +
 *    official_unconfirmed — never no_verified_source), with their citations,
 *  - official documents matched to the product's HTS code.
 *
 * Anthropic may explain/organize this evidence but may never supply a legal,
 * tariff, or compliance fact from its own memory. If the evidence is
 * insufficient, the assistant must say so with the exact phrase.
 */

import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db/client';
import { htsCodesRelated } from './matchingEngine';
import type { WatchlistEntry, ProductRiskScan, RiskCategory } from '../types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const INSUFFICIENT = 'ClearPort could not verify this from its current official sources.';

const SYSTEM = `You are the ClearPort Assistant. You answer an importer's questions about THEIR specific product.

ABSOLUTE RULES:
- Use ONLY the EVIDENCE provided in the user message (product details, verified findings with citations, and matched official documents).
- You may NOT use any tariff rate, rule, citation, date, test, certificate, or legal requirement that is not present in the EVIDENCE. Your own training knowledge is NOT an acceptable source.
- If the EVIDENCE does not contain enough to answer, reply EXACTLY: "${INSUFFICIENT}" and then say which product detail (e.g. exact HTS classification, a missing attribute) or which official source would be needed.
- When you state a sourced fact, cite it inline as (Agency — Title, citation) and rely on the links provided.
- Do NOT issue mandatory instructions that are not directly supported by a finding. You may suggest confirming with a licensed customs broker.
- Be concise and practical. Plain English.`;

export interface GroundedAnswer {
  answer: string;
  grounded: boolean;
  sources: { agency: string; title: string; citation?: string; url: string }[];
}

export async function askAboutProduct(entryId: string, question: string): Promise<GroundedAnswer | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const { data: entry } = await db
    .from('watchlist_entries')
    .select('*')
    .eq('id', entryId)
    .maybeSingle();
  if (!entry) return null;
  const e = entry as WatchlistEntry;

  const { data: scanRow } = await db
    .from('product_risk_scans')
    .select('*')
    .eq('watchlist_entry_id', entryId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const scan = scanRow as ProductRiskScan | null;

  const supported = (scan?.risk_categories ?? []).filter(
    (c) => c.verification_status === 'verified_applicable' || c.verification_status === 'official_unconfirmed',
  );

  const matchedDocs = await getMatchedDocs(e.hts_code);

  // Collect citations to return to the UI.
  const sources: GroundedAnswer['sources'] = [];
  for (const c of supported) {
    if (c.source?.url) {
      sources.push({ agency: c.source.agency, title: c.source.title, citation: c.source.cfr_citation, url: c.source.url });
    }
  }
  for (const d of matchedDocs) {
    sources.push({ agency: d.source_name, title: d.title, url: d.source_url });
  }

  const evidence = buildEvidence(e, supported, matchedDocs);
  const zh = e.language === 'zh';
  const langDirective = zh
    ? `\n\nRespond in Simplified Chinese (简体中文) using professional import/compliance terminology. Keep all agency names, document titles, CFR citations, HTS codes and URLs in their original English/numeric form — do not translate or alter them. If you cannot answer from the EVIDENCE, reply exactly: "ClearPort 无法依据现有官方来源核实这一点。" and state which product detail or official source is missing.`
    : '';

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1100,
    system: [{ type: 'text', text: SYSTEM + langDirective, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: `EVIDENCE (the only allowed basis for any factual claim):\n\n${evidence}\n\n---\n\nCustomer question: ${question}`,
      },
    ],
  });

  const answer = message.content[0].type === 'text' ? message.content[0].text.trim() : INSUFFICIENT;
  const grounded = !answer.startsWith(INSUFFICIENT) && !answer.startsWith('ClearPort 无法依据');
  // De-dup sources by url.
  const seen = new Set<string>();
  const uniqueSources = sources.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)));
  return { answer, grounded, sources: grounded ? uniqueSources : [] };
}

async function getMatchedDocs(htsCode?: string): Promise<
  { title: string; source_name: string; source_url: string; published_at: string | null; plain_english_summary: string | null; effective_date: string | null }[]
> {
  const digits = (htsCode ?? '').replace(/[^0-9]/g, '');
  if (digits.length < 4) return [];
  try {
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await db
      .from('source_documents')
      .select('title, source_name, source_url, published_at, plain_english_summary, effective_date, affected_hts_codes')
      .eq('is_processed', true)
      .gte('published_at', since)
      .order('published_at', { ascending: false })
      .limit(100);
    return (data ?? [])
      .filter((d: any) => Array.isArray(d.affected_hts_codes) && d.affected_hts_codes.some((c: string) => htsCodesRelated(c, htsCode!)))
      .slice(0, 5)
      .map(({ affected_hts_codes, ...rest }: any) => rest);
  } catch {
    return [];
  }
}

function buildEvidence(e: WatchlistEntry, supported: RiskCategory[], docs: any[]): string {
  const attrs = Object.entries({
    children: e.is_children, battery: e.has_battery, electronic: e.is_electronic, textile: e.is_textile,
    cosmetic: e.is_cosmetic, food_contact: e.is_food_contact, supplement: e.is_supplement,
  }).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none provided';

  const product = `PRODUCT:\n- Name: ${e.product_name}\n- Description: ${e.product_description ?? 'not provided'}\n- HTS: ${e.hts_code ?? 'not provided'}\n- Origin: ${e.origin_country} -> ${e.destination_country}\n- Attributes: ${attrs}`;

  const findings = supported.length
    ? supported.map((c) =>
        `- [${c.verification_status}] ${c.category} (risk ${c.level})\n    finding: ${c.explanation}\n    action: ${c.action}` +
        (c.financial_impact ? `\n    financial: ${c.financial_impact}` : '') +
        (c.source ? `\n    source: ${c.source.agency} — ${c.source.title}${c.source.cfr_citation ? ` (${c.source.cfr_citation})` : ''} ${c.source.url}` : ''),
      ).join('\n')
    : '(no verified or official-unconfirmed findings)';

  const recent = docs.length
    ? docs.map((d) => `- ${d.title} (${d.source_name}, ${d.published_at?.slice(0, 10) ?? 'n/a'}): ${(d.plain_english_summary ?? '').slice(0, 250)} ${d.source_url}`).join('\n')
    : '(no recent official documents matched this HTS code)';

  return `${product}\n\nSUPPORTED FINDINGS (verified / official-unconfirmed only):\n${findings}\n\nRECENT MATCHED OFFICIAL DOCUMENTS:\n${recent}`;
}
