/**
 * HTS duty-rate baseline from the official USITC HTS REST API.
 *
 * https://hts.usitc.gov/reststop/exportList?from=XXXX&to=XXXX&format=JSON
 *
 * Captures the official description, the General (MFN) duty rate, and detects
 * Section 301 applicability via the official Chapter 99 footnote (e.g.
 * "See 9903.88.03").
 *
 * SYSTEM INVARIANT (Stage 2): a lookup ALWAYS returns a structured result with a
 * truthful `match_level` — never null, never silent omission. Every submitted
 * HTS code resolves to exactly one of:
 *   - 'exact'      a verified official tariff line + MFN rate
 *   - 'parent'     an official heading/subheading was found, but the exact
 *                  10-digit tariff line still needs confirmation
 *   - 'ambiguous'  multiple official subheadings match; the importer must give
 *                  the exact 10-digit code to pin the rate
 *   - 'not_found'  the code does not resolve to any official HTS line
 *   - 'outage'     the official USITC source did not respond (truthful outage,
 *                  NOT a classification result)
 *
 * No rate or applicability is ever invented — everything comes from the API.
 */

import axios from 'axios';
import { db } from '../db/client';

const HTS_API = 'https://hts.usitc.gov/reststop/exportList';
const HTS_REVISION = '2026'; // USITC publishes revisions per year; stored for history

export type HtsMatchLevel = 'exact' | 'parent' | 'ambiguous' | 'not_found' | 'outage';

export interface HtsCandidateLine {
  htsno: string;       // formatted dotted, e.g. "6109.10.00"
  description: string;
  general: string | null;
}

export interface HtsLookupResult {
  match_level: HtsMatchLevel;
  requested: string;             // normalized digits as submitted
  hts8: string | null;           // resolved 8-digit subheading (exact/parent)
  matched_htsno: string | null;  // the actual line matched (dotted)
  description: string | null;
  mfn_text_rate: string | null;     // only populated on 'exact'
  mfn_ad_valorem_pct: number | null; // only populated on 'exact'
  section301_ref: string | null;    // e.g. "9903.88.15" when an HTS footnote cites it
  candidates: HtsCandidateLine[];   // distinct rated subheadings (parent/ambiguous)
  source_url: string;
  note: string | null;           // human-readable diagnostic
}

export function normalizeHts(raw: string): string {
  return (raw ?? '').replace(/[^0-9]/g, '');
}

function toDotted(digits: string): string {
  // Group as XXXX.XX.XX(.XX) for the USITC range params.
  const d = digits.slice(0, 10);
  const parts = [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean);
  return parts.join('.');
}

function parseAdValorem(rate: string | null): number | null {
  if (!rate) return null;
  if (/free/i.test(rate)) return 0;
  const m = rate.match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? parseFloat(m[1]) : null; // compound/specific rates -> null (not a clean %)
}

function digitsOf(r: any): string {
  return normalizeHts(r?.htsno ?? '');
}

function hasRate(r: any): boolean {
  return String(r?.general ?? '').trim() !== '';
}

function htsQueryUrl(digits: string): string {
  return `https://hts.usitc.gov/?query=${encodeURIComponent(toDotted(digits))}`;
}

function blank(requested: string, level: HtsMatchLevel, note: string): HtsLookupResult {
  return {
    match_level: level,
    requested,
    hts8: null,
    matched_htsno: null,
    description: null,
    mfn_text_rate: null,
    mfn_ad_valorem_pct: null,
    section301_ref: null,
    candidates: [],
    source_url: requested ? htsQueryUrl(requested) : 'https://hts.usitc.gov/',
    note,
  };
}

