import { db } from '../db/client';
import type { SourceFeed } from '../types';

export interface FeedStatus {
  id: string;
  name: string;
  url: string;
  feed_type: string;
  is_active: boolean;
  check_interval_minutes: number;
  last_checked_at: string | null;
  last_successful_sync_at: string | null;
  latest_alert_title: string | null;
  latest_alert_at: string | null;
  recent_error: string | null;
  status: 'healthy' | 'degraded' | 'error' | 'never_checked' | 'unavailable';
}

// includeInactive: when true, deactivated feeds are returned with status
// 'unavailable' (used by the public status page so it can honestly show, e.g.,
// CSMS as deactivated rather than hiding it or faking health).
export async function getSourceStatuses(includeInactive = false): Promise<FeedStatus[]> {
  const base = db.from('source_feeds').select('*').order('name');
  const { data: feeds } = includeInactive ? await base : await base.eq('is_active', true);

  if (!feeds?.length) return [];

  const statuses: FeedStatus[] = [];

  for (const feed of feeds as SourceFeed[]) {
    if (!feed.is_active) {
      statuses.push({
        id: feed.id,
        name: feed.name,
        url: feed.url,
        feed_type: feed.feed_type,
        is_active: false,
        check_interval_minutes: feed.check_interval_minutes,
        last_checked_at: feed.last_checked_at ?? null,
        last_successful_sync_at: feed.last_successful_sync_at ?? null,
        latest_alert_title: null,
        latest_alert_at: null,
        recent_error: null,
        status: 'unavailable',
      });
      continue;
    }

    const { data: latestLog } = await db
      .from('source_check_logs')
      .select('status, error_message, checked_at')
      .eq('feed_id', feed.id)
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: latestDoc } = await db
      .from('source_documents')
      .select('title, created_at')
      .eq('feed_id', feed.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const status = deriveStatus(feed, latestLog as any);

    statuses.push({
      id: feed.id,
      name: feed.name,
      url: feed.url,
      feed_type: feed.feed_type,
      is_active: feed.is_active,
      check_interval_minutes: feed.check_interval_minutes,
      last_checked_at: feed.last_checked_at ?? null,
      last_successful_sync_at: feed.last_successful_sync_at ?? null,
      latest_alert_title: (latestDoc as any)?.title ?? null,
      latest_alert_at: (latestDoc as any)?.created_at ?? null,
      recent_error: (latestLog as any)?.status === 'error' ? (latestLog as any).error_message : null,
      status,
    });
  }

  return statuses;
}

function deriveStatus(feed: SourceFeed, lastLog: any): FeedStatus['status'] {
  if (!feed.last_checked_at) return 'never_checked';
  if (lastLog?.status === 'error') return 'error';

  const lastCheck = new Date(feed.last_checked_at).getTime();
  const expectedInterval = feed.check_interval_minutes * 60 * 1000;
  const overdueThreshold = expectedInterval * 2;
  const isOverdue = Date.now() - lastCheck > overdueThreshold;

  if (isOverdue) return 'degraded';
  return 'healthy';
}
