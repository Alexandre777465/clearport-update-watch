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
