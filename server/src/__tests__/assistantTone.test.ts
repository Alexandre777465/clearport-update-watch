/**
 * Assistant tone regression tests.
 *
 * These tests enforce the ClearPort assistant style contract without calling
 * the LLM. They check:
 *   1. The system prompt strings themselves follow the style rules.
 *   2. A tone-validator helper rejects known bad patterns.
 *   3. The same helper accepts known good patterns.
 *
 * Style contract (summary):
 *   - No +/- rate shorthand  (+25%, -7.5%)
 *   - No raw internal identifiers  (snake_case fact keys, status codes)
 *   - No raw verification labels  (verified_applicable, official_unconfirmed)
 *   - No dense parenthetical asides  (CPC (children <12) + GCC — not applicable)
 *   - Rates written as prose  ("an additional 25 percent")
 *   - Uncertainty phrased as one plain question, never "Cannot determine"
 */

import { describe, it, expect } from 'bun:test';
import { SYSTEM_TEXT } from '../services/askClearport';
import { SYSTEM, INSUFFICIENT } from '../services/askClearportGrounded';

// ── Tone-validation helpers ───────────────────────────────────────────────────

/** Patterns that must NOT appear in any customer-visible assistant answer. */
const TONE_VIOLATIONS = [
  // +/-  rate shorthand
  { re: /[+-]\d+(?:\.\d+)?%/, label: 'rate shorthand (+/-N%)' },
  // raw snake_case fact keys  (two+ lowercase words joined by underscores)
  { re: /\b[a-z][a-z0-9]+_[a-z][a-z0-9_]+\b/, label: 'raw snake_case identifier' },
  // internal verification status codes
  { re: /\bverified_applicable\b|\bofficial_unconfirmed\b|\bno_verified_source\b|\blikely_match\b/, label: 'internal verification status code' },
  // "Cannot determine" without any question following
  { re: /cannot determine/i, label: '"Cannot determine" without explanation' },
];

/**
 * Returns the first tone violation found in `text`, or null if the text is clean.
 */
function firstViolation(text: string): string | null {
  for (const { re, label } of TONE_VIOLATIONS) {
    if (re.test(text)) return label;
  }
  return null;
}

/** True when the text is clean of all tone violations. */
function isCleanTone(text: string): boolean {
  return firstViolation(text) === null;
}

// ── Example assistant responses (for documentation and snapshot use) ──────────

const GOOD_TARIFF_ANSWER = `Yes, this shipment is subject to the China tariff.

Because the product originates from China, an additional 25 percent duty applies on top of the base import rate. For a $50,000 shipment, that adds about $12,500 to your landed cost.

Ask your customs broker to confirm the exact chapter 99 provision and include both amounts in your duty deposit before the goods arrive.`;

const GOOD_CERT_ANSWER = `Yes. Because this is a children's bicycle helmet, the importer needs a Children's Product Certificate.

That certificate must be based on passing test reports from a CPSC-accepted laboratory. It should list the bicycle helmet safety standard and the other children's product rules that apply.

Your next step is to ask the supplier for the test reports, then prepare the certificate before the goods are imported.`;

const GOOD_UNCERTAIN_ANSWER = `I can't confirm that yet because I'm missing one detail.

Does the product have a lithium battery installed inside it?`;

const GOOD_NEXT_STEP_REWRITE = `Include the additional China tariff in your landed cost. For this shipment, it adds about $3,750.`;

// Known bad patterns that the validator must catch.
const BAD_RATE_SHORTHAND = 'Budget +7.5% Section 301 additional duty on top of base MFN rate.';
const BAD_PLUS_RATE = 'This product is subject to +25% Section 301 and +10% Section 122.';
const BAD_FACT_KEY = 'Based on is_children=true and sports_product_type=bicycle_helmet, the CPC applies.';
const BAD_VERIFICATION_STATUS = 'The finding status is verified_applicable under 16 CFR 1203.';
// Note: dense parenthetical style is enforced via the system prompt; the automated
// pattern validator catches +/-rate shorthand and raw identifiers, not prose style.
// The example below deliberately includes both a +rate and a raw key to be detectable.
const BAD_PARENTHETICAL_CRAM =
  'CPC required (is_children=true) — +25% Section 301 / GCC not applicable.';
const BAD_CANNOT_DETERMINE = 'Cannot determine whether the product meets the threshold.';

// ── System prompt tests ───────────────────────────────────────────────────────

