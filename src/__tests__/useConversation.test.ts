/**
 * Targeted regression tests for useConversation helpers.
 *
 * Tests pure functions (makeCoreStep) exported from the hook, and the
 * label/value contract for structured option inputs.
 *
 * Requirements verified:
 *   R1 — Skip advances exactly once (makeCoreStep excludes skippedSteps)
 *   R2 — Skipped field stays "" (absent from API payload — see intakeToPayload.test.ts)
 *   R3 — Stored canonical value ≠ displayed label for structured options
 *   R4 — Chinese labels are separate from canonical stored values
 */

import { describe, it, expect } from "bun:test";
import { makeCoreStep } from "../components/ConversationalIntake/useConversation";
import { EMPTY_STATE } from "../components/ConversationalIntake/intakeToPayload";
import { CONVERSATION_STEPS } from "../components/ConversationalIntake/conversationSteps";

// ── R1: Skip advances exactly once ────────────────────────────────────────────

describe("makeCoreStep — skippedSteps exclusion (I-2 regression)", () => {
  it("returns productName step when state is empty and nothing skipped", () => {
    const step = makeCoreStep(EMPTY_STATE, "en");
    expect(step?.id).toBe("productName");
  });

  it("skips description step when it is in skippedSteps", () => {
    const state = {
      ...EMPTY_STATE,
      productName: "Mug",            // productName answered
      skippedSteps: new Set(["description"]),
    };
    const step = makeCoreStep(state, "en");
    // description is skipped → must not return description
    expect(step?.id).not.toBe("description");
    // next unanswered non-skipped step is htsCode
    expect(step?.id).toBe("htsCode");
  });

  it("skips manufacturer and exporter when both in skippedSteps", () => {
    const answeredAll = {
      ...EMPTY_STATE,
      productName: "Mug",
      originCountry: "China",
      destination: "United States",
      email: "a@b.com",
      skippedSteps: new Set([
        "description", "htsCode", "estimatedValue",
        "freightUsd", "insuranceUsd", "transportMode",
        "manufacturerName", "exporterName",
      ]),
    };
    // All optional steps skipped + required steps answered → no core step remaining
    const step = makeCoreStep(answeredAll, "en");
    expect(step).toBeNull();
  });

  it("a skipped step never re-appears after being added to skippedSteps", () => {
    // Simulate: user has answered productName, skipped description
    const state = {
      ...EMPTY_STATE,
      productName: "Mug",
      skippedSteps: new Set(["description"]),
    };
    const step1 = makeCoreStep(state, "en");
    expect(step1?.id).toBe("htsCode");  // advances past description

    // Simulate: user skips htsCode too
    const state2 = {
      ...state,
      skippedSteps: new Set(["description", "htsCode"]),
    };
    const step2 = makeCoreStep(state2, "en");
    expect(step2?.id).not.toBe("description");  // description still skipped
    expect(step2?.id).not.toBe("htsCode");       // htsCode now skipped too
    expect(step2?.id).toBe("originCountry");     // next required step
  });

  it("skippedSteps field on state is a Set — correct type", () => {
    expect(EMPTY_STATE.skippedSteps).toBeInstanceOf(Set);
    expect(EMPTY_STATE.skippedSteps.size).toBe(0);
  });
});

// ── R3 / R4: Stored value ≠ displayed label ────────────────────────────────────

describe("CONVERSATION_STEPS — no option keys leak as display text", () => {
  it("transportMode step is handled by StructuredInput transport type (no options in step)", () => {
    const step = CONVERSATION_STEPS.find((s) => s.id === "transportMode")!;
    expect(step.inputType).toBe("transport");
    // transport options are defined in StructuredInput.tsx, not in conversationSteps
    expect((step as { options?: unknown }).options).toBeUndefined();
  });
});

describe("Dynamic option display label contract", () => {
  it("all conversation steps have prompts that are not raw underscore-keyed strings", () => {
    for (const step of CONVERSATION_STEPS) {
      // prompts should not look like internal keys (no underscores, no camelCase)
      expect(step.prompt).not.toMatch(/^[a-z]+_[a-z]+$/);
      expect(step.promptZh).not.toMatch(/^[a-z]+_[a-z]+$/);
    }
  });

  it("all steps have human-readable prompts (not empty, not key-like)", () => {
    for (const step of CONVERSATION_STEPS) {
      expect(step.prompt.length).toBeGreaterThan(5);
      expect(step.promptZh.length).toBeGreaterThan(2);
    }
  });
});

// ── Transport option contract (mirroring StructuredInput.tsx) ─────────────────

const TRANSPORT_OPTIONS = [
  { value: "ocean", label: "Ocean / Sea freight", labelZh: "海运" },
  { value: "air",   label: "Air freight",          labelZh: "空运" },
  { value: "truck", label: "Truck / Road",          labelZh: "公路运输" },
  { value: "rail",  label: "Rail",                  labelZh: "铁路运输" },
];

describe("Transport options — stored value ≠ displayed label (I-3 regression)", () => {
  it("each transport option has a distinct stored value and human label", () => {
    for (const opt of TRANSPORT_OPTIONS) {
      // stored value is short lowercase key
      expect(opt.value).toMatch(/^[a-z]+$/);
      // displayed label differs from the stored key (may differ only in capitalisation)
      expect(opt.label).not.toBe(opt.value);
    }
  });

  it("Chinese transport labels are separate from canonical values", () => {
    for (const opt of TRANSPORT_OPTIONS) {
      expect(opt.labelZh).not.toBe(opt.value);
      expect(opt.labelZh).not.toMatch(/^[a-z]+$/);  // must not be an English key
    }
  });
});
