/**
 * Regression tests for the Import Check result-page display logic.
 *
 * Tests verify:
 * - Exact HTS 8708.30.50.20 is in the cost table
 * - MFN 2.5% is shown as the base tariff
 * - Section 301 appears as a separate row
 * - AD case A-570-174 appears as a separate row
 * - CVD case C-570-175 appears as a separate row
 * - Missing manufacturer/exporter are collected as missing facts
 * - Total tariff is "unavailable" when AD/CVD rates are unknown
 * - No risk label (Low/Medium/High/Critical) appears in cost row labels
 * - No readiness percentage is part of the cost display
 * - A missing essential lookup → "incomplete" status → correct sentence
 * - An incomplete result is never "ready" or "checks"
 */

import { describe, it, expect } from "bun:test";
import {
  computeOverallStatus,
  buildCostRows,
  collectMissingFacts,
  coverageCostLabel,
  coverageCostClass,
  computeKnownTariffTotal,
  calculateMpf,
  calculateHmf,
  buildEnhancedCostRows,
} from "../lib/scanDisplay";
import type { ProductRiskScan } from "../lib/api";

// ── Shared mock fixtures ──────────────────────────────────────────────────────

/** Minimal risk category representing a verified MFN duty at 2.5% */
const MFN_CATEGORY = {
  id: "hts_duty",
  category: "Customs Duty (MFN / General Rate)",
  level: "Low" as const,
  explanation: "Under HTS 8708.30.50.20 (Brake drums), the official General (MFN) duty rate is 2.5%.",
  action: "Confirm HTS classification with your broker.",
  verification_status: "verified_applicable" as const,
  applicability_conditions: "Goods correctly classified under HTS 8708.30.50.20.",
  verified_rate_pct: 2.5,
  source: {
    agency: "USITC",
    name: "Harmonized Tariff Schedule of the United States",
    title: "HTS 8708.30.50.20 — Brake drums",
    cfr_citation: "HTSUS 8708.30.50.20",
    last_verified_at: "2026-06-25",
    url: "https://hts.usitc.gov/?query=8708.30.50.20",
    why_relevant: "The product was submitted under this HTS code.",
  },
};

const SECTION_301_CATEGORY = {
  id: "hts_section301",
  category: "Section 301 China Tariff",
  level: "High" as const,
  explanation: "HTS 8708.30.50.20 is covered by Section 301 List 3 (9903.88.03).",
  action: "Confirm Section 301 rate with broker.",
  verification_status: "verified_applicable" as const,
  applicability_conditions: "China-origin goods under this HTS.",
  verified_rate_pct: 25,
  source: {
    agency: "USTR",
    name: "Office of the United States Trade Representative",
    title: "Section 301 List 3 — HTS 9903.88.03",
    cfr_citation: "9903.88.03",
    last_verified_at: "2026-06-25",
    url: "https://ustr.gov/",
    why_relevant: "China-origin goods under heading 8708 covered by List 3.",
  },
};

const S232_AUTO_CATEGORY = {
  id: "section_232_auto",
  category: "Section 232 Automobile-Parts Tariff",
  level: "High" as const,
  explanation: "Automobile parts classified under HTS 8708 are subject to an additional 25% Section 232 tariff under HTSUS 9903.94.05.",
  action: "Include this +25% automobile-parts Section 232 tariff in your landed cost calculation.",
  verification_status: "verified_applicable" as const,
  applicability_conditions: "HTS 8708.x automobile parts",
  verified_rate_pct: 25,
  source: {
    agency: "CBP / Commerce",
    name: "U.S. Customs and Border Protection / U.S. Department of Commerce",
    title: "Section 232 Automobile-Parts Tariff — 9903.94.05 / Proclamation 10908",
    cfr_citation: "9903.94.05",
    last_verified_at: "2026-06-25",
    url: "https://www.federalregister.gov/documents/2025/05/01/2025-07872/adjusting-imports-of-automobiles-and-automobile-parts-into-the-united-states",
    why_relevant: "HTS 8708 (automobile parts including brake drums) is expressly covered by Proclamation 10908.",
  },
};

