import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db/client';
import type { SourceDocument, LlmExtractionResult, DocumentType, ConfidenceLevel } from '../types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_TEXT = `You are a trade compliance analyst assistant for ClearPort, a U.S. import monitoring tool.
Your job is to analyze official U.S. trade and customs documents and extract structured information.

IMPORTANT RULES:
- Do NOT provide legal advice or final customs determinations.
- Do NOT guarantee import clearance or regulatory compliance.
- Focus only on factual extraction from the document text.
- When uncertain, note low confidence.
- HTS codes must follow U.S. HTS format (e.g., 8471.30.0100 or 8471.30).
- Country names should use standard English names (e.g., "China" not "PRC").`;

function extractionPrompt(title: string, text: string): string {
  return `Analyze the following U.S. trade/customs document and extract the information as a JSON object.

Document title: ${title}
Document text (truncated to 8000 chars):
${text.slice(0, 8000)}

Respond with ONLY valid JSON in this exact shape — no markdown fences, no commentary:
{
  "plain_english_summary": "2-4 sentence plain English summary of what this rule/notice means for importers",
  "document_type": "rule | notice | tariff_action | hts_update | guidance | csms",
  "affected_origin_countries": ["country names that are subject to this rule"],
  "affected_destination_countries": ["usually US, but note if otherwise"],
  "affected_categories": ["broad product categories affected, e.g. Electronics, Steel, Textiles"],
  "affected_hts_codes": ["HTS codes explicitly mentioned, e.g. 8471.30, 7210.49"],
  "effective_date": "ISO 8601 date if mentioned, otherwise null",
  "official_reference": "Federal Register citation, CSMS number, or case number if present, otherwise null",
  "broker_questions": [
    "3-5 questions an importer should ask their customs broker about this update"
  ],
  "confidence_level": "high | medium | low"
}`;
}

export async function processUnprocessedDocuments(batchSize = 10): Promise<void> {
  const { data: docs, error } = await db
    .from('source_documents')
    .select('*')
    .eq('is_processed', false)
    .is('processing_error', null)
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (error || !docs?.length) return;

  for (const doc of docs as SourceDocument[]) {
    await summarizeDocument(doc);
  }
}

export async function summarizeDocument(doc: SourceDocument): Promise<void> {
  try {
    const extracted = await callLlm(doc);
    await db.from('source_documents').update({
      plain_english_summary: extracted.plain_english_summary,
      document_type: extracted.document_type,
      affected_origin_countries: extracted.affected_origin_countries,
      affected_destination_countries: extracted.affected_destination_countries,
      affected_categories: extracted.affected_categories,
      affected_hts_codes: extracted.affected_hts_codes,
      effective_date: extracted.effective_date ?? null,
      official_reference: extracted.official_reference ?? doc.official_reference ?? null,
      broker_questions: extracted.broker_questions,
      confidence_level: extracted.confidence_level,
      is_processed: true,
      processing_error: null,
    }).eq('id', doc.id);
  } catch (err: any) {
    await db.from('source_documents').update({
      processing_error: err.message ?? 'Unknown error',
    }).eq('id', doc.id);
    console.error(`[summarizer] Failed doc ${doc.id}:`, err.message);
  }
}

async function callLlm(doc: SourceDocument): Promise<LlmExtractionResult> {
  const title = doc.title ?? 'Untitled document';
  const text  = doc.raw_text ?? '';

  if (!text || text.length < 50) {
    throw new Error('Document text too short to process');
  }

  // Use prompt caching on the system prompt — it's identical for every document
  // processed in the same session, so cache hits reduce cost substantially.
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: [
      {
        type: 'text',
        text: SYSTEM_TEXT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: extractionPrompt(title, text) }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected LLM response type');

  const raw  = content.text.trim();
  const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  return validateExtraction(JSON.parse(json));
}

function validateExtraction(raw: any): LlmExtractionResult {
  const validDocTypes: DocumentType[]     = ['rule', 'notice', 'tariff_action', 'hts_update', 'guidance', 'csms'];
  const validConfidence: ConfidenceLevel[] = ['high', 'medium', 'low'];

  return {
    plain_english_summary:          String(raw.plain_english_summary ?? ''),
    document_type:                  validDocTypes.includes(raw.document_type) ? raw.document_type : 'notice',
    affected_origin_countries:      toStringArray(raw.affected_origin_countries),
    affected_destination_countries: toStringArray(raw.affected_destination_countries),
    affected_categories:            toStringArray(raw.affected_categories),
    affected_hts_codes:             toStringArray(raw.affected_hts_codes).map(normalizeHts).filter(Boolean),
    effective_date:                 raw.effective_date ?? undefined,
    official_reference:             raw.official_reference ?? undefined,
    broker_questions:               toStringArray(raw.broker_questions),
    confidence_level:               validConfidence.includes(raw.confidence_level) ? raw.confidence_level : 'medium',
  };
}

function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v) => typeof v === 'string' && v.length > 0);
  return [];
}

function normalizeHts(code: string): string {
  return code.replace(/[^0-9.]/g, '').replace(/\.+/g, '.').replace(/\.$/, '').trim();
}
