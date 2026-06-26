/**
 * AD/CVD Order screening — pure scope-analysis + DB lookup.
 *
 * Architecture:
 *   1. evaluateScopeMatch(order, entry) — pure function, no I/O.
 *      Parses the product description and name against the written order scope
 *      and returns a structured match result. Testable without a DB.
 *   2. screenAdcvd(entry, normalizedHts) — queries the adcvd_orders table,
 *      then calls evaluateScopeMatch for each order whose HTS codes overlap
 *      with the submitted code and whose origin matches.
 *
 * Scope-match statuses:
 *   likely_match        — written scope criteria are met from submitted facts
 *   official_unconfirmed — order exists; applicability uncertain from available facts
 *   excluded            — product clearly meets an explicit scope exclusion
 *   no_match            — product clearly outside order scope
 *
 * Important: a missing producer/exporter NEVER suppresses an order that
 * otherwise matches scope. The finding is shown with a "confirm producer/
 * exporter for exact rate" note.
 */

import { db } from '../db/client';
import { normalizeHts } from './htsBaseline';
import type { WatchlistEntry, RiskCategory, CoverageItem } from '../types';

export type AdcvdScopeMatch =
  | 'likely_match'
  | 'official_unconfirmed'
  | 'excluded'
  | 'no_match';

// ── Official rate tables ───────────────────────────────────────────────────────

export interface AdcvdRateLookupResult {
  rate_pct: number;
  rule: string;
  source_ref: string;
}

/**
 * A-570-174 Antidumping — Brake Drums from China.
 * Final order: 90 FR 38730 (Aug. 12, 2025), effective Aug. 6, 2025.
 * Period of investigation: Oct. 1, 2023 – Mar. 31, 2024.
 *
 * Separate-rate companies (individually examined): 77.14% cash deposit.
 * China-wide entity: 150.25% (adjusted from 160.79% gross for CVD offset).
 */
const AD_570_174_SEPARATE_PCT = 77.14;
const AD_570_174_CHINA_WIDE_PCT = 150.25;
const AD_570_174_SOURCE_REF = 'A-570-174; Final AD Order, 90 FR 38730 (Aug. 12, 2025)';

const AD_570_174_SEPARATE_COMPANIES: readonly string[] = [
  'shandong conmet mechanical',
  'liaoning hechuang cv parts',
  'hebei oe auto spare parts',
  'longyao county yiheng auto parts',
  'shandong lingang nonferrous metals',
  'qiqihar beimo auto parts manufacturing',
  'shandong hongma engineering machinery',
  'longyao gucheng automobile parts',
  'shandong longji machinery',
];

/**
 * C-570-175 Countervailing Duty — Brake Drums from China.
 * Final order: 90 FR 38730 (Aug. 12, 2025).
 *
 * Named respondent (Shandong ConMet / Weifang ConMet): 11.94%.
 * All-others: 11.94% (same as named respondent's rate).
 * AFA companies (did not cooperate): 446.83%.
 */
const CVD_570_175_ALL_OTHERS_PCT = 11.94;
const CVD_570_175_AFA_PCT = 446.83;
const CVD_570_175_SOURCE_REF = 'C-570-175; Final CVD Order, 90 FR 38730 (Aug. 12, 2025)';

const CVD_570_175_NAMED_RESPONDENTS: readonly string[] = [
  'shandong conmet mechanical',
  'weifang conmet mechanical products',
];

const CVD_570_175_AFA_COMPANIES: readonly string[] = [
  'caiec trailer master',
  'guangzhou joyhand',
  'hebei iruijin auto parts',
  'henan broad top metal work',
  'henan valiant braking system',
  'hts tianjin supply chain',
  'panasia cvs',
  'raw king brake parts',
  'tianjin textile group import and export',
  'xiamen tinmy industrial',
  'xingtai xunchiyoute auto parts',
  'yancheng terbon auto parts',
  'yantai hongtian autoparts',
  'zhejiang firsd group',
];

function nameMatches(input: string, candidates: readonly string[]): boolean {
  const lc = input.toLowerCase();
  return candidates.some((c) => lc.includes(c) || c.includes(lc));
}

