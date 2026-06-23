/**
 * Generates a structured import risk scan for a watchlist entry using Claude.
 *
 * Phase 2: the scan is grounded in official documents. Relevant source
 * documents (matched by HTS) are passed in and Claude may only assert a
 * CURRENT tariff rate, rule change, publication date or effective date if it
 * is supported by one of those documents — in which case it must cite it.
 * Standing requirements that are not tied to a supplied document are returned
 * as unverified "general guidance". Dollar impacts are computed in code from a
 * verified rate, never invented by the model.
 *
 * Returns null if ANTHROPIC_API_KEY is not set — the frontend falls back to
 * a client-side mock scan in that case.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  WatchlistEntry, ProductRiskScan, RiskCategory, RiskLevel,
  VerificationStatus, DocumentChecklistItem,
} from '../types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a practical import compliance advisor helping U.S. importers understand the risks \
for their specific product before they import.

Write everything in plain English for a small business owner or e-commerce seller — not a trade lawyer. \
Be specific about what THEY need to do, not general statements about "consulting professionals." \
Never guarantee clearance or compliance.

SOURCE-GROUNDING RULES (critical):
- You are given a list of RELEVANT OFFICIAL DOCUMENTS. They are the ONLY acceptable basis for any \
statement about a CURRENT tariff rate, a rule change, a publication date, or an effective date.
- Each risk category MUST carry a "verification_status" of exactly one of:
    "official_unconfirmed" — a real official document (from the supplied list) backs this requirement, \
but you cannot confirm from the given product facts that it definitely applies. Fill "source" and \
"applicability_conditions" (the exact product facts that WOULD make it apply).
    "no_verified_source" — no supplied document backs this. Do NOT state a current rate/rule/date. \
Leave "source" null. Use this for standing requirements you cannot cite from the supplied documents.
- Do NOT output "verified_applicable" yourself — that status is assigned only by ClearPort's verified \
baseline system, never by you.
- "verified_rate_pct" may be set ONLY if a supplied document explicitly states the numeric rate.
- NEVER invent a rate, citation, date, document title, agency, or applicability condition. When unsure, \
use "no_verified_source".
- Always name the correct responsible authority in source.agency (e.g. lithium battery TRANSPORT rules \
are DOT/PHMSA + UN, not CPSC; children's product safety is CPSC; food contact is FDA; RF devices FCC; \
fuel/emissions EPA). Do not force a requirement under the wrong agency.
- Do not compute dollar amounts. Provide only "verified_rate_pct" when supported.

Respond ONLY with valid JSON — no markdown, no code fences, no explanation outside the JSON object.`;

type ScanResult = Omit<ProductRiskScan, 'id' | 'watchlist_entry_id' | 'created_at'>;

export interface ScanDocument {
  id: string;
  title: string;
  source_name: string;
  source_url: string;
  published_at: string | null;
  plain_english_summary: string | null;
  effective_date?: string | null;
}

export interface ScanOptions {
  documents?: ScanDocument[];
  estimatedValueUsd?: number;
  // Deterministic, source-backed categories computed in code (Stage 3). These
  // are authoritative: they are merged in and take precedence over any model
  // category with the same name, and only THEY may be "verified_applicable".
  baselineCategories?: RiskCategory[];
}

export async function generateRiskScan(
  entry: WatchlistEntry,
  opts: ScanOptions = {},
): Promise<ScanResult | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const isChina = entry.origin_country.toLowerCase().includes('china');
  const documents = opts.documents ?? [];

  const documentBlock = documents.length
    ? documents
        .map(
          (d, i) =>
            `[DOC ${i + 1}]\n  source_name: ${d.source_name}\n  title: ${d.title}\n  published_at: ${
              d.published_at ?? 'unknown'
            }\n  effective_date: ${d.effective_date ?? 'not stated'}\n  url: ${
              d.source_url
            }\n  summary: ${(d.plain_english_summary ?? '').slice(0, 600)}`,
        )
        .join('\n\n')
    : '(none — no official documents currently match this product by HTS code)';

  const userPrompt = `Generate an import risk assessment for this product and return ONLY valid JSON.

PRODUCT:
- Name: ${entry.product_name}
- Description: ${entry.product_description || 'Not provided'}
- HTS/HS Code: ${entry.hts_code || 'Not provided'}
- Origin: ${entry.origin_country}
- Destination: ${entry.destination_country}

PRODUCT CHARACTERISTICS:
- For children under 12: ${entry.is_children ? 'YES' : 'No'}
- Contains battery: ${entry.has_battery ? 'YES' : 'No'}
- Electronic product: ${entry.is_electronic ? 'YES' : 'No'}
- Textile/apparel: ${entry.is_textile ? 'YES' : 'No'}
- Cosmetic/beauty/personal care: ${entry.is_cosmetic ? 'YES' : 'No'}
- Touches food: ${entry.is_food_contact ? 'YES' : 'No'}
- Supplement/food/medical-adjacent: ${entry.is_supplement ? 'YES' : 'No'}
- Sold on Amazon: ${entry.sold_on_amazon ? 'YES' : 'No'}
- Sold on TikTok Shop: ${entry.sold_on_tiktok ? 'YES' : 'No'}
- Also sold in EU: ${entry.sold_in_eu ? 'YES' : 'No'}

RELEVANT OFFICIAL DOCUMENTS (the ONLY basis for current rate/rule/date claims):
${documentBlock}

Return this exact JSON (no markdown, no code fences):
{
  "overall_risk": "Low|Medium|High|Critical",
  "overall_summary": "One plain-English sentence summarizing the main risk",
  "risk_categories": [
    {
      "category": "Category name",
      "level": "Low|Medium|High|Critical|N/A",
      "explanation": "2-3 sentences in plain English: how this affects THIS product",
      "action": "Specific action this importer should take now",
      "verification_status": "official_unconfirmed | no_verified_source",
      "applicability_conditions": "Exact product facts that make this rule apply (e.g. 'contains a lithium-ion cell shipped by air')",
      "what_changed": "Only when a document backs it: what that document changed",
      "verified_rate_pct": null,
      "source": null
    }
  ],
  "document_checklist": [
    { "document": "Document name", "required": true, "reason": "One sentence on why it is needed" }
  ],
  "broker_questions": ["question 1", "question 2", "question 3", "question 4", "question 5"],
  "supplier_questions": ["question 1", "question 2", "question 3", "question 4"],
  "next_actions": ["action 1", "action 2", "action 3", "action 4"],
  "readiness_score": 0,
  "confidence_level": "Low|Medium|High"
}

For any risk_category that IS supported by a supplied document, set:
  "verification_status": "official_unconfirmed",
  "what_changed": "<what that document changed>",
  "verified_rate_pct": <number or null — only if the doc states a rate>,
  "source": { "agency": "<responsible authority, e.g. USTR/CBP/USITC>", "name": "<source_name>", "title": "<title>", "cfr_citation": "<CFR/statute if present, else omit>", "published_at": "<published_at>", "effective_date": "<effective_date or omit>", "url": "<url>", "why_relevant": "<one sentence>" }
For every other category set "verification_status": "no_verified_source", "source": null, "verified_rate_pct": null.

RISK CATEGORIES to include (only include what is relevant — skip truly inapplicable ones):
1. Tariff Risk — always include
2. HTS Classification Risk — always include
3. Section 301 China Tariff — ${isChina ? 'MUST include' : 'skip (not China origin)'}
4. AD/CVD Risk — include if product type commonly faces antidumping orders
5. Customs Documentation — always include
6. Product Safety / CPSC — include for consumer products
7. FDA Requirements — ${entry.is_food_contact || entry.is_cosmetic || entry.is_supplement ? 'MUST include' : 'include only if clearly relevant'}
8. Battery / UN 38.3 — ${entry.has_battery ? 'MUST include' : 'skip'}
9. Children\'s Product / CPSIA — ${entry.is_children ? 'MUST include, set level to Critical' : 'skip'}
10. Textile / FTC Labeling — ${entry.is_textile ? 'MUST include' : 'skip'}
11. Marketplace Requirements — ${entry.sold_on_amazon || entry.sold_on_tiktok ? 'MUST include' : 'skip'}
12. EU Requirements — ${entry.sold_in_eu ? 'MUST include' : 'skip'}

DOCUMENT CHECKLIST must always include: Commercial Invoice, Packing List, Country of Origin Declaration.
Add specific docs based on product type: UN 38.3 for battery, CPSIA/CPC for children, food-contact declaration for food-contact, FCC for electronics, fiber content cert for textiles.

READINESS SCORE calculation:
- Start at 40
- +15 if HTS code was provided
- +10 if product description was provided
- +5 if more than 3 product attributes answered YES
- -20 if children's product
- -15 if battery product
- -15 if food/supplement
- -10 if cosmetic
- Never go below 10, never above 90 for a new product

CONFIDENCE LEVEL: "High" if HTS code provided and product is straightforward, "Medium" if HTS missing or product has complex characteristics, "Low" if very limited information.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
    // Strip any accidental markdown code fences
    const json = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(json) as ScanResult;

    const sanitized = sanitizeAndPrice(parsed, documents, opts.estimatedValueUsd);
    return finalizeScan(sanitized, opts.baselineCategories ?? []);
  } catch (err: any) {
    console.error('[riskScanner] Failed to generate scan:', err.message);
    return null;
  }
}

// Defensive pass: enforce the grounding contract in code so a model slip can't
// produce an uncited "verified" claim, and compute dollar impact ONLY from a
// verified rate. Never fabricates a figure.
function sanitizeAndPrice(
  scan: ScanResult,
  documents: ScanDocument[],
  estimatedValueUsd?: number,
): ScanResult {
  const allowedUrls = new Set(documents.map((d) => d.source_url));
  const value = typeof estimatedValueUsd === 'number' && estimatedValueUsd > 0 ? estimatedValueUsd : null;

  const categories: RiskCategory[] = (scan.risk_categories ?? []).map((cat) => {
    const c: RiskCategory = { ...cat };

    // Enforce the three-status contract in code. The model may only propose
    // "official_unconfirmed" (and must cite a supplied document) or
    // "no_verified_source". "verified_applicable" is reserved for the baseline
    // system (Stage 3) and is never accepted from the model here.
    const hasValidSource =
      !!c.source && typeof c.source.url === 'string' && allowedUrls.has(c.source.url);

    if (c.verification_status === 'official_unconfirmed' && hasValidSource) {
      // Keep as official-but-unconfirmed; compute $ only from a verified rate.
      const pct = typeof c.verified_rate_pct === 'number' ? c.verified_rate_pct : null;
      if (pct != null && value != null) {
        const amount = Math.round((value * pct) / 100);
        c.financial_impact = `~$${amount.toLocaleString('en-US')} on a $${value.toLocaleString(
          'en-US',
        )} shipment (${pct}% per ${c.source!.name})`;
      } else if (pct != null) {
        c.financial_impact = `~${pct}% of customs value (per ${c.source!.name}) — add an estimated shipment value to see the dollar impact`;
      } else {
        c.financial_impact = undefined;
      }
      return c;
    }

    // Everything else collapses to "no verified source" — no citation, no rate,
    // no dollar figure, no unsupported "what changed".
    c.verification_status = 'no_verified_source';
    c.source = undefined;
    c.what_changed = undefined;
    c.verified_rate_pct = null;
    c.financial_impact = undefined;
    return c;
  });

  return { ...scan, risk_categories: categories };
}

// ── Topic mapping for semantic de-duplication ─────────────────────────────────
// Maps a category name to the set of compliance topics it covers, so a verified
// deterministic baseline can replace any overlapping model category.
function topicsOf(name: string): Set<string> {
  const n = name.toLowerCase();
  const t = new Set<string>();
  if (/mfn|general rate|customs duty|tariff/.test(n)) t.add('tariff');
  if (/hts classification|classification risk/.test(n)) t.add('hts_class');
  if (/section 301|\b301\b/.test(n)) t.add('s301');
  if (/ad\/?cvd|antidumping|countervailing/.test(n)) t.add('adcvd');
  if (/section 232|steel|aluminum/.test(n)) t.add('s232');
  if (/cpsia|children|cpsc/.test(n)) t.add('children');
  if (/food.?contact/.test(n)) t.add('fda_food');
  if (/cosmetic/.test(n)) t.add('fda_cosmetic');
  if (/supplement|dietary/.test(n)) t.add('fda_supplement');
  if (/\bfda\b/.test(n) && t.size === 0) { t.add('fda_food'); t.add('fda_cosmetic'); t.add('fda_supplement'); }
  if (/fcc|radio|part 15|emission/.test(n)) t.add('fcc');
  if (/battery|un ?38\.3|lithium|phmsa/.test(n)) t.add('battery');
  if (/epa|tsca|fifra/.test(n)) t.add('epa');
  if (/textile|apparel|fiber|ftc label/.test(n)) t.add('textile');
  if (/customs documentation|^documentation/.test(n)) t.add('docs');
  if (/marketplace|amazon|tiktok/.test(n)) t.add('marketplace');
  return t;
}

// Universally-required CBP entry documents (required for ALL imports).
const ALWAYS_REQUIRED_DOCS = /commercial invoice|packing list|country of origin|bill of lading|entry summary/i;

// Final report integrity pass (Stage 1):
//  - baselines are authoritative and replace overlapping model categories;
//  - model categories left unsourced are neutralized to make NO claim and have
//    NO mandatory action — they only state what could not be verified;
//  - marketplace cards with no official source are hidden entirely;
//  - overall risk is recomputed from verified + official-unconfirmed only;
//  - the document checklist is gated so "required" needs a verified rule.
function finalizeScan(scan: ScanResult, baselines: RiskCategory[]): ScanResult {
  const baselineTopics = new Set<string>();
  baselines.forEach((b) => topicsOf(b.category).forEach((t) => baselineTopics.add(t)));

  // Drop model categories whose topic a baseline already covers.
  const modelExtras = (scan.risk_categories ?? []).filter((c) => {
    const ts = [...topicsOf(c.category)];
    if (ts.some((t) => baselineTopics.has(t))) return false;
    // Hide marketplace cards entirely — no official policy source is stored.
    if (ts.includes('marketplace')) return false;
    return true;
  });

  // Neutralize any remaining unsourced model category: no claim, no action.
  const neutralized = modelExtras.map((c) => {
    if (c.verification_status === 'official_unconfirmed' && c.source) return c; // sourced, keep
    return {
      category: c.category,
      level: 'N/A' as RiskLevel,
      explanation: `ClearPort has no official source on file to confirm whether ${c.category.toLowerCase()} applies to this product. It is listed only so you know it was considered — no requirement, tariff, test, or obligation is being asserted.`,
      action: '',
      verification_status: 'no_verified_source' as VerificationStatus,
      missing_info:
        c.applicability_conditions ||
        'a matching official source plus your product’s exact HTS classification and attributes.',
    } satisfies RiskCategory;
  });

  const order: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3, 'N/A': 4 };
  const merged = [...baselines, ...neutralized].sort(
    (a, b) => (order[a.level] ?? 5) - (order[b.level] ?? 5),
  );

  // Overall risk from supported findings ONLY (verified + official-unconfirmed).
  const supported = merged.filter(
    (c) => c.verification_status === 'verified_applicable' || c.verification_status === 'official_unconfirmed',
  );
  const verified = supported.filter((c) => c.verification_status === 'verified_applicable');
  const unconfirmed = supported.filter((c) => c.verification_status === 'official_unconfirmed');
  const rank = (lvl: string) => order[lvl] ?? 5;
  const worst = supported.reduce<string>((acc, c) => (rank(c.level) < rank(acc) ? c.level : acc), 'Low');
  const overall_risk = (['Critical', 'High', 'Medium', 'Low'].includes(worst) ? worst : 'Low') as ScanResult['overall_risk'];

  // Deterministic summary built ONLY from supported findings.
  const overall_summary = supported.length
    ? `Based on official sources, ClearPort verified ${verified.length} applicable requirement${verified.length === 1 ? '' : 's'}` +
      (unconfirmed.length
        ? ` and found ${unconfirmed.length} official requirement${unconfirmed.length === 1 ? '' : 's'} whose applicability needs confirmation`
        : '') +
      `. Highest verified/applicable risk: ${overall_risk}.`
    : 'ClearPort could not verify any applicable requirements from official sources for the details provided. Add an HTS code and product attributes for a fuller, source-backed assessment.';

  // Next actions / broker / supplier questions — derived ONLY from supported findings.
  const next_actions = dedupeStrings(
    supported.map((c) => c.action).filter((a): a is string => !!a),
  ).slice(0, 6);

  const broker_questions = dedupeStrings([
    ...(scan.risk_categories.some((c) => c.category.toLowerCase().includes('duty') && c.verification_status === 'verified_applicable')
      ? ['Can you confirm the HTS classification so the verified base duty rate applies, and the total duty including any trade-remedy tariffs?']
      : []),
    ...unconfirmed.map(
      (c) => `Does "${c.category}" apply to this product${c.source?.cfr_citation ? ` under ${c.source.cfr_citation}` : ''}, and what exactly is required?`,
    ),
    ...verified
      .filter((c) => c.source?.agency && c.source.agency !== 'USITC')
      .map((c) => `What documentation proves compliance with ${c.category} (${c.source?.cfr_citation ?? c.source?.agency})?`),
  ]).slice(0, 6);

  const supplier_questions = dedupeStrings(
    verified
      .filter((c) => c.source?.agency && c.source.agency !== 'USITC')
      .map((c) => `Can you provide documentation/test evidence for ${c.category} (${c.source?.cfr_citation ?? c.source?.agency})?`),
  ).slice(0, 6);

  // Readiness from supported findings only: clearer (verified rate) raises it;
  // each mandatory requirement / unconfirmed item lowers it (more to resolve).
  let readiness = 60;
  if (verified.some((c) => c.category.toLowerCase().includes('duty'))) readiness += 15;
  readiness -= 7 * verified.filter((c) => c.source?.agency !== 'USITC').length;
  readiness -= 4 * unconfirmed.length;
  const readiness_score = Math.max(10, Math.min(95, readiness));

  // Gate the document checklist: "required" only when a verified rule backs it.
  const verifiedTopics = new Set<string>();
  baselines
    .filter((b) => b.verification_status === 'verified_applicable')
    .forEach((b) => topicsOf(b.category).forEach((t) => verifiedTopics.add(t)));
  const checklist = (scan.document_checklist ?? []).map((d) => {
    const backed =
      ALWAYS_REQUIRED_DOCS.test(d.document) ||
      [...topicsOf(`${d.document} ${d.reason}`)].some((t) => verifiedTopics.has(t));
    return { ...d, required: backed, status: backed ? 'required' : 'needs_confirmation' } as DocumentChecklistItem;
  });

  return {
    ...scan,
    overall_risk,
    overall_summary,
    risk_categories: merged,
    document_checklist: checklist,
    broker_questions,
    supplier_questions,
    next_actions,
    readiness_score,
  };
}

function dedupeStrings(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const k = s.trim().toLowerCase();
    if (k && !seen.has(k)) { seen.add(k); out.push(s.trim()); }
  }
  return out;
}
