/**
 * Generic tariff-rule architecture for ClearPort.
 *
 * Each TariffRule represents a single enacted U.S. import duty provision with
 * verified provenance, date range, HTS scope, origin scope, and stacking metadata.
 *
 * Rule states (RuleStatus):
 *   ACTIVE         — in effect on the given entry date
 *   EXPIRED        — effective_to < entryDate
 *   SUSPENDED      — suspended: true (temporarily inactive per proclamation/deal)
 *   TERMINATED     — terminated: true (permanently removed)
 *   NOT_APPLICABLE — HTS scope or origin scope does not match
 *
 * Stacking logic (U.S. Chapter 99):
 *   Rules in DIFFERENT stacking_groups always add up.
 *   Rules in the SAME stacking_group are alternatives — only the highest-rate
 *   member applies (same-group = alternatives, not cumulative).
 *
 * IEEPA provisions verified against USITC Chapter 99 PDF (downloaded 2026-09-23):
 *   9903.01.20 — U.S. Note 2(s): China/HK +10%, Feb 4–Mar 4, 2025. EXPIRED.
 *   9903.01.24 — U.S. Note 2(u): China/HK +10%, effective Nov 10, 2025. ACTIVE.
 *   9903.01.25 — U.S. Note 2(v)(i): all countries +10%. China exclusion
 *                (subdivision (v)(xviii)(10)) is SUSPENDED → China IS subject.
 *                Explicitly stacks with other Subchapter III duties.
 *   9903.01.63 — subdivision (v)(xvii)(10): China/HK +34% reciprocal.
 *                SUSPENDED per compiler's note, p.185 (Geneva deal).
 *
 * Last verified: 2026-09-23.
 */

export interface HtsScope {
  type: 'all' | 'chapter' | 'heading' | 'subheading' | 'enumerated_list';
  /** Chapter (e.g. '99'), heading prefix (e.g. '8708'), subheading (e.g. '870830'), or list of 8-digit codes */
  value?: string | readonly string[];
}

export interface OriginScope {
  type: 'all' | 'named_countries';
  /** Lowercase country names or codes — matched with originCountry.toLowerCase().includes(c) */
  countries?: readonly string[];
}

export interface RateExpression {
  type: 'ad_valorem' | 'free' | 'specific' | 'compound' | 'plus_applicable';
  ad_valorem_pct?: number;
  description?: string;
}

export interface SourceCitation {
  authority: string;
  document: string;
  url: string | null;
  retrieved_at: string;
  fr_citation: string | null;
}

export interface ExclusionRule {
  id: string;
  description: string;
  origin_scope?: OriginScope;
  /** When suspended: true the exclusion is inactive — goods ARE subject to the parent rule */
  suspended: boolean;
}

export interface TariffRule {
  readonly id: string;
  readonly jurisdiction: 'US';
  readonly measure_type: 'MFN' | 'Section301' | 'IEEPA' | 'Section232' | 'Section122' | 'ADD' | 'CVD' | 'MPF' | 'HMF';
  readonly ch99_provision: string | null;
  readonly hts_scope: HtsScope;
  readonly origin_scope: OriginScope;
  readonly rate: RateExpression;
  readonly effective_from: string;       // ISO date — first entry date the rule applies
  readonly effective_to: string | null;  // ISO date — last entry date (inclusive), or null = no end
  readonly suspended: boolean;
  readonly terminated: boolean;
  readonly stacking_group: string;
  readonly stacking_note: string | null;
  readonly exclusions: readonly ExclusionRule[];
  readonly source: SourceCitation;
  readonly last_verified_at: string;
}

export type RuleStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'TERMINATED' | 'NOT_APPLICABLE';

export interface EvaluatedRule {
  rule: TariffRule;
  status: RuleStatus;
  applies: boolean;
  rate_pct: number | null;
  reason: string;
}

export interface DutyStackResult {
  hts8: string;
  origin: string;
  entry_date: string;
  evaluated_rules: EvaluatedRule[];
  /** Active rules after stacking-group deduplication — the ones that actually apply */
  active_rules: EvaluatedRule[];
  /** Sum of rate_pct across active_rules */
  total_ad_valorem_pct: number;
  stacking_explanation: string;
}

// ── IEEPA rule data (verified 2026-09-23) ─────────────────────────────────────

const IEEPA_SRC_CHAPTER99 = 'USITC HTSUS Chapter 99 (downloaded 2026-09-23)';
const IEEPA_LAST_VERIFIED = '2026-09-23';
const USITC_URL = 'https://hts.usitc.gov/';
const CHINA_ORIGIN: OriginScope = {
  type: 'named_countries',
  countries: ['china', 'hong kong', 'hk', 'cn'],
} as const;

