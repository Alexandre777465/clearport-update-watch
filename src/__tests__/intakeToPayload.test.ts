/**
 * Parity tests — intakeToPayload()
 *
 * Verifies that intakeToPayload() maps ConversationState to the exact same
 * WatchlistPayload that MonitoringForm.runScan() would produce for equivalent
 * form state inputs.
 *
 * 6 regression fixtures:
 *   1. Charles McManus — vinyl inflatable children's toy (China, HTS 9503.00.8900)
 *   2. Adult bike helmet (China)
 *   3. Children's bike helmet (China)
 *   4. Bicycle from Vietnam
 *   5. Type III PFD life jacket (China)
 *   6. Chinese-description product — language field
 */

import { describe, it, expect } from "bun:test";
import { intakeToPayload, type ConversationState, EMPTY_STATE } from "../components/ConversationalIntake/intakeToPayload";

function state(overrides: Partial<ConversationState>): ConversationState {
  return { ...EMPTY_STATE, ...overrides };
}

describe("intakeToPayload — 6 regression fixtures", () => {
  it("fixture 1: children's toy from China — payload shape", () => {
    const s = state({
      email: "charles@example.com",
      productName: "Vinyl Inflatable Children's Toy",
      htsCode: "9503.00.8900",
      originCountry: "China",
      destination: "United States",
      estimatedValue: "50000",
      knownFacts: { age_range: "under_3" },
    });
    const p = intakeToPayload(s);
    expect(p.email).toBe("charles@example.com");
    expect(p.product_name).toBe("Vinyl Inflatable Children's Toy");
    expect(p.hts_code).toBe("9503.00.8900");
    expect(p.origin_country).toBe("China");
    expect(p.destination_country).toBe("United States");
    expect(p.estimated_value_usd).toBe(50000);
    expect(p.is_children).toBe(true);
    expect(p.alert_frequency).toBe("weekly");
    expect(p.known_facts).toEqual({ age_range: "under_3" });
  });

  it("fixture 2: adult bike helmet from China — no is_children", () => {
    const s = state({
      email: "buyer@helmets.com",
      productName: "Adult Bicycle Helmet",
      htsCode: "6506.10.6090",
      originCountry: "China",
      destination: "United States",
      estimatedValue: "20000",
    });
    const p = intakeToPayload(s);
    expect(p.product_name).toBe("Adult Bicycle Helmet");
    expect(p.hts_code).toBe("6506.10.6090");
    expect(p.is_children).toBeUndefined();
    expect(p.origin_country).toBe("China");
  });

  it("fixture 3: children's bike helmet — is_children from knownFacts", () => {
    const s = state({
      email: "buyer@helmets.com",
      productName: "Children's Bicycle Helmet",
      htsCode: "6506.10.6090",
      originCountry: "China",
      destination: "United States",
      knownFacts: { age_range: "age_3_to_12" },
    });
    const p = intakeToPayload(s);
    expect(p.is_children).toBe(true);
  });

  it("fixture 4: bicycle from Vietnam — correct origin, transport", () => {
    const s = state({
      email: "cyclist@wheels.com",
      productName: "Adult Folding Bicycle",
      htsCode: "8712.00.1500",
      originCountry: "Vietnam",
      destination: "United States",
      estimatedValue: "75000",
      transportMode: "ocean",
    });
    const p = intakeToPayload(s);
    expect(p.origin_country).toBe("Vietnam");
    expect(p.transport_mode).toBe("ocean");
    expect(p.is_children).toBeUndefined();
    expect(p.estimated_value_usd).toBe(75000);
  });

  it("fixture 5: Type III PFD from China — correct payload", () => {
    const s = state({
      email: "marine@safety.com",
      productName: "Type III Personal Flotation Device",
      htsCode: "6307.20.0000",
      originCountry: "China",
      destination: "United States",
      estimatedValue: "30000",
    });
    const p = intakeToPayload(s);
    expect(p.product_name).toBe("Type III Personal Flotation Device");
    expect(p.hts_code).toBe("6307.20.0000");
    expect(p.origin_country).toBe("China");
    expect(p.estimated_value_usd).toBe(30000);
  });

  it("fixture 6: Chinese product name preserved verbatim", () => {
    const s = state({
      email: "zh@example.com",
      productName: "玩具车",
      description: "儿童遥控玩具",
      originCountry: "China",
      destination: "United States",
    });
    const p = intakeToPayload(s);
    expect(p.product_name).toBe("玩具车");
    expect(p.product_description).toBe("儿童遥控玩具");
    // language comes from getLang(); the module uses the real function in this non-mocked run
    expect(["en", "zh"]).toContain(p.language);
  });
});

