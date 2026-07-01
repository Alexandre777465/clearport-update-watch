/**
 * Universal obligation engine.
 *
 * Converts RiskCategory findings + DocSpec entries into normalised ObligationRecords,
 * deduplicates across all module outputs, and filters by transport mode.
 *
 * Architecture rule: this module is the single source of truth for obligation
 * normalisation. No module, baseline, or UI layer should independently invent
 * obligation records or status labels. Product-specific exclusions are expressed
 * as structured rule data (triggering_facts / exclusion_facts), never as UI conditions.
 */

import type {
  RiskCategory,
  ObligationRecord,
  ObligationStatus,
  ObligationTiming,
  VerificationStatus,
  DocItemStatus,
} from '../types';
import type { DocSpec as ModuleDocSpec } from './regulatoryModules/index';

// ── Status mapping ─────────────────────────────────────────────────────────────

function verificationToStatus(
  v: VerificationStatus | undefined,
  level: string,
): ObligationStatus {
  switch (v) {
    case 'verified_applicable':
      return 'mandatory';
    case 'not_applicable':
      // level 'N/A' means "screened — no mandatory rule identified"
      return level === 'N/A' ? 'informational_no_specific_rule' : 'not_applicable';
    case 'official_unconfirmed':
      return 'cannot_determine';
    case 'insufficient_info':
      return 'cannot_determine';
    case 'no_verified_source':
      return 'cannot_determine';
    default:
      return 'cannot_determine';
  }
}

function docStatusToTiming(ds: DocItemStatus | undefined): ObligationTiming {
  switch (ds) {
    case 'required_to_clear':
      return 'customs_clearance';
    case 'required_if':
      return 'customs_clearance';
    case 'usually_requested':
      return 'usually_requested';
    case 'before_sale':
      return 'before_sale';
    case 'cannot_determine':
      return 'customs_clearance';
    default:
      return 'customs_clearance';
  }
}

// ── Canonical dedup key ────────────────────────────────────────────────────────

function canonicalKey(
  citation: string,
  status: ObligationStatus,
  timing: ObligationTiming,
): string {
  return `${citation.toLowerCase().trim()}::${status}::${timing}`;
}

// ── Status confidence — used to pick the "best" record when deduplicating ─────

const STATUS_RANK: Record<ObligationStatus, number> = {
  mandatory: 5,
  cannot_determine: 4,
  voluntary: 3,
  informational_no_specific_rule: 2,
  not_applicable: 1,
};

// ── Core conversion ────────────────────────────────────────────────────────────

/**
 * Convert a single RiskCategory finding (optionally paired with a DocSpec) into
 * an ObligationRecord.  The module parameter identifies the originating module.
 */
export function normalizeObligation(
  category: RiskCategory,
  docSpec?: ModuleDocSpec | { document: string; doc_status?: DocItemStatus; transport_modes?: ('ocean'|'air'|'truck'|'rail')[]; responsible_party?: import('../types').ResponsibleParty },
  module?: string,
): ObligationRecord {
  const citation =
    category.source?.cfr_citation ??
    category.source?.title ??
    category.category;

  const status = verificationToStatus(category.verification_status, category.level);
  const timing = docSpec ? docStatusToTiming(docSpec.doc_status) : 'customs_clearance';
  const obligation_id = canonicalKey(citation, status, timing);

  return {
    obligation_id,
    module: module ?? category.id ?? 'unknown',
    legal_citation: citation,
    official_source: category.source?.url,
    product_scope: category.applicability_conditions,
    status,
    timing,
    responsible_party: docSpec?.responsible_party,
    document_name: docSpec?.document,
    transport_modes: (docSpec as any)?.transport_modes,
  };
}

// ── Deduplication ──────────────────────────────────────────────────────────────

/**
 * Deduplicate obligation records by canonical key.
 * When two records share a key, the one with higher STATUS_RANK survives.
 * Separate laws and timings are never merged: only exact key matches collapse.
 */
export function deduplicateObligations(
  records: ObligationRecord[],
): ObligationRecord[] {
  const seen = new Map<string, ObligationRecord>();
  for (const r of records) {
    const existing = seen.get(r.obligation_id);
    if (!existing || STATUS_RANK[r.status] > STATUS_RANK[existing.status]) {
      seen.set(r.obligation_id, r);
    }
  }
  return [...seen.values()];
}

// ── Transport-mode filter ──────────────────────────────────────────────────────

/**
 * Return only obligations that apply to the given transport mode.
 * An obligation with no transport_modes set applies to all modes.
 */
export function filterByTransportMode(
  records: ObligationRecord[],
  mode: 'ocean' | 'air' | 'truck' | 'rail',
): ObligationRecord[] {
  return records.filter(
    (r) => !r.transport_modes || r.transport_modes.includes(mode),
  );
}

// ── Full pipeline ──────────────────────────────────────────────────────────────

/**
 * Build the full deduplicated obligation list from a finalized scan's findings
 * and document specs.  Optionally filter by transport mode.
 *
 * One obligation record is created per (legal_citation × timing) pair so that
 * a single legal rule never appears under multiple names or timing buckets.
 */
export function buildObligations(
  categories: RiskCategory[],
  docSpecs: Array<ModuleDocSpec | { document: string; doc_status?: DocItemStatus; transport_modes?: ('ocean'|'air'|'truck'|'rail')[]; responsible_party?: import('../types').ResponsibleParty; finding_id?: string }>,
  mode?: 'ocean' | 'air' | 'truck' | 'rail' | null,
): ObligationRecord[] {
  const records: ObligationRecord[] = [];

  for (const cat of categories) {
    const paired = docSpecs.filter((d) => d.finding_id === cat.id);
    if (paired.length > 0) {
      for (const ds of paired) {
        records.push(normalizeObligation(cat, ds as any, cat.id ?? undefined));
      }
    } else {
      records.push(normalizeObligation(cat, undefined, cat.id ?? undefined));
    }
  }

  const deduped = deduplicateObligations(records);
  return mode ? filterByTransportMode(deduped, mode) : deduped;
}
