/**
 * Generic tariff-rule architecture for ClearPort.
 *
 * Each TariffRule represents a single enacted U.S. import duty provision with
 * verified provenance, date range, HTS scope, origin scope, legal status, and
 * stacking metadata.
 *
 * FOUR CONCEPTS ARE KEPT SEPARATE (Chapter 99 architecture principle):
 *   (A) A heading exists in the published HTSUS schedule
 *   (B) The legal measure behind it is operative (not struck down, suspended, or expired)
 *   (C) The measure applies to this specific origin/HTS/date combination
 *   (D) A duty can actually be assessed and collected
 *
 *   (A) is never sufficient to establish (D). ClearPort evaluates (B)+(C)+(D) explicitly.
 *
 * Rule states (RuleStatus):
 *   ACTIVE                — in effect on the given entry date
 *   EXPIRED               — effective_to < entryDate (date range ended normally)
 *   SUSPENDED             — suspended: true (temporarily inactive per proclamation/deal)
 *   TERMINATED            — terminated: true (permanently removed by executive/legislative action)
 *   JUDICIALLY_INVALIDATED — legal_status === 'judicially_invalidated' AND entry date >= legal_status_effective_from
 *   NOT_APPLICABLE        — HTS scope or origin scope does not match
 *
 * LegalStatus vocabulary:
 *   active              — currently operative under its original authority
 *   scheduled           — enacted but not yet effective
 *   suspended           — temporarily paused (proclamation/deal)
 *   expired             — expired by its own terms (effective_to reached)
 *   terminated_revoked  — permanently removed by executive/legislative action
 *   judicially_invalidated — a court of competent jurisdiction held the underlying
 *                            legal authority unconstitutional or otherwise invalid;
 *                            the tariff heading may still appear in the published
 *                            schedule but collection has stopped
 *   superseded_replaced — replaced by a newer measure
 *   source_unavailable  — primary source could not be verified
 *   official_unconfirmed — evidence exists but not from a confirmed primary source
 *
 * Stacking logic (U.S. Chapter 99):
 *   Rules in DIFFERENT stacking_groups always add up.
 *   Rules in the SAME stacking_group are alternatives — only the highest-rate
 *   member applies (same-group = alternatives, not cumulative).
 *
 * IEEPA provisions — status as of 2026-09-25:
 *   9903.01.20 — U.S. Note 2(s): China/HK +10%, Feb 4–Mar 4, 2025. EXPIRED by date.
 *   9903.01.24 — U.S. Note 2(u): China/HK +10%, effective Nov 10, 2025.
 *                JUDICIALLY INVALIDATED: Supreme Court held Feb 20, 2026 that IEEPA
 *                does not authorize tariffs (6-3, Chief Justice Roberts). CBP ceased
 *                collection effective 12:00 AM ET Feb 24, 2026 per Executive Order.
 *                effective_to: 2026-02-23 (last day of collection).
 *   9903.01.25 — U.S. Note 2(v)(i): all countries +10%. China exclusion (v)(xviii)(10)
 *                was SUSPENDED → China was subject. JUDICIALLY INVALIDATED same ruling.
 *                effective_to: 2026-02-23 (last day of collection).
 *   9903.01.63 — subdivision (v)(xvii)(10): China/HK +34% reciprocal.
 *                SUSPENDED per compiler's note, p.185 (Geneva deal) — never collected
 *                at this rate. Also invalidated by same court ruling.
 *
 * New Section 301 forced-labor action (verified 2026-09-25):
 *   9903.05.20 — USTR action in 60-economy Section 301 forced-labor investigation.
 *                China: +12.5% additional duty. Effective July 24, 2026.
 *                Source: FR Doc. 2026-15181 (July 28, 2026, 91 FR 47318).
 *                Covers Chapters 1-97 broadly; 471 HTS subheadings exempted (Annex II).
 *
 *   ANNEX II MACHINE-READABILITY FINDING (verified 2026-09-25):
 *     The Annex II HTS-code tables are published as IMAGE files in the Federal Register
 *     (GPH elements EN28JY26.060 through EN28JY26.086+, pages 47396–47422). The string
 *     "9503" does not appear anywhere in the 183,456-character machine-readable XML of
 *     FR Doc. 2026-15181. The USITC HTS API returns "footnotes": [] (no 9903.05.xx
 *     footnote) for HTS 9503.00.00. Critically, the USITC also returns "footnotes": []
 *     for HTS 6109.10.00 (cotton T-shirts — definitively covered goods), confirming the
 *     USITC has not yet incorporated 9903.05.20 footnotes for ANY goods as of 2026-09-25.
 *     CONCLUSION: 'official_unconfirmed' is the only legally defensible engine state for
 *     any specific HTS vs. 9903.05.20. Coverage can only be determined by human review
 *     of the image tables. $6,250 (12.5% × $50,000) must NOT enter known-payable totals.
 *
 * Sources:
 *   IEEPA ruling:  SCOTUS, Feb 20, 2026 (per Holland & Knight, WilmerHale, Skadden alerts)
 *   CBP termination: CBP CSMS guidance, effective Feb 24, 2026
 *   FL S301:       FR Doc. 2026-15181 (91 FR 47318); USTR press release July 23, 2026
 *   Annex II:      federalregister.gov XML (2026-09-25); USITC HTS API (2026-09-25)
 *
 * Last verified: 2026-09-25.
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

/** Legal status vocabulary — distinct from operational status (suspended/terminated). */
export type LegalStatus =
  | 'active'
  | 'scheduled'
  | 'suspended'
  | 'expired'
  | 'terminated_revoked'
  | 'judicially_invalidated'
  | 'superseded_replaced'
  | 'source_unavailable'
  | 'official_unconfirmed';

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
  /**
   * Legal status of the underlying authority for this rule.
   * Distinct from the operational suspended/terminated flags:
   *   suspended    = temporarily paused by proclamation/deal
   *   terminated   = permanently removed by executive/legislative action
   *   judicially_invalidated = court held the underlying authority unconstitutional/invalid
   *
   * A rule may have effective_to set AND legal_status = 'judicially_invalidated' —
   * the effective_to captures the last day CBP actually collected the duty, while
   * legal_status explains WHY collection stopped (court ruling vs. natural expiry).
   */
  readonly legal_status: LegalStatus;
  /** ISO date when legal_status took effect (e.g. date CBP stopped collecting). */
  readonly legal_status_effective_from: string | null;
  readonly stacking_group: string;
  readonly stacking_note: string | null;
  readonly exclusions: readonly ExclusionRule[];
  readonly source: SourceCitation;
  readonly last_verified_at: string;
}