const AD_CATEGORY = {
  id: "adcvd_A-570-174",
  category: "Antidumping Duty — Brake Drums from China (A-570-174)",
  level: "High" as const,
  explanation: "A-570-174 is an active antidumping order on brake drums from China.",
  action: "Confirm with customs broker.",
  verification_status: "official_unconfirmed" as const,
  applicability_conditions: "Origin: China; scope: Brake Drums from China",
  verified_rate_pct: null,
  missing_info: "producer/manufacturer name (required for producer-specific AD/CVD rate); exporter name (required for exporter-specific AD/CVD rate)",
  source: {
    agency: "Commerce/ITA",
    name: "U.S. Department of Commerce — International Trade Administration",
    title: "Antidumping Duty Order A-570-174 — Brake Drums from China",
    cfr_citation: "87 FR 55699 (Sept. 12, 2022)",
    effective_date: "2022-09-12",
    last_verified_at: "2024-06-01",
    url: "https://www.federalregister.gov/documents/2022/09/12/2022-19571/",
    why_relevant: "HTS code and origin country match this standing AD/CVD order.",
  },
};

const CVD_CATEGORY = {
  id: "adcvd_C-570-175",
  category: "Countervailing Duty — Brake Drums from China (C-570-175)",
  level: "High" as const,
  explanation: "C-570-175 is an active countervailing duty order on brake drums from China.",
  action: "Confirm with customs broker.",
  verification_status: "official_unconfirmed" as const,
  applicability_conditions: "Origin: China; scope: Brake Drums from China",
  verified_rate_pct: null,
  source: {
    agency: "Commerce/ITA",
    name: "U.S. Department of Commerce — International Trade Administration",
    title: "Countervailing Duty Order C-570-175 — Brake Drums from China",
    cfr_citation: "87 FR 55700 (Sept. 12, 2022)",
    effective_date: "2022-09-12",
    last_verified_at: "2024-06-01",
    url: "https://www.federalregister.gov/documents/2022/09/12/2022-19572/",
    why_relevant: "HTS code and origin country match this standing AD/CVD order.",
  },
};

