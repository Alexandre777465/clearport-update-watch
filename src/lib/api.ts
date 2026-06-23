/**
 * ClearPort API client.
 *
 * When VITE_API_URL is not set the app runs entirely on mock data — the
 * Lovable preview and standalone frontend always work without a backend.
 *
 * When VITE_API_URL is set AND the user has a valid Supabase session, every
 * call fetches live data from the Express backend and maps the response into
 * the same shape the frontend components expect (matching src/lib/mock.ts).
 */

import { getAccessToken } from "./supabase";
import {
  alerts as mockAlerts,
  savedProducts as mockProducts,
  type Alert,
  type SavedProduct,
  type SourceStatus,
} from "./mock";

// Production backend (public URL — NOT a secret). Used as the default when a
// production build does not provide VITE_API_URL. An explicit VITE_API_URL
// always wins, so local dev can point elsewhere or stay on mock data (empty).
const PROD_API_URL = "https://clearport-update-watch-production.up.railway.app";

const API_URL = (
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
  (import.meta.env.PROD ? PROD_API_URL : "")
).replace(/\/+$/, "");

// ── Low-level fetch wrapper ──────────────────────────────────────────────────

async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error("not-authenticated");

  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Shape mappers ────────────────────────────────────────────────────────────

function mapMatchType(t: string): Alert["relevance"] {
  if (t === "direct_hts") return "Direct HTS match";
  if (t === "likely_match") return "Likely match";
  return "Possible match";
}

function mapDocType(t: string | null | undefined): Alert["alertType"] {
  if (t === "tariff_action") return "Tariff / exclusion";
  if (t === "hts_update") return "HTS update";
  if (t === "csms") return "Operational";
  if (t === "rule" || t === "notice") return "Tariff / exclusion";
  return "Operational";
}

function mapAlert(raw: Record<string, unknown>): Alert {
  const doc = (raw.source_document ?? {}) as Record<string, unknown>;
  const effectiveDate =
    ((raw.effective_date ?? doc.effective_date ?? "") as string).slice(0, 10) ||
    "TBD";

  return {
    id: raw.id as string,
    title: raw.title as string,
    source: (doc.source_name as string) ?? "ClearPort",
    publicationDate:
      ((doc.published_at ?? raw.created_at ?? "") as string).slice(0, 10),
    effectiveDate,
    originCountries: (doc.affected_origin_countries as string[]) ?? [],
    destinationCountry:
      ((doc.affected_destination_countries as string[])?.[0]) ?? "United States",
    categories: (doc.affected_categories as string[]) ?? [],
    htsCodes: (doc.affected_hts_codes as string[]) ?? [],
    relevance: mapMatchType(raw.match_type as string),
    summary: (raw.summary as string) ?? "",
    whyMatters: (raw.relevance_reason as string) ?? "",
    brokerQuestions: (raw.broker_questions as string[]) ?? [],
    sourceUrl:
      (raw.official_source_url as string) ?? (doc.source_url as string) ?? "",
    sourceExcerpt: "",
    alertType: mapDocType(doc.document_type as string | undefined),
  };
}

function mapProduct(raw: Record<string, unknown>): SavedProduct {
  const cats = (raw.categories as string[]) ?? [];
  const hts = (raw.hts_codes as string[]) ?? [];
  const origins = (raw.origin_countries as string[]) ?? [];
  const dests = (raw.destination_countries as string[]) ?? [];
  return {
    id: raw.id as string,
    name: raw.name as string,
    category: cats[0] ?? "",
    description: (raw.description as string) ?? "",
    material: "",
    intendedUse: "",
    hts: hts[0] ?? "",
    origin: origins[0] ?? "China",
    destination: dests[0] ?? "United States",
    supplier: "",
    supplierCountry: origins[0] ?? "",
    channel: "",
    alertFrequency: "Daily",
    relatedAlerts: 0,
    lastAlertDate: "",
    upcomingEffective: null,
    lastMatchedSource: "",
  };
}

