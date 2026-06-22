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
  alertType: "Tariff / exclusion" | "Labeling / marking" | "Forced labor" | "HTS update" | "AD/CVD" | "Operational";
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
    alertType: "Tariff / exclusion",
    summary:
      "Certain tariff exclusions for China-origin products have been extended, modified, or allowed to expire. Importers using affected HTS codes should verify whether their products remain eligible for exclusion treatment.",
    whyMatters:
      "If your product uses one of the affected HTS codes, your landed cost or filing process may change.",
    brokerQuestions: [
      "Does our saved HTS code appear in the notice?",
      "Is our product description covered by the exclusion?",
      "What is the effective date for shipments in transit?",
      "Does our entry require special filing treatment?",
      "Does our supplier invoice include the required product description?",
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
    alertType: "Labeling / marking",
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
    alertType: "HTS update",
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
    alertType: "HTS update",
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
    alertType: "Forced labor",
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

// Live source health (from GET /api/public/sources). No mock data — the
// sources page shows only real backend health, or "Status unavailable".
export type SourceHealth =
  | "Active"
  | "Degraded"
  | "Error"
  | "Never checked"
  | "Unavailable";

// Static, factual list of the official sources ClearPort monitors. Used by the
// marketing homepage. Contains NO timestamps or live status (that lives on the
// authenticated /sources page, read from the backend) — only what each source
// is and where to verify it. This is descriptive, not a health claim.
export const officialSources: { name: string; type: string; url: string }[] = [
  {
    name: "Federal Register — CBP",
    type: "Customs rules & notices (official API)",
    url: "https://www.federalregister.gov/agencies/u-s-customs-and-border-protection",
  },
  {
    name: "Federal Register — USTR",
    type: "Section 301 & trade actions (official API)",
    url: "https://www.federalregister.gov/agencies/trade-representative-office-of-united-states",
  },
  {
    name: "Federal Register — USITC",
    type: "Trade Commission notices (official API)",
    url: "https://www.federalregister.gov/agencies/international-trade-commission",
  },
  {
    name: "U.S. Customs and Border Protection",
    type: "CBP newsroom RSS",
    url: "https://www.cbp.gov/newsroom",
  },
  {
    name: "USITC Harmonized Tariff Schedule",
    type: "HTS classifications & duty rates",
    url: "https://hts.usitc.gov/",
  },
  {
    name: "USTR Section 301",
    type: "Tariff actions & exclusions",
    url: "https://ustr.gov/issue-areas/enforcement/section-301-investigations",
  },
];

export type SourceStatus = {
  name: string;
  type: string;
  lastChecked: string;        // real relative time, or "Never"
  lastSuccessfulSync: string; // real relative time, or "Never"
  frequency: string;          // real interval derived from check_interval_minutes
  status: SourceHealth;
  error?: string | null;
  url: string;
};


export type SavedProduct = {
  id: string;
  name: string;
  category: string;
  description: string;
  material: string;
  intendedUse: string;
  hts: string;
  origin: string;
  destination: string;
  supplier: string;
  supplierCountry: string;
  channel: string;
  alertFrequency: "Instant" | "Daily" | "Weekly";
  relatedAlerts: number;
  lastAlertDate: string;
  upcomingEffective: string | null;
  lastMatchedSource: string;
};

export const savedProducts: SavedProduct[] = [
  {
    id: "p1",
    name: "Bluetooth speaker — Model BX-200",
    category: "Electronics",
    description: "Portable Bluetooth 5.2 speaker with rechargeable Li-ion battery and USB-C charging.",
    material: "ABS plastic housing, aluminum grille",
    intendedUse: "Consumer audio playback",
    hts: "8518.22.00",
    origin: "China",
    destination: "United States",
    supplier: "Shenzhen AudioCo",
    supplierCountry: "China",
    channel: "Amazon",
    alertFrequency: "Instant",
    relatedAlerts: 3,
    lastAlertDate: "2026-05-12",
    upcomingEffective: "2026-06-01",
    lastMatchedSource: "USTR / Federal Register",
  },
  {
    id: "p2",
    name: "Organic cotton t-shirt",
    category: "Textiles / apparel",
    description: "Crew-neck short-sleeve t-shirt, unisex sizing.",
    material: "100% organic cotton, woven labels",
    intendedUse: "Apparel",
    hts: "6109.10.00",
    origin: "China",
    destination: "United States",
    supplier: "Guangzhou Textiles Ltd.",
    supplierCountry: "China",
    channel: "Shopify",
    alertFrequency: "Daily",
    relatedAlerts: 2,
    lastAlertDate: "2026-05-09",
    upcomingEffective: null,
    lastMatchedSource: "CBP CSMS",
  },
  {
    id: "p3",
    name: "Stainless steel cookware set",
    category: "Kitchenware",
    description: "5-piece coated stainless steel cookware set for residential use.",
    material: "Stainless steel with non-stick coating",
    intendedUse: "Food preparation (food-contact)",
    hts: "7323.93.00",
    origin: "China",
    destination: "United States",
    supplier: "Ningbo Kitchen Co.",
    supplierCountry: "China",
    channel: "Retail",
    alertFrequency: "Weekly",
    relatedAlerts: 1,
    lastAlertDate: "2026-04-28",
    upcomingEffective: "2026-06-27",
    lastMatchedSource: "Customs Bulletin and Decisions",
  },
];

export const relevanceClass = (r: Alert["relevance"]) =>
  r === "Direct HTS match"
    ? "bg-blue-100 text-blue-800 border-blue-200"
    : r === "Likely match"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : "bg-slate-100 text-slate-700 border-slate-200";

export function whyYouSeeThis(alert: Alert): string {
  const matchedProduct = savedProducts.find(
    (p) => alert.htsCodes.includes(p.hts) || alert.categories.includes(p.category),
  );
  const chinaMatch = alert.originCountries.includes("China");
  if (matchedProduct && alert.htsCodes.includes(matchedProduct.hts)) {
    return `You are seeing this because your saved product "${matchedProduct.name}" uses HTS ${matchedProduct.hts}, which is referenced in this update.`;
  }
  if (matchedProduct) {
    return `You are seeing this because your saved product category "${matchedProduct.category}" matches this update${chinaMatch ? ", and it affects China-origin goods" : ""}.`;
  }
  if (chinaMatch) {
    return `You are seeing this because you monitor China → USA shipments and this update affects China-origin goods.`;
  }
  return `You are seeing this because it may apply to one of your monitored categories or routes.`;
}

export function relevantAlertsForProduct(productId: string): Alert[] {
  const p = savedProducts.find((x) => x.id === productId);
  if (!p) return [];
  return alerts.filter((a) => a.htsCodes.includes(p.hts) || a.categories.includes(p.category));
}

export function buildBrokerSummary(alert: Alert): string {
  return [
    `ClearPort — Broker Summary`,
    `=========================`,
    ``,
    `Alert: ${alert.title}`,
    `Source: ${alert.source}`,
    `Published: ${alert.publicationDate}`,
    `Effective: ${alert.effectiveDate}`,
    `Affected origin: ${alert.originCountries.join(", ")}`,
    `Destination: ${alert.destinationCountry}`,
    `Affected categories: ${alert.categories.join(", ")}`,
    `Affected HTS codes: ${alert.htsCodes.length ? alert.htsCodes.join(", ") : "Not specified"}`,
    `Relevance: ${alert.relevance}`,
    ``,
    `Plain-English summary`,
    `---------------------`,
    alert.summary,
    ``,
    `Why this may matter`,
    `-------------------`,
    alert.whyMatters,
    ``,
    `Questions to ask your broker`,
    `----------------------------`,
    ...alert.brokerQuestions.map((q, i) => `${i + 1}. ${q}`),
    ``,
    `Official source: ${alert.sourceUrl}`,
    ``,
    `Disclaimer`,
    `----------`,
    `ClearPort provides educational, source-backed monitoring. It is not legal advice and does not replace a licensed customs broker. Final interpretation and classification should be confirmed with your broker.`,
  ].join("\n");
}
