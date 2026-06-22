-- ── 008 — Seed curated standing regulatory baselines ──────────────────────────
--
-- Each row's citation, title, agency and official URL are taken from official
-- sources (eCFR / the responsible agency). The applicability conditions are
-- ClearPort's curated mapping (no official product->rule map exists). Anthropic
-- never creates these; it only explains them.
--
-- applicability_certainty:
--   'definite'            -> "Verified applicable" when conditions are met
--   'needs_confirmation'  -> "Official requirement — applicability needs confirmation"
--
-- Re-runnable: clears prior seed rows by key before inserting.

DELETE FROM regulatory_baselines WHERE key IN (
  'cpsia_childrens_product', 'lithium_battery_transport', 'fda_food_contact',
  'fcc_part15_rf', 'fda_cosmetics_mocra', 'fda_dietary_supplement_cgmp', 'ftc_textile_labeling'
);

INSERT INTO regulatory_baselines
  (key, category, agency, title, cfr_citation, official_url, effective_or_revision, applicability, applicability_certainty, level, explanation, action)
VALUES
  (
    'cpsia_childrens_product', 'Children''s Product Safety (CPSIA)', 'CPSC',
    'Consumer Product Safety Improvement Act — Children''s Product Certificate & third-party testing',
    '15 U.S.C. 2063; 16 CFR Part 1110',
    'https://www.cpsc.gov/Business--Manufacturing/Testing-Certification/Childrens-Products',
    'Current eCFR revision',
    '{"all_of": ["is_children"]}', 'definite', 'Critical',
    'Products designed or intended primarily for children 12 and under are "children''s products" under the CPSIA and require a Children''s Product Certificate backed by testing at a CPSC-accepted laboratory before they can be sold in the U.S.',
    'Obtain third-party test reports from a CPSC-accepted lab and issue a Children''s Product Certificate before importing.'
  ),
  (
    'lithium_battery_transport', 'Lithium Battery Transport (UN 38.3 / DOT)', 'DOT/PHMSA',
    'Hazardous Materials Regulations — lithium cells and batteries; UN Manual of Tests and Criteria, Section 38.3',
    '49 CFR 173.185',
    'https://www.phmsa.dot.gov/lithiumbatteries',
    'Current eCFR revision',
    '{"all_of": ["has_battery"]}', 'definite', 'High',
    'Products containing lithium cells or batteries are regulated for transport by DOT/PHMSA and must have UN 38.3 test summaries; carriers will require this documentation. (This is a transport/hazmat requirement under DOT/PHMSA and the UN — not a CPSC rule.)',
    'Request the UN 38.3 test summary from your supplier and confirm packaging/marking with your freight forwarder before shipping.'
  ),
  (
    'fda_food_contact', 'Food-Contact Materials (FDA)', 'FDA',
    'Indirect food additives / food-contact substances',
    '21 CFR Parts 174–178',
    'https://www.fda.gov/food/food-ingredients-packaging/food-contact-substances-fcs',
    'Current eCFR revision',
    '{"all_of": ["is_food_contact"]}', 'definite', 'High',
    'Materials intended to contact food or drink must comply with FDA food-contact regulations (the substance must be authorized for that use). Which specific part applies depends on the material.',
    'Obtain an FDA food-contact compliance statement from your supplier identifying the authorizing regulation for each food-contact material.'
  ),
  (
    'fcc_part15_rf', 'Radio-Frequency / Electronic Emissions (FCC)', 'FCC',
    'Radio frequency devices — equipment authorization',
    '47 CFR Part 15',
    'https://www.fcc.gov/general/equipment-authorization-procedures',
    'Current eCFR revision',
    '{"all_of": ["is_electronic"]}', 'needs_confirmation', 'Medium',
    'Electronic devices that emit radio-frequency energy (intentionally or unintentionally, including most digital electronics) are subject to FCC equipment-authorization rules under Part 15. Whether your specific device requires certification, a Supplier''s Declaration of Conformity, or is exempt depends on its design.',
    'Confirm with your supplier which FCC authorization path (Certification vs. SDoC vs. exemption) applies to this device.'
  ),
  (
    'fda_cosmetics_mocra', 'Cosmetics (FDA / MoCRA)', 'FDA',
    'Cosmetics regulation under the FD&C Act and the Modernization of Cosmetics Regulation Act',
    '21 CFR Parts 700–740',
    'https://www.fda.gov/cosmetics',
    'Current eCFR revision',
    '{"all_of": ["is_cosmetic"]}', 'needs_confirmation', 'Medium',
    'Cosmetic and personal-care products are regulated by the FDA, including facility registration and product listing under MoCRA and labeling/safety requirements. Specific obligations depend on the product and ingredients.',
    'Confirm MoCRA facility registration / product listing obligations and ingredient/labeling compliance with your supplier or a regulatory consultant.'
  ),
  (
    'fda_dietary_supplement_cgmp', 'Dietary Supplements (FDA)', 'FDA',
    'Current Good Manufacturing Practice for dietary supplements',
    '21 CFR Part 111',
    'https://www.fda.gov/food/dietary-supplements',
    'Current eCFR revision',
    '{"all_of": ["is_supplement"]}', 'needs_confirmation', 'High',
    'Dietary supplements are regulated by the FDA, including cGMP requirements and labeling rules. Applicability and specific obligations depend on whether the product is a dietary supplement, food, or drug-adjacent.',
    'Confirm the product''s FDA category and cGMP/labeling compliance before importing.'
  ),
  (
    'ftc_textile_labeling', 'Textile Labeling (FTC)', 'FTC',
    'Rules under the Textile Fiber Products Identification Act',
    '16 CFR Part 303',
    'https://www.ftc.gov/business-guidance/resources/threading-your-way-through-labeling-requirements-under-textile-wool-acts',
    'Current eCFR revision',
    '{"all_of": ["is_textile"]}', 'definite', 'Medium',
    'Textile and apparel products must be labeled with fiber content, country of origin, and the manufacturer/importer identity under the FTC''s Textile Fiber Products Identification Act rules.',
    'Ensure your supplier provides fiber-content, country-of-origin, and RN/identity labeling that meets 16 CFR Part 303.'
  );
