/**
 * Deterministic baseline evaluation. Produces source-backed RiskCategory items
 * WITHOUT the model: "verified_applicable" / "official_unconfirmed" are decided
 * here in code from official baseline data (USITC HTS API + curated, citation-
 * backed regulatory_baselines). Anthropic only explains these later.
 */

import { db } from '../db/client';
import type { WatchlistEntry, RiskCategory, RiskLevel } from '../types';
import { lookupHtsBaseline, normalizeHts, type HtsLookupResult } from './htsBaseline';

type AttrKey = keyof Pick<
  WatchlistEntry,
  | 'is_children' | 'has_battery' | 'is_electronic' | 'is_textile'
  | 'is_cosmetic' | 'is_food_contact' | 'is_supplement'
>;

interface Applicability {
  all_of?: AttrKey[];
  any_of?: AttrKey[];
  origin_is_china?: boolean;
  hts_prefixes?: string[];
}

export interface RegulatoryBaselineRow {
  key?: string;
  category: string;
  agency: string;
  title: string;
  cfr_citation: string | null;
  official_url: string;
  effective_or_revision: string | null;
  last_verified_at: string;
  applicability: Applicability;
  applicability_certainty: 'definite' | 'needs_confirmation';
  level: string;
  explanation: string;
  action: string;
}

function attrsMatch(entry: WatchlistEntry, a: Applicability): boolean {
  if (a.all_of && !a.all_of.every((k) => entry[k])) return false;
  if (a.any_of && !a.any_of.some((k) => entry[k])) return false;
  if (a.origin_is_china && !entry.origin_country.toLowerCase().includes('china')) return false;
  if (a.hts_prefixes && a.hts_prefixes.length) {
    const d = normalizeHts(entry.hts_code ?? '');
    if (!d || !a.hts_prefixes.some((p) => d.startsWith(normalizeHts(p)))) return false;
  }
  return true;
}

export async function evaluateBaselines(
  entry: WatchlistEntry,
  estimatedValueUsd?: number,
): Promise<RiskCategory[]> {
  // IO: fetch the official HTS state (always a structured result) and the
  // curated regulatory baselines. The pure assembly happens in assembleBaselines.
  const hts =
    entry.hts_code && normalizeHts(entry.hts_code).length >= 4
      ? await lookupHtsBaseline(entry.hts_code).catch(
          (): HtsLookupResult => ({
            match_level: 'outage',
            requested: normalizeHts(entry.hts_code ?? ''),
            hts8: null,
            matched_htsno: null,
            description: null,
            mfn_text_rate: null,
            mfn_ad_valorem_pct: null,
            section301_ref: null,
            candidates: [],
            source_url: 'https://hts.usitc.gov/',
            note: 'The official USITC HTS service could not be reached.',
          }),
        )
      : null;

  const { data: rows } = await db
    .from('regulatory_baselines')
    .select('*')
    .eq('is_current', true);

  return assembleBaselines(
    entry,
    typeof estimatedValueUsd === 'number' && estimatedValueUsd > 0 ? estimatedValueUsd : null,
    hts,
    (rows ?? []) as unknown as RegulatoryBaselineRow[],
  );
}

/**
 * PURE assembly of baseline RiskCategory[] from already-fetched inputs.
 * Deterministic — no network, no DB — so the report-integrity invariants can be
 * regression-tested (Stage 6) without external services.
 */
