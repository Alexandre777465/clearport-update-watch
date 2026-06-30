/**
 * Independent official-rule registry.
 *
 * Each record is sourced from a primary federal or standards source and is
 * completely independent of the finding objects that reference it. The report
 * verifier cross-checks every verified_applicable finding against this registry
 * before approving it.
 *
 * Fields:
 *   rule_id              — canonical internal identifier
 *   finding_id           — cat.id produced by the baseline/module system for this rule
 *   agency               — issuing authority
 *   legal_citation       — official statute or rule reference
 *   official_url         — primary source URL
 *   supported_proposition — what the rule actually requires (summary)
 *   product_scope        — human-readable scope description
 *   scope_conditions     — machine-checkable preconditions (see ScopeConditions)
 *   effective_date       — ISO date rule took effect
 *   expiry_date          — ISO date rule was repealed/expired (absent = ongoing)
 *   legal_status         — mandatory | voluntary | informational
 *   timing               — when compliance must be demonstrated
 */

export interface ScopeConditions {
  /** First two digits of HTS code must be one of these chapters. */
  hts_chapters?: number[];
  /** First four digits of HTS code (as string) must be one of these headings. */
  hts_headings?: string[];
  /** All of these strings must appear in the product text (case-insensitive). */
  keywords_required?: string[];
  /** At least one of these strings must appear in the product text (case-insensitive). */
  keywords_any_of?: string[];
  /** None of these strings may appear in the product text (case-insensitive). */
  keywords_excluded?: string[];
  /** If 'children_only', productFacts.attrs.is_children must be true. */
  applicable_age?: 'children_only';
  /**
   * Origin country of the shipment must match one of these values
   * (case-insensitive substring match against productFacts.originCountry).
   */
  origin_countries?: string[];
  /** productFacts.attrs.has_battery must be true. */
  battery_required?: boolean;
  /** productFacts.attrs.is_electronic must be true. */
  electronic_required?: boolean;
  /** Shipment transport mode must be one of these (from ctx.transportMode). */
  transport_modes?: ('ocean' | 'air' | 'truck' | 'rail')[];
  /** ISO date: rule is not yet in effect before this date. */
  min_import_date?: string;
  /** ISO date: rule is no longer in effect after this date. */
  max_import_date?: string;
  /**
   * Boolean product attribute checks against ProductFacts.attrs.
   * Every key listed must match the given boolean value.
   * If the attr value is `undefined` (unknown), returns 'clarify'.
   */
  attrs_required?: Partial<{
    is_children: boolean;
    has_battery: boolean;
    is_electronic: boolean;
    is_textile: boolean;
    is_cosmetic: boolean;
    is_food_contact: boolean;
    is_supplement: boolean;
  }>;
  /**
   * Structured-answer checks against ProductFacts.knownFacts.
   * For each entry, knownFacts[key] must be one of the listed values.
   * If the key is absent, returns 'clarify'.
   */
  knownFacts_required?: Array<{ key: string; values: string[] }>;
}

