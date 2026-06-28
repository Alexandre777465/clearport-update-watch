/**
 * Client-side product question engine.
 *
 * Mirrors the backend regulatory module DynamicQuestion[] structure so the
 * form can show module-relevant clarification questions without a server
 * round-trip. detectModules() is a pure function that reproduces the same
 * logic as server/src/services/categoryDetector.ts.
 *
 * Question answers are collected as Record<string, string> (knownFacts) and
 * sent to the backend alongside the watchlist entry so evaluateAllModules()
 * can resolve "insufficient_info" findings into verified results.
 */

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
  | "furniture";

export interface ProductQuestion {
  key: string;
  module: ModuleId;
  question: string;
  helpText?: string;
  options: Array<{ value: string; label: string }>;
  /** Only show this question if the given key already has one of these values */
  showIf?: { key: string; values: string[] };
}

// ── Client-side module detection ──────────────────────────────────────────────

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
 * Pure function — mirrors server/src/services/categoryDetector.ts.
 * Returns the set of active module IDs for this product.
 */
export function detectModules(
  htsDigits: string,
  productText: string,
  attrs: ProductAttrs = {},
): Set<ModuleId> {
  const active = new Set<ModuleId>();
  const h = htsDigits.replace(/[^0-9]/g, "");
  const txt = productText.toLowerCase();

  // Automotive
  if (
    (h.length >= 4 &&
      [
        "8701","8702","8703","8704","8705","8706","8707","8708",
        "8711","8712","8713","8714","8715","8716",
        "8407","8408","8409","8483",
      ].some((p) => h.startsWith(p))) ||
    /\b(brake|bumper|axle|suspension|driveshaft|crankshaft|camshaft|piston|transmission|clutch|differential|motor\s*vehicle|automotive|automobile|passenger\s*vehicle|truck\s*part|vehicle\s*part|wheel\s*hub|steering|muffler|exhaust|radiator|shock\s*absorber|spark\s*plug|fuel\s*injector|catalytic\s*converter)\b/.test(txt)
  ) {
    active.add("automotive");
  }

  // Electronics
  if (
    attrs.is_electronic ||
    (h.length >= 4 &&
      [
        "8471","8472","8517","8518","8519","8520","8521","8522","8523",
        "8524","8525","8526","8527","8528","8529","8530","8531","8532",
        "8533","8534","8535","8536","8537","8538","8539","8540","8541",
        "8542","8543","8544","8545","8546","8547","8548",
        "9009","9013",
      ].some((p) => h.startsWith(p))) ||
    /\b(electronic|wireless|bluetooth|wi-?fi|radio|transmitter|receiver|antenna|modem|router|speaker|headphone|earphone|microphone|amplifier|television|monitor|display|computer|laptop|tablet|phone|charger|power\s*supply|led|printed\s*circuit|circuit\s*board|pcb|semiconductor)\b/.test(txt)
  ) {
    active.add("electronics");
  }

  // Batteries
  if (
    attrs.has_battery ||
    (h.length >= 4 && ["8506","8507"].some((p) => h.startsWith(p))) ||
    /\b(lithium|li-ion|li-?poly|battery|batteries|accumulator|rechargeable\s*cell|lead[- ]?acid|nickel[- ]?metal|nimh)\b/.test(txt)
  ) {
    active.add("batteries");
  }

  // Children's
  if (
    attrs.is_children ||
    (h.length >= 4 &&
      ["9501","9502","9503","9504","9505","9506","9507","9508"].some((p) => h.startsWith(p))) ||
    /\b(toy|toys|doll|game|puzzle|children|child|kids|infant|toddler|juvenile|baby|nursery|playpen|stroller|crib)\b/.test(txt)
  ) {
    active.add("childrens");
  }

  // Textiles
  if (
    attrs.is_textile ||
    (h.length >= 2 &&
      (() => {
        const p2 = parseInt(h.slice(0, 2), 10);
        return (p2 >= 50 && p2 <= 63) || p2 === 64;
      })()) ||
    /\b(fabric|textile|apparel|garment|clothing|shirt|pants|dress|suit|jacket|coat|sweater|hat|cap|glove|sock|underwear|footwear|shoe|boot|sandal|fiber|yarn|knit|woven|cotton|wool|silk|polyester|nylon|linen|denim)\b/.test(txt)
  ) {
    active.add("textiles");
  }

  // Cosmetics
  if (
    attrs.is_cosmetic ||
    (h.length >= 4 &&
      ["3303","3304","3305","3306","3307","3401"].some((p) => h.startsWith(p))) ||
    /\b(cosmetic|skincare|moisturizer|lotion|cream|serum|toner|sunscreen|spf|foundation|lipstick|mascara|eyeliner|blush|concealer|shampoo|conditioner|hair\s*dye|hair\s*color|nail\s*polish|perfume|cologne|deodorant|antiperspirant|body\s*wash|soap|face\s*wash)\b/.test(txt)
  ) {
    active.add("cosmetics");
  }

  // Food
  if (
    attrs.is_food_contact ||
    attrs.is_supplement ||
    (h.length >= 2 &&
      (() => {
        const p2 = parseInt(h.slice(0, 2), 10);
        return p2 >= 1 && p2 <= 24;
      })()) ||
    /\b(food|beverage|drink|edible|snack|meat|fish|seafood|poultry|dairy|cheese|milk|egg|fruit|vegetable|grain|cereal|bread|bakery|confectionery|candy|chocolate|juice|beer|wine|spirits|supplement|vitamin|mineral|protein\s*powder)\b/.test(txt)
  ) {
    active.add("food");
  }

  // Medical devices
  if (
    (h.length >= 4 &&
      ["9018","9019","9020","9021","9022"].some((p) => h.startsWith(p))) ||
    /\b(medical\s*device|surgical|diagnostic|therapeutic|implant|prosthetic|orthopedic|hearing\s*aid|blood\s*pressure|glucose\s*monitor|pulse\s*oximeter|stethoscope|syringe|catheter|scalpel|bandage|wound\s*care|contact\s*lens|dental\s*implant|pacemaker)\b/.test(txt)
  ) {
    active.add("medical_devices");
  }

  // Chemicals
  if (
    (h.length >= 4 &&
      [
        "2801","2802","2803","2804","2805","2806","2807","2808","2809","2810",
        "2811","2812","2813","2814","2815","2816","2817","2818","2819","2820",
        "3208","3209","3210","3211","3212","3213","3214",
        "3401","3402","3403","3404","3405","3406","3407",
        "3701","3702","3703","3704","3705","3706","3707",
        "3808","3809","3810","3811","3812","3813","3814","3815","3816","3817",
        "3818","3819","3820","3821","3822","3823","3824","3825","3826","3827",
      ].some((p) => h.startsWith(p))) ||
    /\b(chemical|disinfectant|pesticide|herbicide|insecticide|fungicide|cleaner|detergent|solvent|paint|varnish|lacquer|coating|lubricant|grease|adhesive|sealant|caulk|epoxy|bleach|acid|alkali|corrosive|flammable\s*liquid|aerosol)\b/.test(txt)
  ) {
    active.add("chemicals");
  }

  // Furniture
  if (
    (h.length >= 4 &&
      ["9401","9402","9403","9404","9405","9406","4410","4411","4412"].some((p) =>
        h.startsWith(p),
      )) ||
    /\b(furniture|chair|sofa|couch|table|desk|cabinet|shelf|bookcase|wardrobe|dresser|bed\s*frame|mattress|pillow|cushion|composite\s*wood|particleboard|mdf|fiberboard|plywood|laminate\s*flooring)\b/.test(txt)
  ) {
    active.add("furniture");
  }

  return active;
}

