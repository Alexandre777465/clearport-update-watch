import type { ProductAttributes } from "./api";
import type { DictKey } from "./i18n";
import { extractFacts } from "./factEngine";

export interface InferredAttribute {
  key: keyof ProductAttributes;
  labelKey: DictKey;
}

// Map from FactKey → ProductAttributes key + i18n label
const FACT_TO_ATTR: Array<{
  factKey: 'contains_battery' | 'contains_electronics' | 'food_contact' | 'intended_for_children' | 'contains_textile' | 'contains_cosmetic';
  attrKey: keyof ProductAttributes;
  labelKey: DictKey;
}> = [
  { factKey: 'contains_battery',      attrKey: 'has_battery',      labelKey: 'attr_battery' },
  { factKey: 'contains_electronics',  attrKey: 'is_electronic',    labelKey: 'attr_electronic' },
  { factKey: 'food_contact',          attrKey: 'is_food_contact',  labelKey: 'attr_food_contact' },
  { factKey: 'intended_for_children', attrKey: 'is_children',      labelKey: 'attr_children' },
  { factKey: 'contains_textile',      attrKey: 'is_textile',       labelKey: 'attr_textile' },
  { factKey: 'contains_cosmetic',     attrKey: 'is_cosmetic',      labelKey: 'attr_cosmetic' },
];

/**
 * Infers ProductAttribute flags from product name and description using the
 * shared fact engine. Explicit negatives ("no battery") always take precedence
 * over keyword inferences, so a suppressed inference is never re-activated.
 */
export function inferAttributes(
  name: string,
  description: string,
): InferredAttribute[] {
  const text = `${name} ${description}`;
  const facts = extractFacts('', text, {});

  return FACT_TO_ATTR
    .filter(({ factKey }) => facts[factKey].value === 'yes')
    .map(({ attrKey, labelKey }) => ({ key: attrKey, labelKey }));
}
