/**
 * Category detector — determines which regulatory modules are relevant for a
 * given product from its HTS code (digit-only), free-text description, and
 * boolean product-attribute flags.
 *
 * This is a pure function used by:
 *   1. The backend (baselines.ts) to decide which modules to evaluate.
 *   2. The frontend question engine to decide which clarification questions to show.
 *
 * Detection is intentionally conservative: a module is activated only when
 * there is a strong, specific signal.  False-positives produce unnecessary
 * questions and documents; false-negatives silently omit requirements.
 *
 * Last verified: 2025-08-01.
 */

export type CategoryId =
  | 'automotive'
  | 'electronics'
  | 'batteries'
  | 'childrens'
  | 'textiles'
  | 'cosmetics'
  | 'food'
  | 'medical_devices'
  | 'chemicals'
  | 'furniture';

export interface ProductBooleans {
  is_children?: boolean;
  has_battery?: boolean;
  is_electronic?: boolean;
  is_textile?: boolean;
  is_cosmetic?: boolean;
  is_food_contact?: boolean;
  is_supplement?: boolean;
}

/**
 * Returns the set of category modules that are relevant for the given product.
 *
 * @param htsDigits  Digit-only HTS code, e.g. "8708305020" or "" when unknown
 * @param productText  Concatenated product name + description (may be empty)
 * @param attrs  Boolean product attribute flags
 */
