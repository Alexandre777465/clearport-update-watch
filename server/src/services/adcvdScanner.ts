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
}

// ── Pure scope analysis (no I/O) ──────────────────────────────────────────────

function lc(s: string): string { return s.toLowerCase(); }

// Extract a numeric inch value from text like "15.5 inches", '15.5"', "15 inch"
function extractInches(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:inches|inch|"|″)/i);
  return m ? parseFloat(m[1]) : null;
}

// Extract a lb/kg weight value from text
function extractPounds(text: string): number | null {
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
): Pick<AdcvdFinding, 'scope_match' | 'matched_facts' | 'missing_facts' | 'excluded_by'> {
  const text = lc(`${entry.product_name} ${entry.product_description ?? ''}`);
  const matched: string[] = [];
  const missing: string[] = [];

  // ── Scope: Brake Drums (A-570-174 / C-570-175) ───────────────────────────────
  if (order.id.startsWith('A-570-174') || order.id.startsWith('C-570-175')) {
    // Primary inclusion: must contain "brake drum"
    const isBrakeDrum = /\bbrake\s*drum/i.test(text);
    if (!isBrakeDrum) {
      return { scope_match: 'no_match', matched_facts: [], missing_facts: [], excluded_by: undefined };
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
        };
      }
    } else {
      missing.push('weight (scope threshold: more than 50 lbs)');
    }

    // Producer / exporter needed for specific rate (not for scope determination)
    if (!/manufacturer|producer|brand|maker/i.test(text)) {
      missing.push('producer/manufacturer name (required for producer-specific AD/CVD rate)');
    }
    missing.push('exporter name (required for exporter-specific AD/CVD rate)');

    // Scope match level
    const criticalMissing = missing.filter((f) => !f.includes('producer') && !f.includes('exporter'));
    const scopeMatch: AdcvdScopeMatch =
      criticalMissing.length === 0 ? 'likely_match' : 'official_unconfirmed';

    return { scope_match: scopeMatch, matched_facts: matched, missing_facts: missing };
  }

  // ── Generic fallback for other orders ────────────────────────────────────────
  // For orders without a specific evaluator: match on HTS only (already done
  // by the HTS filter upstream); report 'official_unconfirmed' with scope text.
  return {
    scope_match: 'official_unconfirmed',
    matched_facts: ['HTS code falls within the order\'s screened HTS codes'],
    missing_facts: ['written-scope comparison against detailed product facts'],
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
    const { order, scope_match, matched_facts, missing_facts, excluded_by } = f;
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

    if (scope_match === 'excluded') {
      level = 'N/A';
      explanation = `This product appears to be excluded from ${order.id}: ${excluded_by}`;
      action = '';
    } else {
      level = 'High';
      const matchSummary = matched_facts.length
        ? `Matched scope criteria: ${matched_facts.join('; ')}.`
        : 'HTS code falls within the order scope.';
      const missSummary = missing_facts.length
        ? ` Missing for rate confirmation: ${missing_facts.join('; ')}.`
        : '';
      explanation =
        `${order.id} is an active ${isAd ? 'antidumping' : 'countervailing duty'} order on ${order.product_description} from ${order.origin_country}. ${matchSummary}${missSummary} Written scope controls — HTS code is a screening signal only. Confirm with CBP/customs broker before importing.`;

      const rateNote = order.china_wide_rate_pct != null
        ? ` China-wide/all-others rate: ${order.china_wide_rate_pct}%. Confirm current rate with your broker.`
        : ' Confirm current rate with your customs broker — rates vary by producer/exporter.';

      action = `Contact your customs broker to verify whether this product falls within the ${order.id} scope and confirm the applicable ${isAd ? 'AD' : 'CVD'} rate.${rateNote}`;
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
      verified_rate_pct: null,
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
        ? `Excluded: ${f.excluded_by}`
        : f.scope_match === 'likely_match'
          ? `Scope criteria met — producer/exporter confirmation required for exact rate`
          : `Order screened — applicability needs confirmation`,
      missing_facts: f.missing_facts.length ? f.missing_facts : undefined,
      official_url: f.order.official_url,
    } satisfies CoverageItem;
  });
}
