import type { ProductAttributes } from "./api";
import type { DictKey } from "./i18n";

export interface InferredAttribute {
  key: keyof ProductAttributes;
  labelKey: DictKey;
}

const INFERENCE_RULES: Array<{
  key: keyof ProductAttributes;
  labelKey: DictKey;
  keywords: string[];
}> = [
  { key: "is_food_contact", labelKey: "attr_food_contact",
    keywords: ["water bottle", "bottle", "tumbler", "flask", "thermos", "mug", "cup",
      "drinkware", "drinking", "food", "plate", "bowl", "cutlery", "utensil",
      "straw", "lunchbox", "lunch box", "kettle", "sippy"] },
  { key: "is_children", labelKey: "attr_children",
    keywords: ["kids", "kid", "child", "children", "toddler", "baby", "infant",
      "nursery", "toy"] },
  { key: "has_battery", labelKey: "attr_battery",
    keywords: ["battery", "rechargeable", "li-ion", "lithium", "power bank", "cordless"] },
  { key: "is_electronic", labelKey: "attr_electronic",
    keywords: ["bluetooth", "wifi", "wi-fi", "usb", "charger", "speaker", "earbud",
      "headphone", "camera", "sensor", "electronic"] },
  { key: "is_textile", labelKey: "attr_textile",
    keywords: ["shirt", "apparel", "clothing", "fabric", "textile", "cotton",
      "polyester", "garment", "sock", "hoodie", "jacket", "dress", "towel"] },
  { key: "is_cosmetic", labelKey: "attr_cosmetic",
    keywords: ["cosmetic", "cream", "lotion", "serum", "makeup", "lipstick",
      "shampoo", "skincare", "beauty", "fragrance", "perfume"] },
  { key: "is_supplement", labelKey: "attr_supplement",
    keywords: ["supplement", "vitamin", "protein", "probiotic", "capsule", "gummies"] },
];

const INFERENCE_NEGATIVES: Array<{
  key: keyof ProductAttributes;
  patterns: RegExp[];
}> = [
  { key: "has_battery", patterns: [
    /no\s+battery/i,
    /no[^.]*\bbattery\b/i,
    /does\s+not\s+contain\s+a?\s*battery/i,
    /without\s+(?:a\s+)?battery/i,
    /battery\s*[-]?\s*free/i,
  ]},
  { key: "is_electronic", patterns: [
    /no\s+electronics/i,
    /no[^.]*\belectronics\b/i,
    /non[-\s]electronic/i,
    /not\s+(?:an?\s+)?electronic/i,
    /does\s+not\s+contain\s+electronics/i,
  ]},
  { key: "is_food_contact", patterns: [
    /no\s+food[-\s]contact/i,
    /no[^.]*food[-\s]contact/i,
    /does\s+not\s+touch\s+food/i,
    /not\s+for\s+food/i,
    /no\s+food\s+or\s+drink/i,
  ]},
];

export function inferAttributes(
  name: string,
  description: string,
): InferredAttribute[] {
  const text = `${name} ${description}`.toLowerCase();

  const negated = new Set(
    INFERENCE_NEGATIVES
      .filter((n) => n.patterns.some((re) => re.test(text)))
      .map((n) => n.key),
  );

  return INFERENCE_RULES
    .filter((rule) => !negated.has(rule.key))
    .filter((rule) => rule.keywords.some((kw) => text.includes(kw)))
    .map(({ key, labelKey }) => ({ key, labelKey }));
}
