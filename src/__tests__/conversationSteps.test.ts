/**
 * Unit tests for conversationSteps.ts and the step ordering contract.
 */

import { describe, it, expect } from "bun:test";
import { CONVERSATION_STEPS, STEP_IDS, type StepId } from "../components/ConversationalIntake/conversationSteps";

const REQUIRED_STEPS: StepId[] = [
  "productName",
  "originCountry",
  "destination",
  "email",
];

const OPTIONAL_STEPS: StepId[] = [
  "description",
  "htsCode",
  "estimatedValue",
  "freightUsd",
  "insuranceUsd",
  "transportMode",
  "manufacturerName",
  "exporterName",
];

describe("CONVERSATION_STEPS", () => {
  it("contains all required steps", () => {
    for (const id of REQUIRED_STEPS) {
      expect(STEP_IDS).toContain(id);
    }
  });

  it("contains all optional steps", () => {
    for (const id of OPTIONAL_STEPS) {
      expect(STEP_IDS).toContain(id);
    }
  });

  it("productName is the first step", () => {
    expect(CONVERSATION_STEPS[0].id).toBe("productName");
  });

  it("email is the last step", () => {
    const last = CONVERSATION_STEPS[CONVERSATION_STEPS.length - 1];
    expect(last.id).toBe("email");
  });

  it("all required steps have optional:false or undefined", () => {
    for (const id of REQUIRED_STEPS) {
      const step = CONVERSATION_STEPS.find((s) => s.id === id)!;
      expect(step.optional).toBeFalsy();
    }
  });

  it("all optional steps have optional:true", () => {
    for (const id of OPTIONAL_STEPS) {
      const step = CONVERSATION_STEPS.find((s) => s.id === id)!;
      expect(step.optional).toBe(true);
    }
  });

  it("all optional steps have a skipLabel", () => {
    for (const id of OPTIONAL_STEPS) {
      const step = CONVERSATION_STEPS.find((s) => s.id === id)!;
      expect(step.skipLabel).toBeTruthy();
    }
  });

  it("transport step uses 'transport' inputType", () => {
    const step = CONVERSATION_STEPS.find((s) => s.id === "transportMode")!;
    expect(step.inputType).toBe("transport");
  });

  it("origin and destination use 'country' inputType", () => {
    const origin = CONVERSATION_STEPS.find((s) => s.id === "originCountry")!;
    const dest = CONVERSATION_STEPS.find((s) => s.id === "destination")!;
    expect(origin.inputType).toBe("country");
    expect(dest.inputType).toBe("country");
  });

  it("email uses 'email' inputType", () => {
    const step = CONVERSATION_STEPS.find((s) => s.id === "email")!;
    expect(step.inputType).toBe("email");
  });

  it("numeric fields use optional-number inputType", () => {
    const numericIds: StepId[] = ["estimatedValue", "freightUsd", "insuranceUsd"];
    for (const id of numericIds) {
      const step = CONVERSATION_STEPS.find((s) => s.id === id)!;
      expect(step.inputType).toBe("optional-number");
    }
  });

  it("all steps have non-empty prompt", () => {
    for (const step of CONVERSATION_STEPS) {
      expect(step.prompt.length).toBeGreaterThan(0);
    }
  });

  it("Chinese prompts are present for all steps", () => {
    for (const step of CONVERSATION_STEPS) {
      expect(step.promptZh).toBeTruthy();
    }
  });

  it("STEP_IDS length matches CONVERSATION_STEPS length", () => {
    expect(STEP_IDS.length).toBe(CONVERSATION_STEPS.length);
  });

  it("no duplicate step IDs", () => {
    const ids = CONVERSATION_STEPS.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
