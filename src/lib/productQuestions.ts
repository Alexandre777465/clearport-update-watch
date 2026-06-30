/**
 * Client-side product question engine.
 *
 * Uses the shared factEngine for module detection so the same evidence
 * precedence rules apply as on the server: explicit negatives override
 * keyword inferences, and structured answers override everything.
 *
 * Module activation and question routing are fact-driven, not keyword-driven.
 */

import { extractFacts, activateFromFacts, MODULE_MANIFESTS } from "./factEngine";

export type ModuleId =
  | "automotive"
  | "electronics"
  | "batteries"
  | "childrens"
  | "textiles"
  | "cosmetics"
  | "food"
  | "medical_devices"
  | "chemicals"
  | "furniture"
  | "sports";

export interface ProductQuestion {
  key: string;
  module: ModuleId;
  question: string;
  helpText?: string;
  options: Array<{ value: string; label: string }>;
  /** Only show this question if the given key already has one of these values */
  showIf?: { key: string; values: string[] };
}

export interface ProductAttrs {
  is_children?: boolean;
  has_battery?: boolean;
  is_electronic?: boolean;
  is_textile?: boolean;
  is_cosmetic?: boolean;
  is_food_contact?: boolean;
  is_supplement?: boolean;
}

/**
 * Pure function — uses the shared factEngine to determine active modules.
 * Supports structured question answers (knownFacts) so that negative
 * first-level answers deactivate their module and remove its questions.
 */
export function detectModules(
  htsDigits: string,
  productText: string,
  _attrs: ProductAttrs = {},  // kept for API compat; factEngine supersedes this
  knownFacts: Record<string, string> = {},
): Set<ModuleId> {
  const facts = extractFacts(htsDigits, productText, knownFacts);
  const active = activateFromFacts(facts, MODULE_MANIFESTS);
  return new Set(active as ModuleId[]);
}

// ── Question bank ─────────────────────────────────────────────────────────────

