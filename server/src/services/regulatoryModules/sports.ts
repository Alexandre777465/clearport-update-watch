/**
 * Sports & Outdoor Equipment regulatory module.
 *
 * Covers 16 product subcategories across bicycle, water, climbing, fitness,
 * snow sports, combat sports, and general protective equipment.
 *
 * Regulatory routing:
 *   MANDATORY (verified_applicable):
 *     - Bicycles:            16 CFR Part 1512 (CPSC)
 *     - Bicycle helmets:     16 CFR Part 1203 (CPSC)
 *     - PFDs / life jackets: 46 CFR Part 160 (USCG)
 *     - Occupational fall arrest: OSHA 29 CFR 1910.140
 *
 *   VOLUNTARY (official_unconfirmed — clearly NOT presented as mandatory):
 *     - Ski/snowboard helmets:       ASTM F2040
 *     - Recreational climbing:       UIAA 105 / EN 12277 / EN 892 / EN 12275
 *     - Fitness / gym equipment:     ASTM F2115, ASTM F3021
 *     - Trampolines:                 ASTM F381
 *     - Adult combat / protective:   no mandatory federal standard
 *
 *   CROSS-MODULE:
 *     - Children's sports (≤12): CPSIA third-party testing (handled by childrens module)
 *     - Electronics (GPS, e-bike): FCC Part 15 (handled by electronics module)
 *     - Batteries (e-bike, GPS):  UN 38.3 / DOT (handled by batteries module)
 *
 * Activation safeguards enforced in factEngine TEXT_RULES:
 *   "active", "fitness", "athletic", "outdoor", "professional" alone do NOT
 *   activate this module. Only specific equipment names or structured answers trigger it.
 *
 * Last rule-set verified: 2025-08-01.
 */

import type { RiskCategory, CoverageItem } from '../../types';
import type { RegulatoryModule, ModuleInput, ModuleResult, DocSpec, DynamicQuestion } from './index';

// ── Module ────────────────────────────────────────────────────────────────────