function mapSource(raw: Record<string, unknown>): SourceStatus {
  const feedType = raw.feed_type as string;
  const typeLabel =
    feedType === "rss"
      ? "Official RSS feed"
      : feedType === "api"
        ? "Official API (Federal Register)"
        : "Official web page";

  // Map backend health to a truthful display status — no invented "Active".
  const backend = raw.status as string;
  const statusMap: Record<string, SourceStatus["status"]> = {
    healthy: "Active",
    degraded: "Degraded",
    error: "Error",
    never_checked: "Never checked",
    unavailable: "Unavailable",
  };
  const status = statusMap[backend] ?? "Never checked";

  const lastChecked = raw.last_checked_at
    ? formatRelative(raw.last_checked_at as string)
    : "Never";
  const lastSuccessfulSync = raw.last_successful_sync_at
    ? formatRelative(raw.last_successful_sync_at as string)
    : "Never";

  const mins = (raw.check_interval_minutes as number) ?? 0;
  const frequency =
    status === "Unavailable"
      ? "Not scheduled"
      : mins >= 1440
        ? `Every ${Math.round(mins / 1440)} day(s)`
        : mins >= 60
          ? `Every ${Math.round(mins / 60)} hour(s)`
          : mins > 0
            ? `Every ${mins} min`
            : "Ongoing";

  return {
    name: raw.name as string,
    type: typeLabel,
    lastChecked,
    lastSuccessfulSync,
    frequency,
    status,
    error: (raw.recent_error as string) ?? null,
    url: raw.url as string,
  };
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const h = Math.round(diffMs / 3_600_000);
  if (h < 1) return "Just now";
  if (h === 1) return "1 hour ago";
  if (h < 24) return `${h} hours ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

// ── Public API functions ─────────────────────────────────────────────────────
// Each function falls back to mock data when API is unconfigured or unauthenticated.

export async function fetchAlerts(): Promise<Alert[]> {
  if (!API_URL) return mockAlerts;
  try {
    const { data } = await apiFetch<{ data: unknown[] }>("/api/alerts?limit=50");
    return data.map((r) => mapAlert(r as Record<string, unknown>));
  } catch {
    return mockAlerts;
  }
}

export async function fetchAlert(id: string): Promise<Alert | undefined> {
  if (!API_URL) return mockAlerts.find((a) => a.id === id);
  try {
    const raw = await apiFetch<Record<string, unknown>>(`/api/alerts/${id}`);
    return mapAlert(raw);
  } catch {
    return mockAlerts.find((a) => a.id === id);
  }
}

export async function markAlertRead(id: string): Promise<void> {
  if (!API_URL) return;
  await apiFetch(`/api/alerts/${id}/read`, { method: "PATCH" }).catch(() => {});
}

export async function saveAlertRemote(id: string): Promise<void> {
  if (!API_URL) return;
  await apiFetch(`/api/alerts/${id}/save`, { method: "POST" }).catch(() => {});
}

export async function unsaveAlertRemote(id: string): Promise<void> {
  if (!API_URL) return;
  await apiFetch(`/api/alerts/${id}/save`, { method: "DELETE" }).catch(() => {});
}

export async function dismissAlertRemote(id: string): Promise<void> {
  if (!API_URL) return;
  await apiFetch(`/api/alerts/${id}/dismiss`, { method: "POST" }).catch(() => {});
}

export async function fetchProducts(): Promise<SavedProduct[]> {
  if (!API_URL) return mockProducts;
  try {
    const { data } = await apiFetch<{ data: unknown[] }>("/api/products");
    return data.map((r) => mapProduct(r as Record<string, unknown>));
  } catch {
    return mockProducts;
  }
}

export async function createProductRemote(p: {
  name: string;
  description?: string;
  categories?: string[];
  hts_codes?: string[];
  origin_countries?: string[];
  destination_countries?: string[];
}): Promise<SavedProduct> {
  const raw = await apiFetch<Record<string, unknown>>("/api/products", {
    method: "POST",
    body: JSON.stringify(p),
  });
  return mapProduct(raw);
}

export async function deleteProductRemote(id: string): Promise<void> {
  await apiFetch(`/api/products/${id}`, { method: "DELETE" });
}

// Live source health only. No mock fallback — if the backend is unreachable
// this throws and the UI shows "Status unavailable" rather than fake data.
export async function fetchSources(): Promise<SourceStatus[]> {
  if (!API_URL) throw new Error("source-status-unavailable");
  const res = await fetch(`${API_URL}/api/public/sources`);
  if (!res.ok) throw new Error(`Sources ${res.status}`);
  const { data } = (await res.json()) as { data: unknown[] };
  return data.map((r) => mapSource(r as Record<string, unknown>));
}

export async function fetchNotificationPreferences() {
  if (!API_URL) return { alert_frequency: "daily", email_notifications: true };
  return apiFetch<{ alert_frequency: string; email_notifications: boolean }>(
    "/api/notifications/preferences",
  ).catch(() => ({ alert_frequency: "daily", email_notifications: true }));
}

export async function updateNotificationPreferences(prefs: {
  alert_frequency?: string;
  email_notifications?: boolean;
}) {
  if (!API_URL) return;
  await apiFetch("/api/notifications/preferences", {
    method: "PUT",
    body: JSON.stringify(prefs),
  }).catch(() => {});
}

// ── Risk scan types (mirrors server/src/types/index.ts) ─────────────────────

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical' | 'N/A';

export interface SourceCitation {
  agency: string;
  name: string;
  title: string;
  cfr_citation?: string;
  published_at?: string;
  effective_date?: string;
  last_verified_at?: string;
  url: string;
  why_relevant: string;
}

export type VerificationStatus =
  | "verified_applicable"
  | "official_unconfirmed"
  | "no_verified_source";

export interface RiskCategory {
  category: string;
  level: RiskLevel;
  explanation: string;
  action: string;
  verification_status?: VerificationStatus;
  applicability_conditions?: string;
  what_changed?: string;
  verified_rate_pct?: number | null;
  financial_impact?: string;
  missing_info?: string;
  source?: SourceCitation;
}

export type DocumentResponsibility = "supplier" | "importer_broker" | "conditional";

export interface DocumentChecklistItem {
  document: string;
  required: boolean;
  status?: "required" | "needs_confirmation";
  reason: string;
  responsibility?: DocumentResponsibility;
  finding_id?: string;
  source?: SourceCitation;
  uploaded?: boolean;  // client-side state only
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

export interface ProductAttributes {
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

// ── Watchlist (public — no auth required) ────────────────────────────────────

export interface WatchlistPreviewDoc {
  id: string;
  title: string;
  source_name: string;
  source_url: string;
  published_at: string;
  plain_english_summary: string;
  broker_questions: string[];
  effective_date?: string;
}

export type ScanStatus = "pending" | "ready" | "failed" | "local";

// fetch with an abort timeout so a single request can't hang forever.
async function fetchWithTimeout(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

// Creates the watchlist entry and returns immediately. The scan runs
// asynchronously on the backend; poll fetchScanResult() for the result.
export async function submitWatchlistEntry(data: {
  email: string;
  product_name: string;
  product_description?: string;
  hts_code?: string;
  origin_country: string;
  destination_country: string;
  alert_frequency?: string;
  estimated_value_usd?: number;
  language?: "en" | "zh";
} & Partial<ProductAttributes>): Promise<{
  id: string;
  preview: WatchlistPreviewDoc[];
  email_enabled: boolean;
  scan_status: ScanStatus;
}> {
  if (!API_URL) {
    // No backend configured — the frontend generates a mock risk scan.
    return { id: `local-${Date.now()}`, preview: [], email_enabled: false, scan_status: "local" };
  }

  const res = await fetchWithTimeout(
    `${API_URL}/api/public/watchlist`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
    30_000, // the POST now returns quickly (no scan inline)
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Watchlist ${res.status}: ${body}`);
  }

  const json = (await res.json()) as {
    id: string;
    preview: WatchlistPreviewDoc[];
    email_enabled?: boolean;
    scan_status?: ScanStatus;
  };
  return {
    id: json.id,
    preview: json.preview ?? [],
    email_enabled: json.email_enabled ?? false,
    scan_status: json.scan_status ?? "pending",
  };
}