export const IEEPA_RULES: readonly TariffRule[] = [
  // ── 9903.01.20 ─────────────────────────────────────────────────────────────
  // U.S. Note 2(s): Initial 10% IEEPA tariff on China/HK.
  // Entry period Feb 4 – Mar 4, 2025 ONLY. EXPIRED.
  {
    id: 'ieepa_9903_01_20',
    jurisdiction: 'US',
    measure_type: 'IEEPA',
    ch99_provision: '9903.01.20',
    hts_scope: { type: 'all' },
    origin_scope: CHINA_ORIGIN,
    rate: { type: 'ad_valorem', ad_valorem_pct: 10 },
    effective_from: '2025-02-04',
    effective_to: '2025-03-04',
    suspended: false,
    terminated: false,
    stacking_group: 'ieepa_china_2025_initial',
    stacking_note: 'Initial 10% IEEPA tariff on China/HK. Superseded by 9903.01.24 (Nov 2025). EXPIRED.',
    exclusions: [],
    source: {
      authority: 'Presidential Proclamation / IEEPA',
      document: `${IEEPA_SRC_CHAPTER99}, U.S. Note 2(s)`,
      url: USITC_URL,
      retrieved_at: IEEPA_LAST_VERIFIED,
      fr_citation: null,
    },
    last_verified_at: IEEPA_LAST_VERIFIED,
  },

  // ── 9903.01.24 ─────────────────────────────────────────────────────────────
  // U.S. Note 2(u): Additional 10% IEEPA tariff on China/HK, effective Nov 10, 2025.
  // Stacks with 9903.01.25 per U.S. Note 2(v)(i). ACTIVE.
  {
    id: 'ieepa_9903_01_24',
    jurisdiction: 'US',
    measure_type: 'IEEPA',
    ch99_provision: '9903.01.24',
    hts_scope: { type: 'all' },
    origin_scope: CHINA_ORIGIN,
    rate: { type: 'ad_valorem', ad_valorem_pct: 10 },
    effective_from: '2025-11-10',
    effective_to: null,
    suspended: false,
    terminated: false,
    stacking_group: 'ieepa_china_2025_nov',
    stacking_note: 'Additional 10% IEEPA tariff on China/HK effective Nov 10, 2025. Stacks with 9903.01.25 per U.S. Note 2(v)(i).',
    exclusions: [],
    source: {
      authority: 'Presidential Proclamation / IEEPA',
      document: `${IEEPA_SRC_CHAPTER99}, U.S. Note 2(u)`,
      url: USITC_URL,
      retrieved_at: IEEPA_LAST_VERIFIED,
      fr_citation: null,
    },
    last_verified_at: IEEPA_LAST_VERIFIED,
  },

  // ── 9903.01.25 ─────────────────────────────────────────────────────────────
  // U.S. Note 2(v)(i): Universal 10% IEEPA baseline tariff, all countries.
  // Explicitly stacks with other Subchapter III duties.
  // China exclusion (subdivision (v)(xviii)(10)) is SUSPENDED →
  //   China IS subject to 9903.01.25. ACTIVE for China.
  {
    id: 'ieepa_9903_01_25',
    jurisdiction: 'US',
    measure_type: 'IEEPA',
    ch99_provision: '9903.01.25',
    hts_scope: { type: 'all' },
    origin_scope: { type: 'all' },
    rate: { type: 'ad_valorem', ad_valorem_pct: 10 },
    effective_from: '2025-04-05',
    effective_to: null,
    suspended: false,
    terminated: false,
    stacking_group: 'ieepa_universal_2025',
    stacking_note: 'Universal 10% IEEPA baseline. Explicitly stacks with all other Subchapter III duties per U.S. Note 2(v)(i). China exclusion (v)(xviii)(10) SUSPENDED — China pays this rate.',
    exclusions: [
      {
        id: 'ieepa_9903_01_25_excl_china',
        // This exclusion is SUSPENDED → it does NOT apply → China IS subject to 9903.01.25
        description: 'U.S. Note 2(v)(xviii)(10): China exclusion from 9903.01.25 — SUSPENDED (compiler\'s note, HTSUS Ch.99 p.185). China IS subject to 9903.01.25.',
        origin_scope: CHINA_ORIGIN,
        suspended: true,
      },
    ],
    source: {
      authority: 'Presidential Proclamation / IEEPA',
      document: `${IEEPA_SRC_CHAPTER99}, U.S. Note 2(v)(i); exclusion at (v)(xviii)(10) SUSPENDED`,
      url: USITC_URL,
      retrieved_at: IEEPA_LAST_VERIFIED,
      fr_citation: null,
    },
    last_verified_at: IEEPA_LAST_VERIFIED,
  },

  // ── 9903.01.63 ─────────────────────────────────────────────────────────────
  // China 34% reciprocal tariff (subdivision (v)(xvii)(10)).
  // SUSPENDED per compiler's note p.185: "Subdivision (v)(xvii)(10) and heading
  // 9903.01.63 are suspended" (Geneva deal). NOT APPLICABLE for Sep 2026 entries.
  {
    id: 'ieepa_9903_01_63',
    jurisdiction: 'US',
    measure_type: 'IEEPA',
    ch99_provision: '9903.01.63',
    hts_scope: { type: 'all' },
    origin_scope: CHINA_ORIGIN,
    rate: { type: 'ad_valorem', ad_valorem_pct: 34 },
    effective_from: '2025-04-09',
    effective_to: null,
    suspended: true,
    terminated: false,
    stacking_group: 'ieepa_china_2025_reciprocal',
    stacking_note: 'China 34% reciprocal IEEPA tariff — SUSPENDED. Compiler\'s note, HTSUS Chapter 99 p.185: "Subdivision (v)(xvii)(10) and heading 9903.01.63 are suspended."',
    exclusions: [],
    source: {
      authority: 'Presidential Proclamation / IEEPA',
      document: `${IEEPA_SRC_CHAPTER99}, subdivision (v)(xvii)(10) and heading 9903.01.63 — SUSPENDED per compiler's note p.185`,
      url: USITC_URL,
      retrieved_at: IEEPA_LAST_VERIFIED,
      fr_citation: null,
    },
    last_verified_at: IEEPA_LAST_VERIFIED,
  },
] as const;