const QUESTION_BANK: ProductQuestion[] = [
  // ── AUTOMOTIVE ─────────────────────────────────────────────────────────────
  {
    key: "vehicle_type",
    module: "automotive",
    question: "What type of vehicle does this part fit?",
    helpText: "Determines which FMVSS safety standard applies.",
    options: [
      { value: "passenger_vehicle", label: "Passenger car / light truck / SUV" },
      { value: "heavy_commercial",  label: "Medium/heavy commercial truck or bus" },
      { value: "non_road",          label: "Non-road or agricultural equipment" },
      { value: "not_automotive",    label: "Not an automotive or vehicle part" },
      { value: "unknown",           label: "I don't know" },
    ],
  },
  {
    key: "brake_system_type",
    module: "automotive",
    question: "What brake system type does this part belong to?",
    helpText: "FMVSS 135 covers hydraulic brakes; FMVSS 121 covers air brakes.",
    showIf: { key: "vehicle_type", values: ["passenger_vehicle", "heavy_commercial"] },
    options: [
      { value: "hydraulic", label: "Hydraulic brakes" },
      { value: "air",       label: "Air brakes" },
      { value: "unknown",   label: "I don't know" },
    ],
  },

  // ── ELECTRONICS ────────────────────────────────────────────────────────────
  {
    key: "has_wireless_tx",
    module: "electronics",
    question: "Does this product contain a wireless transmitter?",
    helpText: "Wi-Fi, Bluetooth, Zigbee, cellular, NFC, active RFID — anything that intentionally broadcasts a radio signal.",
    options: [
      { value: "yes",     label: "Yes — Wi-Fi, Bluetooth, cellular, or other radio" },
      { value: "no",      label: "No wireless transmitter (wired-only or passive)" },
      { value: "unknown", label: "I don't know" },
    ],
  },
  {
    key: "product_function",
    module: "electronics",
    question: "What is the primary function of this electronic product?",
    options: [
      { value: "audio_speaker",          label: "Audio speaker or soundbar" },
      { value: "headphones_earbuds",     label: "Headphones or earbuds" },
      { value: "tv_monitor",             label: "TV or monitor" },
      { value: "computer_laptop_tablet", label: "Computer, laptop, or tablet" },
      { value: "router_modem",           label: "Router or modem" },
      { value: "other_no_radio",         label: "Other electronic device" },
      { value: "not_electronic",         label: "Not an electronic product — no electronic components" },
      { value: "unknown",                label: "I don't know / prefer not to say" },
    ],
  },

  // ── BATTERIES ──────────────────────────────────────────────────────────────
  {
    key: "battery_type",
    module: "batteries",
    question: "What type of battery does this product contain?",
    helpText: "Lithium batteries trigger UN 38.3 testing and DOT/IATA hazmat classification.",
    options: [
      { value: "lithium_ion",     label: "Lithium-ion or lithium-polymer (rechargeable)" },
      { value: "lithium_metal",   label: "Lithium metal (primary / non-rechargeable)" },
      { value: "lead_acid",       label: "Lead-acid" },
      { value: "other_chemistry", label: "Other battery chemistry" },
      { value: "no_battery",      label: "No battery — does not contain any battery" },
      { value: "unknown",         label: "I don't know" },
    ],
  },
  {
    key: "battery_configuration",
    module: "batteries",
    question: "How is the battery shipped?",
    helpText: "Each configuration has different DOT/IATA hazmat requirements and UN numbers.",
    showIf: { key: "battery_type", values: ["lithium_ion", "lithium_metal"] },
    options: [
      { value: "in_equipment",     label: "Installed inside the product (UN 3481)" },
      { value: "with_equipment",   label: "Packed separately in the same box as the product (UN 3481)" },
      { value: "standalone_loose", label: "Standalone — no accompanying product (UN 3480)" },
      { value: "unknown",          label: "I don't know" },
    ],
  },
  {
    key: "battery_wh",
    module: "batteries",
    question: "Approximate watt-hour (Wh) rating per cell or battery pack?",
    helpText: "Wh rating determines quantity limits per package under IATA DGR.",
    showIf: { key: "battery_type", values: ["lithium_ion", "lithium_metal"] },
    options: [
      { value: "under_2wh",       label: "Under 2 Wh per cell" },
      { value: "2_to_20wh",       label: "2 – 20 Wh per cell" },
      { value: "20_to_100wh",     label: "20 – 100 Wh per cell" },
      { value: "over_100wh",      label: "Over 100 Wh per cell" },
      { value: "over_300wh_pack", label: "Over 300 Wh per battery pack" },
      { value: "unknown",         label: "I don't know" },
    ],
  },

  // ── CHILDREN'S ─────────────────────────────────────────────────────────────
  {
    key: "age_range",
    module: "childrens",
    question: "What is the intended age range for this product?",
    helpText: "CPSIA third-party testing applies to products for children 12 and under.",
    options: [
      { value: "under_3",          label: "Under 3 years" },
      { value: "age_3_to_12",      label: "Ages 3 – 12" },
      { value: "over_12",          label: "Ages 13 and up" },
      { value: "not_for_children", label: "Not intended for children — adult product" },
      { value: "unknown",          label: "I don't know / not age-specific" },
    ],
  },
  {
    key: "contains_paint_or_surface_coating",
    module: "childrens",
    question: "Does this product have any paint, surface coating, or dye applied?",
    helpText: "CPSIA limits lead in surface coatings to 90 ppm for children's products.",
    showIf: { key: "age_range", values: ["under_3", "age_3_to_12"] },
    options: [
      { value: "yes",     label: "Yes — painted, coated, or dyed" },
      { value: "no",      label: "No paint or coating" },
      { value: "unknown", label: "I don't know" },
    ],
  },

  // ── TEXTILES ───────────────────────────────────────────────────────────────
  {
    key: "textile_type",
    module: "textiles",
    question: "Is this product a textile, apparel, or fabric item?",
    helpText: "FTC fiber content labeling and care labeling rules apply to textile products.",
    options: [
      { value: "apparel_clothing",  label: "Apparel or clothing (shirt, pants, dress, etc.)" },
      { value: "home_textile",      label: "Home textile (towels, bedding, curtains)" },
      { value: "footwear",          label: "Footwear with textile upper" },
      { value: "other_textile",     label: "Other fabric or textile product" },
      { value: "not_textile",       label: "Not a textile — no fabric content" },
      { value: "unknown",           label: "I don't know" },
    ],
  },

  // ── COSMETICS ──────────────────────────────────────────────────────────────
  {
    key: "contains_otc_ingredient",
    module: "cosmetics",
    question: "Does this product contain any active drug ingredients?",
    helpText: "Sunscreen UV filters, benzoyl peroxide (acne), zinc pyrithione (antidandruff) make a cosmetic an OTC drug regulated under a separate FDA monograph.",
    options: [
      { value: "yes_sunscreen",     label: "Yes — sunscreen (SPF active ingredients)" },
      { value: "yes_acne",          label: "Yes — acne treatment (benzoyl peroxide, salicylic acid)" },
      { value: "yes_antidandruff",  label: "Yes — antidandruff (zinc pyrithione, selenium sulfide)" },
      { value: "yes_other_drug",    label: "Yes — other OTC drug ingredient" },
      { value: "no",                label: "No active drug ingredients — cosmetic only" },
      { value: "not_cosmetic",      label: "Not a cosmetic — not a personal care or beauty product" },
      { value: "unknown",           label: "I don't know" },
    ],
  },

  // ── FOOD ───────────────────────────────────────────────────────────────────
  {
    key: "is_meat_or_poultry",
    module: "food",
    question: "Is this product meat, poultry, or an egg product?",
    helpText: "Meat, poultry, and egg products are regulated by USDA/FSIS, not FDA. They require FSIS re-inspection at a USDA-approved port.",
    options: [
      { value: "yes_meat",    label: "Yes — red meat or game" },
      { value: "yes_poultry", label: "Yes — chicken, turkey, duck, or other poultry" },
      { value: "yes_egg",     label: "Yes — processed egg products" },
      { value: "no",          label: "No — other food or beverage" },
      { value: "not_food",    label: "Not a food product — not intended for consumption or food contact" },
      { value: "unknown",     label: "I don't know" },
    ],
  },

  // ── MEDICAL DEVICES ────────────────────────────────────────────────────────
  {
    key: "fda_device_class",
    module: "medical_devices",
    question: "What is the FDA device classification for this product?",
    helpText: "Class I = general controls only; Class II = 510(k) clearance required; Class III = PMA approval required.",
    options: [
      { value: "class_1",            label: "Class I — general controls only (most exempt)" },
      { value: "class_2",            label: "Class II — 510(k) premarket notification required" },
      { value: "class_3",            label: "Class III — PMA premarket approval required" },
      { value: "not_medical_device", label: "Not a medical device — no medical intended use" },
      { value: "unknown",            label: "I don't know" },
    ],
  },

  // ── CHEMICALS ──────────────────────────────────────────────────────────────
  {
    key: "is_pesticide_or_disinfectant",
    module: "chemicals",
    question: "Does this product make pesticidal or antimicrobial claims?",
    helpText: "Any claim to kill, repel, or control insects, bacteria, viruses, fungi, or weeds triggers EPA FIFRA registration.",
    options: [
      { value: "yes",                   label: "Yes — kills or controls pests, bacteria, viruses, or weeds" },
      { value: "no",                    label: "No pesticidal or antimicrobial claims" },
      { value: "not_chemical_product",  label: "Not a chemical product — no hazardous chemical substance" },
      { value: "unknown",               label: "I don't know" },
    ],
  },
  {
    key: "contains_hazmat",
    module: "chemicals",
    question: "Does this product contain hazardous materials?",
    helpText: "Flammable, corrosive, toxic, or oxidizing substances require DOT hazmat classification and shipping documentation.",
    showIf: { key: "is_pesticide_or_disinfectant", values: ["no"] },
    options: [
      { value: "yes",     label: "Yes — flammable, corrosive, toxic, or oxidizing" },
      { value: "no",      label: "No hazardous materials" },
      { value: "unknown", label: "I don't know" },
    ],
  },

  // ── FURNITURE ──────────────────────────────────────────────────────────────
  {
    key: "contains_composite_wood",
    module: "furniture",
    question: "Does this product contain composite wood panels?",
    helpText: "Particleboard, MDF, hardwood plywood, and thin-wood veneer panels must meet EPA TSCA Title VI formaldehyde emission standards (40 CFR Part 770).",
    options: [
      { value: "yes",            label: "Yes — contains particleboard, MDF, or hardwood plywood" },
      { value: "no",             label: "No composite wood — solid wood, metal, or plastic only" },
      { value: "not_applicable", label: "Does not contain wood of any kind" },
      { value: "unknown",        label: "I don't know" },
    ],
  },
  {
    key: "has_upholstery",
    module: "furniture",
    question: "Does this product include upholstery or foam padding?",
    showIf: { key: "contains_composite_wood", values: ["yes", "no", "unknown"] },
    options: [
      { value: "yes",     label: "Yes — fabric, leather, or foam upholstery" },
      { value: "no",      label: "No upholstery" },
      { value: "unknown", label: "I don't know" },
    ],
  },

  // ── SPORTS & OUTDOOR EQUIPMENT ─────────────────────────────────────────────
  {
    key: "sports_product_type",
    module: "sports",
    question: "What type of sports or outdoor equipment is this?",
    helpText: "Determines which mandatory safety standards apply (CPSC, USCG, ASTM, etc.).",
    options: [
      { value: "bicycle",              label: "Bicycle (includes e-bike)" },
      { value: "kayak_canoe",          label: "Kayak, canoe, or paddleboard" },
      { value: "surfboard_paddleboard", label: "Surfboard or stand-up paddleboard" },
      { value: "climbing_equipment",   label: "Climbing / fall-arrest equipment" },
      { value: "pfd_life_jacket",      label: "Life jacket / PFD / buoyancy aid" },
      { value: "fitness_machine",      label: "Fitness machine (treadmill, elliptical, rower)" },
      { value: "free_weights",         label: "Free weights / dumbbells / barbells / weight bench" },
      { value: "combat_sports",        label: "Combat sports / martial arts equipment" },
      { value: "snow_sports",          label: "Snow sports (skis, snowboard, poles, boots)" },
      { value: "water_sports",         label: "Water sports (wetsuit, fins, water ski, wakeboard)" },
      { value: "ball_racket_sports",   label: "Ball or racket sports (tennis, golf, soccer, baseball)" },
      { value: "trampoline",           label: "Trampoline or gymnastics equipment" },
      { value: "protective_gear",      label: "Protective gear (shin guards, knee/elbow pads, body armor)" },
      { value: "scuba_snorkel",        label: "SCUBA or snorkeling equipment" },
      { value: "other_sports",         label: "Other sports or recreational equipment" },
      { value: "not_sports",           label: "Not sports equipment — misclassified" },
      { value: "unknown",              label: "I don't know" },
    ],
  },
  {
    key: "sports_helmet_type",
    module: "sports",
    question: "Does this product include a helmet or head protection?",
    helpText: "Bicycle helmets require CPSC 16 CFR Part 1203 certification. Ski/snowboard helmets follow ASTM F2040.",
    showIf: { key: "sports_product_type", values: ["bicycle", "snow_sports", "combat_sports", "other_sports"] },
    options: [
      { value: "bicycle_helmet",        label: "Bicycle helmet" },
      { value: "ski_snowboard_helmet",  label: "Ski / snowboard helmet" },
      { value: "motorcycle_helmet",     label: "Motorcycle helmet (DOT FMVSS 218)" },
      { value: "other_helmet",          label: "Other head protection" },
      { value: "no_helmet",             label: "No helmet — does not include head protection" },
      { value: "not_applicable",        label: "Not applicable" },
      { value: "unknown",               label: "I don't know" },
    ],
  },
  {
    key: "pfd_type",
    module: "sports",
    question: "What USCG PFD type is this life jacket / flotation device?",
    helpText: "46 CFR Part 160 requires USCG approval. Type I (offshore), II (near-shore), III (flotation aid), V (special use, may be inflatable).",
    showIf: { key: "sports_product_type", values: ["pfd_life_jacket", "kayak_canoe"] },
    options: [
      { value: "type_1",       label: "Type I — Offshore Life Jacket" },
      { value: "type_2",       label: "Type II — Near-Shore Buoyant Vest" },
      { value: "type_3",       label: "Type III — Flotation Aid (kayaking, paddling)" },
      { value: "type_5",       label: "Type V — Special Use (inflatable, hybrid)" },
      { value: "not_pfd",      label: "Not a PFD — other water safety product" },
      { value: "not_applicable", label: "Not applicable" },
      { value: "unknown",      label: "I don't know" },
    ],
  },
  {
    key: "climbing_equipment_type",
    module: "sports",
    question: "What type of climbing or fall-arrest equipment is this?",
    helpText: "Load-bearing fall-arrest equipment for occupational use must meet OSHA 29 CFR 1910.140. Recreational climbing follows voluntary UIAA/EN standards.",
    showIf: { key: "sports_product_type", values: ["climbing_equipment"] },
    options: [
      { value: "harness",            label: "Full-body or sit harness" },
      { value: "rope",               label: "Dynamic or static climbing rope" },
      { value: "carabiner",          label: "Carabiner or snap hook" },
      { value: "belay_device",       label: "Belay / rappel device" },
      { value: "fall_arrest_system", label: "Self-retracting lifeline (SRL) / fall arrest system" },
      { value: "anchor",             label: "Anchor point / sling / anchor strap" },
      { value: "not_applicable",     label: "Not applicable" },
      { value: "unknown",            label: "I don't know" },
    ],
  },
  {
    key: "is_occupational",
    module: "sports",
    question: "Is this fall-arrest equipment intended for occupational use?",
    helpText: "Occupational (workplace) fall protection triggers OSHA 29 CFR 1910.140. Consumer/recreational climbing uses voluntary UIAA and EN standards.",
    showIf: { key: "climbing_equipment_type", values: ["harness", "rope", "carabiner", "belay_device", "fall_arrest_system", "anchor"] },
    options: [
      { value: "yes_occupational",  label: "Yes — intended for workplace / occupational use" },
      { value: "yes_recreational",  label: "No — recreational climbing / consumer use only" },
      { value: "unknown",           label: "I don't know" },
    ],
  },
  {
    key: "water_sports_type",
    module: "sports",
    question: "What type of watercraft or water-sports product is this?",
    showIf: { key: "sports_product_type", values: ["kayak_canoe", "surfboard_paddleboard", "water_sports"] },
    options: [
      { value: "kayak",                   label: "Kayak (hard shell)" },
      { value: "inflatable_kayak",        label: "Kayak (inflatable)" },
      { value: "canoe",                   label: "Canoe" },
      { value: "surfboard",               label: "Surfboard (hard)" },
      { value: "paddleboard",             label: "Stand-up paddleboard (hard)" },
      { value: "inflatable_paddleboard",  label: "Stand-up paddleboard (inflatable)" },
      { value: "wetsuit",                 label: "Wetsuit or drysuit" },
      { value: "scuba",                   label: "SCUBA gear" },
      { value: "other_water",             label: "Other water sports equipment" },
      { value: "not_applicable",          label: "Not applicable" },
      { value: "unknown",                 label: "I don't know" },
    ],
  },
  {
    key: "protective_gear_type",
    module: "sports",
    question: "What type of protective gear is this?",
    showIf: { key: "sports_product_type", values: ["protective_gear", "combat_sports"] },
    options: [
      { value: "shin_guard",       label: "Shin guard" },
      { value: "knee_pad",         label: "Knee pad" },
      { value: "elbow_pad",        label: "Elbow pad" },
      { value: "body_armor",       label: "Body armor / chest protector" },
      { value: "head_guard",       label: "Head guard (boxing, martial arts)" },
      { value: "face_guard",       label: "Face guard or mask" },
      { value: "mouthguard",       label: "Mouthguard" },
      { value: "other_protective", label: "Other protective gear" },
      { value: "not_applicable",   label: "Not applicable" },
      { value: "unknown",          label: "I don't know" },
    ],
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the ordered list of clarification questions relevant to the given
 * product. Uses the fact engine so that previous answers (knownFacts) can
 * deactivate modules and suppress their questions in real time.
 */
export function getQuestionsForProduct(
  htsDigits: string,
  productText: string,
  attrs: ProductAttrs = {},
  knownFacts: Record<string, string> = {},
): ProductQuestion[] {
  // Map explicit false booleans to negative structured answers so that a user
  // unchecking "Electronic product" (etc.) immediately suppresses that module's
  // questions without waiting for a full scan round-trip.
  const attrOverrides: Record<string, string> = {};
  if (attrs.is_electronic  === false) attrOverrides['product_function']        = 'not_electronic';
  if (attrs.has_battery    === false) attrOverrides['battery_type']             = 'no_battery';
  if (attrs.is_children    === false) attrOverrides['age_range']                = 'not_for_children';
  if (attrs.is_textile     === false) attrOverrides['textile_type']             = 'not_textile';
  if (attrs.is_cosmetic    === false) attrOverrides['contains_otc_ingredient']  = 'not_cosmetic';
  if (attrs.is_food_contact === false) attrOverrides['food_contact_use']        = 'no';
  const mergedFacts = { ...attrOverrides, ...knownFacts };
  const modules = detectModules(htsDigits, productText, attrs, mergedFacts);
  return QUESTION_BANK.filter((q) => modules.has(q.module));
}

/**
 * Maps collected question answers to the boolean product attribute flags
 * the backend needs in the watchlist entry.
 */
export function answersToAttrs(answers: Record<string, string>): ProductAttrs {
  const attrs: ProductAttrs = {};

  if (
    answers.has_wireless_tx === 'yes' ||
    (answers.product_function && answers.product_function !== 'not_electronic' && answers.product_function !== 'unknown')
  ) {
    attrs.is_electronic = true;
  }

  if (
    answers.battery_type &&
    answers.battery_type !== 'no_battery' &&
    answers.battery_type !== 'unknown'
  ) {
    attrs.has_battery = true;
  }

  if (answers.age_range === 'under_3' || answers.age_range === 'age_3_to_12') {
    attrs.is_children = true;
  }

  if (
    answers.contains_otc_ingredient !== undefined &&
    answers.contains_otc_ingredient !== 'not_cosmetic'
  ) {
    attrs.is_cosmetic = true;
  }

  if (answers.is_meat_or_poultry !== undefined && answers.is_meat_or_poultry !== 'not_food') {
    attrs.is_food_contact = true;
  }

  return attrs;
}