export type RuleStatus =
  | 'ACTIVE'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'TERMINATED'
  | 'JUDICIALLY_INVALIDATED'
  | 'NOT_APPLICABLE';

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

// ── IEEPA rule data ────────────────────────────────────────────────────────────
//
// JUDICIAL INVALIDATION (2026-02-20 / 2026-02-24):
//   The U.S. Supreme Court held on February 20, 2026, in a 6-3 decision authored
//   by Chief Justice Roberts, that IEEPA does not authorize the President to impose
//   tariffs. The Court held that IEEPA's grant of authority to "regulate…importation"
//   does not include the power to impose tariffs, which is a taxing power reserved
//   for Congress under Article I. Following the ruling, the President issued an
//   Executive Order ("Ending Certain Tariff Actions") on February 20, 2026.
//   CBP ceased collecting IEEPA duties on goods entered for consumption effective
//   12:00 AM ET February 24, 2026.
//
//   Consequence for data:
//     9903.01.24 and 9903.01.25 are marked judicially_invalidated.
//     effective_to is set to '2026-02-23' — the last calendar day CBP collected.
//     For entries on or after 2026-02-24, evaluateRule() returns JUDICIALLY_INVALIDATED.
//     For entries before 2026-02-24, the rules evaluate normally (ACTIVE or NOT_APPLICABLE
//     by date), preserving correct historical duty calculation.
//
//   Sources (verified 2026-09-25):
//     SCOTUS ruling:   Holland & Knight alert (https://www.hklaw.com/en/insights/publications/2026/02/...)
//                      WilmerHale alert (https://www.wilmerhale.com/en/insights/client-alerts/20260220-...)
//                      Skadden alert (https://www.skadden.com/insights/publications/2026/02/...)
//     CBP termination: CSMS guidance; Crane Worldwide advisory (https://www.craneww.com/...)
//                      White & Case alert (https://www.whitecase.com/insight-alert/...)

