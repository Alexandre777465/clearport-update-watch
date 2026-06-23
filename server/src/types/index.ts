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
  | 'verified_applicable'
  | 'official_unconfirmed'
  | 'no_verified_source';

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
//  supplier        — your overseas supplier/factory must produce or provide it
//  importer_broker — the U.S. importer of record / customs broker files it
//  conditional     — only applies if a requirement's applicability is confirmed
export type DocumentResponsibility = 'supplier' | 'importer_broker' | 'conditional';

export interface DocumentChecklistItem {
  document: string;
  required: boolean;                 // true only when backed by a verified rule
  status?: 'required' | 'needs_confirmation';
  reason: string;
  responsibility: DocumentResponsibility;
  finding_id?: string;               // originating baseline/finding id (traceable)
  source?: SourceCitation;           // official source backing this requirement
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
  created_at: string;
}
