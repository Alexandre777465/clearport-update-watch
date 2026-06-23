/**
 * HTS duty-rate baseline from the official USITC HTS REST API.
 *
 * https://hts.usitc.gov/reststop/exportList?from=XXXX&to=XXXX&format=JSON
 *
 * Captures the official description, the General (MFN) duty rate, and detects
 * Section 301 applicability via the official Chapter 99 footnote (e.g.
 * "See 9903.88.03"). Results are persisted to hts_baselines with version
 * history (old rows flipped to is_current = false when the rate changes).
 *
 * No rate or applicability is ever invented — everything comes from the API.
 */

import axios from 'axios';
import { db } from '../db/client';

const HTS_API = 'https://hts.usitc.gov/reststop/exportList';
const HTS_REVISION = '2026'; // USITC publishes revisions per year; stored for history

export interface HtsBaselineResult {
  hts8: string;
  description: string;
  mfn_text_rate: string | null;
  mfn_ad_valorem_pct: number | null;
  section301_ref: string | null; // e.g. "9903.88.03" when the HTS footnote cites it
  source_url: string;
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

// Fetches the baseline for an HTS code and upserts it (with history). Returns
// null if the code is too short or the API yields nothing usable.
export async function fetchAndStoreHtsBaseline(rawHts: string): Promise<HtsBaselineResult | null> {
  const digits = normalizeHts(rawHts);
  if (digits.length < 6) return null;

  const hts8 = digits.slice(0, 8);
  // The rate often lives on a 10-digit statistical line, not the 8-digit code,
  // so an exact from=to query on an 8-digit code returns []. Query a RANGE that
  // covers all children of the provided heading/subheading and pick the leaf.
  const base = digits.slice(0, 8).padEnd(8, '0');
  const fromDotted = toDotted(base + '0000');
  const toDotted_ = toDotted(base + '9999');
  const url = `${HTS_API}?from=${encodeURIComponent(fromDotted)}&to=${encodeURIComponent(toDotted_)}&format=JSON&styles=false`;

  let rows: any[];
  try {
    const { data } = await axios.get(url, {
      timeout: 25000,
      headers: { 'User-Agent': 'ClearPort/1.0 (+https://clearport.io)', Accept: 'application/json' },
    });
    rows = Array.isArray(data) ? data : [];
  } catch (err: any) {
    await logRefresh('hts', 'error', 0, err?.message);
    return null;
  }

  // Pick the most specific row that has an actual rate and an htsno matching our code.
  const candidates = rows.filter(
    (r) => r.htsno && normalizeHts(r.htsno).startsWith(hts8.slice(0, normalizeHts(r.htsno).length || 8)),
  );
  const rated =
    rows.find((r) => r.htsno && normalizeHts(r.htsno).startsWith(hts8) && (r.general ?? '') !== '') ??
    candidates.find((r) => (r.general ?? '') !== '') ??
    rows.find((r) => (r.general ?? '') !== '');

  if (!rated) {
    await logRefresh('hts', 'success', 0);
    return null;
  }

  const mfn_text_rate = (rated.general as string) || null;
  const mfn_ad_valorem_pct = parseAdValorem(mfn_text_rate);

  // Section 301 detection: any footnote on this (or its parent) row referencing 9903.88.
  const allFootnotes = rows
    .flatMap((r) => (Array.isArray(r.footnotes) ? r.footnotes : []))
    .map((f: any) => String(f?.value ?? ''));
  const ref = allFootnotes.find((v) => /9903\.88/.test(v));
  const section301_ref = ref ? (ref.match(/9903\.88\.\d{2}/)?.[0] ?? '9903.88') : null;

  const result: HtsBaselineResult = {
    hts8,
    description: (rated.description as string) || 'Classified merchandise',
    mfn_text_rate,
    mfn_ad_valorem_pct,
    section301_ref,
    source_url: `https://hts.usitc.gov/?query=${encodeURIComponent(toDotted(digits))}`,
  };

  await persist(result);
  await logRefresh('hts', 'success', 1);
  return result;
}

async function persist(r: HtsBaselineResult): Promise<void> {
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
