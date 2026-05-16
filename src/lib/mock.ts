export type Alert = {
  id: string;
  title: string;
  source: string;
  publicationDate: string;
  effectiveDate: string;
  originCountries: string[];
  destinationCountry: string;
  categories: string[];
  htsCodes: string[];
  relevance: "Possible match" | "Likely match" | "Direct HTS match";
  summary: string;
  whyMatters: string;
  brokerQuestions: string[];
  sourceUrl: string;
  sourceExcerpt: string;
};

export const alerts: Alert[] = [
  {
    id: "ustr-301-exclusions-2026-05",
    title: "USTR updates Section 301 tariff exclusion status for selected China-origin products",
    source: "USTR / Federal Register",
    publicationDate: "2026-05-12",
    effectiveDate: "2026-06-01",
    originCountries: ["China"],
    destinationCountry: "United States",
    categories: ["Electronics", "Home goods", "Fitness accessories"],
    htsCodes: ["8512.20.40", "9506.91.00", "8543.70.99"],
    relevance: "Direct HTS match",
    summary:
      "Certain tariff exclusions for China-origin products have been extended, modified, or allowed to expire. Importers using affected HTS codes should verify whether their products remain eligible for exclusion treatment.",
    whyMatters:
      "If your product uses one of the affected HTS codes, your landed cost or filing process may change.",
    brokerQuestions: [
      "Does your saved HTS code appear in the notice?",
      "Is your product description covered by the exclusion?",
      "What is the effective date for your shipments in transit?",
      "Does your entry require special filing treatment?",
      "Does your supplier invoice include the required product description?",
    ],
    sourceUrl: "https://ustr.gov/",
    sourceExcerpt:
      "The U.S. Trade Representative is modifying the exclusion process by extending certain exclusions and allowing others to lapse on the effective date listed in the annex...",
  },
  {
    id: "cbp-csms-textile-labeling",
    title: "CBP CSMS reminder: textile and apparel labeling requirements for imported goods",
    source: "CBP CSMS",
    publicationDate: "2026-05-09",
    effectiveDate: "2026-05-09",
    originCountries: ["China", "Vietnam", "Bangladesh"],
    destinationCountry: "United States",
    categories: ["Textiles / apparel"],
    htsCodes: ["6109.10.00", "6204.62.80"],
    relevance: "Likely match",
    summary:
      "CBP reminds importers of country-of-origin marking and fiber content labeling requirements for textile and apparel imports. Non-compliant shipments may be subject to redelivery or marking notices.",
    whyMatters:
      "Apparel importers should confirm labels meet fiber content, care, and origin requirements before shipping.",
    brokerQuestions: [
      "Are our care labels permanently affixed and legible?",
      "Does the country of origin appear on the label in English?",
      "Are fiber percentages correctly disclosed?",
    ],
    sourceUrl: "https://www.cbp.gov/trade/automated/cargo-systems-messaging-service",
    sourceExcerpt:
      "All textile and apparel products imported into the United States must comply with applicable marking and labeling requirements under 19 CFR Part 134 and the Textile Fiber Products Identification Act...",
  },
  {
    id: "usitc-hts-2026-revision-3",
    title: "USITC publishes HTS Revision 3 affecting consumer electronics classification",
    source: "USITC",
    publicationDate: "2026-05-05",
    effectiveDate: "2026-07-01",
    originCountries: ["China", "All"],
    destinationCountry: "United States",
    categories: ["Electronics"],
    htsCodes: ["8517.62.00", "8528.72.64"],
    relevance: "Possible match",
    summary:
      "Revision 3 of the 2026 HTS introduces new statistical breakouts for selected consumer electronics. Importers should review whether their products fall under a new 10-digit subheading.",
    whyMatters:
      "Mis-classification may lead to incorrect duty rates and entry rejections after the effective date.",
    brokerQuestions: [
      "Does the new statistical breakout change our reported HTS?",
      "Is the duty rate identical at the 8-digit level?",
      "Do we need to update product master data in our broker's system?",
    ],
    sourceUrl: "https://hts.usitc.gov/",
    sourceExcerpt:
      "Revision 3 incorporates changes proclaimed by the President and modifications recommended by the Committee for the Implementation of Textile Agreements...",
  },
  {
    id: "cbp-bulletin-fcm-coatings",
    title: "Customs Bulletin: food-contact coating classification ruling revoked",
    source: "Customs Bulletin and Decisions",
    publicationDate: "2026-04-28",
    effectiveDate: "2026-06-27",
    originCountries: ["China"],
    destinationCountry: "United States",
    categories: ["Kitchenware", "Food-contact products"],
    htsCodes: ["7323.93.00"],
    relevance: "Likely match",
    summary:
      "CBP is revoking a prior ruling letter concerning the classification of certain coated stainless steel cookware. Affected importers should re-evaluate classification.",
    whyMatters:
      "The revocation may change the applicable duty rate and 301 treatment for similar cookware.",
    brokerQuestions: [
      "Does our cookware fall within the revoked ruling's scope?",
      "What is the corrected HTS classification?",
      "Are entries within the 60-day window subject to reliquidation?",
    ],
    sourceUrl: "https://www.cbp.gov/trade/rulings",
    sourceExcerpt:
      "Pursuant to 19 U.S.C. 1625(c), CBP is revoking NY Ruling N123456 concerning coated stainless steel cookware...",
  },
  {
    id: "cbp-csms-china-forced-labor",
    title: "CBP CSMS: enhanced documentation requirements for selected China-origin commodities",
    source: "CBP CSMS",
    publicationDate: "2026-04-22",
    effectiveDate: "2026-05-15",
    originCountries: ["China"],
    destinationCountry: "United States",
    categories: ["Textiles / apparel", "Electronics", "Other consumer goods"],
    htsCodes: [],
    relevance: "Possible match",
    summary:
      "CBP outlines additional documentation expected at entry for shipments containing inputs from specific regions. Importers should prepare supply chain tracing documentation.",
    whyMatters:
      "Lack of tracing documentation may result in detention or denial of entry under UFLPA.",
    brokerQuestions: [
      "Do we have supplier declarations covering raw material origin?",
      "Is our supply chain map current?",
      "Are isotopic or DNA test reports available if requested?",
    ],
    sourceUrl: "https://www.cbp.gov/trade/automated/cargo-systems-messaging-service",
    sourceExcerpt:
      "Importers are reminded that shipments containing inputs from regions designated under the UFLPA require admissibility documentation demonstrating the goods were not produced with forced labor...",
  },
];

