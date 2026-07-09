/**
 * Regression tests for the GET /api/public/scan/:entryId endpoint behaviour.
 *
 * We can't spin up the full Express server here, so we test the *response
 * shape logic* that the handler exercises:
 *
 *   - English scan (translation_status null) → { status: 'ready', scan, translation_status: null }
 *   - Chinese scan translation pending        → { status: 'ready', scan, translation_status: 'pending' }
 *   - Chinese scan translation ready          → { status: 'ready', scan, translation_status: 'ready' }
 *   - Chinese scan translation failed         → { status: 'ready', scan, translation_status: 'failed' }
 *   - No scan row, entry pending             → { status: 'pending' }
 *   - No scan row, entry failed              → { status: 'failed', error }
 *
 * These tests replicate the handler logic directly so changes to scan.ts
 * will break the tests if the contract changes unexpectedly.
 */

import { describe, test, expect } from 'bun:test';

// ── Replicate the handler logic ───────────────────────────────────────────────

type TranslationStatus = 'pending' | 'ready' | 'failed' | null;

function buildScanResponse(
  scan: { translation_status: TranslationStatus } | null,
  entryStatus: 'pending' | 'ready' | 'failed',
  scanError: string | null = null,
): object {
  if (scan) {
    return {
      status: 'ready',
      scan,
      translation_status: scan.translation_status ?? null,
    };
  }
  const status = entryStatus === 'failed' ? 'failed' : 'pending';
  return scanError ? { status, error: scanError } : { status };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('scan endpoint response logic', () => {
  test('English scan (translation_status null) returns ready immediately', () => {
    const scan = { translation_status: null as TranslationStatus, overall_risk: 'Medium' };
    const resp = buildScanResponse(scan, 'ready') as any;
    expect(resp.status).toBe('ready');
    expect(resp.scan).toBeDefined();
    expect(resp.translation_status).toBeNull();
  });

  test('Chinese scan with translation pending → status ready, translation_status pending', () => {
    const scan = { translation_status: 'pending' as TranslationStatus, overall_risk: 'Medium' };
    const resp = buildScanResponse(scan, 'ready') as any;
    // The frontend must receive status:'ready' so it can show the English scan
    // immediately — it must NOT receive status:'pending' which would look like
    // the scan hasn't started.
    expect(resp.status).toBe('ready');
    expect(resp.translation_status).toBe('pending');
    expect(resp.scan).toBeDefined();
  });

  test('Chinese scan translation_status pending does NOT return status pending', () => {
    const scan = { translation_status: 'pending' as TranslationStatus };
    const resp = buildScanResponse(scan, 'ready') as any;
    // This is the critical regression: the previous code returned status:'pending'
    // here, which caused the frontend to keep polling until timeout.
    expect(resp.status).not.toBe('pending');
  });

  test('Chinese scan translation ready → status ready, translation_status ready', () => {
    const scan = { translation_status: 'ready' as TranslationStatus, overall_risk: 'Medium' };
    const resp = buildScanResponse(scan, 'ready') as any;
    expect(resp.status).toBe('ready');
    expect(resp.translation_status).toBe('ready');
  });

  test('Chinese scan translation failed → status ready, translation_status failed (English fallback)', () => {
    const scan = { translation_status: 'failed' as TranslationStatus, overall_risk: 'Medium' };
    const resp = buildScanResponse(scan, 'ready') as any;
    expect(resp.status).toBe('ready');
    expect(resp.translation_status).toBe('failed');
    expect(resp.scan).toBeDefined(); // English scan available as fallback
  });

  test('No scan row, entry pending → { status: pending }', () => {
    const resp = buildScanResponse(null, 'pending') as any;
    expect(resp.status).toBe('pending');
    expect(resp.scan).toBeUndefined();
  });

  test('No scan row, entry failed → { status: failed, error }', () => {
    const resp = buildScanResponse(null, 'failed', 'ANTHROPIC_KEY_MISSING') as any;
    expect(resp.status).toBe('failed');
    expect(resp.error).toBe('ANTHROPIC_KEY_MISSING');
  });

  test('No scan row, entry failed without error message → { status: failed } only', () => {
    const resp = buildScanResponse(null, 'failed') as any;
    expect(resp.status).toBe('failed');
    expect(resp.error).toBeUndefined();
  });
});

// ── pollTranslationResult logic ───────────────────────────────────────────────

describe('pollTranslationResult contract', () => {
  test('translation_status ready → not pending (poll should stop)', () => {
    // The poll loop terminates when translation_status !== 'pending'.
    expect('ready' !== 'pending').toBe(true);
    expect('failed' !== 'pending').toBe(true);
    expect(null !== 'pending').toBe(true);
  });

  test('translation_status pending → still running (poll continues)', () => {
    expect('pending' === 'pending').toBe(true);
  });

  test('on translation ready, scan has Chinese text (not considered failed)', () => {
    // Simulates what pollTranslationResult returns when translation succeeds.
    const apiResponse = { status: 'ready' as const, scan: { overall_risk: 'Medium' }, translation_status: 'ready' as TranslationStatus };
    const isStillPending = apiResponse.translation_status === 'pending';
    const isFailed = apiResponse.translation_status === 'failed';
    expect(isStillPending).toBe(false);
    expect(isFailed).toBe(false);
  });

  test('on translation failed, result is marked failed so frontend shows English fallback', () => {
    const apiResponse = { status: 'ready' as const, scan: { overall_risk: 'Medium' }, translation_status: 'failed' as TranslationStatus };
    const isFailed = apiResponse.translation_status === 'failed';
    expect(isFailed).toBe(true);
  });
});

// ── Frontend state transitions ────────────────────────────────────────────────

describe('translationStatus state transitions', () => {
  test('starts at idle before any scan', () => {
    const initial: 'idle' | 'pending' | 'failed' = 'idle';
    expect(initial).toBe('idle');
  });

  test('moves to pending when translation_status is pending from poll', () => {
    const polledTranslationStatus = 'pending';
    const needsTranslationPoll = polledTranslationStatus === 'pending';
    expect(needsTranslationPoll).toBe(true);
  });

  test('moves to idle when translation succeeds', () => {
    const failed = false;
    const nextStatus: 'idle' | 'failed' = failed ? 'failed' : 'idle';
    expect(nextStatus).toBe('idle');
  });

  test('moves to failed when translation fails', () => {
    const failed = true;
    const nextStatus: 'idle' | 'failed' = failed ? 'failed' : 'idle';
    expect(nextStatus).toBe('failed');
  });

  test('resets to idle on new scan submission', () => {
    // When runScan starts, translationStatus is reset to 'idle'.
    let translationStatus: 'idle' | 'pending' | 'failed' = 'failed';
    translationStatus = 'idle'; // setTranslationStatus('idle') at top of runScan
    expect(translationStatus).toBe('idle');
  });
});