describe('askClearport SYSTEM_TEXT — style rules are present', () => {
  it('SYSTEM_TEXT is exported and non-empty', () => {
    expect(typeof SYSTEM_TEXT).toBe('string');
    expect(SYSTEM_TEXT.length).toBeGreaterThan(100);
  });

  it('instructs against + / - rate shorthand', () => {
    // The prompt must tell the model to avoid +/- shorthand notation
    expect(SYSTEM_TEXT).toMatch(/never.*[+\-].*%|write.*percent|plain.*percent/i);
  });

  it('instructs against exposing internal identifiers', () => {
    expect(SYSTEM_TEXT).toMatch(/fact key|field name|internal|status code|identifier/i);
  });

  it('instructs to start with a direct answer', () => {
    expect(SYSTEM_TEXT).toMatch(/direct answer|start with/i);
  });

  it('instructs to end with one clear next action', () => {
    expect(SYSTEM_TEXT).toMatch(/next action|one clear/i);
  });

  it('instructs to avoid bullets unless asked', () => {
    expect(SYSTEM_TEXT).toMatch(/bullet|checklist/i);
  });
});

describe('askClearportGrounded SYSTEM — style rules are present', () => {
  it('SYSTEM is exported and non-empty', () => {
    expect(typeof SYSTEM).toBe('string');
    expect(SYSTEM.length).toBeGreaterThan(100);
  });

  it('instructs against + / - rate shorthand', () => {
    expect(SYSTEM).toMatch(/never.*[+\-].*%|write.*percent|plain.*percent/i);
  });

  it('instructs the model not to expose internal status codes to the importer', () => {
    expect(SYSTEM).toMatch(/internal|status code|never repeat|for your understanding/i);
  });

  it('instructs to start with a direct answer', () => {
    expect(SYSTEM).toMatch(/direct answer|open with/i);
  });

  it('instructs to end with one clear next action', () => {
    expect(SYSTEM).toMatch(/next action|one clear/i);
  });

  it('contains the exact INSUFFICIENT phrase the model should use', () => {
    expect(SYSTEM).toContain(INSUFFICIENT);
  });

  it('instructs to ask one simple question when a detail is missing', () => {
    expect(SYSTEM).toMatch(/one simple|plain.language question|missing one detail/i);
  });
});

// ── Tone validator — bad patterns ─────────────────────────────────────────────

describe('tone validator — rejects known bad patterns', () => {
  it('catches +N% rate shorthand', () => {
    expect(firstViolation(BAD_RATE_SHORTHAND)).toBe('rate shorthand (+/-N%)');
  });

  it('catches +25% in a list', () => {
    expect(firstViolation(BAD_PLUS_RATE)).toBe('rate shorthand (+/-N%)');
  });

  it('catches raw snake_case fact key "is_children"', () => {
    expect(firstViolation(BAD_FACT_KEY)).toBe('raw snake_case identifier');
  });

  it('catches internal verification status "verified_applicable"', () => {
    // verified_applicable is both a snake_case identifier and an internal status code —
    // either pattern firing is a valid catch.
    expect(isCleanTone(BAD_VERIFICATION_STATUS)).toBe(false);
  });

  it('catches "Cannot determine" without explanation', () => {
    expect(firstViolation(BAD_CANNOT_DETERMINE)).toBe('"Cannot determine" without explanation');
  });
});

// ── Tone validator — good examples ────────────────────────────────────────────

describe('tone validator — accepts clean human-advisor responses', () => {
  it('tariff answer with prose rate passes', () => {
    expect(isCleanTone(GOOD_TARIFF_ANSWER)).toBe(true);
  });

  it('CPC/certification answer passes', () => {
    expect(isCleanTone(GOOD_CERT_ANSWER)).toBe(true);
  });

  it('uncertainty answer with one plain question passes', () => {
    expect(isCleanTone(GOOD_UNCERTAIN_ANSWER)).toBe(true);
  });

  it('rewritten next-step (no + shorthand) passes', () => {
    expect(isCleanTone(GOOD_NEXT_STEP_REWRITE)).toBe(true);
  });
});

// ── Specific pattern checks on good examples ─────────────────────────────────

describe('good examples — structural properties', () => {
  it('tariff answer does not expose rule IDs', () => {
    expect(/\b9903\.\d+\b/.test(GOOD_TARIFF_ANSWER)).toBe(false);
  });

  it('tariff answer includes a dollar-amount implication', () => {
    expect(GOOD_TARIFF_ANSWER).toMatch(/\$[\d,]+/);
  });

  it('cert answer opens with "Yes"', () => {
    expect(GOOD_CERT_ANSWER.trimStart().startsWith('Yes')).toBe(true);
  });

  it('uncertain answer includes a direct question', () => {
    expect(GOOD_UNCERTAIN_ANSWER).toMatch(/\?/);
  });

  it('uncertain answer does not use "Cannot determine"', () => {
    expect(GOOD_UNCERTAIN_ANSWER).not.toMatch(/cannot determine/i);
  });

  it('bad parenthetical cram is detected as a raw identifier or rate shorthand', () => {
    // The bad example uses "+" as a separator and raw CFR cram — should fail
    const v = firstViolation(BAD_PARENTHETICAL_CRAM);
    expect(v).not.toBeNull();
  });
});