// Detect a Section 301 cross-reference from footnotes on the in-scope rows only
// (so a sibling subheading's 301 footnote is never mis-attributed).
function detect301(rows: any[]): string | null {
  const footnotes = rows
    .flatMap((r) => (Array.isArray(r.footnotes) ? r.footnotes : []))
    .map((f: any) => String(f?.value ?? ''));
  const ref = footnotes.find((v) => /9903\.88/.test(v));
  return ref ? (ref.match(/9903\.88\.\d{2}/)?.[0] ?? '9903.88') : null;
}

/**
 * PURE resolution of USITC HTS rows into a structured HtsLookupResult.
 * No network, no DB — given the requested digits and the rows the API returned,
 * decide the truthful match_level. Exposed for deterministic regression tests.
 * Passing `rows: null` represents a source OUTAGE (the fetch itself failed).
 */
export function resolveHtsRows(requestedRaw: string, rows: any[] | null): HtsLookupResult {
  const requested = normalizeHts(requestedRaw);

  if (requested.length < 4) {
    return blank(requested, 'not_found', 'HTS code too short to resolve — provide at least a 4-digit heading.');
  }

  if (rows === null) {
    return blank(
      requested,
      'outage',
      'The official USITC HTS service did not respond. This is a source outage, not a classification result.',
    );
  }

  // Rows that actually carry an HTS number and fall under the requested prefix.
  const scoped = rows.filter((r) => {
    const d = digitsOf(r);
    if (!d) return false;
    // either the row is under our prefix, or our prefix is under the row (ancestor)
    return d.startsWith(requested) || requested.startsWith(d);
  });

  if (scoped.length === 0) {
    return blank(
      requested,
      'not_found',
      'No official HTS line matches this code. Re-check the digits (USITC publishes 10-digit statistical lines).',
    );
  }

  // ── Full / near-full line provided (>= 8 digits) ────────────────────────────
  if (requested.length >= 8) {
    const req8 = requested.slice(0, 8);
    const under8 = scoped.filter((r) => digitsOf(r).startsWith(req8) || req8.startsWith(digitsOf(r)));
    const rated =
      under8.find((r) => digitsOf(r) === req8 && hasRate(r)) ??
      under8.find((r) => digitsOf(r).length >= 6 && req8.startsWith(digitsOf(r)) && hasRate(r)) ??
      under8.find((r) => digitsOf(r).startsWith(req8) && hasRate(r));

    if (rated) {
      const mfn_text_rate = (rated.general as string) || null;
      return {
        match_level: 'exact',
        requested,
        hts8: req8,
        matched_htsno: rated.htsno ?? toDotted(req8),
        description: (rated.description as string) || 'Classified merchandise',
        mfn_text_rate,
        mfn_ad_valorem_pct: parseAdValorem(mfn_text_rate),
        section301_ref: detect301(under8),
        candidates: [],
        source_url: htsQueryUrl(requested),
        note: null,
      };
    }

    // The heading/subheading exists but no rate line could be resolved for it.
    const anyDesc = under8.find((r) => (r.description as string)?.trim())?.description as string | undefined;
    return {
      ...blank(requested, 'parent', 'Official HTS heading found — the exact tariff line / rate needs confirmation.'),
      hts8: req8,
      matched_htsno: toDotted(req8),
      description: anyDesc ?? null,
      section301_ref: detect301(under8),
    };
  }

  // ── Heading / subheading prefix only (4 or 6 digits) ────────────────────────
  // Collect the distinct rated 8-digit subheadings under the prefix.
  const ratedSubs = new Map<string, HtsCandidateLine>();
  for (const r of scoped) {
    const d = digitsOf(r);
    if (d.length >= 8 && hasRate(r)) {
      const key = d.slice(0, 8);
      if (!ratedSubs.has(key)) {
        ratedSubs.set(key, {
          htsno: r.htsno ?? toDotted(key),
          description: (r.description as string) || 'Classified merchandise',
          general: (r.general as string) || null,
        });
      }
    }
  }
  const candidates = [...ratedSubs.values()];
  const headingDesc =
    scoped.find((r) => (r.description as string)?.trim())?.description as string | undefined;

  if (candidates.length === 0) {
    return {
      ...blank(requested, 'parent', 'Official HTS heading found — the exact tariff line / rate needs confirmation.'),
      description: headingDesc ?? null,
      section301_ref: detect301(scoped),
    };
  }

  if (candidates.length === 1) {
    // A single subheading resolves, but the importer still owes the exact
    // 10-digit statistical line — we do NOT assert this as the exact rate.
    return {
      ...blank(requested, 'parent', 'Official HTS heading found — confirm the exact 10-digit tariff line to lock the rate.'),
      hts8: candidates[0].htsno ? normalizeHts(candidates[0].htsno).slice(0, 8) : null,
      description: candidates[0].description ?? headingDesc ?? null,
      candidates,
      section301_ref: detect301(scoped),
    };
  }

  return {
    ...blank(
      requested,
      'ambiguous',
      'Multiple official HTS subheadings match this heading — provide the exact 10-digit code to pin the duty rate.',
    ),
    description: headingDesc ?? null,
    candidates,
    section301_ref: detect301(scoped),
  };
}