export function lookupBrakeDrumAdRate(
  manufacturer: string | null,
  exporter: string | null,
): AdcvdRateLookupResult {
  const names = [manufacturer, exporter].filter(Boolean) as string[];
  const isSeparateRate = names.some((n) => nameMatches(n, AD_570_174_SEPARATE_COMPANIES));
  if (isSeparateRate) {
    return {
      rate_pct: AD_570_174_SEPARATE_PCT,
      rule: 'Separate-rate company (individually examined mandatory respondent)',
      source_ref: AD_570_174_SOURCE_REF,
    };
  }
  if (names.length > 0) {
    return {
      rate_pct: AD_570_174_CHINA_WIDE_PCT,
      rule: 'China-wide entity rate (AFA) — company not on separate-rate list; verify with Commerce',
      source_ref: AD_570_174_SOURCE_REF,
    };
  }
  return {
    rate_pct: AD_570_174_CHINA_WIDE_PCT,
    rule: 'China-wide entity rate applied — manufacturer and exporter required to determine separate rate',
    source_ref: AD_570_174_SOURCE_REF,
  };
}

export function lookupBrakeDrumCvdRate(
  manufacturer: string | null,
  exporter: string | null,
): AdcvdRateLookupResult {
  const names = [manufacturer, exporter].filter(Boolean) as string[];
  const isAfa = names.some((n) => nameMatches(n, CVD_570_175_AFA_COMPANIES));
  if (isAfa) {
    return {
      rate_pct: CVD_570_175_AFA_PCT,
      rule: 'AFA rate (company did not cooperate in CVD investigation)',
      source_ref: CVD_570_175_SOURCE_REF,
    };
  }
  // Named respondent gets its specific rate; all other cooperating companies get all-others
  return {
    rate_pct: CVD_570_175_ALL_OTHERS_PCT,
    rule: names.length > 0
      ? 'All-others CVD rate (company not an AFA recipient)'
      : 'All-others CVD rate applied — manufacturer and exporter required to confirm',
    source_ref: CVD_570_175_SOURCE_REF,
  };
}

export interface AdcvdOrderRow {
  id: string;                    // e.g. "A-570-174"
  case_type: 'AD' | 'CVD';
  product_description: string;
  origin_country: string;
  scope_text: string;
  hts_codes: string[];
  order_published_at: string | null;
  effective_date: string | null;
  status: string;
  china_wide_rate_pct: number | null;
  rates_jsonb: Record<string, number> | null;
  official_url: string;
  federal_register_ref: string | null;
  scope_exclusions: string[] | null;
  last_verified_at: string;
}

export interface AdcvdFinding {
  order: AdcvdOrderRow;
  scope_match: AdcvdScopeMatch;
  matched_facts: string[];          // facts that confirm scope coverage
  missing_facts: string[];          // facts needed for rate or final confirmation
  excluded_by?: string;             // which exclusion applies (when excluded)
  manufacturer?: string | null;     // extracted from product description
  exporter?: string | null;         // extracted from product description
}

// ── Pure scope analysis (no I/O) ──────────────────────────────────────────────

function lc(s: string): string { return s.toLowerCase(); }

