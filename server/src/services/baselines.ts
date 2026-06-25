/**
 * Deterministic baseline evaluation. Produces source-backed RiskCategory items
 * WITHOUT the model: "verified_applicable" / "official_unconfirmed" are decided
 * here in code from official baseline data (USITC HTS API + curated, citation-
 * backed regulatory_baselines). Anthropic only explains these later.
 */

import { db } from '../db/client';
import type { WatchlistEntry, RiskCategory, RiskLevel, CoverageItem, CoverageStatus } from '../types';
import { lookupHtsBaseline, normalizeHts, formatHts, type HtsLookupResult } from './htsBaseline';
import { screenAdcvd, adcvdFindingsToCategories, adcvdFindingsToCoverage } from './adcvdScanner';

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

export interface BaselineResult {
  categories: RiskCategory[];
  coverage: CoverageItem[];
  missingFacts: string[];
}

export async function evaluateBaselines(
  entry: WatchlistEntry,
  estimatedValueUsd?: number,
): Promise<BaselineResult> {
  const normalizedHts = normalizeHts(entry.hts_code ?? '');

  // Parallel IO: HTS lookup + regulatory baselines + AD/CVD screening
  const [hts, regRowsResult, adcvdFindings] = await Promise.all([
    entry.hts_code && normalizedHts.length >= 4
      ? lookupHtsBaseline(entry.hts_code).catch(
          (): HtsLookupResult => ({
            match_level: 'outage',
            requested: normalizedHts,
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
      : Promise.resolve(null),

    db.from('regulatory_baselines').select('*').eq('is_current', true),

    // AD/CVD screening is fault-tolerant — returns [] if table not yet created
    screenAdcvd(entry, normalizedHts).catch(() => []),
  ]);

  const regRows = (regRowsResult.data ?? []) as unknown as RegulatoryBaselineRow[];
  const value = typeof estimatedValueUsd === 'number' && estimatedValueUsd > 0 ? estimatedValueUsd : null;
  const today = new Date().toISOString().slice(0, 10);

  const baseCategories = assembleBaselines(entry, value, hts, regRows, today);
  const adcvdCategories = adcvdFindingsToCategories(adcvdFindings, today);
  const categories = [...baseCategories, ...adcvdCategories];

  // Build coverage matrix from all checked domains
  const adcvdCoverage = adcvdFindingsToCoverage(adcvdFindings, adcvdCategories);
  const coverage = buildCoverageMatrix(entry, categories, adcvdCoverage, hts, normalizedHts, regRows);

  // Aggregate missing facts from AD/CVD scope analysis
  const missingFacts = Array.from(
    new Set(adcvdFindings.flatMap((f) => f.missing_facts)),
  );

  return { categories, coverage, missingFacts };
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

// ── Coverage matrix builder ───────────────────────────────────────────────────
// Produces the "What ClearPort checked" matrix. Every domain that ClearPort
// knows how to screen for this product class gets a status — even when the
// result is "no applicable rule found" or "not applicable."

const DOMAIN_REGISTRY: Array<{
  key: string;
  label: string;
  cat: CoverageItem['category'];
  // Returns whether to include this domain at all (true = check it)
  relevant: (entry: WatchlistEntry, hts: string) => boolean;
  // Returns status given what was found in categories
  resolve: (
    cats: RiskCategory[],
    entry: WatchlistEntry,
    hts: HtsLookupResult | null,
    regRows: RegulatoryBaselineRow[],
  ) => { status: CoverageStatus; note?: string; missing?: string[] };
}> = [
  {
    key: 'mfn_duty',
    label: 'MFN / Base Duty (USITC HTS)',
    cat: 'tariff',
    // Always include — show insufficient_info when no HTS code so the gap is
    // visible rather than silently absent.
    relevant: () => true,
    resolve: (cats, _e, hts) => {
      if (!hts) return { status: 'insufficient_info', note: 'HTS code required for MFN duty lookup', missing: ['HTS code (8-digit minimum)'] };
      const c = cats.find((x) => x.id === 'hts_duty');
      if (!c) return { status: 'source_unavailable', note: 'HTS lookup did not return a duty card' };
      if (c.verification_status === 'verified_applicable')
        return { status: 'verified_applicable', note: `MFN rate: ${hts.mfn_text_rate ?? 'confirmed from USITC'}` };
      if (c.verification_status === 'official_unconfirmed')
        return { status: 'official_unconfirmed', note: 'HTS heading found; exact 10-digit line needed to confirm rate', missing: ['exact 10-digit HTS statistical line'] };
      if (hts.match_level === 'outage') return { status: 'source_unavailable', note: 'USITC HTS service temporarily unavailable' };
      return { status: 'insufficient_info', note: 'HTS code not found in USITC database' };
    },
  },
  {
    key: 'section_301',
    label: 'Section 301 China Tariff (Chapter 99)',
    cat: 'tariff',
    relevant: (_e, _hts) => true,
    resolve: (cats, entry, hts) => {
      if (!entry.origin_country.toLowerCase().includes('china'))
        return { status: 'not_applicable', note: 'Not applicable — origin is not China' };
      const c = cats.find((x) => x.id === 'hts_section301');
      if (c) return { status: 'official_unconfirmed', note: `Chapter 99 cross-reference ${hts?.section301_ref ?? ''} found in official HTS footnote` };
      if (hts && hts.match_level === 'exact' && !hts.section301_ref)
        return { status: 'no_applicable_rule', note: 'No Section 301 footnote found on the matched HTS line' };
      if (hts && (hts.match_level === 'parent' || hts.match_level === 'ambiguous'))
        return { status: 'insufficient_info', note: '10-digit HTS line needed to confirm Section 301 cross-reference', missing: ['exact 10-digit HTS code'] };
      return { status: 'insufficient_info', note: 'HTS code required to screen Section 301 footnotes', missing: ['exact HTS code'] };
    },
  },
  {
    key: 'section_232',
    label: 'Section 232 (Steel / Aluminum)',
    cat: 'tariff',
    relevant: (_e, hts) => {
      const h = hts.slice(0, 4);
      // Core S232 chapters: 72 (steel), 73 (iron/steel articles), 76 (aluminum)
      return ['7201','7202','7203','7204','7205','7206','7207','7208','7209','7210',
              '7211','7212','7213','7214','7215','7216','7217','7218','7219','7220',
              '7221','7222','7223','7224','7225','7226','7227','7228','7229',
              '7301','7302','7303','7304','7305','7306','7307','7308','7309','7310',
              '7311','7312','7313','7314','7315','7316','7317','7318','7319','7320',
              '7321','7322','7323','7324','7325','7326',
              '7601','7602','7603','7604','7605','7606','7607','7608','7609','7610',
              '7611','7612','7613','7614','7615','7616'].some((p) => h === p.slice(0, 4));
    },
    resolve: () => ({ status: 'official_unconfirmed', note: 'Product HTS falls in steel/aluminum tariff chapters — confirm Section 232 applicability with your broker' }),
  },
  {
    key: 'adcvd_screened',
    label: 'AD/CVD Orders (standing)',
    cat: 'trade_remedy',
    relevant: () => true,
    resolve: (cats) => {
      const adcvd = cats.filter((c) => c.id?.startsWith('adcvd_'));
      if (adcvd.length > 0) return { status: 'likely_match', note: `${adcvd.length} active AD/CVD order(s) screened — see detailed findings` };
      return { status: 'no_applicable_rule', note: 'No active AD/CVD orders matched this HTS code and origin' };
    },
  },
  {
    key: 'customs_entry',
    label: 'Customs Entry & CBP Filing',
    cat: 'customs',
    relevant: () => true,
    resolve: (cats) => {
      const c = cats.find((x) => x.id === 'cbp_entry');
      return c ? { status: 'verified_applicable', note: 'Required for all commercial U.S. imports' } : { status: 'insufficient_info' };
    },
  },
  {
    key: 'origin_marking',
    label: 'Country-of-Origin Marking (CBP)',
    cat: 'customs',
    relevant: () => true,
    resolve: (cats) => {
      const c = cats.find((x) => x.id === 'cbp_entry');
      return c ? { status: 'verified_applicable', note: 'Required — goods must be legibly marked with country of origin (19 U.S.C. 1304)' } : { status: 'insufficient_info' };
    },
  },
  {
    key: 'cpsc',
    label: 'Product Safety (CPSC / CPSIA)',
    cat: 'product_regulation',
    relevant: () => true,
    resolve: (cats, entry) => {
      const c = cats.find((x) => x.id === 'reg_cpsia_childrens_product');
      if (c) return { status: c.verification_status === 'verified_applicable' ? 'verified_applicable' : 'official_unconfirmed' };
      if (!entry.is_children) return { status: 'not_applicable', note: 'Not a children\'s product — CPSIA third-party testing not required' };
      return { status: 'no_applicable_rule' };
    },
  },
  {
    key: 'fda',
    label: 'FDA Requirements',
    cat: 'product_regulation',
    relevant: () => true,
    resolve: (cats, entry) => {
      const fdaCats = cats.filter((c) => c.id?.startsWith('reg_fda'));
      if (fdaCats.length > 0) return { status: fdaCats[0].verification_status === 'verified_applicable' ? 'verified_applicable' : 'official_unconfirmed' };
      if (!entry.is_food_contact && !entry.is_cosmetic && !entry.is_supplement)
        return { status: 'not_applicable', note: 'Not food-contact, cosmetic, or supplement — no FDA requirement triggered' };
      return { status: 'no_applicable_rule' };
    },
  },
  {
    key: 'fcc',
    label: 'FCC Emissions & Equipment Authorization',
    cat: 'product_regulation',
    relevant: () => true,
    resolve: (cats, entry) => {
      const c = cats.find((x) => x.id === 'reg_fcc_part15_rf');
      if (c) return { status: 'official_unconfirmed', note: 'Electronic device — FCC authorization may be required' };
      if (!entry.is_electronic) return { status: 'not_applicable', note: 'Not an electronic device — FCC Part 15 not triggered' };
      return { status: 'no_applicable_rule' };
    },
  },
  {
    key: 'dot_phmsa',
    label: 'Hazardous Materials Transport (DOT/PHMSA)',
    cat: 'product_regulation',
    relevant: () => true,
    resolve: (cats, entry) => {
      const c = cats.find((x) => x.id === 'reg_lithium_battery_transport');
      if (c) return { status: c.verification_status === 'verified_applicable' ? 'verified_applicable' : 'official_unconfirmed' };
      if (!entry.has_battery) return { status: 'not_applicable', note: 'No battery — DOT/PHMSA lithium battery transport rules not triggered' };
      return { status: 'no_applicable_rule' };
    },
  },
  {
    key: 'nhtsa_fmvss',
    label: 'NHTSA / FMVSS (Motor Vehicle Equipment)',
    cat: 'product_regulation',
    // Trigger on HTS prefix OR on automotive keywords when no HTS code is provided,
    // so brake drums/axles/suspension parts are never silently excluded.
    relevant: (entry, hts) => {
      const htsPrefixes = ['8708','8711','8714','8701','8702','8703','8704','8705','8706','8707'];
      if (htsPrefixes.some((p) => hts.startsWith(p))) return true;
      const text = `${entry.product_name} ${entry.product_description ?? ''}`;
      return /\bbrake\b|\bwheel\s+hub\b|\baxle\b|\bsuspension\b|\bdriveshaft\b|\bmotor\s+vehicle\b|\bpassenger\s+vehicle\b|\bautomotive\b|\btruck\s+part\b|\bvehicle\s+part\b/i.test(text);
    },
    resolve: (cats) => {
      const c = cats.find((x) => x.id === 'reg_nhtsa_fmvss');
      if (c) return { status: 'official_unconfirmed', note: 'Automotive parts may be subject to FMVSS — confirm with NHTSA and importer', missing: ['vehicle type and use (OEM vs. replacement)', 'whether vehicle is subject to FMVSS 121'] };
      return { status: 'official_unconfirmed', note: 'Automotive part — FMVSS applicability should be confirmed with NHTSA', missing: ['vehicle type', 'OEM vs. replacement equipment'] };
    },
  },
  {
    key: 'ftc_labeling',
    label: 'FTC Labeling Requirements',
    cat: 'product_regulation',
    relevant: () => true,
    resolve: (cats, entry) => {
      const c = cats.find((x) => x.id === 'reg_ftc_textile_labeling');
      if (c) return { status: c.verification_status === 'verified_applicable' ? 'verified_applicable' : 'official_unconfirmed' };
      if (!entry.is_textile) return { status: 'not_applicable', note: 'Not a textile — FTC fiber-content labeling not triggered' };
      return { status: 'no_applicable_rule' };
    },
  },
  {
    key: 'epa_tsca',
    label: 'EPA / TSCA / FIFRA',
    cat: 'product_regulation',
    relevant: () => true,
    resolve: (_cats, _entry) => ({
      status: 'no_applicable_rule',
      note: 'No EPA/TSCA/FIFRA trigger detected from submitted product attributes',
    }),
  },
];

export function buildCoverageMatrix(
  entry: WatchlistEntry,
  categories: RiskCategory[],
  adcvdCoverage: CoverageItem[],
  hts: HtsLookupResult | null,
  normalizedHts: string,
  regRows: RegulatoryBaselineRow[],
): CoverageItem[] {
  const result: CoverageItem[] = [];

  // Stable domain_key → risk_category.id mapping so the frontend cost table can
  // look up the finalized finding (rate, source, CFR citation) via finding_id.
  const DOMAIN_FINDING_IDS: Record<string, string> = {
    mfn_duty: 'hts_duty',
    section_301: 'hts_section301',
  };

  // Domains from the registry
  for (const d of DOMAIN_REGISTRY) {
    if (!d.relevant(entry, normalizedHts)) continue;
    const resolved = d.resolve(categories, entry, hts, regRows);
    const linkedId = DOMAIN_FINDING_IDS[d.key];
    const findingId = linkedId && categories.find((c) => c.id === linkedId) ? linkedId : undefined;
    result.push({
      domain: d.label,
      domain_key: d.key,
      category: d.cat,
      status: resolved.status,
      finding_id: findingId,
      note: resolved.note,
      missing_facts: resolved.missing?.length ? resolved.missing : undefined,
    });
  }

  // Replace the generic AD/CVD_screened row with the specific per-order rows
  const adcvdIdx = result.findIndex((r) => r.domain_key === 'adcvd_screened');
  if (adcvdCoverage.length > 0) {
    result.splice(adcvdIdx, 1, ...adcvdCoverage);
  }

  return result;
}
