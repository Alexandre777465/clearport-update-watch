/**
 * Regulatory module registry.
 *
 * Each module is a self-contained unit that:
 *   1. Knows which products it covers (via categoryDetector signals)
 *   2. Evaluates specific regulatory requirements deterministically
 *   3. Produces RiskCategory findings, CoverageItem entries, and DocSpec items
 *
 * Design rules:
 *   - Modules NEVER guess. They return one of the five permitted statuses.
 *   - Modules cite exact CFR provisions and official source URLs.
 *   - Finding IDs use consistent scheme: <module>_<requirement_key>
 *   - Modules are pure functions (no I/O, no DB, no Anthropic).
 *
 * Permitted finding statuses (verification_status):
 *   verified_applicable         — applies to this product, deterministic
 *   official_unconfirmed        — rule exists; applicability needs confirmation
 *   not_applicable              — definitively does not apply from known facts
 *   no_verified_source          — "not supported by ClearPort yet" / cannot verify
 *
 * Permitted doc_status values (for DocSpec):
 *   required_to_clear | required_if | usually_requested | before_sale | not_required | cannot_determine
 */

import type { RiskCategory, CoverageItem } from '../../types';
import type { DocItemStatus, ResponsibleParty } from '../../types';
import type { CategoryId, ProductBooleans } from '../categoryDetector';

export type { CategoryId, ProductBooleans };

// ── Module input ──────────────────────────────────────────────────────────────

export interface ModuleInput {
  htsDigits: string;
  productText: string;       // product_name + ' ' + product_description
  attrs: ProductBooleans;
  originCountry: string;
  importDate: string;        // ISO date, e.g. "2026-06-26"
  /** Answers collected via dynamic clarification questions, keyed by question key */
  knownFacts: Record<string, string>;
}

// ── Document spec ─────────────────────────────────────────────────────────────

export interface DocSpec {
  document: string;
  owner: 'supplier' | 'importer_broker' | 'carrier';
  responsible_party: ResponsibleParty;
  reason: string;
  doc_status: DocItemStatus;
  condition?: string;
  finding_id: string;   // must match a finding.id in the module result
}

// ── Dynamic question ──────────────────────────────────────────────────────────

export interface DynamicQuestion {
  key: string;          // stable key used in ModuleInput.knownFacts
  module: CategoryId;
  question: string;     // shown to user
  options?: Array<{ value: string; label: string }>;
  helpText?: string;
}

// ── Module result ─────────────────────────────────────────────────────────────

export interface ModuleResult {
  findings: RiskCategory[];
  coverageDomains: CoverageItem[];
  docSpecs: DocSpec[];
  questions: DynamicQuestion[];
}

// ── Module interface ──────────────────────────────────────────────────────────

export interface RegulatoryModule {
  id: CategoryId;
  name: string;
  /** True when this module should be evaluated for this product */
  detects(input: Omit<ModuleInput, 'importDate' | 'knownFacts'>): boolean;
  evaluate(input: ModuleInput): ModuleResult;
}

// ── Module registry ───────────────────────────────────────────────────────────

import { automotiveModule } from './automotive';
import { electronicsModule } from './electronics';
import { batteriesModule } from './batteries';
import { childrensModule } from './childrens';
import { textilesModule } from './textiles';
import { cosmeticsModule } from './cosmetics';
import { foodModule } from './food';
import { medicalDevicesModule } from './medicalDevices';
import { chemicalsModule } from './chemicals';
import { furnitureModule } from './furniture';

export const ALL_MODULES: RegulatoryModule[] = [
  automotiveModule,
  electronicsModule,
  batteriesModule,
  childrensModule,
  textilesModule,
  cosmeticsModule,
  foodModule,
  medicalDevicesModule,
  chemicalsModule,
  furnitureModule,
];

export function getActiveModules(input: Omit<ModuleInput, 'importDate' | 'knownFacts'>): RegulatoryModule[] {
  return ALL_MODULES.filter((m) => m.detects(input));
}

export function evaluateAllModules(input: ModuleInput): ModuleResult {
  const findings: RiskCategory[] = [];
  const coverageDomains: CoverageItem[] = [];
  const docSpecs: DocSpec[] = [];
  const questions: DynamicQuestion[] = [];

  for (const mod of ALL_MODULES) {
    if (!mod.detects(input)) continue;
    const result = mod.evaluate(input);
    findings.push(...result.findings);
    coverageDomains.push(...result.coverageDomains);
    docSpecs.push(...result.docSpecs);
    questions.push(...result.questions);
  }

  return { findings, coverageDomains, docSpecs, questions };
}