export function assembleBaselines(
  entry: WatchlistEntry,
  value: number | null,
  hts: HtsLookupResult | null,
  regRows: RegulatoryBaselineRow[],
  today: string = new Date().toISOString().slice(0, 10),
): RiskCategory[] {
  const out: RiskCategory[] = [];

  // ── 0. Universal CBP entry filing (true for every commercial import) ─────────
  // Backs the universally-required entry documents so each one traces to a
  // verified, officially-sourced finding (no untraceable "required" docs).
  out.push({
    id: 'cbp_entry',
    category: 'Customs Entry Filing',
    level: 'Low',
    explanation:
      'Every commercial U.S. import must be entered with CBP. The importer of record (or their customs broker) files the entry and entry summary, supported by a commercial invoice, packing list, transport document, and country-of-origin marking.',
    action:
      'Make sure your customs broker has your commercial invoice, packing list, and product details to file the CBP entry (Form 3461) and entry summary (Form 7501).',
    verification_status: 'verified_applicable',
    applicability_conditions:
      'Applies to all commercial merchandise entered for consumption into the United States.',
    verified_rate_pct: null,
    source: {
      agency: 'CBP',
      name: 'U.S. Customs and Border Protection',
      title: 'Entry of merchandise — 19 U.S.C. 1484 / 19 CFR Part 142',
      cfr_citation: '19 CFR Part 142; 19 CFR 141.86',
      last_verified_at: today,
      url: 'https://www.cbp.gov/trade/programs-administration/entry-summary',
      why_relevant: 'All commercial shipments entered into the U.S. require a CBP entry and entry summary.',
    },
  });

  // ── 1. HTS duty baseline (official USITC) ───────────────────────────────────
  // SYSTEM INVARIANT (Stage 2): when an HTS code is submitted, the tariff
  // section is NEVER omitted. The lookup always resolves to a truthful state —
  // exact / parent / ambiguous / not_found / outage — and each produces a card.
  if (hts) {
    const submitted = formatHts(hts.requested);

    if (hts.match_level === 'exact' && hts.hts8) {
      const pct = hts.mfn_ad_valorem_pct;
      let financial: string | undefined;
      if (pct != null && value != null) {
        const amt = Math.round((value * pct) / 100);
        financial = `~$${amt.toLocaleString('en-US')} on a $${value.toLocaleString('en-US')} shipment (${pct}% MFN, per USITC HTS)`;
      } else if (pct != null) {
        financial = `${pct}% of customs value (MFN base rate) — add a shipment value to see the dollar impact`;
      }

      out.push({
        id: 'hts_duty',
        category: 'Customs Duty (MFN / General Rate)',
        level: pct != null && pct >= 5 ? 'Medium' : 'Low',
        explanation: `Under HTS ${formatHts(hts.hts8)} (${hts.description}), the official General (MFN) duty rate is ${hts.mfn_text_rate ?? 'as published'}. This is the base duty before any trade-remedy tariffs.`,
        action: 'Confirm this HTS classification with your customs broker — the rate only applies if the goods are correctly classified.',
        verification_status: 'verified_applicable',
        applicability_conditions: `Goods correctly classified under HTS ${formatHts(hts.hts8)}.`,
        verified_rate_pct: pct,
        financial_impact: financial,
        source: {
          agency: 'USITC',
          name: 'Harmonized Tariff Schedule of the United States',
          title: `HTS ${formatHts(hts.hts8)} — ${hts.description}`,
          cfr_citation: `HTSUS ${formatHts(hts.hts8)}`,
          effective_date: undefined,
          last_verified_at: today,
          url: hts.source_url,
          why_relevant: 'The product was submitted under this HTS code.',
        },
      });
    } else if (hts.match_level === 'parent' || hts.match_level === 'ambiguous') {
      // Official heading found, but the exact tariff line / rate is NOT
      // confirmed. We never present a parent heading's rate as the exact rate.
      const candidateText = hts.candidates.length
        ? ' Subheadings found: ' +
          hts.candidates
            .map((c) => `${c.htsno} (${(c.description || '').slice(0, 60)}; General ${c.general ?? 'see HTS'})`)
            .join('; ') +
          '.'
        : '';
      out.push({
        id: 'hts_duty',
        category: 'Customs Duty (HTS classification needs confirmation)',
        level: 'Medium',
        explanation:
          `Official HTS heading found for ${submitted}${hts.description ? ` (${hts.description})` : ''}, but the exact 10-digit tariff line — and therefore the precise MFN duty rate — still needs confirmation.${candidateText} ClearPort does not assume a parent heading's rate is the rate for your goods.`,
        action:
          'Provide the exact 10-digit HTS statistical line (or confirm it with your customs broker) so ClearPort can verify the official MFN duty rate.',
        verification_status: 'official_unconfirmed',
        applicability_conditions:
          'A specific 10-digit HTS classification is required to confirm the official duty rate.',
        verified_rate_pct: null,
        missing_info: 'the exact 10-digit HTS statistical suffix for this product',
        source: {
          agency: 'USITC',
          name: 'Harmonized Tariff Schedule of the United States',
          title: `HTS heading ${submitted} — exact tariff line to be confirmed`,
          cfr_citation: hts.hts8 ? `HTSUS ${formatHts(hts.hts8)}` : `HTSUS ${submitted}`,
          last_verified_at: today,
          url: hts.source_url,
          why_relevant: 'The product was submitted under this HTS heading.',
        },
      });
    } else if (hts.match_level === 'not_found') {
      // Truthful "could not be verified" — makes NO duty claim and does NOT
      // influence the risk score, but the tariff section is still present.
      out.push({
        id: 'hts_duty',
        category: 'Customs Duty (HTS code not found)',
        level: 'N/A',
        explanation: `ClearPort could not find an official USITC HTS line matching ${submitted}. No duty rate is being asserted. The most likely cause is a typo, a withdrawn code, or a code that needs its full 10-digit statistical suffix.`,
        action: '',
        verification_status: 'no_verified_source',
        missing_info:
          'a valid official HTS classification — re-check the code against hts.usitc.gov or ask your customs broker.',
      });
    } else {
      // Outage — the official source did not respond. Truthful, never silent.
      out.push({
        id: 'hts_duty',
        category: 'Customs Duty (official source temporarily unavailable)',
        level: 'N/A',
        explanation: `The official USITC HTS service was temporarily unavailable when this report was generated, so the duty rate for ${submitted} could not be verified right now. This is a source outage — not a finding about your product. ClearPort will not display an unverified rate.`,
        action: '',
        verification_status: 'no_verified_source',
        missing_info:
          'a live response from the official USITC HTS service — re-run this check shortly, or confirm the rate with your customs broker.',
      });
    }

    // ── 2. Section 301 (only from the official HTS Ch.99 footnote) ────────────
    // Requires both an official 9903.88 cross-reference AND China origin; never
    // inferred from origin alone.
    if (hts.section301_ref && entry.origin_country.toLowerCase().includes('china')) {
      out.push({
        id: 'hts_section301',
        category: 'Section 301 China Tariff',
        level: 'High',
        explanation: `The HTS entry for this product carries an official footnote referencing ${hts.section301_ref} (a Section 301 Chapter 99 provision). Section 301 duties are added on top of the base rate for China-origin goods, but the exact additional rate and any exclusions depend on the specific Chapter 99 subheading.`,
        action: 'Ask your broker to confirm the exact Section 301 rate and exclusion status for the applicable 9903.88 subheading.',
        verification_status: 'official_unconfirmed',
        applicability_conditions: `China-origin goods classified under an HTS code cross-referenced to ${hts.section301_ref}.`,
        verified_rate_pct: null,
        source: {
          agency: 'USTR',
          name: 'USITC HTS Chapter 99 / USTR Section 301',
          title: `Section 301 cross-reference ${hts.section301_ref}`,
          cfr_citation: `HTSUS ${hts.section301_ref}`,
          last_verified_at: today,
          url: 'https://ustr.gov/issue-areas/enforcement/section-301-investigations',
          why_relevant: 'The official HTS footnote cross-references this product to a Section 301 provision.',
        },
      });
    }
  }

  // ── 3. Curated standing regulatory baselines ────────────────────────────────
  for (const r of regRows) {
    if (!attrsMatch(entry, r.applicability ?? {})) continue;
    const definite = r.applicability_certainty === 'definite';
    out.push({
      id: r.key ? `reg_${r.key}` : undefined,
      category: r.category,
      level: (r.level as RiskLevel) ?? 'Medium',
      explanation: r.explanation,
      action: r.action,
      verification_status: definite ? 'verified_applicable' : 'official_unconfirmed',
      applicability_conditions: describeApplicability(r.applicability),
      verified_rate_pct: null,
      source: {
        agency: r.agency,
        name: r.agency,
        title: r.title,
        cfr_citation: r.cfr_citation ?? undefined,
        effective_date: r.effective_or_revision ?? undefined,
        last_verified_at: (r.last_verified_at ?? today).slice(0, 10),
        url: r.official_url,
        why_relevant: 'Your submitted product characteristics match this requirement’s applicability conditions.',
      },
    });
  }

  return out;
}

function formatHts(d: string): string {
  return [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean).join('.');
}

function describeApplicability(a: Applicability): string {
  const parts: string[] = [];
  if (a.all_of?.length) parts.push(a.all_of.map(prettyAttr).join(' and '));
  if (a.any_of?.length) parts.push(a.any_of.map(prettyAttr).join(' or '));
  if (a.origin_is_china) parts.push('origin is China');
  return parts.length ? `Applies because the product is: ${parts.join('; ')}.` : 'Applies to this product class.';
}

function prettyAttr(k: AttrKey): string {
  const map: Record<AttrKey, string> = {
    is_children: 'intended for children under 12',
    has_battery: 'contains a battery',
    is_electronic: 'an electronic device',
    is_textile: 'a textile/apparel item',
    is_cosmetic: 'a cosmetic/personal-care product',
    is_food_contact: 'in contact with food or drink',
    is_supplement: 'a supplement/food/medical-adjacent product',
  };
  return map[k];
}