export const sources = [
  {
    name: "CBP CSMS messages",
    type: "Customs operational messages",
    lastChecked: "2 hours ago",
    frequency: "Hourly",
  },
  {
    name: "CBP Federal Register notices",
    type: "Rulemaking and notices",
    lastChecked: "5 hours ago",
    frequency: "Daily",
  },
  {
    name: "Customs Bulletin and Decisions",
    type: "Rulings and revocations",
    lastChecked: "Today",
    frequency: "Weekly",
  },
  {
    name: "USTR Section 301 actions",
    type: "Tariff actions and exclusions",
    lastChecked: "3 hours ago",
    frequency: "Daily",
  },
  {
    name: "USITC HTS updates",
    type: "Tariff schedule revisions",
    lastChecked: "Today",
    frequency: "On publication",
  },
  {
    name: "Official tariff change records",
    type: "Proclamations and modifications",
    lastChecked: "1 day ago",
    frequency: "On publication",
  },
];

export const savedProducts = [
  {
    id: "p1",
    name: "Bluetooth speaker — Model BX-200",
    category: "Electronics",
    hts: "8518.22.00",
    origin: "China",
    destination: "United States",
    supplier: "Shenzhen AudioCo",
    channel: "Amazon",
    relatedAlerts: 3,
  },
  {
    id: "p2",
    name: "Organic cotton t-shirt",
    category: "Textiles / apparel",
    hts: "6109.10.00",
    origin: "China",
    destination: "United States",
    supplier: "Guangzhou Textiles Ltd.",
    channel: "Shopify",
    relatedAlerts: 2,
  },
  {
    id: "p3",
    name: "Stainless steel cookware set",
    category: "Kitchenware",
    hts: "7323.93.00",
    origin: "China",
    destination: "United States",
    supplier: "Ningbo Kitchen Co.",
    channel: "Retail",
    relatedAlerts: 1,
  },
];

export const relevanceClass = (r: Alert["relevance"]) =>
  r === "Direct HTS match"
    ? "bg-blue-100 text-blue-800 border-blue-200"
    : r === "Likely match"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : "bg-slate-100 text-slate-700 border-slate-200";