# ClearPort — Official Source Coverage Matrix (Stage 2)

This matrix maps every claim type ClearPort can produce to its responsible
authority and official source. It is the contract for what may be asserted:
a claim type with coverage **None** must never appear as a verified or
official-unconfirmed finding — only as "No verified source found."

Legend — **Coverage**: `Verified` = wired to a structured baseline / live feed
that backs the claim; `Sourced-event` = covered by the Federal Register event
feed but not as a standing baseline; `Detect-only` = applicability is detected
but the exact rate/rule needs confirmation; `None` = no reliable source wired.

## Customs / Tariffs

| Claim type | Agency | Official source | Endpoint | Machine-readable | Refresh | Applicability fields | Coverage | Limitations |
|---|---|---|---|---|---|---|---|---|
| HTS description + MFN/base duty | USITC | Harmonized Tariff Schedule | `hts.usitc.gov/reststop/exportList?from=&to=&format=JSON` | ✅ JSON | On HTS revision (yearly + intra-year) | `hts_code` | **Verified** | Compound/specific rates stored as text (no clean %); requires correct classification |
| HTS revision history | USITC | HTS published revisions | same API + `hts_baselines` version rows | ✅ JSON | Per revision | `hts_code` | **Verified** (version rows on rate change) | Revision label coarse (year-level) |
| Section 301 actions/rates/exclusions | USTR | USTR 301 + HTS Ch. 99 | HTS API footnotes (`9903.88.xx`) + Federal Register USTR feed | ⚠️ Partial | 6 h (FR) / per revision (HTS) | `hts_code`, origin=China | **Detect-only** | Exact added rate & exclusion status need the 9903 subheading → official_unconfirmed |
| HTS Chapter 99 notes | USITC | HTS Chapter 99 | HTS API | ✅ JSON | Per revision | `hts_code` | **Detect-only** | Footnote reference captured; full note text not parsed |
| Federal Register tariff notices | Federal Register | FR documents API (CBP/USTR/ITC) | `federalregister.gov/api/v1/documents.json` | ✅ JSON | 6 h | `hts_code`, origin, category | **Sourced-event** | Event stream, not a standing rate |
| CBP CROSS rulings / classification | CBP | CROSS ruling database | `rulings.cbp.gov` (no documented public JSON API) | ❌ HTML/search | — | `hts_code`, product description | **None** | No stable machine-readable endpoint; not wired |
| CBP Customs Bulletin & Decisions | CBP | Customs Bulletin (PDF/HTML) | `cbp.gov/trade/rulings/bulletin-decisions` | ❌ PDF/HTML | — | `hts_code` | **None** | PDF-based; not wired |
| AD/CVD investigations & orders | USITC / Commerce | FR + USITC DataWeb / Commerce ACCESS | FR API (wired); USITC AD/CVD list (HTML) | ⚠️ Partial | 6 h (FR) | `hts_code`, product type, origin | **Sourced-event** | Detected via FR notices → official_unconfirmed; no structured order list |
| Section 232 (steel/aluminum) | Commerce / Presidential | Proclamations via Federal Register | FR API | ✅ JSON (events) | 6 h | `hts_code` (Ch. 72/73/76), origin | **None (not yet wired)** | No standing 232 baseline; would need Ch. 99 232 mapping |

## Product Compliance

| Claim type | Agency | Official source | Endpoint | Machine-readable | Refresh | Applicability fields | Coverage | Limitations |
|---|---|---|---|---|---|---|---|---|
| CPSIA children's product cert + testing | CPSC | 15 U.S.C. 2063; 16 CFR 1110 | eCFR API + CPSC site | ✅ eCFR JSON (citation) | Manual / eCFR | `is_children` | **Verified** (definite) | Specific test standards per product not enumerated |
| Lead / phthalates / choking hazard | CPSC | 16 CFR 1303, 1307; ASTM F963 | eCFR API | ✅ eCFR JSON | Manual | `is_children` (+ material/age detail) | **Detect-only** | Exact sub-rule depends on material/age not captured → needs_confirmation |
| FDA food-contact | FDA | 21 CFR 174–178 | eCFR API + FDA FCS | ✅ eCFR JSON | Manual | `is_food_contact` (+ material) | **Verified** (definite) | Authorizing part depends on material |
| FDA cosmetics (MoCRA) | FDA | 21 CFR 700–740; FD&C Act VI | FDA site / eCFR | ✅ eCFR JSON | Manual | `is_cosmetic` | **Detect-only** | Facility/listing specifics need confirmation |
| FDA dietary supplements | FDA | 21 CFR 111 | eCFR API | ✅ eCFR JSON | Manual | `is_supplement` | **Detect-only** | Category (food vs supplement vs drug) needs confirmation |
| FCC equipment authorization / Part 15 | FCC | 47 CFR Part 15 | eCFR API + FCC | ✅ eCFR JSON | Manual | `is_electronic` (+ emits RF?) | **Detect-only** | Cert vs SDoC vs exempt depends on device |
| EPA TSCA / FIFRA | EPA | 40 CFR; TSCA §13; FIFRA | eCFR API + EPA | ✅ eCFR JSON | Manual | chemical / pesticidal attrs (not collected) | **None** | No product attribute maps to TSCA/FIFRA yet |
| DOT/PHMSA lithium battery transport | DOT/PHMSA | 49 CFR 173.185; UN 38.3 | eCFR API + PHMSA | ✅ eCFR JSON | Manual | `has_battery` | **Verified** (definite) | Air vs ocean packing detail not modeled |
| NHTSA / FMVSS | NHTSA | 49 CFR 571 | eCFR API | ✅ eCFR JSON | Manual | motor-vehicle attrs (not collected) | **None** | No vehicle attribute collected |
| FTC textile / labeling | FTC | 16 CFR 303 (Textile Act) | eCFR API + FTC | ✅ eCFR JSON | Manual | `is_textile` | **Verified** (definite) | Wool/fur acts (16 CFR 300/301) not separately modeled |

## Marketplace Policies (only when selected by the user)

| Claim type | Source | Endpoint | Machine-readable | Coverage | Limitations |
|---|---|---|---|---|---|
| Amazon seller compliance | Amazon Seller Central policy | Seller Central (auth/HTML) | ❌ | **None** | Not a government requirement; no official machine-readable source — cards hidden |
| TikTok Shop seller compliance | TikTok Shop policy | Seller portal (auth/HTML) | ❌ | **None** | Same — cards hidden until an official policy source is stored |

## Summary of coverage achieved (as of Stage 3)

- **Verified (standing baseline):** HTS description + MFN duty, HTS revision history,
  CPSIA (children), FDA food-contact, DOT/PHMSA lithium battery, FTC textile.
- **Detect-only (official_unconfirmed):** Section 301 (HTS Ch.99 footnote), FCC Part 15,
  FDA cosmetics, FDA supplements, lead/phthalates.
- **Sourced-event only:** Federal Register CBP/USTR/ITC notices, AD/CVD (via FR).
- **None (must show as "No verified source found"):** CBP CROSS, Customs Bulletin,
  Section 232 baseline, EPA TSCA/FIFRA, NHTSA/FMVSS, Amazon/TikTok policies.