const IEEPA_SRC_CHAPTER99 = 'USITC HTSUS Chapter 99 (downloaded 2026-09-23)';
const IEEPA_LAST_VERIFIED = '2026-09-25';
const IEEPA_INVALIDATION_DATE = '2026-02-24'; // first day CBP did NOT collect
const IEEPA_LAST_COLLECTED = '2026-02-23';    // last day CBP collected IEEPA duties
const USITC_URL = 'https://hts.usitc.gov/';
const CHINA_ORIGIN: OriginScope = {
  type: 'named_countries',
  countries: ['china', 'hong kong', 'hk', 'cn'],
} as const;

export const IEEPA_RULES: readonly TariffRule[] = [
  // ── 9903.01.20 ─────────────────────────────────────────────────────────────
  // U.S. Note 2(s): Initial 10% IEEPA tariff on China/HK.
  // Entry period Feb 4 – Mar 4, 2025 ONLY. EXPIRED by its own terms before the
  // judicial invalidation. legal_status remains 'expired' (not judicially_invalidated)
  // because collection ceased due to the date-range end, not the court ruling.
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
    legal_status: 'expired',
    legal_status_effective_from: '2025-03-05', // day after the date-range ended
    stacking_group: 'ieepa_china_2025_initial',
    stacking_note: 'Initial 10% IEEPA tariff on China/HK. Superseded by 9903.01.24 (Nov 2025). Expired by own terms Mar 4, 2025.',
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
  // Stacks with 9903.01.25 per U.S. Note 2(v)(i).
  //
  // JUDICIALLY INVALIDATED: CBP ceased collection effective Feb 24, 2026.
  // effective_to = '2026-02-23' (last day collected).
  // legal_status = 'judicially_invalidated'; legal_status_effective_from = '2026-02-24'.
  // For historical entries (Nov 10, 2025 – Feb 23, 2026): evaluates as ACTIVE.
  // For entries on/after Feb 24, 2026: evaluates as JUDICIALLY_INVALIDATED.
  {
    id: 'ieepa_9903_01_24',
    jurisdiction: 'US',
    measure_type: 'IEEPA',
    ch99_provision: '9903.01.24',
    hts_scope: { type: 'all' },
    origin_scope: CHINA_ORIGIN,
    rate: { type: 'ad_valorem', ad_valorem_pct: 10 },
    effective_from: '2025-11-10',
    effective_to: IEEPA_LAST_COLLECTED,
    suspended: false,
    terminated: false,
    legal_status: 'judicially_invalidated',
    legal_status_effective_from: IEEPA_INVALIDATION_DATE,
    stacking_group: 'ieepa_china_2025_nov',
    stacking_note:
      'Additional 10% IEEPA tariff on China/HK effective Nov 10, 2025. ' +
      'JUDICIALLY INVALIDATED: Supreme Court held Feb 20, 2026 that IEEPA does not ' +
      'authorize tariffs. CBP ceased collection Feb 24, 2026 (last collected Feb 23, 2026). ' +
      'This provision still appears in the published HTSUS schedule but is not collectible ' +
      'on entries dated Feb 24, 2026 or later.',
    exclusions: [],
    source: {
      authority: 'Presidential Proclamation / IEEPA — JUDICIALLY INVALIDATED Feb 20, 2026',
      document:
        `${IEEPA_SRC_CHAPTER99}, U.S. Note 2(u). ` +
        `Invalidation: SCOTUS ruling Feb 20, 2026; CBP termination guidance Feb 24, 2026.`,
      url: USITC_URL,
      retrieved_at: IEEPA_LAST_VERIFIED,
      fr_citation: null,
    },
    last_verified_at: IEEPA_LAST_VERIFIED,
  },

  // ── 9903.01.25 ─────────────────────────────────────────────────────────────
  // U.S. Note 2(v)(i): Universal 10% IEEPA baseline tariff, all countries.
  // Explicitly stacks with other Subchapter III duties.
  // China exclusion (subdivision (v)(xviii)(10)) was SUSPENDED →
  //   China WAS subject to 9903.01.25 while it was active.
  //
  // JUDICIALLY INVALIDATED: same ruling and CBP termination as 9903.01.24.
  // effective_to = '2026-02-23'. legal_status = 'judicially_invalidated'.
  {
    id: 'ieepa_9903_01_25',
    jurisdiction: 'US',
    measure_type: 'IEEPA',
    ch99_provision: '9903.01.25',
    hts_scope: { type: 'all' },
    origin_scope: { type: 'all' },
    rate: { type: 'ad_valorem', ad_valorem_pct: 10 },
    effective_from: '2025-04-05',
    effective_to: IEEPA_LAST_COLLECTED,
    suspended: false,
    terminated: false,
    legal_status: 'judicially_invalidated',
    legal_status_effective_from: IEEPA_INVALIDATION_DATE,
    stacking_group: 'ieepa_universal_2025',
    stacking_note:
      'Universal 10% IEEPA baseline (all countries). China exclusion (v)(xviii)(10) was SUSPENDED — ' +
      'China was subject while active. ' +
      'JUDICIALLY INVALIDATED: Supreme Court held Feb 20, 2026 that IEEPA does not authorize tariffs. ' +
      'CBP ceased collection Feb 24, 2026 (last collected Feb 23, 2026).',
    exclusions: [
      {
        id: 'ieepa_9903_01_25_excl_china',
        description: 'U.S. Note 2(v)(xviii)(10): China exclusion from 9903.01.25 — was SUSPENDED (compiler\'s note, HTSUS Ch.99 p.185). China was subject to 9903.01.25 while it was active.',
        origin_scope: CHINA_ORIGIN,
        suspended: true,
      },
    ],
    source: {
      authority: 'Presidential Proclamation / IEEPA — JUDICIALLY INVALIDATED Feb 20, 2026',
      document:
        `${IEEPA_SRC_CHAPTER99}, U.S. Note 2(v)(i); China exclusion at (v)(xviii)(10) was SUSPENDED. ` +
        `Invalidation: SCOTUS ruling Feb 20, 2026; CBP termination guidance Feb 24, 2026.`,
      url: USITC_URL,
      retrieved_at: IEEPA_LAST_VERIFIED,
      fr_citation: null,
    },
    last_verified_at: IEEPA_LAST_VERIFIED,
  },

  // ── 9903.01.63 ─────────────────────────────────────────────────────────────
  // China 34% reciprocal tariff (subdivision (v)(xvii)(10)).
  // SUSPENDED per compiler's note p.185: "Subdivision (v)(xvii)(10) and heading
  // 9903.01.63 are suspended" (Geneva deal) — never actually collected at this rate.
  // Also judicially invalidated by the same Feb 20, 2026 ruling, but suspension
  // takes precedence as it was already inactive before the ruling.
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
    legal_status: 'judicially_invalidated',
    legal_status_effective_from: IEEPA_INVALIDATION_DATE,
    stacking_group: 'ieepa_china_2025_reciprocal',
    stacking_note:
      'China 34% reciprocal IEEPA tariff — SUSPENDED (Geneva deal; compiler\'s note, HTSUS Chapter 99 p.185: ' +
      '"Subdivision (v)(xvii)(10) and heading 9903.01.63 are suspended"). ' +
      'Also judicially invalidated Feb 20, 2026 — not collectible for any entry.',
    exclusions: [],
    source: {
      authority: 'Presidential Proclamation / IEEPA — SUSPENDED + JUDICIALLY INVALIDATED',
      document:
        `${IEEPA_SRC_CHAPTER99}, subdivision (v)(xvii)(10) and heading 9903.01.63 — SUSPENDED per compiler's note p.185. ` +
        `Invalidation: SCOTUS ruling Feb 20, 2026.`,
      url: USITC_URL,
      retrieved_at: IEEPA_LAST_VERIFIED,
      fr_citation: null,
    },
    last_verified_at: IEEPA_LAST_VERIFIED,
  },
] as const;

