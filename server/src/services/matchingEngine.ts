import type { SourceDocument, MonitoredProduct, MatchResult, MatchType } from '../types';

/**
 * Match a source document against a monitored product.
 * Returns null if no relevant match is found.
 *
 * Match hierarchy:
 *   direct_hts   — an HTS code on the document exactly matches one on the product
 *   likely_match — document category + route (origin/dest) aligns with the product
 *   possible_match — only country/origin overlap
 */
export function matchDocumentToProduct(
  doc: SourceDocument,
  product: MonitoredProduct,
): MatchResult | null {
  // ── 1. Direct HTS match ────────────────────────────────────────────────────
  if (doc.affected_hts_codes.length > 0 && product.hts_codes.length > 0) {
    for (const docHts of doc.affected_hts_codes) {
      for (const productHts of product.hts_codes) {
        if (htsMatch(docHts, productHts)) {
          return {
            product,
            match_type: 'direct_hts',
            match_reason: `HTS code ${docHts} directly matches your monitored product "${product.name}"`,
            matched_hts_code: productHts,
            confidence: 0.95,
          };
        }
      }
    }
  }

  // ── 2. Likely match: category AND route ───────────────────────────────────
  const categoryMatch = categoriesOverlap(doc.affected_categories, product.categories);
  const routeMatch = routeOverlaps(doc, product);

  if (categoryMatch && routeMatch) {
    return {
      product,
      match_type: 'likely_match',
      match_reason: buildLikelyReason(doc, product),
      confidence: 0.70,
    };
  }

  // ── 3. Possible match: country/origin only ────────────────────────────────
  if (routeMatch && doc.affected_categories.length === 0) {
    return {
      product,
      match_type: 'possible_match',
      match_reason: buildPossibleReason(doc, product),
      confidence: 0.40,
    };
  }

  if (categoryMatch && !routeMatch && product.origin_countries.length === 0) {
    // Product has no country constraint — category match alone is possible
    return {
      product,
      match_type: 'possible_match',
      match_reason: `Category overlap with "${product.name}" — verify if origin countries apply`,
      confidence: 0.35,
    };
  }

  return null;
}

// HTS codes match if one is a prefix of the other at a dot boundary
// e.g. "8471.30" matches "8471.30.0100" and vice-versa
function htsMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\./g, '');
  const na = norm(a);
  const nb = norm(b);
  const shorter = na.length <= nb.length ? na : nb;
  const longer  = na.length <= nb.length ? nb : na;
  return longer.startsWith(shorter);
}

function categoriesOverlap(docCats: string[], productCats: string[]): boolean {
  if (docCats.length === 0 || productCats.length === 0) return false;
  const docLower = docCats.map((c) => c.toLowerCase());
  return productCats.some((pc) => {
    const pl = pc.toLowerCase();
    return docLower.some((dc) => dc.includes(pl) || pl.includes(dc));
  });
}

function routeOverlaps(doc: SourceDocument, product: MonitoredProduct): boolean {
  const originMatch =
    product.origin_countries.length === 0 ||
    doc.affected_origin_countries.length === 0 ||
    product.origin_countries.some((pc) =>
      doc.affected_origin_countries.some((dc) => normalize(dc) === normalize(pc)),
    );

  const destMatch =
    product.destination_countries.length === 0 ||
    doc.affected_destination_countries.length === 0 ||
    product.destination_countries.some((pc) =>
      doc.affected_destination_countries.some((dc) => normalize(dc) === normalize(pc)),
    );

  return originMatch && destMatch;
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function buildLikelyReason(doc: SourceDocument, product: MonitoredProduct): string {
  const cats = doc.affected_categories.slice(0, 2).join(', ');
  const origins = doc.affected_origin_countries.slice(0, 2).join(', ');
  let reason = `Category match (${cats || 'unknown'}) with product "${product.name}"`;
  if (origins) reason += ` — affects imports from ${origins}`;
  return reason;
}

function buildPossibleReason(doc: SourceDocument, product: MonitoredProduct): string {
  const countries = [
    ...doc.affected_origin_countries,
    ...doc.affected_destination_countries,
  ].slice(0, 3).join(', ');
  return `Country/route overlap (${countries || 'unknown'}) with product "${product.name}" — review for applicability`;
}

export function severityFromMatchType(matchType: MatchType): 'low' | 'medium' | 'high' | 'critical' {
  switch (matchType) {
    case 'direct_hts':   return 'high';
    case 'likely_match': return 'medium';
    case 'possible_match': return 'low';
  }
}