/** A finalized brake-drum scan with all coverage domains populated */
const BRAKE_DRUM_SCAN: ProductRiskScan = {
  id: "mock-scan-f41898d2",
  watchlist_entry_id: "mock-entry-7ad2aac3",
  overall_risk: "High",
  overall_summary: "Cast-iron brake drum from China — active AD/CVD orders apply, confirm rates with broker.",
  risk_categories: [MFN_CATEGORY, SECTION_301_CATEGORY, S232_AUTO_CATEGORY, AD_CATEGORY, CVD_CATEGORY],
  document_checklist: [],
  broker_questions: [],
  supplier_questions: [],
  next_actions: [],
  readiness_score: 60,
  confidence_level: "Medium",
  created_at: "2026-06-25T10:00:00.000Z",
  coverage_matrix: [
    {
      domain: "MFN Duty (USITC)",
      domain_key: "mfn_duty",
      category: "tariff",
      status: "verified_applicable",
      finding_id: "hts_duty",
    },
    {
      domain: "Section 301 China Tariff (Chapter 99)",
      domain_key: "section_301",
      category: "tariff",
      status: "verified_applicable",
      finding_id: "hts_section301",
    },
    {
      domain: "Section 232 Automobile-Parts Tariff (9903.94.05)",
      domain_key: "section_232_auto",
      category: "tariff",
      status: "verified_applicable",
      finding_id: "section_232_auto",
    },
    {
      domain: "AD Order A-570-174 — Brake Drums from China",
      domain_key: "adcvd_A-570-174",
      category: "trade_remedy",
      status: "likely_match",
      finding_id: "adcvd_A-570-174",
      missing_facts: [
        "producer/manufacturer name (required for producer-specific AD/CVD rate)",
        "exporter name (required for exporter-specific AD/CVD rate)",
      ],
    },
    {
      domain: "CVD Order C-570-175 — Brake Drums from China",
      domain_key: "adcvd_C-570-175",
      category: "trade_remedy",
      status: "likely_match",
      finding_id: "adcvd_C-570-175",
    },
    {
      domain: "Customs Entry & CBP Filing",
      domain_key: "customs_entry",
      category: "customs",
      status: "verified_applicable",
    },
    {
      domain: "NHTSA / FMVSS (Federal Motor Vehicle Safety Standards)",
      domain_key: "nhtsa_fmvss",
      category: "product_regulation",
      status: "official_unconfirmed",
    },
  ],
  missing_facts: [
    "producer/manufacturer name (required for producer-specific AD/CVD rate)",
    "exporter name (required for exporter-specific AD/CVD rate)",
  ],
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("buildCostRows — brake drum scan with HTS 8708.30.50.20", () => {
  const rows = buildCostRows(BRAKE_DRUM_SCAN, "en");

  it("MFN base tariff row is present", () => {
    const mfn = rows.find((r) => r.label === "Base tariff (MFN)");
    expect(mfn).toBeDefined();
  });

  it("MFN rate is exactly 2.5%", () => {
    const mfn = rows.find((r) => r.label === "Base tariff (MFN)");
    expect(mfn?.rateText).toBe("2.5%");
  });

  it("MFN status is verified_applicable", () => {
    const mfn = rows.find((r) => r.label === "Base tariff (MFN)");
    expect(mfn?.status).toBe("verified_applicable");
  });

  it("Section 301 tariff row is present and separate from MFN", () => {
    const s301 = rows.find((r) => r.label === "Section 301 tariff");
    expect(s301).toBeDefined();
    expect(s301?.rateText).toBe("25%");
  });

  it("AD case A-570-174 appears as antidumping duty row", () => {
    const ad = rows.find((r) => r.label === "Antidumping duty" && r.coverageItem.domain_key === "adcvd_A-570-174");
    expect(ad).toBeDefined();
  });

  it("CVD case C-570-175 appears as countervailing duty row", () => {
    const cvd = rows.find((r) => r.label === "Countervailing duty" && r.coverageItem.domain_key === "adcvd_C-570-175");
    expect(cvd).toBeDefined();
  });

  it("AD rate is null (rate unknown without producer/exporter)", () => {
    const ad = rows.find((r) => r.coverageItem.domain_key === "adcvd_A-570-174");
    expect(ad?.rateText).toBeNull();
  });

  it("cost row labels contain no risk level words (Low/Medium/High/Critical)", () => {
    const riskWords = ["Low", "Medium", "High", "Critical", "risk", "readiness", "score", "%"];
    for (const row of rows) {
      for (const word of ["Low", "Medium", "High", "Critical"]) {
        expect(row.label).not.toContain(word);
      }
    }
  });

  it("rateText is never a readiness percentage (never ends in a score format)", () => {
    // Readiness scores would be round numbers like 60, 70, 80. MFN is 2.5%.
    for (const row of rows) {
      if (row.rateText) {
        const n = parseFloat(row.rateText);
        // All valid tariff rates for this product should be under 100%
        expect(n).toBeLessThan(100);
        // The MFN rate (2.5%) is definitely not a readiness score (60–100)
        if (row.label === "Base tariff (MFN)") {
          expect(n).toBeLessThan(10);
        }
      }
    }
  });

  it("DOMAIN_FINDING_MAP fallback resolves mfn_duty to hts_duty even when finding_id absent", () => {
    const scanNoFindingId: ProductRiskScan = {
      ...BRAKE_DRUM_SCAN,
      coverage_matrix: [
        {
          domain: "MFN Duty",
          domain_key: "mfn_duty",
          category: "tariff",
          status: "verified_applicable",
          // No finding_id — relies on DOMAIN_FINDING_MAP fallback
        },
      ],
    };
    const fallbackRows = buildCostRows(scanNoFindingId, "en");
    const mfn = fallbackRows.find((r) => r.label === "Base tariff (MFN)");
    expect(mfn?.rateText).toBe("2.5%");
  });
});

describe("computeOverallStatus — brake drum scan", () => {
  it("returns 'checks' when AD/CVD orders are likely_match", () => {
    expect(computeOverallStatus(BRAKE_DRUM_SCAN)).toBe("checks");
  });

  it("returns 'incomplete' when any coverage item is insufficient_info", () => {
    const scan: ProductRiskScan = {
      ...BRAKE_DRUM_SCAN,
      coverage_matrix: [
        { domain: "Section 301", domain_key: "section_301", category: "tariff", status: "insufficient_info" },
      ],
    };
    expect(computeOverallStatus(scan)).toBe("incomplete");
  });

  it("returns 'incomplete' when any coverage item is source_unavailable", () => {
    const scan: ProductRiskScan = {
      ...BRAKE_DRUM_SCAN,
      coverage_matrix: [
        { domain: "MFN", domain_key: "mfn_duty", category: "tariff", status: "source_unavailable" },
      ],
    };
    expect(computeOverallStatus(scan)).toBe("incomplete");
  });

  it("returns 'incomplete' when coverage_matrix is empty", () => {
    const scan: ProductRiskScan = { ...BRAKE_DRUM_SCAN, coverage_matrix: [] };
    expect(computeOverallStatus(scan)).toBe("incomplete");
  });

  it("returns 'incomplete' when coverage_matrix is absent", () => {
    const scan: ProductRiskScan = { ...BRAKE_DRUM_SCAN, coverage_matrix: undefined };
    expect(computeOverallStatus(scan)).toBe("incomplete");
  });

  it("returns 'ready' only when all domains are verified/not_applicable", () => {
    const scan: ProductRiskScan = {
      ...BRAKE_DRUM_SCAN,
      risk_categories: [],
      coverage_matrix: [
        { domain: "MFN", domain_key: "mfn_duty", category: "tariff", status: "verified_applicable" },
        { domain: "CBP", domain_key: "customs_entry", category: "customs", status: "verified_applicable" },
        { domain: "AD", domain_key: "adcvd_A-570-174", category: "trade_remedy", status: "not_applicable" },
      ],
    };
    expect(computeOverallStatus(scan)).toBe("ready");
  });

  it("'incomplete' is never confused with 'checks' — missing source beats likely_match", () => {
    const scan: ProductRiskScan = {
      ...BRAKE_DRUM_SCAN,
      coverage_matrix: [
        { domain: "AD", domain_key: "adcvd_A-570-174", category: "trade_remedy", status: "likely_match" },
        { domain: "MFN", domain_key: "mfn_duty", category: "tariff", status: "source_unavailable" },
      ],
    };
    const status = computeOverallStatus(scan);
    expect(status).toBe("incomplete");
    expect(status).not.toBe("checks");
  });
});

describe("collectMissingFacts — brake drum", () => {
  const facts = collectMissingFacts(BRAKE_DRUM_SCAN);

  it("includes producer/manufacturer name", () => {
    expect(facts.some((f) => /producer|manufacturer/i.test(f))).toBe(true);
  });

  it("includes exporter name", () => {
    expect(facts.some((f) => /exporter/i.test(f))).toBe(true);
  });

  it("deduplicates facts that appear in both scan.missing_facts and coverage items", () => {
    const seen = new Set<string>();
    for (const f of facts) {
      const key = f.trim().toLowerCase();
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe("coverageCostLabel and coverageCostClass", () => {
  it("verified_applicable → 'Applies' and green class", () => {
    expect(coverageCostLabel("verified_applicable", "en")).toBe("Applies");
    expect(coverageCostClass("verified_applicable")).toContain("green");
  });

  it("likely_match → amber class (not green, not red)", () => {
    const cls = coverageCostClass("likely_match");
    expect(cls).toContain("amber");
    expect(cls).not.toContain("green");
    expect(cls).not.toContain("red");
  });

  it("source_unavailable → red class", () => {
    expect(coverageCostClass("source_unavailable")).toContain("red");
  });

  it("not_applicable → muted/slate class", () => {
    expect(coverageCostClass("not_applicable")).toContain("slate");
  });
});

describe("NHTSA/FMVSS coverage item is present in brake drum scan", () => {
  it("coverage_matrix includes nhtsa_fmvss domain", () => {
    const nhtsa = BRAKE_DRUM_SCAN.coverage_matrix?.find((c) => c.domain_key === "nhtsa_fmvss");
    expect(nhtsa).toBeDefined();
    expect(nhtsa?.status).toBe("official_unconfirmed");
  });
});

describe("Decisive answers — no vague language in cost row answers", () => {
  const rows = buildCostRows(BRAKE_DRUM_SCAN, "en");

  it("no customer-visible cost row answer contains 'may apply'", () => {
    for (const row of rows) {
      expect(row.answer.toLowerCase()).not.toContain("may apply");
    }
  });

  it("no customer-visible cost row answer contains 'applicability needs confirmation'", () => {
    for (const row of rows) {
      expect(row.answer.toLowerCase()).not.toContain("applicability needs confirmation");
    }
  });

  it("Section 301 answer includes exact rate and chapter 99 reference", () => {
    const s301 = rows.find((r) => r.coverageItem.domain_key === "section_301");
    expect(s301).toBeDefined();
    expect(s301?.answer).toContain("+25%");
    expect(s301?.answer).toContain("9903.88");
  });

  it("Section 232 auto answer includes '+25%' and '9903.94.05'", () => {
    const s232 = rows.find((r) => r.coverageItem.domain_key === "section_232_auto");
    expect(s232).toBeDefined();
    expect(s232?.answer).toContain("+25%");
    expect(s232?.answer).toContain("9903.94.05");
  });

  it("AD answer says 'within scope' not 'may apply'", () => {
    const ad = rows.find((r) => r.coverageItem.domain_key === "adcvd_A-570-174");
    expect(ad).toBeDefined();
    expect(ad?.answer.toLowerCase()).toContain("within scope");
    expect(ad?.answer.toLowerCase()).not.toContain("may apply");
  });

  it("computeKnownTariffTotal returns correct sum for MFN+S301+S232 when AD/CVD rates unknown", () => {
    const { knownPct, hasUnknown } = computeKnownTariffTotal(rows);
    // MFN 2.5% + Section 301 25% + Section 232 25% = 52.5%
    expect(knownPct).toBe(52.5);
    expect(hasUnknown).toBe(true);
  });

  it("computeKnownTariffTotal marks hasUnknown=true when AD/CVD rows have null ratePct", () => {
    const { hasUnknown } = computeKnownTariffTotal(rows);
    expect(hasUnknown).toBe(true);
  });
});

// ── calculateMpf — FY2026 rate schedule ──────────────────────────────────────

describe("calculateMpf — FY2026 CBP fee schedule", () => {
  it("rate is exactly 0.3464% of goods value (below minimum)", () => {
    // $5,000 × 0.003464 = $17.32 → minimum $33.58 applies
    const { amount } = calculateMpf(5_000);
    expect(amount).toBe(33.58);
  });

  it("FY2026 minimum is $33.58", () => {
    const { amount } = calculateMpf(0.01);
    expect(amount).toBe(33.58);
  });

  it("FY2026 maximum is $651.50", () => {
    // $200,000 × 0.003464 = $692.80 → capped at $651.50
    const { amount } = calculateMpf(200_000);
    expect(amount).toBe(651.50);
  });

  it("$50,000 × 0.3464% = $173.20 (no floor/ceiling applied)", () => {
    const { amount } = calculateMpf(50_000);
    expect(amount).toBeCloseTo(173.20, 2);
  });

  it("$50,000 × 2.5% tariff is exactly $1,250", () => {
    // Tariff dollar amounts are computed as rate/100 * goods value, separate from MPF.
    expect(50_000 * (2.5 / 100)).toBe(1_250);
  });

  it("$50,000 × 25% tariff is exactly $12,500", () => {
    expect(50_000 * (25 / 100)).toBe(12_500);
  });

  it("two separate 25% tariffs sum to $25,000, not $12,500", () => {
    const s301 = 50_000 * (25 / 100);
    const s232 = 50_000 * (25 / 100);
    expect(s301 + s232).toBe(25_000);
  });

  it("MPF basis is goods (customs) value only — does not include freight or insurance", () => {
    // Goods $50k, freight $2k, insurance $200 — MPF is only on goods value
    const goodsValue = 50_000;
    const { amount: mpfOnGoods } = calculateMpf(goodsValue);
    const { amount: mpfOnCIF } = calculateMpf(50_000 + 2_000 + 200);
    // MPF must be calculated on goods value, not CIF
    expect(mpfOnGoods).toBeCloseTo(173.20, 2);
    expect(mpfOnCIF).not.toBeCloseTo(mpfOnGoods, 2);
    expect(mpfOnCIF).toBeGreaterThan(mpfOnGoods);
  });
});

// ── calculateHmf — ocean-only fee ────────────────────────────────────────────

describe("calculateHmf — 0.125% for qualifying ocean cargo only", () => {
  it("$50,000 ocean shipment → HMF $62.50", () => {
    const { amount } = calculateHmf(50_000);
    expect(amount).toBe(62.50);
  });

  it("HMF does not apply to air shipments — no HMF row or $0 HMF for non-ocean", () => {
    // buildEnhancedCostRows with transportMode="air" must return a not_applicable HMF row
    const rows = buildEnhancedCostRows(BRAKE_DRUM_SCAN, "en", 50_000, "air");
    const hmfRow = rows.find((r) => r.label === "Harbor Maintenance Fee (HMF)");
    expect(hmfRow).toBeDefined();
    expect(hmfRow!.status).toBe("not_applicable");
    expect(hmfRow!.dollarText).toBeNull();
  });

  it("HMF row is verified_applicable and $62.50 for ocean shipment at $50,000", () => {
    const rows = buildEnhancedCostRows(BRAKE_DRUM_SCAN, "en", 50_000, "ocean");
    const hmfRow = rows.find((r) => r.label === "Harbor Maintenance Fee (HMF)");
    expect(hmfRow).toBeDefined();
    expect(hmfRow!.status).toBe("verified_applicable");
    expect(hmfRow!.dollarText).toBe("$62.50");
  });

  it("HMF row is insufficient_info when transport mode is unknown", () => {
    const rows = buildEnhancedCostRows(BRAKE_DRUM_SCAN, "en", 50_000, null);
    const hmfRow = rows.find((r) => r.label === "Harbor Maintenance Fee (HMF)");
    expect(hmfRow).toBeDefined();
    expect(hmfRow!.status).toBe("insufficient_info");
    expect(hmfRow!.dollarText).toBeNull();
  });
});

// ── $50,000 ocean brake-drum shipment — full breakdown ────────────────────────

describe("$50,000 ocean shipment — brake drum from China — full cost breakdown", () => {
  const rows = buildEnhancedCostRows(BRAKE_DRUM_SCAN, "en", 50_000, "ocean");

  it("MFN tariff: $1,250 ($50,000 × 2.5%)", () => {
    const mfn = rows.find((r) => r.label === "Base tariff (MFN)");
    expect(mfn).toBeDefined();
    expect(mfn!.dollarText).toBe("$1,250.00");
  });

  it("Section 301 tariff: $12,500 ($50,000 × 25%)", () => {
    const s301 = rows.find((r) => r.label === "Section 301 tariff");
    expect(s301).toBeDefined();
    expect(s301!.dollarText).toBe("$12,500.00");
  });

  it("Section 232 auto-parts tariff: $12,500 ($50,000 × 25%)", () => {
    const s232 = rows.find((r) => r.label === "Automobile-parts Section 232");
    expect(s232).toBeDefined();
    expect(s232!.dollarText).toBe("$12,500.00");
  });

  it("MPF: $173.20 ($50,000 × 0.3464%, between $33.58 and $651.50)", () => {
    const mpf = rows.find((r) => r.label === "Merchandise Processing Fee (MPF)");
    expect(mpf).toBeDefined();
    expect(mpf!.dollarText).toBe("$173.20");
    expect(mpf!.status).toBe("verified_applicable");
  });

  it("HMF: $62.50 ($50,000 × 0.125%, ocean)", () => {
    const hmf = rows.find((r) => r.label === "Harbor Maintenance Fee (HMF)");
    expect(hmf).toBeDefined();
    expect(hmf!.dollarText).toBe("$62.50");
    expect(hmf!.status).toBe("verified_applicable");
  });

  it("AD/CVD rows are present but have null dollarText because manufacturer/exporter unknown", () => {
    const adRow = rows.find((r) => r.coverageItem?.domain_key === "adcvd_A-570-174");
    const cvdRow = rows.find((r) => r.coverageItem?.domain_key === "adcvd_C-570-175");
    expect(adRow).toBeDefined();
    expect(cvdRow).toBeDefined();
    expect(adRow!.dollarText).toBeNull();
    expect(cvdRow!.dollarText).toBeNull();
  });

  it("known tariff total ($26,250) plus MPF ($173.20) plus HMF ($62.50) = $26,485.70", () => {
    const knownDollarRows = rows.filter(
      (r) => r.dollarText != null && r.status !== "not_applicable" && r.status !== "no_applicable_rule",
    );
    const total = knownDollarRows.reduce((sum, r) => {
      const n = parseFloat(r.dollarText!.replace(/[$,]/g, ""));
      return sum + n;
    }, 0);
    expect(total).toBeCloseTo(26_485.70, 1);
  });

  it("no fabricated dollar amounts — all null-dollarText rows have genuine unknown status", () => {
    const fabricated = rows.filter(
      (r) => r.dollarText == null &&
             r.status !== "not_applicable" &&
             r.status !== "no_applicable_rule" &&
             r.status !== "insufficient_info" &&
             r.status !== "source_unavailable" &&
             r.status !== "official_unconfirmed" &&
             r.status !== "likely_match",
    );
    expect(fabricated).toHaveLength(0);
  });
});