// ── Rule evaluation engine ─────────────────────────────────────────────────────

function matchesOriginScope(scope: OriginScope, originCountry: string): boolean {
  if (scope.type === 'all') return true;
  const lc = originCountry.toLowerCase();
  return scope.countries?.some((c) => lc.includes(c)) ?? false;
}

function matchesHtsScope(scope: HtsScope, hts8: string): boolean {
  if (scope.type === 'all') return true;
  const digits = hts8.replace(/[^0-9]/g, '');
  if (scope.type === 'chapter') {
    const ch = String(scope.value).replace(/[^0-9]/g, '').padStart(2, '0');
    return digits.startsWith(ch);
  }
  if (scope.type === 'heading') {
    return digits.startsWith(String(scope.value).replace(/[^0-9]/g, '').slice(0, 4));
  }
  if (scope.type === 'subheading') {
    return digits.startsWith(String(scope.value).replace(/[^0-9]/g, '').slice(0, 6));
  }
  if (scope.type === 'enumerated_list') {
    const list = (scope.value as readonly string[]).map((v) => v.replace(/[^0-9]/g, '').slice(0, 8));
    return list.some((v) => digits.startsWith(v));
  }
  return false;
}

/** Returns true if entryDate falls within [effective_from, effective_to] (inclusive). */
export function entryDateWithinRange(
  entryDate: string,
  effectiveFrom: string,
  effectiveTo: string | null,
): boolean {
  return entryDate >= effectiveFrom && (effectiveTo === null || entryDate <= effectiveTo);
}

/** Evaluate a single TariffRule against a specific HTS8, origin, and entry date. */
export function evaluateRule(
  rule: TariffRule,
  hts8: string,
  origin: string,
  entryDate: string,
): EvaluatedRule {
  const prov = rule.ch99_provision ?? rule.id;

  if (!matchesHtsScope(rule.hts_scope, hts8)) {
    return { rule, status: 'NOT_APPLICABLE', applies: false, rate_pct: null, reason: `${prov}: HTS not within scope` };
  }
  if (!matchesOriginScope(rule.origin_scope, origin)) {
    return { rule, status: 'NOT_APPLICABLE', applies: false, rate_pct: null, reason: `${prov}: origin '${origin}' not within scope` };
  }

  // Active exclusion check — an unsuspended exclusion exempts the goods
  for (const excl of rule.exclusions) {
    if (excl.suspended) continue;
    if (excl.origin_scope && !matchesOriginScope(excl.origin_scope, origin)) continue;
    return { rule, status: 'NOT_APPLICABLE', applies: false, rate_pct: null, reason: `${prov}: excluded — ${excl.description}` };
  }

  if (rule.terminated) {
    return { rule, status: 'TERMINATED', applies: false, rate_pct: null, reason: `${prov} has been terminated` };
  }
  if (rule.suspended) {
    return { rule, status: 'SUSPENDED', applies: false, rate_pct: null, reason: `${prov} is suspended — ${rule.stacking_note ?? ''}`.trimEnd() };
  }

  if (!entryDateWithinRange(entryDate, rule.effective_from, rule.effective_to)) {
    if (entryDate < rule.effective_from) {
      return { rule, status: 'NOT_APPLICABLE', applies: false, rate_pct: null, reason: `${prov}: entry date ${entryDate} is before effective date ${rule.effective_from}` };
    }
    return { rule, status: 'EXPIRED', applies: false, rate_pct: null, reason: `${prov} expired ${rule.effective_to} — entry date ${entryDate} is after expiry` };
  }

  const rate_pct = rule.rate.type === 'ad_valorem' ? (rule.rate.ad_valorem_pct ?? null)
    : rule.rate.type === 'free' ? 0
    : null;
  return {
    rule,
    status: 'ACTIVE',
    applies: true,
    rate_pct,
    reason: `${prov} applies — +${rate_pct != null ? `${rate_pct}%` : (rule.rate.description ?? 'see provision')} (${rule.origin_scope.type === 'all' ? 'all origins' : rule.origin_scope.countries?.join(', ')})`,
  };
}

