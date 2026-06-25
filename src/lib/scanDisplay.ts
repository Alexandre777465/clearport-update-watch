/**
 * Pure display-layer functions for the Import Check result page.
 * Extracted so they can be regression-tested without a DOM environment.
 */

import type { ProductRiskScan, CoverageStatus, CoverageItem } from "./api";
import { t } from "./i18n";
import type { Lang } from "./i18n";

export type ImportStatus = "ready" | "checks" | "donot" | "incomplete";

export interface CostRow {
  label: string;
  rateText: string | null;
  status: CoverageStatus;
  coverageItem: CoverageItem;
}

/** Maps coverage domain_key → the risk category id that carries the rate. */
export const DOMAIN_FINDING_MAP: Record<string, string> = {
  mfn_duty: "hts_duty",
  section_301: "hts_section301",
};

/**
 * Derive the single plain-sentence import status from the finalized scan.
 *
 *  incomplete — any source_unavailable or insufficient_info domain present
 *  donot      — any Critical + verified finding
 *  checks     — any likely_match or official_unconfirmed domain
 *  ready      — nothing pending
 */
export function computeOverallStatus(scan: ProductRiskScan): ImportStatus {
  const cm = scan.coverage_matrix;
  if (!cm || cm.length === 0) return "incomplete";

  if (cm.some((c) => c.status === "source_unavailable" || c.status === "insufficient_info")) {
    return "incomplete";
  }

  const hasCriticalVerified = scan.risk_categories.some(
    (c) =>
      c.level === "Critical" &&
      (c.verification_status === "verified_applicable" ||
        c.verification_status === "official_unconfirmed"),
  );
  if (hasCriticalVerified) return "donot";

  if (cm.some((c) => c.status === "likely_match" || c.status === "official_unconfirmed")) {
    return "checks";
  }

  return "ready";
}

export function coverageCostLabel(status: CoverageStatus, lang: Lang): string {
  switch (status) {
    case "verified_applicable": return t(lang, "imp_cost_confirmed");
    case "likely_match":        return t(lang, "imp_cost_likely");
    case "official_unconfirmed": return t(lang, "imp_cost_may_apply");
    case "no_applicable_rule":
    case "not_applicable":      return t(lang, "imp_cost_not_applicable");
    case "source_unavailable":  return t(lang, "imp_cost_unavailable");
    default:                    return t(lang, "imp_cost_unknown");
  }
}

export function coverageCostClass(status: CoverageStatus): string {
  switch (status) {
    case "verified_applicable": return "text-green-700";
    case "likely_match":
    case "official_unconfirmed": return "text-amber-700";
    case "no_applicable_rule":
    case "not_applicable":      return "text-slate-400";
    case "source_unavailable":  return "text-red-600";
    default:                    return "text-slate-500";
  }
}

export function buildCostRows(scan: ProductRiskScan, lang: Lang): CostRow[] {
  const cm = scan.coverage_matrix ?? [];
  const rows: CostRow[] = [];

  for (const c of cm) {
    const fallbackId = DOMAIN_FINDING_MAP[c.domain_key];
    const cat = c.finding_id
      ? scan.risk_categories.find((r) => r.id === c.finding_id)
      : fallbackId
        ? scan.risk_categories.find((r) => r.id === fallbackId)
        : undefined;
    const rateText = cat?.verified_rate_pct != null ? `${cat.verified_rate_pct}%` : null;

    if (c.domain_key === "mfn_duty") {
      rows.push({ label: t(lang, "imp_costs_base"), rateText, status: c.status, coverageItem: c });
    } else if (c.domain_key === "section_301") {
      rows.push({ label: t(lang, "imp_costs_s301"), rateText, status: c.status, coverageItem: c });
    } else if (c.domain_key === "section_232") {
      rows.push({ label: t(lang, "imp_costs_s232"), rateText, status: c.status, coverageItem: c });
    } else if (c.domain_key.startsWith("adcvd_A-")) {
      rows.push({ label: t(lang, "imp_costs_ad"), rateText, status: c.status, coverageItem: c });
    } else if (c.domain_key.startsWith("adcvd_C-")) {
      rows.push({ label: t(lang, "imp_costs_cvd"), rateText, status: c.status, coverageItem: c });
    }
  }

  return rows;
}

export function collectMissingFacts(scan: ProductRiskScan): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const add = (s: string) => {
    const key = s.trim().toLowerCase();
    if (!seen.has(key)) { seen.add(key); result.push(s.trim()); }
  };

  (scan.missing_facts ?? []).forEach(add);

  (scan.coverage_matrix ?? [])
    .filter((c) => c.status === "official_unconfirmed" || c.status === "likely_match" || c.status === "insufficient_info")
    .forEach((c) => (c.missing_facts ?? []).forEach(add));

  scan.risk_categories
    .filter((c) => c.missing_info)
    .forEach((c) => add(c.missing_info!));

  return result;
}
