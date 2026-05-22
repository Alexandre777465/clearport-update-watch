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
  sources as mockSources,
  type Alert,
  type SavedProduct,
  type SourceStatus,
} from "./mock";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

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
  const healthy =
    raw.status === "healthy" || raw.status === "never_checked";
  const feedType = raw.feed_type as string;
  const typeLabel =
    feedType === "rss"
      ? "Trade news RSS"
      : feedType === "api"
        ? "Federal Register API"
        : "Official page";

  const lastChecked = raw.last_checked_at
    ? formatRelative(raw.last_checked_at as string)
    : "Never";

  const latestTitle = raw.latest_alert_title as string | null;
  const latestAt = raw.latest_alert_at as string | null;
  const lastUpdate =
    latestTitle && latestAt
      ? `${latestAt.slice(0, 10)} — ${latestTitle}`
      : latestTitle ?? "No updates yet";

  return {
    name: raw.name as string,
    type: typeLabel,
    lastChecked,
    lastUpdate,
    frequency: "Ongoing",
    status: healthy ? "Active" : "Needs attention",
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

export async function fetchSources(): Promise<SourceStatus[]> {
  if (!API_URL) return mockSources;
  try {
    const { data } = await apiFetch<{ data: unknown[] }>("/api/sources/status");
    return data.map((r) => mapSource(r as Record<string, unknown>));
  } catch {
    return mockSources;
  }
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

export async function submitWatchlistEntry(data: {
  email: string;
  product_name: string;
  product_description?: string;
  hts_code?: string;
  origin_country: string;
  destination_country: string;
  alert_frequency?: string;
}): Promise<{ id: string; preview: WatchlistPreviewDoc[] }> {
  if (!API_URL) {
    // No backend configured — return a successful local placeholder so the
    // confirmation screen still appears (email is obviously not persisted).
    return { id: `local-${Date.now()}`, preview: [] };
  }

  const res = await fetch(`${API_URL}/api/public/watchlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Watchlist ${res.status}: ${body}`);
  }

  return res.json() as Promise<{ id: string; preview: WatchlistPreviewDoc[] }>;
}

export { API_URL };
