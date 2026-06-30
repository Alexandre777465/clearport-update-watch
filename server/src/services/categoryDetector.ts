/**
 * Category detector — determines which regulatory modules are relevant for a
 * given product from its HTS code, free-text description, structured answers,
 * and optional legacy boolean attribute flags.
 *
 * Delegates all logic to factEngine.ts. The legacy ProductBooleans parameter is
 * kept for backward compatibility and mapped to inference-level evidence.
 */

import { extractFacts, activateFromFacts, type FactSet, type FactKey, type TriStateFact } from './factEngine';

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
  | 'furniture'
  | 'sports';

export interface ProductBooleans {
  is_children?: boolean;
  has_battery?: boolean;
  is_electronic?: boolean;
  is_textile?: boolean;
  is_cosmetic?: boolean;
  is_food_contact?: boolean;
  is_supplement?: boolean;
}

// Map legacy ProductBooleans to structured answers so they flow through the
// fact engine at inference level (confidence < explicit sources).
function attrsToAnswers(attrs: ProductBooleans): Record<string, string> {
  const out: Record<string, string> = {};
  // Positive attrs activate the module; negative attrs suppress it so text/HTS
  // detection can't override an explicit user denial (e.g. unchecking Electronic).
  if (attrs.has_battery    === true)  out['battery_type']            = 'other_chemistry';
  if (attrs.has_battery    === false) out['battery_type']            = 'no_battery';
  if (attrs.is_electronic  === true)  out['product_function']        = 'other_no_radio';
  if (attrs.is_electronic  === false) out['product_function']        = 'not_electronic';
  if (attrs.is_children    === true)  out['age_range']               = 'age_3_to_12';
  if (attrs.is_children    === false) out['age_range']               = 'not_for_children';
  if (attrs.is_textile     === true)  out['textile_type']            = 'yes_textile';
  if (attrs.is_textile     === false) out['textile_type']            = 'not_textile';
  if (attrs.is_cosmetic    === true)  out['contains_otc_ingredient'] = 'no';
  if (attrs.is_cosmetic    === false) out['contains_otc_ingredient'] = 'not_cosmetic';
  if (attrs.is_food_contact === true) out['food_contact_use']        = 'yes';
  if (attrs.is_food_contact === false) out['food_contact_use']       = 'no';
  if (attrs.is_supplement  === true)  out['is_meat_or_poultry']      = 'no';  // supplement → food module
  return out;
}

/**
 * Returns the set of category modules that are relevant for the given product.
 *
 * @param htsDigits   Digit-only HTS code, e.g. "8708305020" or ""
 * @param productText Concatenated product name + description
 * @param attrs       Optional legacy boolean attribute flags (inference level)
 * @param structuredAnswers  Optional structured question answers (highest precedence)
 */
export function detectCategories(
  htsDigits: string,
  productText: string,
  attrs: ProductBooleans = {},
  structuredAnswers: Record<string, string> = {},
): Set<CategoryId> {
  // Merge legacy attrs (low precedence) with structured answers (high precedence).
  // Structured answers win because extractFacts applies them last at level 1.
  const mergedAnswers = { ...attrsToAnswers(attrs), ...structuredAnswers };
  const facts = extractFacts(htsDigits, productText, mergedAnswers);
  const activeIds = activateFromFacts(facts);
  return new Set(activeIds as CategoryId[]);
}

// Re-export for callers that need the raw fact set
export { extractFacts, activateFromFacts, type FactSet, type FactKey, type TriStateFact };