export interface OfficialRuleRecord {
  /** Canonical internal identifier for this rule record. */
  rule_id: string;
  /**
   * The cat.id value produced by the baseline or module system when this
   * rule fires.  Used as the primary lookup key in the verifier.
   * Absent when a single rule may appear under multiple finding ids.
   */
  finding_id?: string;
  /** Issuing authority (federal agency or standards body). */
  agency: string;
  /** Official statutory / regulatory citation. */
  legal_citation: string;
  /** Authoritative source URL. */
  official_url: string;
  /** One-sentence statement of what the rule requires. */
  supported_proposition: string;
  /** Human-readable scope description. */
  product_scope: string;
  /** Machine-checkable preconditions. */
  scope_conditions: ScopeConditions;
  /** ISO date the rule became effective. */
  effective_date: string;
  /** ISO date the rule was repealed or expired.  Absent = still in effect. */
  expiry_date?: string;
  /** Whether this rule creates a mandatory obligation, voluntary standard, or informational notice. */
  legal_status: 'mandatory' | 'voluntary' | 'informational';
  /** When compliance must be demonstrated. */
  timing: 'customs_clearance' | 'transport' | 'before_sale' | 'post_market' | 'available_on_request' | 'usually_requested';
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const OFFICIAL_RULE_REGISTRY: OfficialRuleRecord[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // BASELINES
  // ═══════════════════════════════════════════════════════════════════════════

  // ── CBP Entry Requirements ────────────────────────────────────────────────
  {
    rule_id: 'cbp_entry_requirements',
    finding_id: 'cbp_entry',
    agency: 'CBP',
    legal_citation: '19 CFR 141; 19 U.S.C. 1484',
    official_url: 'https://www.cbp.gov/trade/basic-import-export/importing-into-united-states',
    supported_proposition:
      'All commercial importations above the $2,500 formal-entry threshold require a formal entry with CBP, including commercial invoice, packing list, and transport document.',
    product_scope: 'All commercial merchandise imported into the United States',
    scope_conditions: {},
    effective_date: '1994-01-01',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ── MFN / General Duty (USITC HTS) ──────────────────────────────────────
  {
    rule_id: 'mfn_duty',
    finding_id: 'hts_duty',
    agency: 'USITC',
    legal_citation: '19 U.S.C. 1202',
    official_url: 'https://hts.usitc.gov',
    supported_proposition:
      'All imported merchandise is subject to the MFN (General) duty rate published in the Harmonized Tariff Schedule of the United States.',
    product_scope: 'All commercial merchandise imported into the United States',
    scope_conditions: {},
    effective_date: '1989-01-01',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ── Merchandise Processing Fee ───────────────────────────────────────────
  {
    rule_id: 'mpf_fy2026',
    finding_id: 'mpf',
    agency: 'CBP',
    legal_citation: '19 U.S.C. 58c(a)(9)(A); 19 CFR 24.23',
    official_url: 'https://www.cbp.gov/trade/programs-administration/fees/merchandise-processing-fee',
    supported_proposition:
      'Merchandise Processing Fee assessed at 0.3464% of entered value with FY2026 minimum $33.58 and maximum $651.50 on all formal commercial entries.',
    product_scope: 'All formal commercial entries into the United States',
    scope_conditions: {},
    effective_date: '2025-10-01',
    expiry_date: '2026-09-30',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ── Harbor Maintenance Fee ───────────────────────────────────────────────
  {
    rule_id: 'harbor_maintenance_fee',
    finding_id: 'hmf',
    agency: 'CBP',
    legal_citation: '26 U.S.C. 4461-4462; 19 CFR 24.24',
    official_url: 'https://www.cbp.gov/trade/programs-administration/fees/harbor-maintenance-fee',
    supported_proposition:
      'Harbor Maintenance Fee assessed at 0.125% of dutiable value on commercial cargo entering U.S. ports via ocean carrier.',
    product_scope: 'Commercial cargo imported through a U.S. port via ocean carrier',
    scope_conditions: {
      transport_modes: ['ocean'],
    },
    effective_date: '1987-01-01',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ── Section 122 Temporary Surcharge ──────────────────────────────────────
  {
    rule_id: 'section_122_surcharge_2026',
    finding_id: 'section_122_surcharge',
    agency: 'CBP',
    legal_citation: '9903.01.25; 19 U.S.C. 2132',
    official_url: 'https://www.federalregister.gov/documents/search?conditions%5Bagencies%5D%5B%5D=customs-border-protection',
    supported_proposition:
      'Temporary 10% ad valorem surcharge under 19 U.S.C. 2132 on most imported articles entering between February 24 and July 23, 2026. Excludes civil aircraft and parts (HTS chapter 88).',
    product_scope:
      'Most imported articles entered between 2026-02-24 and 2026-07-23, except civil aircraft and parts',
    scope_conditions: {
      min_import_date: '2026-02-24',
      max_import_date: '2026-07-23',
    },
    effective_date: '2026-02-24',
    expiry_date: '2026-07-23',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ── Section 301 China Additional Duty ────────────────────────────────────
  {
    rule_id: 'section_301_list3',
    finding_id: 'hts_section301',
    agency: 'USTR',
    legal_citation: '9903.88.03; 19 U.S.C. 2411',
    official_url: 'https://ustr.gov/issue-areas/enforcement/section-301-investigations/tariff-actions',
    supported_proposition:
      'Additional 25% ad valorem tariff on China-origin goods covered by USTR Section 301 List 3, effective September 24, 2018.',
    product_scope:
      'Merchandise of Chinese origin in HTS chapters covered by Section 301 List 3',
    scope_conditions: {
      origin_countries: ['china', 'prc', 'cn'],
    },
    effective_date: '2018-09-24',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ── Section 232 Steel and Aluminum Additional Duty ────────────────────────
  {
    rule_id: 'section_232_auto',
    finding_id: 'section_232_auto',
    agency: 'CBP',
    legal_citation: '19 U.S.C. 1862; HTSUS 9903.80.01',
    official_url: 'https://www.commerce.gov/issues/section-232-tariffs',
    supported_proposition:
      'Additional 25% ad valorem duty on steel articles and aluminum articles imported under the Section 232 national security tariff, applied via HTSUS special provision 9903.80.01.',
    product_scope:
      'Steel articles (HTS chapters 72–73) and aluminum articles (HTS chapter 76) subject to Section 232 national security determination',
    scope_conditions: {
      hts_chapters: [72, 73, 76],
    },
    effective_date: '2018-03-23',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CHILDREN'S MODULE
  // ═══════════════════════════════════════════════════════════════════════════

  // ── CPSIA Third-Party Testing ─────────────────────────────────────────────
  {
    rule_id: 'cpsia_third_party_testing',
    finding_id: 'cpsia_third_party_testing',
    agency: 'CPSC',
    legal_citation: '15 U.S.C. 2063; 16 CFR 1107',
    official_url: 'https://www.cpsc.gov/Business--Manufacturing/Testing-Certification/Third-Party-Testing',
    supported_proposition:
      "Children's products must be tested by a CPSC-accredited third-party laboratory before importation or sale to verify compliance with all applicable children's product safety rules.",
    product_scope: 'Products designed or intended primarily for children 12 years of age and younger',
    scope_conditions: {
      applicable_age: 'children_only',
    },
    effective_date: '2010-02-10',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ── CPSIA Children's Product Certificate (CPC) ───────────────────────────
  {
    rule_id: 'cpsia_cpc',
    finding_id: 'cpsia_cpc',
    agency: 'CPSC',
    legal_citation: '15 U.S.C. 2063(a); 16 CFR 1110',
    official_url: 'https://www.cpsc.gov/Business--Manufacturing/Testing-Certification/Childrens-Product-Certificate',
    supported_proposition:
      "Every children's product must be accompanied by a Children's Product Certificate (CPC) based on third-party test results, identifying the product, the applicable rules, and the accredited laboratory.",
    product_scope: "All children's products (for children 12 and under) imported or distributed in commerce",
    scope_conditions: {
      applicable_age: 'children_only',
    },
    effective_date: '2010-02-10',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ── CPSIA Lead Content ────────────────────────────────────────────────────
  {
    rule_id: 'cpsia_lead',
    finding_id: 'cpsia_lead',
    agency: 'CPSC',
    legal_citation: '15 U.S.C. 1278a; 16 CFR 1303',
    official_url: 'https://www.cpsc.gov/Regulations-Laws--Standards/Statutes/The-Consumer-Product-Safety-Improvement-Act',
    supported_proposition:
      "Children's products must not contain more than 100 ppm of lead in any accessible substrate material or more than 90 ppm of lead in surface coatings.",
    product_scope: 'Products designed or intended primarily for children 12 years of age and younger',
    scope_conditions: {
      applicable_age: 'children_only',
    },
    effective_date: '2011-08-14',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ── CPSC Toy Safety (16 CFR 1250 / ASTM F963) ────────────────────────────
  {
    rule_id: 'cpsc_toy_f963',
    finding_id: 'cpsc_toy_f963',
    agency: 'CPSC',
    legal_citation: '15 U.S.C. 2056b; 16 CFR 1250; ASTM F963',
    official_url: 'https://www.cpsc.gov/Regulations-Laws--Standards/CPSC-Regulations-Standards-and-Bans/Toys',
    supported_proposition:
      'Toys for children under 14 must conform to the ASTM F963 toy safety standard as mandated by 16 CFR 1250 and must be third-party tested and accompanied by a CPC.',
    product_scope: 'Toys designed or intended for children under 14 years of age (HTS chapter 95 or product keywords indicating toy use)',
    scope_conditions: {
      applicable_age: 'children_only',
    },
    effective_date: '2009-02-10',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BATTERIES MODULE
  // ═══════════════════════════════════════════════════════════════════════════

  // ── PHMSA UN 38.3 Lithium Battery Testing ────────────────────────────────
  {
    rule_id: 'phmsa_un383',
    finding_id: 'phmsa_un383',
    agency: 'PHMSA',
    legal_citation: '49 CFR 173.185',
    official_url: 'https://www.phmsa.dot.gov/sites/phmsa.dot.gov/files/docs/lithium-battery-guidance.pdf',
    supported_proposition:
      'Lithium cells and batteries (UN 3090, 3091, 3480, 3481) must meet UN 38.3 testing requirements and be accompanied by a test summary before transport as hazardous materials.',
    product_scope:
      'Products containing or shipping as lithium-ion or lithium-metal cells and batteries',
    scope_conditions: {
      battery_required: true,
      knownFacts_required: [
        { key: 'battery_type', values: ['lithium_ion', 'lithium_metal'] },
      ],
    },
    effective_date: '2003-01-01',
    legal_status: 'mandatory',
    timing: 'transport',
  },

  // ── PHMSA DOT Hazmat Class / Marking ─────────────────────────────────────
  {
    rule_id: 'phmsa_dot_class',
    finding_id: 'phmsa_dot_class',
    agency: 'PHMSA',
    legal_citation: '49 CFR 173.185',
    official_url: 'https://www.phmsa.dot.gov/lithiumbatteries',
    supported_proposition:
      'Shipments of lithium batteries must bear the correct DOT hazard class labels, UN identification number markings, and handling labels required under 49 CFR 173.185.',
    product_scope: 'Products containing or shipped as lithium cells or batteries',
    scope_conditions: {
      battery_required: true,
    },
    effective_date: '2003-01-01',
    legal_status: 'mandatory',
    timing: 'transport',
  },

  // ── PHMSA State-of-Charge for Air Transport ──────────────────────────────
  {
    rule_id: 'phmsa_soc_air',
    finding_id: 'phmsa_soc_air',
    agency: 'PHMSA',
    legal_citation: '49 CFR 173.185(b)(2)',
    official_url: 'https://www.phmsa.dot.gov/lithiumbatteries',
    supported_proposition:
      'Lithium-ion cells and batteries transported by air must be limited to a state of charge of no more than 30% of rated design capacity.',
    product_scope: 'Lithium cells and batteries transported by air (standalone or in equipment)',
    scope_conditions: {
      battery_required: true,
      transport_modes: ['air'],
    },
    effective_date: '2016-01-01',
    legal_status: 'mandatory',
    timing: 'transport',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ELECTRONICS MODULE
  // ═══════════════════════════════════════════════════════════════════════════

  // ── FCC Equipment Authorization (intentional radiators / wireless) ────────
  {
    rule_id: 'fcc_equipment_authorization',
    finding_id: 'fcc_equipment_authorization',
    agency: 'FCC',
    legal_citation: '47 CFR 2.803; 47 CFR Part 15',
    official_url: 'https://www.fcc.gov/oet/ea/rfdevice',
    supported_proposition:
      'Electronic devices with intentional radio transmitters must obtain FCC equipment authorization (Grant of Authorization) before importation or sale in the United States.',
    product_scope: 'Electronic devices that intentionally emit radio frequency energy (wireless transceivers, Bluetooth, Wi-Fi, etc.)',
    scope_conditions: {
      electronic_required: true,
      knownFacts_required: [
        { key: 'has_wireless_tx', values: ['yes'] },
      ],
    },
    effective_date: '1997-01-01',
    legal_status: 'mandatory',
    timing: 'before_sale',
  },

  // ── FCC Part 15 SDoC (unintentional radiators) ───────────────────────────
  {
    rule_id: 'fcc_part15_sdoc',
    finding_id: 'fcc_part15_sdoc',
    agency: 'FCC',
    legal_citation: '47 CFR Part 15',
    official_url: 'https://www.fcc.gov/oet/ea/rfdevice',
    supported_proposition:
      'Electronic devices that unintentionally emit radio frequency energy must comply with FCC Part 15 emission limits and may be self-declared (SDoC) before importation or sale.',
    product_scope: 'Electronic devices that unintentionally generate or emit radio frequency energy',
    scope_conditions: {
      electronic_required: true,
    },
    effective_date: '1997-01-01',
    legal_status: 'mandatory',
    timing: 'before_sale',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CHEMICALS MODULE
  // ═══════════════════════════════════════════════════════════════════════════

  // ── EPA FIFRA Pesticide Registration ─────────────────────────────────────
  {
    rule_id: 'epa_fifra',
    finding_id: 'epa_fifra',
    agency: 'EPA',
    legal_citation: '7 U.S.C. 136 et seq.; 40 CFR Part 152',
    official_url: 'https://www.epa.gov/pesticide-registration',
    supported_proposition:
      'Pesticide products imported into or distributed in the United States must be registered with EPA under FIFRA before importation or sale.',
    product_scope: 'Pesticide products — any substance intended to prevent, destroy, repel, or mitigate pests',
    scope_conditions: {
      knownFacts_required: [
        { key: 'is_pesticide', values: ['yes'] },
      ],
    },
    effective_date: '1972-10-21',
    legal_status: 'mandatory',
    timing: 'before_sale',
  },

  // ── EPA TSCA Chemical Substance Notification ──────────────────────────────
  {
    rule_id: 'epa_tsca',
    finding_id: 'epa_tsca',
    agency: 'EPA',
    legal_citation: '15 U.S.C. 2604-2607; 40 CFR Part 720',
    official_url: 'https://www.epa.gov/tsca-inventory',
    supported_proposition:
      'Chemical substances not on the TSCA Inventory require pre-manufacture notice (PMN) or exemption before importation; importer certifies compliance with TSCA at entry.',
    product_scope: 'Chemical substances imported into the United States (articles are excluded unless they release a chemical substance)',
    scope_conditions: {
      knownFacts_required: [
        { key: 'is_chemical_substance', values: ['yes'] },
      ],
    },
    effective_date: '1977-01-01',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ── DOT Hazmat Chemical Transport ────────────────────────────────────────
  {
    rule_id: 'dot_hazmat_chemical',
    finding_id: 'dot_hazmat_chemical',
    agency: 'PHMSA',
    legal_citation: '49 U.S.C. 5101-5128; 49 CFR Parts 171-180',
    official_url: 'https://www.phmsa.dot.gov/regulations',
    supported_proposition:
      'Hazardous materials must be properly classified, packaged, labeled, marked, and documented in accordance with DOT Hazardous Materials Regulations before transport.',
    product_scope: 'Hazardous materials as defined in 49 CFR 171.8 — flammable liquids, corrosives, oxidizers, toxics, and other regulated chemicals',
    scope_conditions: {
      knownFacts_required: [
        { key: 'contains_hazmat', values: ['yes'] },
      ],
    },
    effective_date: '1975-01-01',
    legal_status: 'mandatory',
    timing: 'transport',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COSMETICS MODULE
  // ═══════════════════════════════════════════════════════════════════════════

  // ── FDA Cosmetic Facility Registration (MoCRA) ────────────────────────────
  {
    rule_id: 'fda_cosmetic_mocra',
    finding_id: 'fda_cosmetic_mocra',
    agency: 'FDA',
    legal_citation: '21 U.S.C. 364b; 21 CFR Part 710 (as amended by MoCRA)',
    official_url: 'https://www.fda.gov/cosmetics/cosmetics-laws-regulations/modernization-cosmetics-regulation-act-2022',
    supported_proposition:
      'Cosmetic product facilities must register with FDA and cosmetic product listings must be submitted under the Modernization of Cosmetics Regulation Act of 2022 (MoCRA) before importation.',
    product_scope: 'Cosmetic products as defined in 21 U.S.C. 321(i)',
    scope_conditions: {
      attrs_required: {
        is_cosmetic: true,
      },
    },
    effective_date: '2023-12-29',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ── FDA Cosmetic Labeling ─────────────────────────────────────────────────
  {
    rule_id: 'fda_cosmetic_labeling',
    finding_id: 'fda_cosmetic_labeling',
    agency: 'FDA',
    legal_citation: '21 U.S.C. 362; 21 CFR Part 701',
    official_url: 'https://www.fda.gov/cosmetics/cosmetics-labeling',
    supported_proposition:
      'Cosmetic products must bear labels with the name and place of business, net contents, ingredient declaration in descending order of predominance, and any required warnings.',
    product_scope: 'Cosmetic products as defined in 21 U.S.C. 321(i)',
    scope_conditions: {
      attrs_required: {
        is_cosmetic: true,
      },
    },
    effective_date: '1975-01-01',
    legal_status: 'mandatory',
    timing: 'before_sale',
  },

  // ── FDA OTC Drug (cosmetics with OTC drug ingredients) ───────────────────
  {
    rule_id: 'fda_otc_drug',
    finding_id: 'fda_otc_drug',
    agency: 'FDA',
    legal_citation: '21 U.S.C. 355; 21 CFR Parts 330-358',
    official_url: 'https://www.fda.gov/drugs/drug-approvals-and-databases/otc-drug-monograph-process',
    supported_proposition:
      'Cosmetic products that also meet the definition of an OTC drug (e.g., sunscreens, acne treatments, anti-dandruff shampoos) must comply with applicable OTC drug monographs and labeling requirements.',
    product_scope: 'Cosmetic products containing active OTC drug ingredients (sunscreen, acne, anti-dandruff)',
    scope_conditions: {
      attrs_required: {
        is_cosmetic: true,
      },
      knownFacts_required: [
        { key: 'contains_otc_ingredient', values: ['yes_sunscreen', 'yes_acne', 'yes_antidandruff'] },
      ],
    },
    effective_date: '1972-01-01',
    legal_status: 'mandatory',
    timing: 'before_sale',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FOOD MODULE
  // ═══════════════════════════════════════════════════════════════════════════

  // ── FDA Prior Notice ──────────────────────────────────────────────────────
  {
    rule_id: 'fda_prior_notice',
    finding_id: 'fda_prior_notice',
    agency: 'FDA',
    legal_citation: '21 U.S.C. 381(m); 21 CFR Part 1 Subpart I',
    official_url: 'https://www.fda.gov/food/importing-food/prior-notice-imported-food-shipments',
    supported_proposition:
      'All food imported or offered for import into the United States must have prior notice submitted to FDA before arrival at the U.S. port of entry.',
    product_scope: 'Food articles as defined in 21 U.S.C. 321(f), including dietary supplements and food contact substances',
    scope_conditions: {
      attrs_required: {
        is_food_contact: true,
      },
    },
    effective_date: '2003-12-12',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ── FSIS Meat and Poultry Inspection ──────────────────────────────────────
  {
    rule_id: 'fda_fsis_inspection',
    finding_id: 'fda_fsis_inspection',
    agency: 'FSIS',
    legal_citation: '21 U.S.C. 601 et seq.; 9 CFR Parts 327, 381',
    official_url: 'https://www.fsis.usda.gov/inspection/import-export/importing-meat-poultry-egg-products',
    supported_proposition:
      'Imported meat, poultry, and egg products must originate from eligible countries and establishments, and must be presented to FSIS inspectors at FSIS-approved import inspection facilities.',
    product_scope: 'Meat products, poultry products, and egg products imported into the United States',
    scope_conditions: {
      knownFacts_required: [
        { key: 'is_meat_or_poultry', values: ['yes_meat', 'yes_poultry', 'yes_egg'] },
      ],
    },
    effective_date: '1968-01-01',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ── FDA Food Labeling ─────────────────────────────────────────────────────
  {
    rule_id: 'fda_food_labeling',
    finding_id: 'fda_food_labeling',
    agency: 'FDA',
    legal_citation: '21 U.S.C. 343; 21 CFR Parts 101-104',
    official_url: 'https://www.fda.gov/food/food-labeling-nutrition',
    supported_proposition:
      'Food and dietary supplements must bear labels including statement of identity, net quantity, nutrition facts, ingredient list, and allergen declarations in English.',
    product_scope: 'Food products and dietary supplements sold in the United States',
    scope_conditions: {
      attrs_required: {
        is_food_contact: true,
      },
    },
    effective_date: '1994-01-01',
    legal_status: 'mandatory',
    timing: 'before_sale',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDICAL DEVICES MODULE
  // ═══════════════════════════════════════════════════════════════════════════

  // ── FDA Medical Device Establishment Registration ─────────────────────────
  {
    rule_id: 'fda_device_registration',
    finding_id: 'fda_device_registration',
    agency: 'FDA',
    legal_citation: '21 U.S.C. 360; 21 CFR Part 807',
    official_url: 'https://www.fda.gov/medical-devices/how-study-and-market-your-device/device-registration-and-listing',
    supported_proposition:
      'Foreign establishments that manufacture medical devices exported to the United States must register with FDA annually and list their devices before importation.',
    product_scope: 'Medical devices as defined in 21 U.S.C. 321(h)',
    scope_conditions: {},
    effective_date: '1976-05-28',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ── FDA Premarket Notification / Approval (510(k) / PMA) ─────────────────
  {
    rule_id: 'fda_device_premarket',
    finding_id: 'fda_device_premarket',
    agency: 'FDA',
    legal_citation: '21 U.S.C. 360c, 360e; 21 CFR Part 807 Subpart E; 21 CFR Part 814',
    official_url: 'https://www.fda.gov/medical-devices/premarket-submissions-selecting-and-preparing-correct-submission/premarket-notification-510k',
    supported_proposition:
      'Class II medical devices require a cleared 510(k) premarket notification and Class III devices require an approved Premarket Approval (PMA) before importation or commercial distribution.',
    product_scope: 'Class II and Class III medical devices as classified under 21 CFR Parts 862–892',
    scope_conditions: {},
    effective_date: '1976-05-28',
    legal_status: 'mandatory',
    timing: 'before_sale',
  },

  // ── FDA Quality System Regulation / QMSR ─────────────────────────────────
  {
    rule_id: 'fda_device_qsr',
    finding_id: 'fda_device_qsr',
    agency: 'FDA',
    legal_citation: '21 U.S.C. 360j(f); 21 CFR Part 820',
    official_url: 'https://www.fda.gov/medical-devices/postmarket-requirements-devices/quality-system-qs-regulationmedical-device-good-manufacturing-practices',
    supported_proposition:
      'Medical device manufacturers must establish and maintain a quality management system that meets FDA Quality System Regulation (QSR) requirements, including design controls, production controls, and complaint handling.',
    product_scope: 'Medical devices as defined in 21 U.S.C. 321(h) — applicable to manufacturers',
    scope_conditions: {},
    effective_date: '1997-06-01',
    legal_status: 'mandatory',
    timing: 'available_on_request',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTOMOTIVE MODULE
  // ═══════════════════════════════════════════════════════════════════════════

  // ── NHTSA FMVSS (general) ─────────────────────────────────────────────────
  {
    rule_id: 'nhtsa_fmvss',
    finding_id: 'nhtsa_fmvss',
    agency: 'NHTSA',
    legal_citation: '49 U.S.C. 30112; 49 CFR Part 571',
    official_url: 'https://www.nhtsa.gov/vehicle-manufacturers/fmvss',
    supported_proposition:
      'Motor vehicles and motor vehicle equipment imported into the United States must conform to applicable Federal Motor Vehicle Safety Standards (FMVSS) and bear a certification label.',
    product_scope: 'Motor vehicles and motor vehicle equipment in HTS chapter 87',
    scope_conditions: {
      hts_chapters: [87],
    },
    effective_date: '1968-01-01',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ── NHTSA FMVSS 135 — Passenger Car Brake Systems ────────────────────────
  {
    rule_id: 'nhtsa_fmvss_135',
    finding_id: 'nhtsa_fmvss_135',
    agency: 'NHTSA',
    legal_citation: '49 CFR 571.135',
    official_url: 'https://www.ecfr.gov/current/title-49/subtitle-B/chapter-V/part-571/subpart-B/section-571.135',
    supported_proposition:
      'Passenger cars must meet FMVSS 135 hydraulic and electric brake system performance requirements, and brake parts must meet applicable standards.',
    product_scope: 'Passenger car brake systems and components (HTS heading 8708.30)',
    scope_conditions: {
      hts_headings: ['8708.30'],
    },
    effective_date: '1999-09-01',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ── NHTSA FMVSS 121 — Air Brake Systems ──────────────────────────────────
  {
    rule_id: 'nhtsa_fmvss_121',
    finding_id: 'nhtsa_fmvss_121',
    agency: 'NHTSA',
    legal_citation: '49 CFR 571.121',
    official_url: 'https://www.ecfr.gov/current/title-49/subtitle-B/chapter-V/part-571/subpart-B/section-571.121',
    supported_proposition:
      'Trucks, buses, and trailers with air brake systems must meet FMVSS 121 performance requirements for stopping distance, brake force, and antilock brake system operation.',
    product_scope: 'Heavy commercial vehicles (trucks, buses, trailers) equipped with air brake systems',
    scope_conditions: {
      hts_chapters: [87],
    },
    effective_date: '1975-03-01',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ── NHTSA FMVSS 126 — Electronic Stability Control ───────────────────────
  {
    rule_id: 'nhtsa_fmvss_126',
    finding_id: 'nhtsa_fmvss_126',
    agency: 'NHTSA',
    legal_citation: '49 CFR 571.126',
    official_url: 'https://www.ecfr.gov/current/title-49/subtitle-B/chapter-V/part-571/subpart-B/section-571.126',
    supported_proposition:
      'Passenger cars, multipurpose passenger vehicles, trucks, and buses with a GVWR of 10,000 lb or less must be equipped with an electronic stability control system meeting FMVSS 126 requirements.',
    product_scope: 'Light vehicles (GVWR ≤ 10,000 lb) — passenger cars, MPVs, light trucks, and buses',
    scope_conditions: {
      hts_chapters: [87],
    },
    effective_date: '2012-09-01',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ── EPA Motor Vehicle Pollution Control ───────────────────────────────────
  {
    rule_id: 'epa_mvpc',
    finding_id: 'epa_mvpc',
    agency: 'EPA',
    legal_citation: '42 U.S.C. 7521-7554; 40 CFR Part 86',
    official_url: 'https://www.epa.gov/vehicle-and-fuel-emissions-testing/light-duty-vehicle-and-truck-certification',
    supported_proposition:
      'Motor vehicles imported into the United States must comply with EPA emission standards and must have an EPA Certificate of Conformity (COC) or equivalent authorization before importation.',
    product_scope: 'Motor vehicles (light-duty and heavy-duty) imported into the United States',
    scope_conditions: {
      hts_chapters: [87],
    },
    effective_date: '1968-01-01',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FURNITURE MODULE
  // ═══════════════════════════════════════════════════════════════════════════

  // ── EPA TSCA Title VI — Formaldehyde in Composite Wood ───────────────────
  {
    rule_id: 'epa_tsca_title_vi',
    finding_id: 'epa_tsca_title_vi',
    agency: 'EPA',
    legal_citation: '15 U.S.C. 2697; 40 CFR Part 770',
    official_url: 'https://www.epa.gov/formaldehyde/formaldehyde-emission-standards-composite-wood-products',
    supported_proposition:
      'Composite wood products and finished goods containing composite wood must meet EPA TSCA Title VI formaldehyde emission standards (CARB Phase 2 equivalent) and be labeled or accompanied by third-party certification.',
    product_scope: 'Products containing hardwood plywood, medium-density fiberboard, or particleboard',
    scope_conditions: {
      knownFacts_required: [
        { key: 'contains_composite_wood', values: ['yes'] },
      ],
    },
    effective_date: '2019-03-22',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ── CPSC General Safety Reporting Obligation ──────────────────────────────
  {
    rule_id: 'cpsc_general_safety',
    finding_id: 'cpsc_general_safety',
    agency: 'CPSC',
    legal_citation: '15 U.S.C. 2064',
    official_url: 'https://www.cpsc.gov/Business--Manufacturing/Recall-Guidance/SaferProducts',
    supported_proposition:
      'Manufacturers, importers, distributors, and retailers must report to CPSC immediately upon learning that a consumer product contains a defect that could create a substantial product hazard or creates an unreasonable risk of serious injury or death.',
    product_scope: 'Consumer products subject to CPSC jurisdiction',
    scope_conditions: {},
    effective_date: '1972-10-27',
    legal_status: 'mandatory',
    timing: 'post_market',
  },

  // ── California Prop 65 ────────────────────────────────────────────────────
  {
    rule_id: 'ca_prop65',
    finding_id: 'ca_prop65',
    agency: 'California OEHHA',
    legal_citation: 'Cal. Health & Safety Code § 25249.5 et seq. (Safe Drinking Water and Toxic Enforcement Act of 1986)',
    official_url: 'https://oehha.ca.gov/proposition-65',
    supported_proposition:
      'Businesses selling products in California must provide clear and reasonable warnings before exposing consumers to listed carcinogens or reproductive toxicants; no federal equivalent.',
    product_scope: 'Consumer products containing Prop 65-listed chemicals sold in California',
    scope_conditions: {},
    effective_date: '1988-02-27',
    legal_status: 'informational',
    timing: 'before_sale',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SPORTS MODULE
  // ═══════════════════════════════════════════════════════════════════════════

  // ── CPSC Bicycle Safety (16 CFR 1512) ────────────────────────────────────
  {
    rule_id: 'sports_bicycle_cpsc_1512',
    finding_id: 'sports_bicycle_cpsc_1512',
    agency: 'CPSC',
    legal_citation: '16 CFR Part 1512',
    official_url: 'https://www.ecfr.gov/current/title-16/chapter-II/subchapter-D/part-1512',
    supported_proposition:
      'Bicycles must meet CPSC requirements under 16 CFR 1512 covering brakes, reflectors, lighting systems, protrusion hazards, and structural integrity before importation or sale.',
    product_scope: 'Bicycles (HTS 8712) and similar human-powered cycles',
    scope_conditions: {
      hts_chapters: [87],
      keywords_any_of: ['bicycle', 'bike', 'cycle', 'cycling'],
    },
    effective_date: '1978-01-01',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ── CPSC Bicycle Helmet (16 CFR 1203) ────────────────────────────────────
  {
    rule_id: 'sports_bicycle_helmet_cpsc_1203',
    finding_id: 'sports_bicycle_helmet_cpsc_1203',
    agency: 'CPSC',
    legal_citation: '16 CFR Part 1203',
    official_url: 'https://www.ecfr.gov/current/title-16/chapter-II/subchapter-D/part-1203',
    supported_proposition:
      'Bicycle helmets must meet the CPSC bicycle helmet safety standard under 16 CFR 1203, including impact attenuation, retention system, and labeling requirements.',
    product_scope: 'Helmets intended for use while riding a bicycle',
    scope_conditions: {
      keywords_any_of: ['bicycle helmet', 'bike helmet', 'cycling helmet'],
    },
    effective_date: '1999-03-17',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },

  // ── USCG Personal Flotation Devices (46 CFR 160) ─────────────────────────
  {
    rule_id: 'sports_pfd_uscg_46cfr160',
    finding_id: 'sports_pfd_uscg_46cfr160',
    agency: 'USCG',
    legal_citation: '46 CFR Part 160',
    official_url: 'https://www.ecfr.gov/current/title-46/chapter-I/subchapter-Q/part-160',
    supported_proposition:
      'Personal flotation devices (life jackets) must be approved by the U.S. Coast Guard under 46 CFR Part 160 and bear USCG approval markings before sale for recreational use.',
    product_scope: 'Personal flotation devices (PFDs / life jackets) for recreational and commercial marine use',
    scope_conditions: {
      keywords_any_of: ['life jacket', 'life vest', 'pfd', 'personal flotation', 'flotation device'],
    },
    effective_date: '1979-01-01',
    legal_status: 'mandatory',
    timing: 'before_sale',
  },

  // ── USCG Type V Inflatable PFD ────────────────────────────────────────────
  {
    rule_id: 'sports_inflatable_pfd_type5',
    finding_id: 'sports_inflatable_pfd_type5',
    agency: 'USCG',
    legal_citation: '46 CFR Part 160',
    official_url: 'https://www.ecfr.gov/current/title-46/chapter-I/subchapter-Q/part-160',
    supported_proposition:
      'Type V inflatable PFDs must have USCG approval under 46 CFR 160.076 and bear labeling specifying conditions of use; must be worn to count as required safety equipment.',
    product_scope: 'Type V inflatable personal flotation devices',
    scope_conditions: {
      keywords_any_of: ['inflatable pfd', 'inflatable life jacket', 'type v pfd', 'type 5 pfd'],
    },
    effective_date: '1995-01-01',
    legal_status: 'mandatory',
    timing: 'before_sale',
  },

  // ── OSHA Personal Fall Arrest Systems (29 CFR 1910.140) ──────────────────
  {
    rule_id: 'sports_fall_arrest_osha_1910_140',
    finding_id: 'sports_fall_arrest_osha_1910_140',
    agency: 'OSHA',
    legal_citation: '29 CFR 1910.140',
    official_url: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.140',
    supported_proposition:
      'Personal fall protection systems used in occupational settings must meet OSHA design, performance, and use requirements under 29 CFR 1910.140, including body harnesses, lanyards, and anchorage connectors.',
    product_scope: 'Personal fall arrest, restraint, and positioning systems for occupational use',
    scope_conditions: {
      keywords_any_of: ['fall arrest', 'fall protection', 'harness', 'lanyard', 'anchorage connector'],
    },
    effective_date: '2017-01-17',
    legal_status: 'mandatory',
    timing: 'before_sale',
  },

  // ── ASTM F2040 Voluntary Ski Helmet Standard ──────────────────────────────
  {
    rule_id: 'sports_ski_helmet_astm_f2040',
    finding_id: 'sports_ski_helmet_astm_f2040',
    agency: 'ASTM International',
    legal_citation: 'ASTM F2040',
    official_url: 'https://www.astm.org/f2040-18.html',
    supported_proposition:
      'Voluntary performance standard for helmets used in recreational alpine skiing and snowboarding. No mandatory federal requirement exists; compliance is voluntary.',
    product_scope: 'Helmets designed for recreational alpine skiing and snowboarding',
    scope_conditions: {
      keywords_any_of: ['ski helmet', 'ski', 'alpine helmet', 'snowboard helmet', 'snowboarding'],
    },
    effective_date: '2018-01-01',
    legal_status: 'voluntary',
    timing: 'before_sale',
  },

  // ── UIAA / EN Voluntary Climbing Equipment Standard ──────────────────────
  {
    rule_id: 'sports_climbing_uiaa_en_voluntary',
    finding_id: 'sports_climbing_uiaa_en_voluntary',
    agency: 'UIAA / CEN',
    legal_citation: 'UIAA 100-152; EN 892, EN 12275, EN 12276, EN 958',
    official_url: 'https://www.theuiaa.org/safety/safety-standards/',
    supported_proposition:
      'Climbing equipment such as ropes, harnesses, carabiners, and helmets may voluntarily comply with UIAA and EN standards; no mandatory U.S. federal standard exists for recreational climbing equipment.',
    product_scope: 'Technical climbing and mountaineering equipment — ropes, harnesses, carabiners, belay devices',
    scope_conditions: {
      keywords_any_of: ['climbing rope', 'climbing harness', 'carabiner', 'belay', 'rappel', 'climbing equipment'],
    },
    effective_date: '1995-01-01',
    legal_status: 'voluntary',
    timing: 'before_sale',
  },

  // ── ASTM F1749 Voluntary Fitness Machine Standard ─────────────────────────
  {
    rule_id: 'sports_fitness_machine_astm',
    finding_id: 'sports_fitness_machine_astm',
    agency: 'ASTM International',
    legal_citation: 'ASTM F1749; ASTM F2276',
    official_url: 'https://www.astm.org/f1749-15.html',
    supported_proposition:
      'Voluntary safety and performance standards for fitness equipment (treadmills, ellipticals, stationary cycles, strength equipment); no mandatory U.S. federal standard exists.',
    product_scope: 'Fitness and exercise equipment for home and commercial use',
    scope_conditions: {
      keywords_any_of: ['treadmill', 'elliptical', 'stationary bike', 'fitness equipment', 'exercise machine', 'gym equipment'],
    },
    effective_date: '1996-01-01',
    legal_status: 'voluntary',
    timing: 'before_sale',
  },

  // ── ASTM F381 Voluntary Trampoline Standard ───────────────────────────────
  {
    rule_id: 'sports_trampoline_astm_f381',
    finding_id: 'sports_trampoline_astm_f381',
    agency: 'ASTM International',
    legal_citation: 'ASTM F381',
    official_url: 'https://www.astm.org/f0381-16.html',
    supported_proposition:
      'Voluntary performance and labeling standard for trampolines; no mandatory U.S. federal safety standard exists for consumer trampolines.',
    product_scope: 'Trampolines for consumer use',
    scope_conditions: {
      keywords_any_of: ['trampoline'],
    },
    effective_date: '1992-01-01',
    legal_status: 'voluntary',
    timing: 'before_sale',
  },

  // ── No Federal Standard — Combat / Protective Sports Equipment ────────────
  {
    rule_id: 'sports_combat_protective_no_federal',
    finding_id: 'sports_combat_protective_no_federal',
    agency: 'N/A',
    legal_citation: 'No applicable federal standard',
    official_url: 'https://www.cpsc.gov/Business--Manufacturing/Business-Education/Business-Guidance/Sports-Recreational-and-Exercise-Equipment',
    supported_proposition:
      'No mandatory U.S. federal standard currently applies to combat sports protective equipment (boxing gloves, shin guards, mouth guards, headgear); CPSC general safety requirements apply.',
    product_scope: 'Combat sports protective equipment — boxing, MMA, martial arts protective gear',
    scope_conditions: {
      keywords_any_of: ['boxing glove', 'shin guard', 'mma', 'martial arts', 'combat sports', 'sparring'],
    },
    effective_date: '1972-10-27',
    legal_status: 'informational',
    timing: 'before_sale',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TEXTILES MODULE
  // ═══════════════════════════════════════════════════════════════════════════

  // ── FTC Textile Fiber Products Identification Act (16 CFR 303) ───────────
  {
    rule_id: 'ftc_textile_fiber_identification',
    finding_id: 'ftc_textile_labeling',
    agency: 'FTC',
    legal_citation: '15 U.S.C. 70; 16 CFR Part 303',
    official_url: 'https://www.ftc.gov/tips-advice/business-center/guidance/threading-your-way-through-labeling-requirements-under-textile',
    supported_proposition:
      'Textile fiber products sold in commerce must bear labels disclosing fiber content by percentage, country of origin, and manufacturer or dealer identity.',
    product_scope: 'Textile fiber products in HTS chapters 50–63',
    scope_conditions: {
      hts_chapters: [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63],
    },
    effective_date: '1960-03-03',
    legal_status: 'mandatory',
    timing: 'before_sale',
  },

  // ── FTC Care Labeling Rule (16 CFR 423) ──────────────────────────────────
  {
    rule_id: 'ftc_care_labeling',
    finding_id: 'ftc_care_labeling',
    agency: 'FTC',
    legal_citation: '16 CFR Part 423',
    official_url: 'https://www.ftc.gov/legal-library/browse/rules/care-labeling-rule',
    supported_proposition:
      'Wearing apparel must have permanently attached care labels with regular-care instructions. Excluded: hats, gloves, mittens, belts, suspenders, neckties, scarves, handkerchiefs, and footwear.',
    product_scope: 'Wearing apparel in HTS chapters 61–62, excluding gloves, hats, scarves, belts, and footwear',
    scope_conditions: {
      hts_chapters: [61, 62],
      keywords_excluded: ['glove', 'mitten', 'hat', 'scarf', 'necktie', 'belt', 'handkerchief', 'sock', 'shoe', 'footwear', 'headwear', 'boxing'],
    },
    effective_date: '1972-01-01',
    legal_status: 'mandatory',
    timing: 'before_sale',
  },

  // ── FTC Wool Products Labeling Act (16 CFR 300) ───────────────────────────
  {
    rule_id: 'ftc_wool_labeling',
    finding_id: 'ftc_wool_labeling',
    agency: 'FTC',
    legal_citation: '15 U.S.C. 68; 16 CFR Part 300',
    official_url: 'https://www.ftc.gov/legal-library/browse/rules/wool-products-labeling-rule',
    supported_proposition:
      'Wool products sold in commerce must be labeled with the percentage of each fiber present, country of origin, and the manufacturer or dealer identity in accordance with the Wool Products Labeling Act.',
    product_scope: 'Products containing wool, recycled wool, or specialty animal fiber',
    scope_conditions: {
      keywords_any_of: ['wool', 'cashmere', 'alpaca', 'mohair', 'angora', 'llama', 'vicuna', 'camel hair'],
    },
    effective_date: '1941-01-01',
    legal_status: 'mandatory',
    timing: 'before_sale',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST SCENARIO / ADDITIONAL ENTRIES
  // ═══════════════════════════════════════════════════════════════════════════

  // ── CPSC Children's Sleepwear Flammability (16 CFR 1615) ─────────────────
  {
    rule_id: 'cpsc_sleepwear_flammability',
    finding_id: 'cpsc_sleepwear_1615',
    agency: 'CPSC',
    legal_citation: '16 CFR Part 1615',
    official_url: 'https://www.ecfr.gov/current/title-16/chapter-II/subchapter-D/part-1615',
    supported_proposition:
      "Children's sleepwear in sizes 0–6X must meet flammability requirements under 16 CFR 1615 and bear a permanent label stating compliance with the standard.",
    product_scope: "Children's sleepwear — pajamas, nightgowns, robes, and similar nightwear in sizes 0–6X",
    scope_conditions: {
      applicable_age: 'children_only',
      keywords_any_of: ['sleepwear', 'pajama', 'nightgown', 'nightwear', 'pyjama'],
    },
    effective_date: '1972-01-01',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  },
];

// ── Registry index ────────────────────────────────────────────────────────────

/**
 * Build a lookup map from finding_id → OfficialRuleRecord.
 * Exported so the verifier (and tests) can inject a custom registry.
 */
export function buildFindingIndex(
  rules: OfficialRuleRecord[],
): Map<string, OfficialRuleRecord> {
  const index = new Map<string, OfficialRuleRecord>();
  for (const rule of rules) {
    if (rule.finding_id) {
      index.set(rule.finding_id, rule);
    }
  }
  return index;
}

/** Pre-built index from the default production registry. */
export const DEFAULT_FINDING_INDEX: Map<string, OfficialRuleRecord> =
  buildFindingIndex(OFFICIAL_RULE_REGISTRY);