// Extract a numeric inch value from text like "15.5 inches", '15.5"', "15 inch", "15 in"
// The "in" short form requires a trailing word boundary to avoid matching inside words
// like "inside" or "origin".
function extractInches(text: string): number | null {
  // Long forms first (greedy, no word-boundary issue)
  const mLong = text.match(/(\d+(?:\.\d+)?)\s*(?:inches?|"|″)/i);
  if (mLong) return parseFloat(mLong[1]);
  // Short form: "15 in" — require at least one space before "in" and word boundary after
  const mShort = text.match(/(\d+(?:\.\d+)?)\s+in\b/i);
  if (mShort) return parseFloat(mShort[1]);
  return null;
}

// Extract a lb/kg weight value from text.
// Handles threshold phrases like "over 50 lbs" or ">50 lbs": returns the
// threshold value + 0.001 so scope checks (wt > 50) behave correctly.
function extractPounds(text: string): number | null {
  // Threshold forms: "over 50 lbs", ">50 lbs", "more than 50 lbs", "greater than 50 lb"
  const mThreshold = text.match(
    /(?:over|>|more\s+than|greater\s+than)\s*(\d+(?:\.\d+)?)\s*(?:pounds|lbs?|lb)/i,
  );
  if (mThreshold) return parseFloat(mThreshold[1]) + 0.001;

  const mLbs = text.match(/(\d+(?:\.\d+)?)\s*(?:pounds|lbs?|lb)/i);
  if (mLbs) return parseFloat(mLbs[1]);
  const mKg = text.match(/(\d+(?:\.\d+)?)\s*(?:kilograms?|kg)/i);
  if (mKg) return parseFloat(mKg[1]) * 2.20462;
  return null;
}

// Extract a steel percentage from text like "38% steel", "steel content approximately 38%".
// No character limit on the second pattern — "steel content approximately 38%" spans 23 chars.
function extractSteelPct(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*%\s*steel/i)
    ?? text.match(/steel[^.]*?(\d+(?:\.\d+)?)\s*%/i);
  return m ? parseFloat(m[1]) : null;
}

/**
 * Pure function: evaluate how well `entry` matches `order`'s written scope.
 * Works entirely from entry.product_name + entry.product_description; no DB.
 */
export function evaluateScopeMatch(
  order: AdcvdOrderRow,
  entry: WatchlistEntry,
): Pick<AdcvdFinding, 'scope_match' | 'matched_facts' | 'missing_facts' | 'excluded_by' | 'manufacturer' | 'exporter'> {
  const text = lc(`${entry.product_name} ${entry.product_description ?? ''}`);
  const matched: string[] = [];
  const missing: string[] = [];

  // ── Scope: Brake Drums (A-570-174 / C-570-175) ───────────────────────────────
  if (order.id.startsWith('A-570-174') || order.id.startsWith('C-570-175')) {
    // Primary inclusion: must contain "brake drum"
    const isBrakeDrum = /\bbrake\s*drum/i.test(text);
    if (!isBrakeDrum) {
      return { scope_match: 'no_match', matched_facts: [], missing_facts: [], excluded_by: undefined, manufacturer: null, exporter: null };
    }
    matched.push('Product identified as a brake drum');

    // Exclusion check: composite drum with > 38% steel by weight.
    // "non-composite" must be detected FIRST: the hyphen before "composite" creates
    // a word boundary, so /\bcomposite\b/ would otherwise match "non-composite" and
    // incorrectly classify the product as a composite drum.
    const steelPct = extractSteelPct(text);
    const isNonComposite = /non[-\s]composite|not\s+composite/i.test(text);
    const isComposite = !isNonComposite && (
      /\bcomposite\b/i.test(text) ||
      /\bsteel.*drum\b/i.test(text) ||
      /\bdrum.*steel\b/i.test(text)
    );
    if (isComposite && (steelPct === null || steelPct > 38)) {
      return {
        scope_match: 'excluded',
        matched_facts: matched,
        missing_facts: [],
        excluded_by: 'Composite brake drums (more than 38% steel by weight) are excluded from the order scope.',
        manufacturer: null,
        exporter: null,
      };
    }
    if (isNonComposite) {
      matched.push('Described as non-composite — composite exclusion does not apply');
      if (steelPct !== null) {
        matched.push(`Steel content ${steelPct}% by weight stated`);
      }
    } else if (steelPct !== null && steelPct <= 38) {
      matched.push(`Steel content ≤38% by weight (${steelPct}%) — composite exclusion does not apply`);
    } else if (steelPct === null && isComposite) {
      missing.push('percentage of steel by weight (to confirm composite exclusion does not apply)');
    } else if (steelPct !== null && steelPct > 38 && !isComposite) {
      missing.push('confirmation whether this is a composite drum (steel > 38% by weight stated)');
    }

    // Material: gray cast iron
    if (/gray\s+cast\s+iron|grey\s+cast\s+iron|cast.iron/i.test(text)) {
      matched.push('Material: gray cast iron (confirmed in description)');
    } else {
      missing.push('material confirmation (order scope: gray cast iron)');
    }

    // Inside diameter: 14.75–16.60 inches
    const dia = extractInches(text);
    if (dia !== null) {
      if (dia >= 14.75 && dia <= 16.60) {
        matched.push(`Inside diameter: ${dia}" — within scope range (14.75–16.60")`);
      } else {
        return {
          scope_match: 'excluded',
          matched_facts: matched,
          missing_facts: [],
          excluded_by: `Inside diameter ${dia}" is outside the scope range of 14.75–16.60 inches.`,
          manufacturer: null,
          exporter: null,
        };
      }
    } else {
      missing.push('inside diameter (scope range: 14.75–16.60 inches)');
    }

    // Weight: > 50 lbs
    const wt = extractPounds(text);
    if (wt !== null) {
      if (wt > 50) {
        matched.push(`Weight: ${Math.round(wt)} lbs — above 50 lb scope threshold`);
      } else {
        return {
          scope_match: 'excluded',
          matched_facts: matched,
          missing_facts: [],
          excluded_by: `Weight ${Math.round(wt)} lbs does not meet the scope threshold of more than 50 lbs.`,
          manufacturer: null,
          exporter: null,
        };
      }
    } else {
      missing.push('weight (scope threshold: more than 50 lbs)');
    }

    // Extract manufacturer/exporter names from clarification facts (e.g. "Manufacturer: Shandong ConMet")
    const mfgM = text.match(/(?:manufacturer|producer)[:\s]+([^\n;,]+)/i);
    const expM = text.match(/exporter[:\s]+([^\n;,]+)/i);
    const manufacturer = mfgM ? mfgM[1].trim() : null;
    const exporter = expM ? expM[1].trim() : null;

    // Producer / exporter needed for specific rate (not for scope determination)
    if (!manufacturer) {
      missing.push('producer/manufacturer name (required for producer-specific AD/CVD rate)');
    }
    if (!exporter) {
      missing.push('exporter name (required for exporter-specific AD/CVD rate)');
    }

    // Scope match level
    const criticalMissing = missing.filter((f) => !f.includes('producer') && !f.includes('exporter'));
    const scopeMatch: AdcvdScopeMatch =
      criticalMissing.length === 0 ? 'likely_match' : 'official_unconfirmed';

    return { scope_match: scopeMatch, matched_facts: matched, missing_facts: missing, manufacturer, exporter };
  }

  // ── Generic fallback for other orders ────────────────────────────────────────
  return {
    scope_match: 'official_unconfirmed',
    matched_facts: ['HTS code falls within the order\'s screened HTS codes'],
    missing_facts: ['written-scope comparison against detailed product facts'],
    manufacturer: null,
    exporter: null,
  };
}

// ── DB-backed screening ───────────────────────────────────────────────────────

/**
 * Screen the submitted entry against active AD/CVD orders. Returns an empty
 * array (never throws) if the adcvd_orders table does not exist yet or if the
 * origin/HTS produces no matches.
 */
export async function screenAdcvd(
  entry: WatchlistEntry,
  normalizedHts: string,
): Promise<AdcvdFinding[]> {
  try {
    const { data, error } = await db
      .from('adcvd_orders')
      .select('*')
      .eq('status', 'active');

    if (error || !data) return [];

    const findings: AdcvdFinding[] = [];

    for (const row of data as AdcvdOrderRow[]) {
      // Filter 1: origin country must match
      const entryOrigin = lc(entry.origin_country);
      const orderOrigin = lc(row.origin_country);
      const originMatches =
        entryOrigin.includes(orderOrigin) ||
        orderOrigin.includes(entryOrigin) ||
        (entryOrigin.includes('china') && orderOrigin.includes('china'));
      if (!originMatches) continue;

      // Filter 2: at least one HTS code in the order must share a prefix with the submitted code
      const htsMatch =
        !normalizedHts ||
        (row.hts_codes ?? []).some((code: string) => {
          const orderDigits = normalizeHts(code);
          const prefix = Math.min(orderDigits.length, normalizedHts.length);
          return (
            orderDigits.slice(0, prefix) === normalizedHts.slice(0, prefix) ||
            normalizedHts.slice(0, prefix) === orderDigits.slice(0, prefix)
          );
        });
      if (!htsMatch) continue;

      // Run scope analysis
      const scopeResult = evaluateScopeMatch(row, entry);
      if (scopeResult.scope_match === 'no_match') continue;

      findings.push({ order: row, ...scopeResult });
    }

    return findings;
  } catch {
    return [];
  }
}

// ── Convert findings to RiskCategory[] and CoverageItem[] ────────────────────

export function adcvdFindingsToCategories(findings: AdcvdFinding[], today: string): RiskCategory[] {
  return findings.map((f) => {
    const { order, scope_match, matched_facts, missing_facts, excluded_by, manufacturer, exporter } = f;
    const isAd = order.case_type === 'AD';
    const label = isAd
      ? `Antidumping Duty — ${order.product_description} (${order.id})`
      : `Countervailing Duty — ${order.product_description} (${order.id})`;

    const verificationStatus =
      scope_match === 'likely_match' ? 'official_unconfirmed' as const
      : scope_match === 'excluded' ? 'no_verified_source' as const
      : 'official_unconfirmed' as const;

    let explanation: string;
    let action: string;
    let level: 'High' | 'Medium' | 'N/A';
    let resolvedRate: number | null = null;

    if (scope_match === 'excluded') {
      level = 'N/A';
      explanation = `This product appears to be excluded from ${order.id}: ${excluded_by}`;
      action = '';
    } else {
      level = 'High';
      const matchSummary = matched_facts.length
        ? `Scope criteria confirmed: ${matched_facts.join('; ')}.`
        : 'HTS code falls within the order scope.';
      const missSummary = missing_facts.filter(m => !/producer|manufacturer|exporter/i.test(m)).length
        ? ` Missing for scope determination: ${missing_facts.filter(m => !/producer|manufacturer|exporter/i.test(m)).join('; ')}.`
        : missing_facts.some(m => /producer|manufacturer|exporter/i.test(m))
          ? ` To calculate the exact duty rate, the producer name and exporter name are required.`
          : '';

      // Rate lookup for orders with known rate tables
      let rateNote = '';
      if (scope_match === 'likely_match') {
        if (order.id === 'A-570-174') {
          const r = lookupBrakeDrumAdRate(manufacturer ?? null, exporter ?? null);
          resolvedRate = r.rate_pct;
          rateNote = ` Cash-deposit rate: ${r.rate_pct}% (${r.rule}). ${r.source_ref}.`;
        } else if (order.id === 'C-570-175') {
          const r = lookupBrakeDrumCvdRate(manufacturer ?? null, exporter ?? null);
          resolvedRate = r.rate_pct;
          rateNote = ` Cash-deposit rate: ${r.rate_pct}% (${r.rule}). ${r.source_ref}.`;
        } else if (order.china_wide_rate_pct != null) {
          rateNote = ` All-others/China-wide cash-deposit rate: ${order.china_wide_rate_pct}%. Company-specific rate requires manufacturer and exporter name.`;
        } else {
          rateNote = ` Exact rate requires manufacturer and exporter name — provide these to determine the applicable cash-deposit rate.`;
        }
      } else if (order.china_wide_rate_pct != null) {
        rateNote = ` Reference rate: ${order.china_wide_rate_pct}%.`;
      }

      explanation = scope_match === 'likely_match'
        ? `Order ${order.id} applies to this product. ${matchSummary}${missSummary}${rateNote}`
        : `Order ${order.id} (${isAd ? 'antidumping' : 'countervailing duty'} on ${order.product_description} from ${order.origin_country}). ${matchSummary}${missSummary}`;

      action = scope_match === 'likely_match'
        ? manufacturer || exporter
          ? `Rate confirmed for the provided manufacturer/exporter. Retain the AD/CVD cash-deposit rate for entry filing.`
          : `Provide your manufacturer and exporter's legal names to determine the exact AD/CVD cash-deposit rate applicable to this shipment.`
        : `Provide additional product facts to confirm scope, then provide manufacturer and exporter names to determine the rate.`;
    }

    return {
      id: `adcvd_${order.id}`,
      category: label,
      level,
      explanation,
      action,
      verification_status: verificationStatus,
      applicability_conditions: `Origin: ${order.origin_country}; scope: ${order.product_description}`,
      missing_info: missing_facts.length ? missing_facts.join('; ') : undefined,
      verified_rate_pct: resolvedRate,
      source: {
        agency: 'Commerce/ITA',
        name: 'U.S. Department of Commerce — International Trade Administration',
        title: `${isAd ? 'Antidumping Duty' : 'Countervailing Duty'} Order ${order.id} — ${order.product_description}`,
        cfr_citation: order.federal_register_ref ?? undefined,
        effective_date: order.effective_date ?? undefined,
        last_verified_at: order.last_verified_at ?? today,
        url: order.official_url,
        why_relevant: 'HTS code and origin country match this standing AD/CVD order; written scope must be confirmed.',
      },
    } satisfies RiskCategory;
  });
}

export function adcvdFindingsToCoverage(findings: AdcvdFinding[], categories: RiskCategory[]): CoverageItem[] {
  return findings.map((f) => {
    const domainKey = `adcvd_${f.order.id}`;
    const linkedCat = categories.find((c) => c.id === domainKey);
    let status: import('../types').CoverageStatus;
    if (f.scope_match === 'excluded') status = 'not_applicable';
    else if (f.scope_match === 'likely_match') status = 'likely_match';
    else status = 'official_unconfirmed';

    return {
      domain: `${f.order.case_type} Order ${f.order.id} — ${f.order.product_description}`,
      domain_key: domainKey,
      category: 'trade_remedy' as const,
      status,
      finding_id: linkedCat?.id,
      note: f.scope_match === 'excluded'
        ? `Outside scope: ${f.excluded_by}`
        : f.scope_match === 'likely_match'
          ? `Product is within scope — exact rate requires manufacturer and exporter`
          : (() => {
              const scopeMissing = f.missing_facts.filter(m => !/producer|manufacturer|exporter/i.test(m));
              return scopeMissing.length > 0
                ? `Cannot determine scope — missing: ${scopeMissing.join('; ')}`
                : `Product appears within scope — confirm with customs broker`;
            })(),
      missing_facts: f.missing_facts.length ? f.missing_facts : undefined,
      official_url: f.order.official_url,
    } satisfies CoverageItem;
  });
}