// ── Section 301 Forced-Labor Rules (effective July 24, 2026) ──────────────────
//
// USTR took final action under Section 301 of the Trade Act of 1974 on July 23, 2026,
// imposing additional duties on imports from 60 economies for their failure to impose
// and effectively enforce a prohibition on the importation of goods produced with
// forced labor.
//
// Key facts (verified 2026-09-25):
//   Effective date:     July 24, 2026 (12:01 AM ET)
//   China provision:    9903.05.20 — +12.5% on all Chapter 1-97 goods from China
//   Scope:              Chapter 1-97 broadly; 471 HTS subheadings exempted (Annex II)
//   Stacking:           Stacks on top of MFN base rate and any Section 301 List 1-4A duties
//   FR citation:        FR Doc. 2026-15181 (July 28, 2026, 91 FR [pending final page cite])
//
// IMPORTANT LIMITATION: The 471 HTS-subheading exemptions listed in Annex II
// cannot be reproduced in full here (431-page table). The rule is therefore coded
// as covering ALL goods (consistent with the default-covered posture) with a note
// that the specific exemption list must be verified at ustr.gov.
// Importers should check whether their 10-digit HTS code is in Annex II.
//
// Sources (verified 2026-09-25):
//   USTR press release: https://ustr.gov/about/policy-offices/press-office/press-releases/2026/july/ustr-takes-action-forced-labor-section-301-investigations
//   FR Doc. 2026-15181: https://www.federalregister.gov/documents/2026/07/28/2026-15181/...
//   CH Robinson advisory: https://www.chrobinson.com/en-us/resources/insights-and-advisories/...
//   Tariff Sentinel: https://tariffsentinel.com/changes/section-301-forced-labor-60-economies-2026