// Polls a single scan-status read.
export async function fetchScanResult(entryId: string): Promise<{
  status: ScanStatus;
  scan: ProductRiskScan | null;
  error?: string;
}> {
  const res = await fetchWithTimeout(`${API_URL}/api/public/scan/${entryId}`, {}, 20_000);
  if (!res.ok) {
    return { status: "pending", scan: null };
  }
  const json = (await res.json()) as {
    status: ScanStatus;
    scan?: ProductRiskScan;
    error?: string;
  };
  return { status: json.status, scan: json.scan ?? null, error: json.error };
}

// Polls until the scan is ready/failed or the budget is exhausted.
export async function pollScanResult(
  entryId: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<{ status: ScanStatus; scan: ProductRiskScan | null; error?: string }> {
  const intervalMs = opts.intervalMs ?? 3_000;
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const deadline = Date.now() + timeoutMs;

  // initial small delay — the scan takes a few seconds minimum
  await new Promise((r) => setTimeout(r, 1_500));

  while (Date.now() < deadline) {
    const r = await fetchScanResult(entryId).catch(() => ({
      status: "pending" as ScanStatus,
      scan: null,
    }));
    if (r.status === "ready" || r.status === "failed") return r;
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  return { status: "pending", scan: null, error: "timeout" };
}

// ── ClearPort Assistant (product-grounded) ───────────────────────────────────

export interface AssistantSource {
  agency: string;
  title: string;
  citation?: string;
  url: string;
}

export async function fetchScanContext(entryId: string): Promise<{
  id: string;
  product_name: string;
  hts_code: string | null;
  origin_country: string;
  destination_country: string;
} | null> {
  if (!API_URL) return null;
  const res = await fetch(`${API_URL}/api/public/scan/${entryId}/context`);
  if (!res.ok) return null;
  return res.json();
}

export async function askProduct(
  entryId: string,
  question: string,
): Promise<{ answer: string; grounded: boolean; sources: AssistantSource[] }> {
  const res = await fetchWithTimeout(
    `${API_URL}/api/public/scan/${entryId}/ask`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    },
    90_000,
  );
  const json = (await res.json().catch(() => null)) as
    | { answer: string; grounded: boolean; sources: AssistantSource[] }
    | null;
  if (!json) {
    return {
      answer: "Something went wrong answering your question. Please try again.",
      grounded: false,
      sources: [],
    };
  }
  return json;
}

export { API_URL };
