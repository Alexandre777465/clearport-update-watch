/**
 * i18n coverage guard (requirement 8).
 *
 * Scans every customer-facing component/route for hard-coded English UI strings
 * that should instead be rendered through the i18n dictionary (`t(lang, key)`),
 * so that selecting 中文 produces a fully Chinese page.
 *
 * Two layers:
 *   1. A curated regression list of the exact English UI phrases we extracted
 *      into src/lib/i18n.ts. None of them may reappear as raw text in a
 *      customer-facing component.
 *   2. A heuristic that flags any remaining JSX *text node* (the text rendered
 *      between tags) that is a run of plain ASCII English words and is not
 *      wrapped in a t(...) call.
 *
 * Run with:  ~/.bun/bin/bun test tests/i18nCoverage.test.ts
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

// Customer-facing surfaces that must be fully translatable.
const CUSTOMER_FACING = [
  "src/routes/index.tsx",
  "src/routes/onboarding.tsx",
  "src/routes/ask.tsx",
  "src/routes/sources.tsx",
  "src/routes/sample-alert.tsx",
  "src/routes/privacy.tsx",
  "src/routes/terms.tsx",
  "src/components/MonitoringForm.tsx",
  "src/components/RiskScanCard.tsx",
  "src/components/ReadinessScore.tsx",
  "src/components/DocumentChecklist.tsx",
  "src/components/BrokerPack.tsx",
  "src/components/MarketingNav.tsx",
];

// Strip JS/JSX comments and `head:`/meta `title:` string literals before
// scanning: comments aren't rendered, and the browser-tab/SEO <title> stays in
// English by design (it is outside the visible page sections in requirement 2).
function stripNonRendered(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "") // {/* JSX comment */}
    .replace(/\/\*[\s\S]*?\*\//g, "") // /* block comment */
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1") // // line comment (not URLs)
    .replace(/title:\s*"[^"]*"/g, "title: \"\""); // head meta titles
}

const read = (rel: string) => stripNonRendered(readFileSync(join(ROOT, rel), "utf8"));

// ── Layer 1: curated regression phrases ──────────────────────────────────────
// Each phrase used to be hard-coded in the file listed; it must now live only in
// src/lib/i18n.ts. (Phrases are chosen to NOT collide with the intentionally
// English broker-pack export text or the no-backend mock fallback data.)
const FORBIDDEN: Array<{ file: string; phrases: string[] }> = [
  {
    file: "src/routes/index.tsx",
    phrases: [
      "For importers buying from China",
      "Never miss a customs or tariff update affecting your products",
      "Importers are buried in technical notices",
      "Built around official trade sources",
      "Built for preparation, not legal interpretation",
      "Don't read 50-page notices manually",
      "See pricing",
      "Latest alert",
    ],
  },
  {
    file: "src/components/MonitoringForm.tsx",
    phrases: [
      "Start monitoring a product",
      "Start monitoring + generate risk scan",
      "Country of origin",
      "Import destination",
      "Quick check before we scan",
      "Saving your product",
      "Launch readiness",
      "Recent verified changes",
      "Questions about this report?",
    ],
  },
  {
    file: "src/components/RiskScanCard.tsx",
    phrases: [
      "Overall risk:",
      "Risk breakdown",
      "What to do next",
      "Official source",
      "View official document",
      "How it affects this product:",
    ],
  },
  {
    file: "src/components/ReadinessScore.tsx",
    phrases: ["Launch readiness", "No requirements were verified from official sources"],
  },
  {
    file: "src/components/MarketingNav.tsx",
    phrases: [
      "U.S. import rule updates, simplified for importers.",
      "All rights reserved.",
      "Check a product",
      "Official sources",
    ],
  },
  {
    file: "src/routes/ask.tsx",
    phrases: [
      "What duties or tariffs apply?",
      "Informational only. Verify with a licensed customs broker before importing.",
      "Checking your verified findings",
      "Run a product check first",
    ],
  },
  {
    file: "src/routes/sources.tsx",
    phrases: [
      "Status unavailable",
      "No sources are configured.",
      "Visit official source",
      "Last successful sync:",
      "This source is deactivated",
    ],
  },
  {
    file: "src/routes/sample-alert.tsx",
    phrases: ["Sample alert", "Plain-English summary", "Why this may matter", "What to verify with broker"],
  },
  {
    file: "src/routes/privacy.tsx",
    phrases: ["To request deletion of your data", "We do not\n            sell your data", "ClearPort collects the product details"],
  },
  {
    file: "src/routes/terms.tsx",
    phrases: ["does not replace a licensed customs broker", "without warranties"],
  },
];

describe("no hard-coded English UI phrases remain in customer-facing components", () => {
  for (const { file, phrases } of FORBIDDEN) {
    const src = read(file);
    for (const phrase of phrases) {
      test(`${file} no longer hard-codes: "${phrase.slice(0, 40)}"`, () => {
        expect(src.includes(phrase)).toBe(false);
      });
    }
  }
});

// ── Layer 2: heuristic JSX-text-node scan ────────────────────────────────────
// Flags text rendered between tags that is plain English and not produced by a
// t(...) call. This catches *new* hard-coded strings added later.
//
// Intentional exceptions:
//   • BrokerPack.tsx — builds an English document meant to be sent to a U.S.
//     customs broker; its text is deliberately English (requirement 6 spirit).
//   • MonitoringForm.tsx generateMockRiskScan — a dev-only fallback used only
//     when no backend is connected; the live pilot always returns localized
//     content from the backend.
const HEURISTIC_FILES = CUSTOMER_FACING.filter(
  (f) => f !== "src/components/BrokerPack.tsx",
);

// A run of >=3 ASCII words (lets short UI fragments / units through but catches
// real sentences).
const ENGLISH_RUN = /^[A-Za-z][A-Za-z'.,:?!&/-]*(?:\s+[A-Za-z][A-Za-z'.,:?!&/-]*){2,}$/;
// Text nodes between JSX tags: >  Some text  <
const TEXT_NODE = />\s*([A-Za-z][^<>{}]*?)\s*</g;

function inMockRegion(file: string, src: string, index: number): boolean {
  if (file !== "src/components/MonitoringForm.tsx") return false;
  const start = src.indexOf("function generateMockRiskScan");
  const end = src.indexOf("// ── Attribute toggle");
  return start !== -1 && end !== -1 && index > start && index < end;
}

describe("no untranslated JSX text nodes (heuristic)", () => {
  for (const file of HEURISTIC_FILES) {
    test(`${file} renders text only via t(...)`, () => {
      const src = read(file);
      const offenders: string[] = [];
      for (const m of src.matchAll(TEXT_NODE)) {
        const text = m[1].trim();
        if (!ENGLISH_RUN.test(text)) continue;
        if (inMockRegion(file, src, m.index ?? 0)) continue;
        offenders.push(text);
      }
      expect(offenders).toEqual([]);
    });
  }
});