const FL_S301_LAST_VERIFIED = '2026-09-25';
const FL_S301_FR = 'FR Doc. 2026-15181 (July 28, 2026)';
const FL_S301_USTR_URL = 'https://ustr.gov/about/policy-offices/press-office/press-releases/2026/july/ustr-takes-action-forced-labor-section-301-investigations';

export const SECTION_301_FL_RULES: readonly TariffRule[] = [
  // ── 9903.05.20 — China/HK +12.5% forced-labor Section 301 ─────────────────
  {
    id: 'section301_fl_9903_05_20',
    jurisdiction: 'US',
    measure_type: 'Section301',
    ch99_provision: '9903.05.20',
    hts_scope: { type: 'all' }, // covers Chapters 1-97; Annex II exemptions not encoded
    origin_scope: CHINA_ORIGIN,
    rate: { type: 'ad_valorem', ad_valorem_pct: 12.5 },
    effective_from: '2026-07-24',
    effective_to: null,
    suspended: false,
    terminated: false,
    legal_status: 'active',
    legal_status_effective_from: '2026-07-24',
    stacking_group: 'section301_fl_2026',
    stacking_note:
      'Section 301 forced-labor additional duty on China (+12.5%), effective July 24, 2026. ' +
      'Stacks with MFN base rate and any original Section 301 List 1–4A duty. ' +
      '471 HTS subheadings are exempt per Annex II (FR Doc. 2026-15181) — verify whether ' +
      'your specific HTS code is in the exemption list at ustr.gov.',
    exclusions: [],
    source: {
      authority: 'USTR — Section 301 (forced labor investigation)',
      document: `${FL_S301_FR}; USTR press release July 23, 2026`,
      url: FL_S301_USTR_URL,
      retrieved_at: FL_S301_LAST_VERIFIED,
      fr_citation: FL_S301_FR,
    },
    last_verified_at: FL_S301_LAST_VERIFIED,
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

  // Judicial invalidation check (concept B → D separation):
  // A provision may still appear in the published HTSUS schedule (concept A) yet
  // be judicially invalidated — meaning CBP has stopped collecting it (concept D).
  // This is checked AFTER scope matching so historical analyses can see it was
  // scoped for this origin/HTS; the invalidation is the reason it doesn't apply.
  if (
    rule.legal_status === 'judicially_invalidated' &&
    rule.legal_status_effective_from != null &&
    entryDate >= rule.legal_status_effective_from
  ) {
    return {
      rule,
      status: 'JUDICIALLY_INVALIDATED',
      applies: false,
      rate_pct: null,
      reason:
        `${prov}: judicially invalidated — the underlying legal authority was held unconstitutional ` +
        `or otherwise invalid by a court of competent jurisdiction. CBP ceased collection effective ` +
        `${rule.legal_status_effective_from}. This provision may still appear in the published HTSUS ` +
        `schedule but is not collectible on entries dated ${rule.legal_status_effective_from} or later.`,
    };
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