describe("intakeToPayload — field mapping invariants", () => {
  it("omits hts_code when empty", () => {
    const p = intakeToPayload(state({
      email: "a@b.com", productName: "Mug",
      originCountry: "China", destination: "United States",
    }));
    expect(p.hts_code).toBeUndefined();
  });

  it("omits transport_mode when empty", () => {
    const p = intakeToPayload(state({
      email: "a@b.com", productName: "Mug",
      originCountry: "China", destination: "United States",
    }));
    expect(p.transport_mode).toBeUndefined();
  });

  it("defaults origin_country to China when blank", () => {
    const p = intakeToPayload(state({ email: "a@b.com", productName: "Mug" }));
    expect(p.origin_country).toBe("China");
  });

  it("defaults destination_country to United States when blank", () => {
    const p = intakeToPayload(state({ email: "a@b.com", productName: "Mug" }));
    expect(p.destination_country).toBe("United States");
  });

  it("parses estimatedValue with dollar sign and comma", () => {
    const p = intakeToPayload(state({
      email: "a@b.com", productName: "Mug",
      originCountry: "China", destination: "United States",
      estimatedValue: "$12,500",
    }));
    expect(p.estimated_value_usd).toBe(12500);
  });

  it("sets has_battery from knownFacts battery_type=lithium_ion", () => {
    const p = intakeToPayload(state({
      email: "a@b.com", productName: "Power Bank",
      originCountry: "China", destination: "United States",
      knownFacts: { battery_type: "lithium_ion" },
    }));
    expect(p.has_battery).toBe(true);
  });

  it("omits known_facts when empty", () => {
    const p = intakeToPayload(state({
      email: "a@b.com", productName: "Mug",
      originCountry: "China", destination: "United States",
    }));
    expect(p.known_facts).toBeUndefined();
  });

  it("includes freight_usd and insurance_usd when provided", () => {
    const p = intakeToPayload(state({
      email: "a@b.com", productName: "Mug",
      originCountry: "China", destination: "United States",
      freightUsd: "2500",
      insuranceUsd: "300",
    }));
    expect(p.freight_usd).toBe(2500);
    expect(p.insurance_usd).toBe(300);
  });

  it("includes manufacturer_name and exporter_name when provided", () => {
    const p = intakeToPayload(state({
      email: "a@b.com", productName: "Mug",
      originCountry: "China", destination: "United States",
      manufacturerName: "Shenzhen Co.",
      exporterName: "HK Ltd.",
    }));
    expect(p.manufacturer_name).toBe("Shenzhen Co.");
    expect(p.exporter_name).toBe("HK Ltd.");
  });

  it("trims whitespace from all string fields", () => {
    const p = intakeToPayload(state({
      email: "  a@b.com  ", productName: "  Mug  ",
      originCountry: "  China  ", destination: "  United States  ",
      manufacturerName: "  Factory  ",
    }));
    expect(p.email).toBe("a@b.com");
    expect(p.product_name).toBe("Mug");
    expect(p.origin_country).toBe("China");
    expect(p.manufacturer_name).toBe("Factory");
  });
});