// ── Question bank ─────────────────────────────────────────────────────────────
// One entry per (module, question key). Options mirror the backend modules.

const QUESTION_BANK: ProductQuestion[] = [
  // ── AUTOMOTIVE ─────────────────────────────────────────────────────────────
  {
    key: "vehicle_type",
    module: "automotive",
    question: "What type of vehicle does this part fit?",
    helpText: "Determines which FMVSS safety standard applies.",
    options: [
      { value: "passenger_vehicle", label: "Passenger car / light truck / SUV" },
      { value: "heavy_commercial", label: "Medium/heavy commercial truck or bus" },
      { value: "non_road", label: "Non-road or agricultural equipment" },
      { value: "unknown", label: "I don't know" },
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
      { value: "air", label: "Air brakes" },
      { value: "unknown", label: "I don't know" },
    ],
  },

  // ── ELECTRONICS ────────────────────────────────────────────────────────────
  {
    key: "has_wireless_tx",
    module: "electronics",
    question: "Does this product contain a wireless transmitter?",
    helpText: "Wi-Fi, Bluetooth, Zigbee, cellular, NFC, active RFID — anything that intentionally broadcasts a radio signal.",
    options: [
      { value: "yes", label: "Yes — Wi-Fi, Bluetooth, cellular, or other radio" },
      { value: "no", label: "No wireless transmitter (wired-only or passive)" },
      { value: "unknown", label: "I don't know" },
    ],
  },
  {
    key: "product_function",
    module: "electronics",
    question: "What is the primary function of this electronic product?",
    options: [
      { value: "audio_speaker", label: "Audio speaker or soundbar" },
      { value: "headphones_earbuds", label: "Headphones or earbuds" },
      { value: "tv_monitor", label: "TV or monitor" },
      { value: "computer_laptop_tablet", label: "Computer, laptop, or tablet" },
      { value: "router_modem", label: "Router or modem" },
      { value: "other_no_radio", label: "Other electronic device" },
      { value: "unknown", label: "I don't know / prefer not to say" },
    ],
  },

  // ── BATTERIES ──────────────────────────────────────────────────────────────
  {
    key: "battery_type",
    module: "batteries",
    question: "What type of battery does this product contain?",
    helpText: "Lithium batteries trigger UN 38.3 testing and DOT/IATA hazmat classification.",
    options: [
      { value: "lithium_ion", label: "Lithium-ion or lithium-polymer (rechargeable)" },
      { value: "lithium_metal", label: "Lithium metal (primary / non-rechargeable)" },
      { value: "lead_acid", label: "Lead-acid" },
      { value: "other_chemistry", label: "Other battery chemistry" },
      { value: "unknown", label: "I don't know" },
    ],
  },
  {
    key: "battery_configuration",
    module: "batteries",
    question: "How is the battery shipped?",
    helpText: "Each configuration has different DOT/IATA hazmat requirements and UN numbers.",
    showIf: {
      key: "battery_type",
      values: ["lithium_ion", "lithium_metal"],
    },
    options: [
      { value: "in_equipment", label: "Installed inside the product (UN 3481)" },
      { value: "with_equipment", label: "Packed separately in the same box as the product (UN 3481)" },
      { value: "standalone_loose", label: "Standalone — no accompanying product (UN 3480)" },
      { value: "unknown", label: "I don't know" },
    ],
  },
  {
    key: "battery_wh",
    module: "batteries",
    question: "Approximate watt-hour (Wh) rating per cell or battery pack?",
    helpText: "Wh rating determines quantity limits per package under IATA DGR.",
    showIf: {
      key: "battery_type",
      values: ["lithium_ion", "lithium_metal"],
    },
    options: [
      { value: "under_2wh", label: "Under 2 Wh per cell" },
      { value: "2_to_20wh", label: "2 – 20 Wh per cell" },
      { value: "20_to_100wh", label: "20 – 100 Wh per cell" },
      { value: "over_100wh", label: "Over 100 Wh per cell" },
      { value: "over_300wh_pack", label: "Over 300 Wh per battery pack" },
      { value: "unknown", label: "I don't know" },
    ],
  },

  // ── CHILDREN'S ─────────────────────────────────────────────────────────────
  {
    key: "age_range",
    module: "childrens",
    question: "What is the intended age range for this product?",
    helpText: "CPSIA third-party testing applies to products for children 12 and under.",
    options: [
      { value: "under_3", label: "Under 3 years" },
      { value: "age_3_to_12", label: "Ages 3 – 12" },
      { value: "over_12", label: "Ages 13 and up" },
      { value: "unknown", label: "I don't know / not age-specific" },
    ],
  },
  {
    key: "contains_paint_or_surface_coating",
    module: "childrens",
    question: "Does this product have any paint, surface coating, or dye applied?",
    helpText: "CPSIA limits lead in surface coatings to 90 ppm for children's products.",
    options: [
      { value: "yes", label: "Yes — painted, coated, or dyed" },
      { value: "no", label: "No paint or coating" },
      { value: "unknown", label: "I don't know" },
    ],
  },

  // ── TEXTILES ───────────────────────────────────────────────────────────────
  // No clarification questions needed — FTC labeling applies by detection alone.

  // ── COSMETICS ──────────────────────────────────────────────────────────────
  {
    key: "contains_otc_ingredient",
    module: "cosmetics",
    question: "Does this product contain any active drug ingredients?",
    helpText: "Sunscreen UV filters, benzoyl peroxide (acne), zinc pyrithione (antidandruff) make a cosmetic an OTC drug regulated under a separate FDA monograph.",
    options: [
      { value: "yes_sunscreen", label: "Yes — sunscreen (SPF active ingredients)" },
      { value: "yes_acne", label: "Yes — acne treatment (benzoyl peroxide, salicylic acid)" },
      { value: "yes_antidandruff", label: "Yes — antidandruff (zinc pyrithione, selenium sulfide)" },
      { value: "yes_other_drug", label: "Yes — other OTC drug ingredient" },
      { value: "no", label: "No active drug ingredients — cosmetic only" },
      { value: "unknown", label: "I don't know" },
    ],
  },

  // ── FOOD ───────────────────────────────────────────────────────────────────
  {
    key: "is_meat_or_poultry",
    module: "food",
    question: "Is this product meat, poultry, or an egg product?",
    helpText: "Meat, poultry, and egg products are regulated by USDA/FSIS, not FDA. They require FSIS re-inspection at a USDA-approved port.",
    options: [
      { value: "yes_meat", label: "Yes — red meat or game" },
      { value: "yes_poultry", label: "Yes — chicken, turkey, duck, or other poultry" },
      { value: "yes_egg", label: "Yes — processed egg products" },
      { value: "no", label: "No — other food or beverage" },
      { value: "unknown", label: "I don't know" },
    ],
  },

  // ── MEDICAL DEVICES ────────────────────────────────────────────────────────
  {
    key: "fda_device_class",
    module: "medical_devices",
    question: "What is the FDA device classification for this product?",
    helpText: "Class I = general controls only; Class II = 510(k) clearance required; Class III = PMA approval required.",
    options: [
      { value: "class_1", label: "Class I — general controls only (most exempt)" },
      { value: "class_2", label: "Class II — 510(k) premarket notification required" },
      { value: "class_3", label: "Class III — PMA premarket approval required" },
      { value: "unknown", label: "I don't know" },
    ],
  },

  // ── CHEMICALS ──────────────────────────────────────────────────────────────
  {
    key: "is_pesticide_or_disinfectant",
    module: "chemicals",
    question: "Does this product make pesticidal or antimicrobial claims?",
    helpText: "Any claim to kill, repel, or control insects, bacteria, viruses, fungi, or weeds triggers EPA FIFRA registration.",
    options: [
      { value: "yes", label: "Yes — kills or controls pests, bacteria, viruses, or weeds" },
      { value: "no", label: "No pesticidal or antimicrobial claims" },
      { value: "unknown", label: "I don't know" },
    ],
  },
  {
    key: "contains_hazmat",
    module: "chemicals",
    question: "Does this product contain hazardous materials?",
    helpText: "Flammable, corrosive, toxic, or oxidizing substances require DOT hazmat classification and shipping documentation.",
    options: [
      { value: "yes", label: "Yes — flammable, corrosive, toxic, or oxidizing" },
      { value: "no", label: "No hazardous materials" },
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
      { value: "yes", label: "Yes — contains particleboard, MDF, or hardwood plywood" },
      { value: "no", label: "No composite wood — solid wood, metal, or plastic only" },
      { value: "unknown", label: "I don't know" },
    ],
  },
  {
    key: "has_upholstery",
    module: "furniture",
    question: "Does this product include upholstery or foam padding?",
    options: [
      { value: "yes", label: "Yes — fabric, leather, or foam upholstery" },
      { value: "no", label: "No upholstery" },
      { value: "unknown", label: "I don't know" },
    ],
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the ordered list of clarification questions relevant to the given
 * product. Call after the user fills in product name, HTS code, and description.
 *
 * Questions with a `showIf` condition are always included in the result —
 * the form is responsible for hiding/showing them based on prior answers.
 */
export function getQuestionsForProduct(
  htsDigits: string,
  productText: string,
  attrs: ProductAttrs = {},
): ProductQuestion[] {
  const modules = detectModules(htsDigits, productText, attrs);
  return QUESTION_BANK.filter((q) => modules.has(q.module));
}

/**
 * Maps collected question answers to the boolean product attribute flags
 * the backend needs in the watchlist entry.
 */
export function answersToAttrs(answers: Record<string, string>): ProductAttrs {
  const attrs: ProductAttrs = {};

  // Electronics → is_electronic
  if (answers.has_wireless_tx || answers.product_function) {
    attrs.is_electronic = true;
  }

  // Batteries → has_battery
  if (
    answers.battery_type &&
    answers.battery_type !== "other_chemistry"
  ) {
    attrs.has_battery = true;
  }

  // Children's → is_children
  if (
    answers.age_range === "under_3" ||
    answers.age_range === "age_3_to_12"
  ) {
    attrs.is_children = true;
  }

  // Cosmetics → is_cosmetic
  if (answers.contains_otc_ingredient !== undefined) {
    attrs.is_cosmetic = true;
  }

  // Food → is_food_contact / is_supplement
  if (answers.is_meat_or_poultry !== undefined) {
    attrs.is_food_contact = true;
  }

  return attrs;
}
