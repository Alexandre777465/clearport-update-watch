export type AlertFrequency = 'instant' | 'daily' | 'weekly';
export type MatchType = 'direct_hts' | 'likely_match' | 'possible_match';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FeedType = 'rss' | 'html' | 'api';
export type DocumentType = 'rule' | 'notice' | 'tariff_action' | 'hts_update' | 'guidance' | 'csms';
export type CheckStatus = 'success' | 'error' | 'no_change' | 'new_content';
export type EmailType = 'instant' | 'daily_digest' | 'weekly_digest';

export interface Organization {
  id: string;
  name: string;
  plan: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  alert_frequency: AlertFrequency;
  email_notifications: boolean;
  created_at: string;
  updated_at: string;
}

export interface MonitoredProduct {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  hts_codes: string[];
  categories: string[];
  origin_countries: string[];
  destination_countries: string[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface MonitoredHtsCode {
  id: string;
  organization_id: string;
  hts_code: string;
  description?: string;
  created_by?: string;
  created_at: string;
}

export interface SourceFeed {
  id: string;
  name: string;
  source_name: string;
  url: string;
  feed_type: FeedType;
  check_interval_minutes: number;
  last_checked_at?: string;
  last_successful_sync_at?: string;
  last_checksum?: string;
  is_active: boolean;
  created_at: string;
}

export interface SourceDocument {
  id: string;
  feed_id?: string;
  source_name: string;
  source_url: string;
  published_at?: string;
  fetched_at: string;
  title?: string;
  raw_text?: string;
  raw_html?: string;
  document_type?: DocumentType;
  checksum: string;
  official_reference?: string;
  effective_date?: string;
  affected_origin_countries: string[];
  affected_destination_countries: string[];
  affected_categories: string[];
  affected_hts_codes: string[];
  plain_english_summary?: string;
  broker_questions: string[];
  confidence_level?: ConfidenceLevel;
  is_processed: boolean;
  processing_error?: string;
  created_at: string;
}

export interface SourceCheckLog {
  id: string;
  feed_id: string;
  checked_at: string;
  status: CheckStatus;
  documents_found: number;
  documents_new: number;
  error_message?: string;
  duration_ms?: number;
}

export interface Alert {
  id: string;
  source_document_id: string;
  organization_id: string;
  title: string;
  summary: string;
  relevance_reason: string;
  match_type: MatchType;
  broker_questions: string[];
  official_source_url?: string;
  effective_date?: string;
  severity: AlertSeverity;
  is_read: boolean;
  created_at: string;
}

export interface AlertMatch {
  id: string;
  alert_id: string;
  product_id: string;
  hts_code?: string;
  match_reason?: string;
  match_confidence?: number;
  created_at: string;
}

export interface LlmExtractionResult {
  plain_english_summary: string;
  affected_origin_countries: string[];
  affected_destination_countries: string[];
  affected_categories: string[];
  affected_hts_codes: string[];
  effective_date?: string;
  official_reference?: string;
  document_type: DocumentType;
  broker_questions: string[];
  confidence_level: ConfidenceLevel;
}

export interface MatchResult {
  product: MonitoredProduct;
  match_type: MatchType;
  match_reason: string;
  matched_hts_code?: string;
  confidence: number;
}

export interface FetchedContent {
  url: string;
  title?: string;
  raw_text: string;
  raw_html?: string;
  published_at?: Date;
  checksum: string;
  items?: FetchedItem[];
}

export interface FetchedItem {
  url: string;
  title: string;
  raw_text: string;
  raw_html?: string;
  published_at?: Date;
  checksum: string;
  official_reference?: string;
}

export interface AlertWithDetails extends Alert {
  source_document?: Partial<SourceDocument>;
  alert_matches?: AlertMatch[];
}

export interface WatchlistEntry {
  id: string;
  email: string;
  product_name: string;
  product_description?: string;
  hts_code?: string;
  origin_country: string;
  destination_country: string;
  alert_frequency: AlertFrequency;
  language?: 'en' | 'zh';
  last_alerted_at?: string;
  created_at: string;
  // Product attribute flags (added in migration 003)
  is_children: boolean;
  has_battery: boolean;
  is_electronic: boolean;
  is_textile: boolean;
  is_cosmetic: boolean;
  is_food_contact: boolean;
  is_supplement: boolean;
  sold_on_amazon: boolean;
  sold_on_tiktok: boolean;
  sold_in_eu: boolean;
  transport_mode?: 'ocean' | 'air' | 'truck' | 'rail' | null;
  manufacturer_name?: string | null;
  exporter_name?: string | null;
}

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical' | 'N/A';

export interface SourceCitation {
  agency: string;        // responsible authority, e.g. "CPSC", "FDA", "DOT/PHMSA", "USTR", "USITC"
  name: string;          // publication/source name
  title: string;         // document or regulation title
  cfr_citation?: string; // e.g. "16 CFR 1303" or statute, when available
  published_at?: string; // ISO date
  effective_date?: string; // effective date or current revision date
  last_verified_at?: string; // when ClearPort last verified this citation
  url: string;
  why_relevant: string;  // one sentence: why this source affects THIS product
}

// Three honest statuses (replaces the old binary verified flag):
//  verified_applicable  — official source is current AND the submitted product
//                         facts clearly satisfy its applicability conditions.
//  official_unconfirmed — the rule is real & sourced, but product facts /
//                         classification are insufficient to confirm it applies.
//  no_verified_source   — no official source backs this; do not guess.
export type VerificationStatus =
  | 'verified_applicable'      // confirmed applicable from official source
  | 'official_unconfirmed'     // official source found; exact applicability needs confirmation
  | 'no_verified_source'       // no official source could be reached / not in database
  | 'not_applicable'           // verified from official source that rule does NOT apply
  | 'insufficient_info';       // cannot determine — specific fact(s) are missing

export interface RiskCategory {
  id?: string;           // stable finding id — lets documents/questions trace back
  category: string;
  level: RiskLevel;
  explanation: string;   // "how it affects this product"
  action: string;        // "required action"
  // ── Source-grounding (stored inside the existing risk_categories JSONB —
  // no schema migration).
  verification_status?: VerificationStatus;
  applicability_conditions?: string; // exact product conditions that make it apply
  what_changed?: string;             // what changed (sourced items)
  verified_rate_pct?: number | null; // numeric rate taken from a source, if any
  financial_impact?: string;         // computed in code from a verified rate
  missing_info?: string;             // for no_verified_source: what's missing to verify
  source?: SourceCitation;
}

// Who is responsible for a document (Stage 4):
export type DocumentResponsibility = 'supplier' | 'importer_broker' | 'conditional' | 'carrier';

export type DocItemStatus =
  | 'required_to_clear'   // must be presented at CBP to release the goods
  | 'required_if'         // required when a stated condition is met
  | 'usually_requested'   // not universally mandatory; CBP frequently asks for it
  | 'before_sale'         // not a customs-clearance requirement; needed to sell in the U.S.
  | 'not_required'        // definitively not required for this product/route
  | 'cannot_determine';   // missing a fact needed to assign status

export type ResponsibleParty = 'supplier' | 'importer' | 'customs_broker' | 'carrier' | 'laboratory';

export interface DocumentChecklistItem {
  document: string;
  required: boolean;                 // true only when backed by a verified rule
  status?: 'required' | 'needs_confirmation';
  reason: string;
  responsibility: DocumentResponsibility;
  doc_status?: DocItemStatus;        // explicit per-item status (takes precedence over responsibility)
  condition?: string;                // for required_if — the triggering condition
  missing_fact?: string;             // for cannot_determine — the missing fact
  responsible_party?: ResponsibleParty; // more precise than responsibility
  finding_id?: string;               // originating baseline/finding id (traceable)
  source?: SourceCitation;           // official source backing this requirement
  transport_modes?: ('ocean' | 'air' | 'truck' | 'rail')[]; // absent = all modes
}

// CoverageItem — one entry in the "What ClearPort checked" matrix.
// Every domain ClearPort screens for the submitted product gets a status so the
// user sees what was checked, even when nothing was found.
export type CoverageStatus =
  | 'verified_applicable'            // confirmed applies to this product
  | 'likely_match'                   // scope criteria met; producer/exporter or formal entry needed
  | 'official_unconfirmed'           // real rule exists; applicability not yet confirmed from facts
  | 'no_applicable_rule'             // checked — no matching official rule or order found
  | 'not_applicable'                 // definitively does not apply based on submitted product facts
  | 'insufficient_info'              // cannot assess — key product facts are missing
  | 'source_unavailable'             // official source temporarily unavailable
  | 'informational_no_specific_rule'; // screened — no mandatory rule identified; informational only

export interface CoverageItem {
  domain: string;         // display label, e.g. "AD/CVD — Brake Drums (A-570-174)"
  domain_key: string;     // stable machine key, e.g. "adcvd_A-570-174"
  category: 'tariff' | 'trade_remedy' | 'customs' | 'product_regulation';
  status: CoverageStatus;
  finding_id?: string;    // links to risk_category.id when a finding was produced
  note?: string;          // one-sentence result summary shown to user
  missing_facts?: string[]; // specific facts needed to resolve this domain
  official_url?: string;
}

export interface ClarificationQuestion {
  /** Machine key for the missing fact (e.g. 'transport_mode', 'is_children'). */
  fact_key: string;
  /** Short label shown to the user — the exact fact that is missing. */
  missing_info: string;
  /** One-sentence explanation of which rule / conclusion this fact affects. */
  why_it_matters: string;
  /** The finding id that is blocked pending this fact. */
  affects_finding_id: string;
  /** Human-readable category name of the blocked finding. */
  affects_category: string;
  /** Selectable options the user can pick from (when applicable). */
  options?: Array<{ value: string; label: string }>;
}

export interface ProductRiskScan {
  id: string;
  watchlist_entry_id: string;
  overall_risk: 'Low' | 'Medium' | 'High' | 'Critical';
  overall_summary: string;
  risk_categories: RiskCategory[];
  document_checklist: DocumentChecklistItem[];
  broker_questions: string[];
  supplier_questions: string[];
  next_actions: string[];
  readiness_score: number;
  confidence_level: 'Low' | 'Medium' | 'High';
  coverage_matrix?: CoverageItem[];
  missing_facts?: string[];
  clarification_questions?: ClarificationQuestion[];
  translation_status?: string | null;
  created_at: string;
  obligations?: ObligationRecord[];
}

// ── Universal obligation model ─────────────────────────────────────────────────
// Every regulatory output is normalised to one ObligationRecord per legal rule.
// Laws with different timings become separate records; records are deduplicated
// by canonical key before display.

export type ObligationStatus =
  | 'mandatory'                    // verified applicable — compliance is required
  | 'voluntary'                    // official standard; no mandatory federal rule
  | 'informational_no_specific_rule' // screened; no mandatory rule identified
  | 'not_applicable'               // definitively excluded for this product/route
  | 'cannot_determine';            // fact(s) missing to resolve applicability

export type ObligationTiming =
  | 'customs_clearance'    // must be resolved to release goods at CBP
  | 'transport'            // governs the physical shipment (carrier docs)
  | 'before_sale'          // pre-market requirement; not a customs-clearance doc
  | 'post_market'          // surveillance or reporting obligation after import
  | 'available_on_request' // must exist; CBP or agency may request at any time
  | 'usually_requested';   // not universally required; CBP frequently asks for it

export interface ObligationRecord {
  obligation_id: string;      // dedup key: lower(citation)::status::timing
  module: string;             // originating module id, e.g. 'sports', 'textiles'
  legal_citation: string;     // exact CFR/USC/EO citation or HTS provision
  official_source?: string;   // URL to the authoritative source
  product_scope?: string;     // applicability conditions (who this covers)
  triggering_facts?: string[]; // fact keys that activate this obligation
  exclusion_facts?: string[];  // fact keys that exclude this obligation
  status: ObligationStatus;
  timing: ObligationTiming;
  responsible_party?: ResponsibleParty;
  required_evidence?: string[];
  document_name?: string;     // canonical document name, if any
  transport_modes?: ('ocean' | 'air' | 'truck' | 'rail')[]; // null = all modes
}