/**
 * Resolves an HTS code against the official USITC HTS API. Always returns a
 * structured result (see HtsLookupResult). Persists the baseline only on an
 * exact match with a resolved rate.
 */
export async function lookupHtsBaseline(rawHts: string): Promise<HtsLookupResult> {
  const requested = normalizeHts(rawHts);
  if (requested.length < 4) return resolveHtsRows(requested, []);

  // Range covers all children of the provided prefix (heading/subheading/line).
  const prefix = requested.slice(0, 10);
  const fromDotted = toDotted(prefix.padEnd(10, '0'));
  const toDotted_ = toDotted(prefix.padEnd(10, '9'));
  const url = `${HTS_API}?from=${encodeURIComponent(fromDotted)}&to=${encodeURIComponent(toDotted_)}&format=JSON&styles=false`;

  let rows: any[] | null;
  try {
    const { data } = await axios.get(url, {
      timeout: 25000,
      headers: { 'User-Agent': 'ClearPort/1.0 (+https://clearport.io)', Accept: 'application/json' },
    });
    rows = Array.isArray(data) ? data : [];
  } catch (err: any) {
    await logRefresh('hts', 'error', 0, err?.message);
    rows = null; // outage
  }

  const result = resolveHtsRows(requested, rows);

  if (result.match_level === 'exact') {
    await persist(result);
    await logRefresh('hts', 'success', 1);
  } else if (result.match_level !== 'outage') {
    await logRefresh('hts', 'success', result.match_level === 'parent' || result.match_level === 'ambiguous' ? 1 : 0);
  }

  return result;
}

async function persist(r: HtsLookupResult): Promise<void> {
  if (!r.hts8) return;
  // If the current row has the same rate, keep it; otherwise version it.
  const { data: current } = await db
    .from('hts_baselines')
    .select('id, mfn_text_rate')
    .eq('hts8', r.hts8)
    .eq('is_current', true)
    .maybeSingle();

  if (current && (current as any).mfn_text_rate === r.mfn_text_rate) return;

  if (current) {
    await db
      .from('hts_baselines')
      .update({ is_current: false, valid_to: new Date().toISOString() })
      .eq('id', (current as any).id);
  }

  await db.from('hts_baselines').insert({
    hts8: r.hts8,
    description: r.description,
    mfn_text_rate: r.mfn_text_rate,
    mfn_ad_valorem_pct: r.mfn_ad_valorem_pct,
    hts_revision: HTS_REVISION,
    source_url: r.source_url,
    is_current: true,
  });
}

async function logRefresh(
  type: string,
  status: string,
  records: number,
  error?: string,
): Promise<void> {
  await db.from('baseline_refresh_logs').insert({
    baseline_type: type,
    status,
    records,
    error_message: error ?? null,
  });
}