/**
 * Calculate the IEEPA duty stack for a specific HTS-8 code, origin country,
 * and entry date. Does NOT include MFN, Section 301, MPF, or HMF.
 *
 * Stacking: different stacking_groups are cumulative; same group = pick highest.
 *
 * @param hts8       8-digit HTS digits (e.g. '95030000'); empty string matches all-scope rules
 * @param origin     Origin country (free text; compared case-insensitively)
 * @param entryDate  ISO entry date; defaults to today
 * @param rules      Rule set to evaluate; defaults to IEEPA_RULES
 */
export function calculateDutyStack(
  hts8: string,
  origin: string,
  entryDate: string = new Date().toISOString().slice(0, 10),
  rules: readonly TariffRule[] = IEEPA_RULES,
): DutyStackResult {
  const evaluated = rules.map((r) => evaluateRule(r, hts8, origin, entryDate));
  const activeRaw = evaluated.filter((e) => e.applies);

  // Deduplicate within stacking groups: keep highest-rate rule per group
  const groupMap = new Map<string, EvaluatedRule>();
  for (const e of activeRaw) {
    const prev = groupMap.get(e.rule.stacking_group);
    if (!prev || (e.rate_pct ?? 0) > (prev.rate_pct ?? 0)) {
      groupMap.set(e.rule.stacking_group, e);
    }
  }
  const activeRules = Array.from(groupMap.values());
  const total = activeRules.reduce((s, e) => s + (e.rate_pct ?? 0), 0);

  const parts = activeRules.map((e) => `${e.rule.ch99_provision} (+${e.rate_pct}%)`);
  const explanation = parts.length === 0
    ? 'No IEEPA duties applicable for this origin/date combination.'
    : `Active IEEPA layers: ${parts.join(' + ')} = +${total}% total additional IEEPA duty.`;

  return { hts8, origin, entry_date: entryDate, evaluated_rules: evaluated, active_rules: activeRules, total_ad_valorem_pct: total, stacking_explanation: explanation };
}

// ── USTR Section 301 static lookup ────────────────────────────────────────────
//
// P6: Section 301 provenance must come from the USTR database, not USITC footnotes.
// Full database: https://ustr.gov/themes/custom/ustr2021/tariff/hts_new.json (11,413 records)
// This table is a verified subset for HTS codes relevant to known ClearPort use cases.
// For production, integrate a live USTR fetch in lookupHtsBaseline (in htsBaseline.ts)
// and populate HtsLookupResult.ustr_section301_pct / .ustr_section301_note.

export interface UstrSection301Entry {
  /** 8-digit normalized HTS digits (no dots, no leading zeros dropped) */
  readonly hts8_digits: string;
  readonly action_description: string;
  readonly rate_pct: number;
  readonly source: SourceCitation;
}

// Verified from live fetch of hts_new.json on 2026-09-23:
//   {"HTS_id":95030000,"description":"Toys...","action_description":"List 4 (Modification) - 0.0% duties","note":""}
export const KNOWN_USTR_SECTION301: readonly UstrSection301Entry[] = [
  {
    hts8_digits: '95030000',
    action_description: 'List 4 (Modification) - 0.0% duties',
    rate_pct: 0,
    source: {
      authority: 'USTR',
      document: 'hts_new.json — USTR Section 301 China tariff schedule',
      url: 'https://ustr.gov/themes/custom/ustr2021/tariff/hts_new.json',
      retrieved_at: '2026-09-23',
      fr_citation: null,
    },
  },
] as const;

/**
 * Look up USTR Section 301 status for a given 8-digit HTS code.
 * Returns null when the code is not in the local verified subset.
 * A null result does NOT mean Section 301 does not apply — it means the USTR
 * database has not been consulted for this code in the static table.
 */
export function lookupSection301Ustr(hts8digits: string): UstrSection301Entry | null {
  return KNOWN_USTR_SECTION301.find((e) => e.hts8_digits === hts8digits) ?? null;
}
