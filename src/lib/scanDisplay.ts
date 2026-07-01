/**
 * Pure display-layer functions for the Import Check result page.
 * Extracted so they can be regression-tested without a DOM environment.
 *
 * Status vocabulary (customer-facing):
 *   Applies                  — verified_applicable
 *   Does not apply           — not_applicable / no_applicable_rule
 *   Informational            — informational_no_specific_rule
 *   Within scope             — likely_match (AD/CVD orders)
 *   Cannot determine — missing: [exact fact]  — insufficient_info / official_unconfirmed with missing facts
 *   Official lookup failed   — source_unavailable
 */

import type { ProductRiskScan, CoverageStatus, CoverageItem } from "./api";
import { t } from "./i18n";
import type { Lang } from "./i18n";

export type ImportStatus = "ready" | "checks" | "donot" | "incomplete";

export interface CostRow {
  label: string;
  /** Decisive answer text shown directly to the customer */
  answer: string;
  /** Numeric rate string (e.g. "2.5%") when available — used for display and total calc */
  rateText: string | null;
  /** Numeric rate value for known-total calculation; null when rate is unknown */
  ratePct: number | null;
  status: CoverageStatus;
  coverageItem: CoverageItem;
}

/** Maps coverage domain_key → the risk category id that carries the rate. */
export const DOMAIN_FINDING_MAP: Record<string, string> = {
  mfn_duty: "hts_duty",
  section_301: "hts_section301",
  section_232_auto: "section_232_auto",
  section_122_surcharge: "section_122_surcharge",
};

