import { db } from '../db/client';
import { matchDocumentToProduct, severityFromMatchType } from './matchingEngine';
import type { SourceDocument, MonitoredProduct, Organization } from '../types';

const DISCLAIMER =
  'DISCLAIMER: ClearPort cannot provide final legal interpretation or guarantee import clearance. ' +
  'This update may be relevant based on your monitored products and should be verified with your customs broker.';

export async function generateAlertsForDocument(docId: string): Promise<void> {
  const { data: doc } = await db
    .from('source_documents')
    .select('*')
    .eq('id', docId)
    .single();

  if (!doc || !doc.is_processed) return;

  // Get all organizations with products
  const { data: orgs } = await db.from('organizations').select('id, name');
  if (!orgs?.length) return;

  for (const org of orgs as Organization[]) {
    await generateAlertsForOrganization(doc as SourceDocument, org.id);
  }
}

async function generateAlertsForOrganization(
  doc: SourceDocument,
  orgId: string,
): Promise<void> {
  const { data: products } = await db
    .from('monitored_products')
    .select('*')
    .eq('organization_id', orgId);

  const { data: htsCodes } = await db
    .from('monitored_hts_codes')
    .select('*')
    .eq('organization_id', orgId);

  if (!products?.length && !htsCodes?.length) return;

  // Check if alert already exists for this doc+org
  const { data: existing } = await db
    .from('alerts')
    .select('id')
    .eq('source_document_id', doc.id)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (existing) return;

  const allProducts = (products ?? []) as MonitoredProduct[];

  // Add virtual products for standalone HTS codes
  for (const hts of (htsCodes ?? []) as any[]) {
    allProducts.push({
      id: hts.id,
      organization_id: orgId,
      name: `HTS ${hts.hts_code}`,
      hts_codes: [hts.hts_code],
      categories: [],
      origin_countries: [],
      destination_countries: [],
      created_at: hts.created_at,
      updated_at: hts.created_at,
    });
  }

  const matches = allProducts
    .map((p) => matchDocumentToProduct(doc, p))
    .filter(Boolean);

  if (!matches.length) return;

  // Use the highest-confidence match to set alert severity
  const best = matches.sort((a, b) => b!.confidence - a!.confidence)[0]!;

  const summary = doc.plain_english_summary
    ? `${doc.plain_english_summary}\n\n${DISCLAIMER}`
    : `A new trade update was detected: "${doc.title}". ${DISCLAIMER}`;

  const { data: alert, error: alertErr } = await db
    .from('alerts')
    .insert({
      source_document_id: doc.id,
      organization_id: orgId,
      title: doc.title ?? 'New Trade Update',
      summary,
      relevance_reason: best.match_reason,
      match_type: best.match_type,
      broker_questions: doc.broker_questions ?? [],
      official_source_url: doc.source_url,
      effective_date: doc.effective_date ?? null,
      severity: severityFromMatchType(best.match_type),
    })
    .select('id')
    .single();

  if (alertErr || !alert) return;

  // Store individual match records
  const matchRows = matches
    .filter(Boolean)
    .map((m) => ({
      alert_id: alert.id,
      product_id: m!.product.id,
      hts_code: m!.matched_hts_code ?? null,
      match_reason: m!.match_reason,
      match_confidence: m!.confidence,
    }));

  if (matchRows.length) {
    await db.from('alert_matches').insert(matchRows);
  }
}