export function detectCategories(
  htsDigits: string,
  productText: string,
  attrs: ProductBooleans = {},
): Set<CategoryId> {
  const active = new Set<CategoryId>();
  const h = htsDigits;
  const txt = productText.toLowerCase();

  // ── Automotive ─────────────────────────────────────────────────────────────
  // HTS chapters 87 (motor vehicles and parts), specific engine/drivetrain HTS
  if (
    (h.length >= 4 && [
      '8701','8702','8703','8704','8705','8706','8707','8708',
      '8711','8712','8713','8714','8715','8716',
      '8407','8408','8409','8483',
    ].some((p) => h.startsWith(p))) ||
    /\b(brake|bumper|axle|suspension|driveshaft|crankshaft|camshaft|piston|transmission|clutch|differential|motor\s*vehicle|automotive|automobile|passenger\s*vehicle|truck\s*part|vehicle\s*part|wheel\s*hub|steering|muffler|exhaust|radiator|shock\s*absorber|spark\s*plug|fuel\s*injector|catalytic\s*converter)\b/.test(txt)
  ) {
    active.add('automotive');
  }

  // ── Electronics / wireless devices ─────────────────────────────────────────
  // FCC Part 15 unintentional radiators + FCC ID intentional transmitters
  if (
    attrs.is_electronic ||
    (h.length >= 4 && [
      '8471','8472','8517','8518','8519','8520','8521','8522','8523',
      '8524','8525','8526','8527','8528','8529','8530','8531','8532',
      '8533','8534','8535','8536','8537','8538','8539','8540','8541',
      '8542','8543','8544','8545','8546','8547','8548',
      '9009','9013',
    ].some((p) => h.startsWith(p))) ||
    /\b(electronic|wireless|bluetooth|wi-?fi|radio|transmitter|receiver|antenna|modem|router|speaker|headphone|earphone|microphone|amplifier|television|monitor|display|computer|laptop|tablet|phone|charger|power\s*supply|LED|printed\s*circuit|circuit\s*board|PCB|semiconductor)\b/.test(txt)
  ) {
    active.add('electronics');
  }

  // ── Batteries ───────────────────────────────────────────────────────────────
  // HTS 8506 (primary cells) + 8507 (accumulators) + has_battery flag + text
  if (
    attrs.has_battery ||
    (h.length >= 4 && ['8506','8507'].some((p) => h.startsWith(p))) ||
    /\b(lithium|li-ion|li-?poly|battery|batteries|accumulator|rechargeable\s*cell|lead[- ]?acid|nickel[- ]?metal|NiMH)\b/.test(txt)
  ) {
    active.add('batteries');
  }

  // ── Children's products ─────────────────────────────────────────────────────
  // HTS chapter 95 (toys/games/sporting goods) + is_children flag + text
  if (
    attrs.is_children ||
    (h.length >= 4 && ['9501','9502','9503','9504','9505','9506','9507','9508'].some((p) => h.startsWith(p))) ||
    /\b(toy|toys|doll|game|puzzle|children|child|kids|infant|toddler|juvenile|baby|nursery|playpen|stroller|crib)\b/.test(txt)
  ) {
    active.add('childrens');
  }

  // ── Textiles, apparel and footwear ─────────────────────────────────────────
  // HTS chapters 50-63 (textiles/apparel) + 64 (footwear)
  if (
    attrs.is_textile ||
    (h.length >= 2 && (() => {
      const prefix2 = parseInt(h.slice(0, 2), 10);
      return (prefix2 >= 50 && prefix2 <= 63) || prefix2 === 64;
    })()) ||
    /\b(fabric|textile|apparel|garment|clothing|shirt|pants|dress|suit|jacket|coat|sweater|hat|cap|glove|sock|underwear|footwear|shoe|boot|sandal|fiber|yarn|knit|woven|cotton|wool|silk|polyester|nylon|linen|denim)\b/.test(txt)
  ) {
    active.add('textiles');
  }

  // ── Cosmetics and personal care ─────────────────────────────────────────────
  // HTS 3303-3307, 3401 + is_cosmetic flag + text
  if (
    attrs.is_cosmetic ||
    (h.length >= 4 && ['3303','3304','3305','3306','3307','3401'].some((p) => h.startsWith(p))) ||
    /\b(cosmetic|skincare|moisturizer|lotion|cream|serum|toner|sunscreen|SPF|foundation|lipstick|mascara|eyeliner|blush|concealer|shampoo|conditioner|hair\s*dye|hair\s*color|nail\s*polish|perfume|cologne|deodorant|antiperspirant|body\s*wash|soap|face\s*wash)\b/.test(txt)
  ) {
    active.add('cosmetics');
  }

  // ── Food and beverages ──────────────────────────────────────────────────────
  // HTS chapters 1-24 (food chapters) + is_food_contact + is_supplement + text
  if (
    attrs.is_food_contact ||
    attrs.is_supplement ||
    (h.length >= 2 && (() => {
      const prefix2 = parseInt(h.slice(0, 2), 10);
      return prefix2 >= 1 && prefix2 <= 24;
    })()) ||
    /\b(food|beverage|drink|edible|snack|meat|fish|seafood|poultry|dairy|cheese|milk|egg|fruit|vegetable|grain|cereal|bread|bakery|confectionery|candy|chocolate|juice|beer|wine|spirits|supplement|vitamin|mineral|protein\s*powder)\b/.test(txt)
  ) {
    active.add('food');
  }

  // ── Medical devices ─────────────────────────────────────────────────────────
  // HTS 9018-9022 + is_supplement (adjacent products) + text
  if (
    (h.length >= 4 && ['9018','9019','9020','9021','9022'].some((p) => h.startsWith(p))) ||
    /\b(medical\s*device|surgical|diagnostic|therapeutic|implant|prosthetic|orthopedic|hearing\s*aid|blood\s*pressure|glucose\s*monitor|pulse\s*oximeter|stethoscope|syringe|catheter|scalpel|bandage|wound\s*care|contact\s*lens|dental\s*implant|pacemaker)\b/.test(txt)
  ) {
    active.add('medical_devices');
  }

  // ── Chemicals, cleaners and paints ──────────────────────────────────────────
  // HTS chapters 28-38 (inorganic/organic chemicals, misc chemical products)
  // plus specific text triggers for disinfectants/pesticides (EPA FIFRA)
  if (
    (h.length >= 4 && [
      '2801','2802','2803','2804','2805','2806','2807','2808','2809','2810',
      '2811','2812','2813','2814','2815','2816','2817','2818','2819','2820',
      '3208','3209','3210','3211','3212','3213','3214',
      '3401','3402','3403','3404','3405','3406','3407',
      '3701','3702','3703','3704','3705','3706','3707',
      '3808','3809','3810','3811','3812','3813','3814','3815','3816','3817',
      '3818','3819','3820','3821','3822','3823','3824','3825','3826','3827',
    ].some((p) => h.startsWith(p))) ||
    /\b(chemical|disinfectant|pesticide|herbicide|insecticide|fungicide|cleaner|detergent|solvent|paint|varnish|lacquer|coating|lubricant|grease|adhesive|sealant|caulk|epoxy|bleach|acid|alkali|corrosive|flammable\s*liquid|aerosol)\b/.test(txt)
  ) {
    active.add('chemicals');
  }

  // ── Furniture, wood and general consumer goods ──────────────────────────────
  // HTS 9401-9406, 4410-4412 (composite wood) + text
  if (
    (h.length >= 4 && ['9401','9402','9403','9404','9405','9406','4410','4411','4412'].some((p) => h.startsWith(p))) ||
    /\b(furniture|chair|sofa|couch|table|desk|cabinet|shelf|bookcase|wardrobe|dresser|bed\s*frame|mattress|pillow|cushion|composite\s*wood|particleboard|MDF|fiberboard|plywood|laminate\s*flooring)\b/.test(txt)
  ) {
    active.add('furniture');
  }

  return active;
}