/**
 * Derive the single plain-sentence import status from the finalized scan.
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
    case "likely_match":        return t(lang, "imp_cost_within_scope");
    case "official_unconfirmed": return t(lang, "imp_cost_cannot_determine");
    case "no_applicable_rule":
    case "not_applicable":      return t(lang, "imp_cost_not_applicable");
    case "informational_no_specific_rule": return t(lang, "imp_cost_informational");
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
    case "informational_no_specific_rule": return "text-slate-500";
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
    const ratePct = cat?.verified_rate_pct ?? null;
    const rateText = ratePct != null ? `${ratePct}%` : null;

    if (c.domain_key === "mfn_duty") {
      const answer = ratePct != null
        ? `${ratePct}%`
        : c.status === "insufficient_info"
          ? "Cannot determine — HTS code required"
          : "Official lookup failed";
      rows.push({ label: t(lang, "imp_costs_base"), answer, rateText, ratePct, status: c.status, coverageItem: c });

    } else if (c.domain_key === "section_301") {
      if (c.status === "not_applicable" || c.status === "no_applicable_rule") {
        rows.push({ label: t(lang, "imp_costs_s301"), answer: "Does not apply", rateText: null, ratePct: null, status: c.status, coverageItem: c });
      } else if (c.status === "verified_applicable" && ratePct != null) {
        const ref = cat?.source?.cfr_citation ?? "9903.88.03";
        rows.push({ label: t(lang, "imp_costs_s301"), answer: `Applies — +${ratePct}% — ${ref}`, rateText, ratePct, status: c.status, coverageItem: c });
      } else if (c.status === "insufficient_info") {
        const missing = c.missing_facts?.join(", ") ?? "exact HTS code";
        rows.push({ label: t(lang, "imp_costs_s301"), answer: `Cannot determine — missing: ${missing}`, rateText: null, ratePct: null, status: c.status, coverageItem: c });
      } else {
        // official_unconfirmed — rate may still be known from the category
        if (ratePct != null) {
          const ref = cat?.source?.cfr_citation ?? "";
          rows.push({ label: t(lang, "imp_costs_s301"), answer: `Applies — +${ratePct}%${ref ? ` — ${ref}` : ""}`, rateText, ratePct, status: c.status, coverageItem: c });
        } else {
          rows.push({ label: t(lang, "imp_costs_s301"), answer: "Cannot determine — exact HTS code required", rateText: null, ratePct: null, status: c.status, coverageItem: c });
        }
      }

    } else if (c.domain_key === "section_232_auto") {
      if (c.status === "not_applicable") {
        rows.push({ label: t(lang, "imp_costs_s232_auto"), answer: "Does not apply", rateText: null, ratePct: null, status: c.status, coverageItem: c });
      } else {
        // verified_applicable for HTS 8708.x
        const rate = ratePct ?? 25;
        rows.push({ label: t(lang, "imp_costs_s232_auto"), answer: `Applies — +${rate}% — 9903.94.05`, rateText: `${rate}%`, ratePct: rate, status: c.status, coverageItem: c });
      }

    } else if (c.domain_key === "section_232") {
      if (c.status === "not_applicable" || c.status === "no_applicable_rule") {
        rows.push({ label: t(lang, "imp_costs_s232"), answer: "Does not apply", rateText: null, ratePct: null, status: c.status, coverageItem: c });
      } else {
        rows.push({ label: t(lang, "imp_costs_s232"), answer: rateText ? `Applies — +${rateText}` : "Confirm with customs broker", rateText, ratePct, status: c.status, coverageItem: c });
      }

    } else if (c.domain_key === "section_122_surcharge") {
      if (c.status === "not_applicable" || c.status === "no_applicable_rule") {
        rows.push({ label: t(lang, "imp_costs_s122"), answer: "Does not apply", rateText: null, ratePct: null, status: c.status, coverageItem: c });
      } else if (c.status === "verified_applicable" && ratePct != null) {
        rows.push({ label: t(lang, "imp_costs_s122"), answer: `Applies — +${ratePct}% — 9903.01.25`, rateText, ratePct, status: c.status, coverageItem: c });
      } else if (c.status === "insufficient_info") {
        const missing = c.missing_facts?.join(", ") ?? "civil aircraft use certification";
        rows.push({ label: t(lang, "imp_costs_s122"), answer: `Cannot determine — missing: ${missing}`, rateText: null, ratePct: null, status: c.status, coverageItem: c });
      } else {
        rows.push({ label: t(lang, "imp_costs_s122"), answer: "Cannot determine — confirm applicability", rateText: null, ratePct: null, status: c.status, coverageItem: c });
      }

    } else if (c.domain_key.startsWith("adcvd_A-")) {
      const caseId = c.domain_key.replace("adcvd_", "");
      if (c.status === "not_applicable") {
        rows.push({ label: t(lang, "imp_costs_ad"), answer: `Does not apply — outside order scope`, rateText: null, ratePct: null, status: c.status, coverageItem: c });
      } else if (c.status === "likely_match") {
        const scopeMissing = (c.missing_facts ?? []).filter((f) => !/producer|manufacturer|exporter/i.test(f));
        const needsParty = (c.missing_facts ?? []).some((f) => /producer|manufacturer|exporter/i.test(f));
        if (scopeMissing.length === 0 && needsParty) {
          rows.push({ label: t(lang, "imp_costs_ad"), answer: `Order ${caseId} — within scope — exact rate requires manufacturer and exporter name`, rateText: null, ratePct: null, status: c.status, coverageItem: c });
        } else if (scopeMissing.length > 0) {
          rows.push({ label: t(lang, "imp_costs_ad"), answer: `Cannot determine scope — missing: ${scopeMissing.join("; ")}`, rateText: null, ratePct: null, status: c.status, coverageItem: c });
        } else {
          rows.push({ label: t(lang, "imp_costs_ad"), answer: `Order ${caseId} — within scope`, rateText: null, ratePct: null, status: c.status, coverageItem: c });
        }
      } else {
        const scopeMissing = (c.missing_facts ?? []).filter((f) => !/producer|manufacturer|exporter/i.test(f));
        rows.push({ label: t(lang, "imp_costs_ad"), answer: scopeMissing.length ? `Cannot determine scope — missing: ${scopeMissing.join("; ")}` : `Order ${caseId} — scope check in progress`, rateText: null, ratePct: null, status: c.status, coverageItem: c });
      }

    } else if (c.domain_key.startsWith("adcvd_C-")) {
      const caseId = c.domain_key.replace("adcvd_", "");
      if (c.status === "not_applicable") {
        rows.push({ label: t(lang, "imp_costs_cvd"), answer: `Does not apply — outside order scope`, rateText: null, ratePct: null, status: c.status, coverageItem: c });
      } else if (c.status === "likely_match") {
        const scopeMissing = (c.missing_facts ?? []).filter((f) => !/producer|manufacturer|exporter/i.test(f));
        const needsParty = (c.missing_facts ?? []).some((f) => /producer|manufacturer|exporter/i.test(f));
        if (scopeMissing.length === 0 && needsParty) {
          rows.push({ label: t(lang, "imp_costs_cvd"), answer: `Order ${caseId} — within scope — exact rate requires manufacturer and exporter name`, rateText: null, ratePct: null, status: c.status, coverageItem: c });
        } else if (scopeMissing.length > 0) {
          rows.push({ label: t(lang, "imp_costs_cvd"), answer: `Cannot determine scope — missing: ${scopeMissing.join("; ")}`, rateText: null, ratePct: null, status: c.status, coverageItem: c });
        } else {
          rows.push({ label: t(lang, "imp_costs_cvd"), answer: `Order ${caseId} — within scope`, rateText: null, ratePct: null, status: c.status, coverageItem: c });
        }
      } else {
        const scopeMissing = (c.missing_facts ?? []).filter((f) => !/producer|manufacturer|exporter/i.test(f));
        rows.push({ label: t(lang, "imp_costs_cvd"), answer: scopeMissing.length ? `Cannot determine scope — missing: ${scopeMissing.join("; ")}` : `Order ${caseId} — scope check in progress`, rateText: null, ratePct: null, status: c.status, coverageItem: c });
      }
    }
  }

  return rows;
}

/** Sum the known-rate tariff rows and indicate whether the total is complete. */
export function computeKnownTariffTotal(rows: CostRow[]): { knownPct: number; hasUnknown: boolean } {
  let knownPct = 0;
  let hasUnknown = false;
  for (const row of rows) {
    if (row.ratePct != null) {
      knownPct += row.ratePct;
    } else if (
      row.status !== "not_applicable" &&
      row.status !== "no_applicable_rule" &&
      row.status !== "informational_no_specific_rule"
    ) {
      hasUnknown = true;
    }
  }
  return { knownPct, hasUnknown };
}

