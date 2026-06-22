/**
 * Deterministic baseline evaluation. Produces source-backed RiskCategory items
 * WITHOUT the model: "verified_applicable" / "official_unconfirmed" are decided
 * here in code from official baseline data (USITC HTS API + curated, citation-
 * backed regulatory_baselines). Anthropic only explains these later.
 */

import { db } from '../db/client';
import type { WatchlistEntry, RiskCategory, RiskLevel } from '../types';
import { fetchAndStoreHtsBaseline, normalizeHts } from './htsBaseline';

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

interface RegulatoryBaselineRow {
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
  const out: RiskCategory[] = [];
  const value = typeof estimatedValueUsd === 'number' && estimatedValueUsd > 0 ? estimatedValueUsd : null;
  const today = new Date().toISOString().slice(0, 10);

  // ── 1. HTS duty baseline (official USITC) ───────────────────────────────────
  if (entry.hts_code) {
    const hts = await fetchAndStoreHtsBaseline(entry.hts_code).catch(() => null);
    if (hts) {
      const pct = hts.mfn_ad_valorem_pct;
      let financial: string | undefined;
      if (pct != null && value != null) {
        const amt = Math.round((value * pct) / 100);
        financial = `~$${amt.toLocaleString('en-US')} on a $${value.toLocaleString('en-US')} shipment (${pct}% MFN, per USITC HTS)`;
      } else if (pct != null) {
        financial = `${pct}% of customs value (MFN base rate) — add a shipment value to see the dollar impact`;
      }

      out.push({
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

      // ── 2. Section 301 (detected from the official HTS Ch.99 footnote) ───────
      if (hts.section301_ref && entry.origin_country.toLowerCase().includes('china')) {
        out.push({
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
  }

  // ── 3. Curated standing regulatory baselines ────────────────────────────────
  const { data: rows } = await db
    .from('regulatory_baselines')
    .select('*')
    .eq('is_current', true);

  for (const r of (rows ?? []) as unknown as RegulatoryBaselineRow[]) {
    if (!attrsMatch(entry, r.applicability ?? {})) continue;
    const definite = r.applicability_certainty === 'definite';
    out.push({
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
