/**
 * Tests for the clarification step helper functions.
 * These are pure functions extracted from MonitoringForm for testability.
 */

import { describe, it, expect } from "bun:test";

// ── Inline the helpers under test (same logic as MonitoringForm.tsx) ──────────
// We duplicate the logic here to allow pure testing without DOM imports.

interface BrakeDrumFacts {
  inside_diameter: string;
  weight: string;
  material: string;
  construction: string;
  vehicle_type: string;
  brake_system: string;
  oe_or_aftermarket: string;
  manufacturer_name: string;
  exporter_name: string;
}

const DEFAULT_BRAKE_FACTS: BrakeDrumFacts = {
  inside_diameter: "unknown",
  weight: "unknown",
  material: "unknown",
  construction: "unknown",
  vehicle_type: "unknown",
  brake_system: "unknown",
  oe_or_aftermarket: "unknown",
  manufacturer_name: "",
  exporter_name: "",
};

function needsClarificationQuestions(form: { htsCode: string; productName: string; description: string }): boolean {
  const hts = form.htsCode.replace(/[^0-9]/g, "");
  if (hts.startsWith("8708")) return true;
  const text = `${form.productName} ${form.description}`.toLowerCase();
  return /brake\s*drum/.test(text);
}

function appendClarificationFacts(originalDesc: string, facts: BrakeDrumFacts): string {
  const lines: string[] = [];
  if (facts.inside_diameter !== "unknown") lines.push(`Inside diameter: ${facts.inside_diameter} in`);
  if (facts.weight !== "unknown") lines.push(`Weight: ${facts.weight === "over_50" ? ">50 lbs" : "≤50 lbs"}`);
  if (facts.material !== "unknown") lines.push(`Material: ${facts.material === "grey_cast_iron" ? "grey cast iron" : "other material"}`);
  if (facts.construction !== "unknown") lines.push(`Construction: ${facts.construction === "non_composite" ? "non-composite" : "composite"}`);
  if (facts.vehicle_type !== "unknown") lines.push(`Vehicle type: ${facts.vehicle_type === "passenger" ? "passenger vehicle" : "medium/heavy commercial truck"}`);
  if (facts.brake_system !== "unknown") lines.push(`Brake system: ${facts.brake_system === "hydraulic" ? "hydraulic" : "air brakes"}`);
  if (facts.oe_or_aftermarket !== "unknown") lines.push(`OEM/aftermarket: ${facts.oe_or_aftermarket}`);
  if (facts.manufacturer_name.trim()) lines.push(`Manufacturer: ${facts.manufacturer_name.trim()}`);
  if (facts.exporter_name.trim()) lines.push(`Exporter: ${facts.exporter_name.trim()}`);
  if (lines.length === 0) return originalDesc;
  return `${originalDesc}\n\n--- Product specifications ---\n${lines.join("\n")}`;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("needsClarificationQuestions", () => {
  it("HTS 8708.30.50.20 → needsClarification = true", () => {
    expect(needsClarificationQuestions({ htsCode: "8708.30.50.20", productName: "Brake drum", description: "" })).toBe(true);
  });

  it("HTS 8708 (bare heading) → needsClarification = true", () => {
    expect(needsClarificationQuestions({ htsCode: "8708", productName: "Auto part", description: "" })).toBe(true);
  });

  it("HTS 6302.10.00 → needsClarification = false", () => {
    expect(needsClarificationQuestions({ htsCode: "6302.10.00", productName: "Bed linen", description: "" })).toBe(false);
  });

  it("'brake drum' in product name → needsClarification = true", () => {
    expect(needsClarificationQuestions({ htsCode: "", productName: "Cast iron brake drum", description: "" })).toBe(true);
  });

  it("'brake drum' in description → needsClarification = true", () => {
    expect(needsClarificationQuestions({ htsCode: "", productName: "Auto part", description: "Grey cast iron brake drum for trucks" })).toBe(true);
  });

  it("unrelated product → needsClarification = false", () => {
    expect(needsClarificationQuestions({ htsCode: "6109.10.00", productName: "Cotton T-shirt", description: "Men's cotton t-shirt" })).toBe(false);
  });
});

describe("appendClarificationFacts", () => {
  const BASE_DESC = "Grey cast iron brake drum from China.";

  it("with diameter=15 → description contains 'Inside diameter: 15 in'", () => {
    const facts: BrakeDrumFacts = { ...DEFAULT_BRAKE_FACTS, inside_diameter: "15" };
    const result = appendClarificationFacts(BASE_DESC, facts);
    expect(result).toContain("Inside diameter: 15 in");
  });

  it("with weight=over_50 → description contains '>50 lbs'", () => {
    const facts: BrakeDrumFacts = { ...DEFAULT_BRAKE_FACTS, weight: "over_50" };
    const result = appendClarificationFacts(BASE_DESC, facts);
    expect(result).toContain(">50 lbs");
  });

  it("with weight=50_or_under → description contains '≤50 lbs'", () => {
    const facts: BrakeDrumFacts = { ...DEFAULT_BRAKE_FACTS, weight: "50_or_under" };
    const result = appendClarificationFacts(BASE_DESC, facts);
    expect(result).toContain("≤50 lbs");
  });

  it("with material=grey_cast_iron → description contains 'grey cast iron'", () => {
    const facts: BrakeDrumFacts = { ...DEFAULT_BRAKE_FACTS, material: "grey_cast_iron" };
    const result = appendClarificationFacts(BASE_DESC, facts);
    expect(result).toContain("grey cast iron");
  });

  it("with construction=non_composite → description contains 'non-composite'", () => {
    const facts: BrakeDrumFacts = { ...DEFAULT_BRAKE_FACTS, construction: "non_composite" };
    const result = appendClarificationFacts(BASE_DESC, facts);
    expect(result).toContain("non-composite");
  });

  it("with manufacturer_name → description contains 'Manufacturer: ...'", () => {
    const facts: BrakeDrumFacts = { ...DEFAULT_BRAKE_FACTS, manufacturer_name: "Longhua Brake Parts Co., Ltd." };
    const result = appendClarificationFacts(BASE_DESC, facts);
    expect(result).toContain("Manufacturer: Longhua Brake Parts Co., Ltd.");
  });

  it("with exporter_name → description contains 'Exporter: ...'", () => {
    const facts: BrakeDrumFacts = { ...DEFAULT_BRAKE_FACTS, exporter_name: "Longhua Trading Ltd." };
    const result = appendClarificationFacts(BASE_DESC, facts);
    expect(result).toContain("Exporter: Longhua Trading Ltd.");
  });

  it("with all unknown → description unchanged (no facts block appended)", () => {
    const result = appendClarificationFacts(BASE_DESC, DEFAULT_BRAKE_FACTS);
    expect(result).toBe(BASE_DESC);
    expect(result).not.toContain("--- Product specifications ---");
  });

  it("appended facts section uses separator header", () => {
    const facts: BrakeDrumFacts = { ...DEFAULT_BRAKE_FACTS, material: "grey_cast_iron" };
    const result = appendClarificationFacts(BASE_DESC, facts);
    expect(result).toContain("--- Product specifications ---");
  });
});