// ── MPF / HMF ────────────────────────────────────────────────────────────────

const MPF_RATE_PCT = 0.3464;
// FY2026 (Oct 1 2025 – Sep 30 2026) CBP-published MPF floor/ceiling.
const MPF_MIN_USD = 33.58;
const MPF_MAX_USD = 651.50;
const HMF_RATE_PCT = 0.125;

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

export function calculateMpf(customsValueUsd: number): { amount: number; basisText: string } {
  const raw = (customsValueUsd * MPF_RATE_PCT) / 100;
  const amount = Math.min(Math.max(raw, MPF_MIN_USD), MPF_MAX_USD);
  const capped =
    raw < MPF_MIN_USD ? " (minimum applied)" : raw > MPF_MAX_USD ? " (maximum applied)" : "";
  return { amount, basisText: `${fmtUsd(customsValueUsd)} × ${MPF_RATE_PCT}% = ${fmtUsd(raw)}${capped}` };
}

export function calculateHmf(customsValueUsd: number): { amount: number; basisText: string } {
  const amount = (customsValueUsd * HMF_RATE_PCT) / 100;
  return { amount, basisText: `${fmtUsd(customsValueUsd)} × ${HMF_RATE_PCT}%` };
}

// ── Enhanced cost rows (dollar amounts + MPF/HMF) ────────────────────────────

export interface CostRowV2 {
  label: string;
  rateText: string | null;
  ratePct: number | null;
  dollarText: string | null;
  calcBasis: string;
  status: CoverageStatus;
  answer: string;
  coverageItem: CoverageItem | null;
}