export const sportsModule: RegulatoryModule = {
  id: 'sports',

  name: 'Sports & Outdoor Equipment',

  detects(_input) {
    // Detection is driven entirely by the factEngine via evaluateAllModules.
    return false;
  },

  evaluate(input: ModuleInput): ModuleResult {
    const { knownFacts } = input;

    const findings: RiskCategory[] = [];
    const coverageDomains: CoverageItem[] = [];
    const docSpecs: DocSpec[] = [];
    const questions: DynamicQuestion[] = [];

    // ── Dynamic questions ─────────────────────────────────────────────────────

    questions.push({
      key: 'sports_product_type',
      module: 'sports',
      question: 'What type of sports or outdoor equipment is this?',
      helpText: 'Determines which mandatory safety standards apply.',
      options: [
        { value: 'bicycle',               label: 'Bicycle (includes e-bike)' },
        { value: 'kayak_canoe',           label: 'Kayak, canoe, or paddleboard' },
        { value: 'surfboard_paddleboard', label: 'Surfboard or stand-up paddleboard' },
        { value: 'climbing_equipment',    label: 'Climbing / fall-arrest equipment' },
        { value: 'pfd_life_jacket',       label: 'Life jacket / PFD / buoyancy aid' },
        { value: 'fitness_machine',       label: 'Fitness machine (treadmill, elliptical, rower)' },
        { value: 'free_weights',          label: 'Free weights / dumbbells / barbells' },
        { value: 'combat_sports',         label: 'Combat sports / martial arts equipment' },
        { value: 'snow_sports',           label: 'Snow sports (skis, snowboard, poles)' },
        { value: 'water_sports',          label: 'Water sports (wetsuit, fins, water ski)' },
        { value: 'ball_racket_sports',    label: 'Ball or racket sports' },
        { value: 'trampoline',            label: 'Trampoline or gymnastics equipment' },
        { value: 'protective_gear',       label: 'Protective gear (shin guards, knee/elbow pads)' },
        { value: 'scuba_snorkel',         label: 'SCUBA or snorkeling equipment' },
        { value: 'other_sports',          label: 'Other sports or recreational equipment' },
        { value: 'not_sports',            label: 'Not sports equipment — misclassified' },
        { value: 'unknown',               label: "I don't know" },
      ],
    });

    // ── Derived facts ─────────────────────────────────────────────────────────

    const sportType      = knownFacts['sports_product_type'];
    const helmetType     = knownFacts['sports_helmet_type'];
    const pfdType        = knownFacts['pfd_type'];
    const climbType      = knownFacts['climbing_equipment_type'];
    const isOccupational = knownFacts['is_occupational'] === 'yes_occupational';

    const isBicycle   = sportType === 'bicycle';
    const isPfd       = sportType === 'pfd_life_jacket' || sportType === 'kayak_canoe';
    const isClimbing  = sportType === 'climbing_equipment';
    const isFitness   = sportType === 'fitness_machine' || sportType === 'free_weights';
    const isTrampoline = sportType === 'trampoline';
    const isCombat    = sportType === 'combat_sports' || sportType === 'protective_gear';
    const isSnow      = sportType === 'snow_sports';
    const isNotSports = sportType === 'not_sports';

    const hasBicycleHelmet = helmetType === 'bicycle_helmet';
    const hasSkiHelmet     = helmetType === 'ski_snowboard_helmet';
    const isInflatablePfd  = pfdType === 'type_5';

    if (isNotSports) {
      return { findings: [], coverageDomains: [], docSpecs: [], questions };
    }

    // ── 1. BICYCLES — 16 CFR Part 1512 (MANDATORY) ────────────────────────────

    if (isBicycle) {
      findings.push({
        id: 'sports_bicycle_cpsc_1512',
        category: 'CPSC — Bicycle Safety Standard (16 CFR Part 1512)',
        level: 'High',
        explanation:
          'Bicycles intended for use by persons under age 16 must comply with 16 CFR Part 1512 (CPSC). ' +
          'This mandatory federal standard covers brakes, reflectors, sharp edges, protrusions, ' +
          'handlebar requirements, and structural integrity. ' +
          'Importers must issue a General Certificate of Conformity (GCC) based on third-party testing ' +
          'by a CPSC-accepted laboratory.',
        action:
          'Obtain a third-party test report from a CPSC-accepted laboratory confirming 16 CFR Part 1512 compliance. ' +
          'Issue a General Certificate of Conformity (GCC). File with CBP and retain records for five years.',
        verification_status: 'verified_applicable',
        source: {
          name: '16 CFR Part 1512',
          title: '16 CFR Part 1512 — Requirements for Bicycles',
          agency: 'CPSC',
          url: 'https://www.ecfr.gov/current/title-16/chapter-II/subchapter-B/part-1512',
          last_verified_at: '2025-08-01',
          why_relevant: 'Mandatory federal standard for bicycle safety; applies to all bicycles for persons under 16.',
        },
      });

      questions.push({
        key: 'sports_helmet_type',
        module: 'sports',
        question: 'Does the product include a bicycle helmet?',
        helpText: 'Bicycle helmets require separate CPSC 16 CFR Part 1203 certification.',
        options: [
          { value: 'bicycle_helmet', label: 'Yes — bicycle helmet included' },
          { value: 'no_helmet',      label: 'No — helmet not included' },
          { value: 'unknown',        label: "I don't know" },
        ],
      });

      docSpecs.push({
        document: 'Third-Party Test Report (16 CFR Part 1512) + General Certificate of Conformity',
        owner: 'supplier',
        responsible_party: 'laboratory',
        reason: 'Mandatory CPSC bicycle safety standard requires testing by a CPSC-accepted lab and a GCC.',
        doc_status: 'required_to_clear',
        finding_id: 'sports_bicycle_cpsc_1512',
      });
    }

    // ── 2. BICYCLE HELMETS — 16 CFR Part 1203 (MANDATORY) ────────────────────

    if (hasBicycleHelmet) {
      findings.push({
        id: 'sports_bicycle_helmet_cpsc_1203',
        category: 'CPSC — Bicycle Helmet Standard (16 CFR Part 1203)',
        level: 'High',
        explanation:
          '16 CFR Part 1203 is a mandatory federal standard for bicycle helmets. ' +
          'It requires impact attenuation testing, penetration resistance, retention system performance, ' +
          'and peripheral vision requirements. Testing must be performed by a CPSC-accepted laboratory. ' +
          'The importer must issue a General Certificate of Conformity (GCC).',
        action:
          'Obtain a third-party test report from a CPSC-accepted laboratory confirming 16 CFR Part 1203 compliance. ' +
          'Prepare a General Certificate of Conformity. Retain records for five years.',
        verification_status: 'verified_applicable',
        source: {
          name: '16 CFR Part 1203',
          title: '16 CFR Part 1203 — Safety Standard for Bicycle Helmets',
          agency: 'CPSC',
          url: 'https://www.ecfr.gov/current/title-16/chapter-II/subchapter-B/part-1203',
          last_verified_at: '2025-08-01',
          why_relevant: 'Mandatory federal standard for bicycle helmets sold in the United States.',
        },
      });

      docSpecs.push({
        document: 'Third-Party Test Report (16 CFR Part 1203) + General Certificate of Conformity',
        owner: 'supplier',
        responsible_party: 'laboratory',
        reason: 'Mandatory CPSC bicycle helmet standard requires CPSC-accepted lab testing and a GCC.',
        doc_status: 'required_to_clear',
        finding_id: 'sports_bicycle_helmet_cpsc_1203',
      });
    }

    // ── 3. SKI / SNOWBOARD HELMETS — ASTM F2040 (voluntary) ──────────────────

    if (hasSkiHelmet || isSnow) {
      findings.push({
        id: 'sports_ski_helmet_astm_f2040',
        category: 'Ski / Snowboard Helmet — ASTM F2040 (Voluntary)',
        level: 'Medium',
        explanation:
          'There is no mandatory U.S. federal standard exclusively for ski or snowboard helmets. ' +
          'ASTM F2040 is the voluntary industry standard covering impact attenuation, retention, ' +
          'and field of vision for snow-sport helmets. ' +
          'Helmets labeled or marketed as meeting ASTM F2040 must actually comply with the standard ' +
          'to avoid FTC deceptive-labeling enforcement. ' +
          'If marketed for children ≤12 with an age-graded claim, CPSIA third-party testing is also required.',
        action:
          'Confirm test report against ASTM F2040 is available. ' +
          'If sold for children ≤12, obtain CPSIA third-party testing through the children\'s products module. ' +
          'Ensure labeling accurately reflects the standard(s) met.',
        verification_status: 'official_unconfirmed',
        source: {
          name: 'ASTM F2040',
          title: 'ASTM F2040 — Standard Specification for Helmets Used in Recreational Skiing and Snowboarding',
          agency: 'ASTM International',
          url: 'https://www.astm.org/f2040-21.html',
          last_verified_at: '2025-08-01',
          why_relevant: 'Industry voluntary standard for ski/snowboard helmets; compliance claimed on product labeling.',
        },
      });
    }

    // ── 4. PFDs / LIFE JACKETS — 46 CFR Part 160 (MANDATORY) ─────────────────

    if (isPfd) {
      questions.push({
        key: 'pfd_type',
        module: 'sports',
        question: 'What USCG PFD type is this life jacket / flotation device?',
        helpText:
          '46 CFR Part 160 requires USCG approval. ' +
          'Type I (offshore), II (near-shore), III (flotation aid), V (special use, may be inflatable).',
        options: [
          { value: 'type_1',         label: 'Type I — Offshore Life Jacket' },
          { value: 'type_2',         label: 'Type II — Near-Shore Buoyant Vest' },
          { value: 'type_3',         label: 'Type III — Flotation Aid (kayaking, paddling)' },
          { value: 'type_5',         label: 'Type V — Special Use (inflatable, hybrid)' },
          { value: 'not_pfd',        label: 'Not a PFD — other water safety product' },
          { value: 'not_applicable', label: 'Not applicable' },
          { value: 'unknown',        label: "I don't know" },
        ],
      });

      findings.push({
        id: 'sports_pfd_uscg_46cfr160',
        category: 'USCG — Personal Flotation Device Approval (46 CFR Part 160)',
        level: 'Critical',
        explanation:
          'Personal flotation devices (PFDs) sold in the United States must be approved by the ' +
          'U.S. Coast Guard (USCG) under 46 CFR Part 160. ' +
          'This applies to Type I (offshore), Type II (near-shore), Type III (flotation aid), ' +
          'and Type V (special use / inflatable) devices. ' +
          'The PFD must bear the USCG approval number and comply with buoyancy, materials, construction, ' +
          'and labeling requirements. Products without a USCG approval number cannot be sold or imported ' +
          'as PFDs for use aboard U.S. vessels.',
        action:
          'Confirm the USCG approval number from the manufacturer. Obtain the USCG approval certificate. ' +
          'Verify that product labeling includes the USCG approval number, type designation, ' +
          'and all required use and care instructions.',
        verification_status: 'verified_applicable',
        source: {
          name: '46 CFR Part 160',
          title: '46 CFR Part 160 — Life Preservers and Other Lifesaving Equipment',
          agency: 'U.S. Coast Guard',
          url: 'https://www.ecfr.gov/current/title-46/chapter-I/subchapter-Q/part-160',
          last_verified_at: '2025-08-01',
          why_relevant: 'Mandatory USCG approval required for all PFDs sold in the United States.',
        },
      });

      docSpecs.push({
        document: 'USCG Approval Certificate (46 CFR Part 160)',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'Mandatory USCG approval required for all PFDs sold in the United States.',
        doc_status: 'required_to_clear',
        finding_id: 'sports_pfd_uscg_46cfr160',
      });

      if (isInflatablePfd) {
        findings.push({
          id: 'sports_inflatable_pfd_type5',
          category: 'USCG — Inflatable PFD Type V Requirements (46 CFR Part 160)',
          level: 'Medium',
          explanation:
            'Inflatable Type V PFDs have additional USCG requirements beyond the base 46 CFR Part 160 approval. ' +
            'The inflation mechanism (CO₂ cartridge, oral inflation, or auto-inflation bladder) ' +
            'must itself be USCG-approved. ' +
            'Type V devices must be worn continuously when underway (unless the label specifies otherwise). ' +
            'Labeling must include inspection intervals, re-arming instructions, and use-limitation warnings.',
          action:
            'Confirm the inflation mechanism type and its USCG approval. ' +
            'Verify that labeling includes all required Type V statements including re-arming and inspection requirements. ' +
            'Provide service documentation with the product.',
          verification_status: 'official_unconfirmed',
          source: {
            name: '46 CFR Part 160 — Type V',
            title: '46 CFR Part 160 — Type V Special Use PFDs',
            agency: 'U.S. Coast Guard',
            url: 'https://www.ecfr.gov/current/title-46/chapter-I/subchapter-Q/part-160',
            last_verified_at: '2025-08-01',
            why_relevant: 'Type V inflatable PFDs have additional inflation mechanism and labeling requirements.',
          },
        });
      }
    }

    // ── 5. CLIMBING / FALL ARREST ─────────────────────────────────────────────

    if (isClimbing) {
      questions.push({
        key: 'climbing_equipment_type',
        module: 'sports',
        question: 'What type of climbing or fall-arrest equipment is this?',
        helpText:
          'Occupational fall-arrest equipment triggers OSHA 29 CFR 1910.140 (mandatory). ' +
          'Recreational climbing uses voluntary UIAA/EN standards.',
        options: [
          { value: 'harness',            label: 'Full-body or sit harness' },
          { value: 'rope',               label: 'Dynamic or static climbing rope' },
          { value: 'carabiner',          label: 'Carabiner or snap hook' },
          { value: 'belay_device',       label: 'Belay / rappel device' },
          { value: 'fall_arrest_system', label: 'Self-retracting lifeline (SRL) / fall arrest system' },
          { value: 'anchor',             label: 'Anchor point / sling' },
          { value: 'not_applicable',     label: 'Not applicable' },
          { value: 'unknown',            label: "I don't know" },
        ],
      });

      questions.push({
        key: 'is_occupational',
        module: 'sports',
        question: 'Is this fall-arrest equipment intended for occupational (workplace) use?',
        helpText:
          'Occupational use triggers OSHA 29 CFR 1910.140 (mandatory). ' +
          'Consumer and recreational climbing uses voluntary UIAA and EN standards.',
        options: [
          { value: 'yes_occupational', label: 'Yes — workplace / occupational use' },
          { value: 'yes_recreational', label: 'No — recreational / consumer use only' },
          { value: 'unknown',          label: "I don't know" },
        ],
      });

      if (isOccupational) {
        findings.push({
          id: 'sports_fall_arrest_osha_1910_140',
          category: 'OSHA — Personal Fall Arrest Systems (29 CFR 1910.140)',
          level: 'Critical',
          explanation:
            'Fall-arrest equipment (harnesses, self-retracting lifelines, lanyards, anchor connectors) ' +
            'intended for occupational use in general industry must comply with OSHA 29 CFR 1910.140. ' +
            'Construction fall protection falls under 29 CFR 1926.502. ' +
            'Requirements include rated strength, deceleration distance limits, anchorage capacity ' +
            '(5,000 lbs per attached employee or twice maximum arresting force), and manufacturer/model labeling. ' +
            'Equipment that fails to meet OSHA requirements cannot legally be used in covered workplaces.',
          action:
            'Confirm the equipment meets OSHA 29 CFR 1910.140 (or 29 CFR 1926.502 for construction). ' +
            'Obtain test documentation showing compliance with strength and performance requirements. ' +
            'Ensure labeling includes manufacturer, model number, rated load, and relevant ANSI/ASSE standard references.',
          verification_status: 'verified_applicable',
          source: {
            name: '29 CFR 1910.140',
            title: '29 CFR 1910.140 — Personal Protective Equipment: Fall Protection Systems',
            agency: 'OSHA',
            url: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.140',
            last_verified_at: '2025-08-01',
            why_relevant: 'Mandatory OSHA standard for occupational personal fall-arrest equipment.',
          },
        });

        docSpecs.push({
          document: 'Occupational Fall Arrest Test Report (OSHA 29 CFR 1910.140)',
          owner: 'supplier',
          responsible_party: 'laboratory',
          reason: 'OSHA mandatory requirements for occupational fall-arrest equipment.',
          doc_status: 'required_to_clear',
          finding_id: 'sports_fall_arrest_osha_1910_140',
        });
      } else {
        // Recreational climbing — voluntary UIAA / EN standards
        const isLoadBearing =
          climbType !== undefined &&
          ['harness', 'rope', 'carabiner', 'belay_device', 'fall_arrest_system', 'anchor'].includes(climbType);

        if (isLoadBearing || climbType === undefined) {
          findings.push({
            id: 'sports_climbing_uiaa_en_voluntary',
            category: 'Recreational Climbing — UIAA / EN Voluntary Standards',
            level: 'Medium',
            explanation:
              'There is no mandatory U.S. federal standard for recreational climbing equipment. ' +
              'The industry follows voluntary UIAA (International Climbing and Mountaineering Federation) ' +
              'and European EN standards: EN 12277 (harnesses), EN 892 (dynamic ropes), ' +
              'EN 12275 (connectors / carabiners), EN 15151 (belay devices), UIAA 105 / 106 / 126. ' +
              'Products labeled or marketed as meeting UIAA or CE standards must actually comply with ' +
              'those standards to avoid deceptive claims under the FTC Act.',
            action:
              'If the product is labeled or marketed as meeting UIAA or CE/EN standards, ' +
              'obtain and retain the relevant test report from the manufacturer. ' +
              'Ensure product labeling does not claim compliance with standards the product has not been tested to.',
            verification_status: 'official_unconfirmed',
            source: {
              name: 'UIAA Safety Standards',
              title: 'UIAA Safety Standards — Climbing Equipment',
              agency: 'UIAA',
              url: 'https://www.theuiaa.org/safety-standards/',
              last_verified_at: '2025-08-01',
              why_relevant: 'Industry-recognized voluntary standards for recreational climbing equipment.',
            },
          });
        }
      }
    }

    // ── 6. FITNESS MACHINES — ASTM F2115 / F3021 (voluntary) ─────────────────

    if (isFitness) {
      findings.push({
        id: 'sports_fitness_machine_astm',
        category: 'Fitness Equipment — ASTM F2115 / ASTM F3021 (Voluntary)',
        level: 'Low',
        explanation:
          'There is no mandatory U.S. federal safety standard for fitness machines (treadmills, ellipticals, ' +
          'stationary bikes, rowing machines) or free weights sold for adult use. ' +
          'Voluntary standards include ASTM F2115 (motorized treadmills) and ASTM F3021 (all fitness equipment). ' +
          'Products marketed or labeled for children require CPSIA compliance. ' +
          'CPSC has issued guidance on treadmill entrapment hazards; any product subject to an active recall ' +
          'has mandatory remediation requirements.',
        action:
          'No mandatory U.S. certification is required for adult fitness equipment absent a recall. ' +
          'Verify whether the product or model has been subject to a CPSC recall via the CPSC recall database. ' +
          'If marketed to children ≤12, the children\'s products module applies.',
        verification_status: 'official_unconfirmed',
        source: {
          name: 'ASTM F3021',
          title: 'ASTM F3021 — Standard Specification for All Fitness Equipment',
          agency: 'ASTM International',
          url: 'https://www.astm.org/f3021-17.html',
          last_verified_at: '2025-08-01',
          why_relevant: 'Voluntary standard applicable to fitness machines; no mandatory federal equivalent for adults.',
        },
      });
    }

    // ── 7. TRAMPOLINES — ASTM F381 (voluntary) ───────────────────────────────

    if (isTrampoline) {
      findings.push({
        id: 'sports_trampoline_astm_f381',
        category: 'Trampoline Safety — ASTM F381 (Voluntary)',
        level: 'Medium',
        explanation:
          'There is no mandatory U.S. federal standard for trampolines. ' +
          'ASTM F381 is the voluntary standard covering frame construction, bed attachment, padding, ' +
          'enclosures, stability, and labeling / warning requirements. ' +
          'Trampolines sold for children are subject to CPSIA general requirements (lead, phthalates if applicable). ' +
          'CPSC has issued safety advisories and recall actions on trampoline enclosures and frame failures.',
        action:
          'No mandatory certification is required for adult trampolines. ' +
          'If marketed for children ≤12, the children\'s products module applies — obtain CPSIA third-party testing. ' +
          'Check the CPSC recall database for any outstanding recall on the specific model.',
        verification_status: 'official_unconfirmed',
        source: {
          name: 'ASTM F381',
          title: 'ASTM F0381 — Standard Safety Specification for Components, Assembly, Use, and Labeling of Trampolines',
          agency: 'ASTM International',
          url: 'https://www.astm.org/f0381-23.html',
          last_verified_at: '2025-08-01',
          why_relevant: 'Industry voluntary standard for trampolines; no mandatory federal equivalent exists.',
        },
      });
    }

    // ── 8. COMBAT SPORTS / ADULT PROTECTIVE GEAR — no federal mandatory ───────

    if (isCombat) {
      findings.push({
        id: 'sports_combat_protective_no_federal',
        category: 'Combat Sports / Protective Gear — No Mandatory Federal Standard (Adults)',
        level: 'Low',
        explanation:
          'Adult combat sports equipment (boxing gloves, shin guards, sparring gear, body armor) ' +
          'and general sports protective gear (knee pads, elbow pads) do not have a mandatory U.S. federal ' +
          'safety standard for adult use. ' +
          'Relevant voluntary standards include ASTM F2697 (general sports protective equipment), ' +
          'NOCSAE standards (football/lacrosse helmets), and sport-specific ASTM or ISO standards. ' +
          'If the product is intended for children ≤12, CPSIA third-party testing is required ' +
          'and is covered under the children\'s products module.',
        action:
          'No mandatory certification is required for adult protective gear. ' +
          'If marketed to children ≤12, obtain CPSIA third-party testing. ' +
          'If the product is labeled as meeting a specific voluntary standard, retain the relevant test report.',
        verification_status: 'official_unconfirmed',
        source: {
          name: 'CPSC Sports & Recreational Guidance',
          title: 'CPSC Business Guidance — Sports, Recreational, and Outdoor Products',
          agency: 'CPSC',
          url: 'https://www.cpsc.gov/Business--Manufacturing/Business-Education/Business-Guidance/Sports-Recreational-and-Outdoor-Products',
          last_verified_at: '2025-08-01',
          why_relevant: 'CPSC guidance covering sports and recreational equipment; no mandatory standard for adult combat/protective gear.',
        },
      });
    }

    // ── Coverage domain ───────────────────────────────────────────────────────

    const hasMandatory = findings.some((f) => f.verification_status === 'verified_applicable');

    coverageDomains.push({
      domain: 'Sports & Outdoor Equipment — CPSC / USCG / OSHA',
      domain_key: 'sports_outdoor_equipment',
      category: 'product_regulation',
      status: hasMandatory ? 'verified_applicable' : 'official_unconfirmed',
      note: hasMandatory
        ? 'Mandatory safety requirements identified. See findings for details.'
        : 'No mandatory federal standard identified for this product type. Voluntary standards may apply.',
      official_url: 'https://www.cpsc.gov/Business--Manufacturing/Business-Education/Business-Guidance/Sports-Recreational-and-Outdoor-Products',
    });

    return { findings, coverageDomains, docSpecs, questions };
  },
};