export type TransportMode = "ocean" | "air" | "truck" | "rail" | null;

export function buildEnhancedCostRows(
  scan: ProductRiskScan,
  lang: Lang,
  customsValueUsd?: number,
  transportMode?: TransportMode,
): CostRowV2[] {
  const base = buildCostRows(scan, lang);
  const result: CostRowV2[] = base.map((r) => {
    const dollarAmount =
      r.ratePct != null && customsValueUsd != null
        ? (r.ratePct / 100) * customsValueUsd
        : null;
    return {
      label: r.label,
      rateText: r.rateText,
      ratePct: r.ratePct,
      dollarText: dollarAmount != null ? fmtUsd(dollarAmount) : null,
      calcBasis:
        r.ratePct != null && customsValueUsd != null
          ? `${fmtUsd(customsValueUsd)} × ${r.ratePct}%`
          : r.ratePct != null
            ? `${r.ratePct}% of customs value`
            : "",
      status: r.status,
      answer: r.answer,
      coverageItem: r.coverageItem,
    };
  });

  if (customsValueUsd != null) {
    const mpf = calculateMpf(customsValueUsd);
    result.push({
      label: "Merchandise Processing Fee (MPF)",
      rateText: `${MPF_RATE_PCT}%`,
      ratePct: MPF_RATE_PCT,
      dollarText: fmtUsd(mpf.amount),
      calcBasis: mpf.basisText,
      status: "verified_applicable",
      answer: fmtUsd(mpf.amount),
      coverageItem: null,
    });
  } else {
    result.push({
      label: "Merchandise Processing Fee (MPF)",
      rateText: `${MPF_RATE_PCT}%`,
      ratePct: null,
      dollarText: null,
      calcBasis: `${MPF_RATE_PCT}% of customs value, min $${MPF_MIN_USD}, max $${MPF_MAX_USD}`,
      status: "insufficient_info",
      answer: "Cannot calculate — customs value not provided",
      coverageItem: null,
    });
  }

  if (transportMode === "ocean") {
    if (customsValueUsd != null) {
      const hmf = calculateHmf(customsValueUsd);
      result.push({
        label: "Harbor Maintenance Fee (HMF)",
        rateText: `${HMF_RATE_PCT}%`,
        ratePct: HMF_RATE_PCT,
        dollarText: fmtUsd(hmf.amount),
        calcBasis: hmf.basisText,
        status: "verified_applicable",
        answer: fmtUsd(hmf.amount),
        coverageItem: null,
      });
    } else {
      result.push({
        label: "Harbor Maintenance Fee (HMF)",
        rateText: `${HMF_RATE_PCT}%`,
        ratePct: null,
        dollarText: null,
        calcBasis: `${HMF_RATE_PCT}% of cargo value (ocean) — provide goods value to calculate`,
        status: "insufficient_info",
        answer: "Cannot calculate — goods value not provided",
        coverageItem: null,
      });
    }
  } else if (transportMode === "air" || transportMode === "truck" || transportMode === "rail") {
    result.push({
      label: "Harbor Maintenance Fee (HMF)",
      rateText: null,
      ratePct: null,
      dollarText: null,
      calcBasis: "HMF applies to qualifying ocean imports only",
      status: "not_applicable",
      answer: "Not applicable — not an ocean shipment",
      coverageItem: null,
    });
  } else {
    result.push({
      label: "Harbor Maintenance Fee (HMF)",
      rateText: `${HMF_RATE_PCT}%`,
      ratePct: null,
      dollarText: null,
      calcBasis: `${HMF_RATE_PCT}% of cargo value — ocean imports only`,
      status: "insufficient_info",
      answer: "Cannot determine — missing: shipping method (ocean, air, or land)",
      coverageItem: null,
    });
  }

  return result;
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
    .filter(
      (c) =>
        c.missing_info &&
        c.verification_status !== "verified_applicable" &&
        c.verification_status !== "not_applicable",
    )
    .forEach((c) => add(c.missing_info!));

  return result;
}
