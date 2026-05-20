import { parseRssFeed } from '../utils/rssParser';
import { fetchHtmlPage, fetchJsonFeed } from '../utils/htmlFetcher';
import { computeChecksum, normalizeForChecksum } from '../utils/checksum';
import { db } from '../db/client';
import type { SourceFeed, FetchedItem, CheckStatus } from '../types';

export interface FeedCheckResult {
  feedId: string;
  status: CheckStatus;
  documentsFound: number;
  documentsNew: number;
  durationMs: number;
  error?: string;
}

export async function checkFeed(feed: SourceFeed): Promise<FeedCheckResult> {
  const start = Date.now();
  let status: CheckStatus = 'no_change';
  let documentsFound = 0;
  let documentsNew = 0;

  try {
    const items = await fetchItems(feed);
    documentsFound = items.length;

    for (const item of items) {
      const isNew = await storeIfNew(feed, item);
      if (isNew) documentsNew++;
    }

    status = documentsNew > 0 ? 'new_content' : 'no_change';

    await db.from('source_feeds').update({
      last_checked_at: new Date().toISOString(),
      last_successful_sync_at: new Date().toISOString(),
    }).eq('id', feed.id);

  } catch (err: any) {
    status = 'error';
    await logCheck(feed.id, status, documentsFound, documentsNew, Date.now() - start, err.message);
    return { feedId: feed.id, status, documentsFound, documentsNew, durationMs: Date.now() - start, error: err.message };
  }

  await logCheck(feed.id, status, documentsFound, documentsNew, Date.now() - start);
  return { feedId: feed.id, status, documentsFound, documentsNew, durationMs: Date.now() - start };
}

async function fetchItems(feed: SourceFeed): Promise<FetchedItem[]> {
  switch (feed.feed_type) {
    case 'rss':
      return parseRssFeed(feed.url);

    case 'api':
      return fetchApiItems(feed);

    case 'html':
    default: {
      const page = await fetchHtmlPage(feed.url);
      return [{
        url: page.url,
        title: page.title ?? feed.name,
        raw_text: page.raw_text,
        raw_html: page.raw_html,
        checksum: page.checksum,
      }];
    }
  }
}

async function fetchApiItems(feed: SourceFeed): Promise<FetchedItem[]> {
  const result = await fetchJsonFeed(feed.url);
  const raw = result.items ?? [];

  // Federal Register API returns { results: [...] }; fetchJsonFeed resolves
  // data.results as the items array. Map to FetchedItem shape.
  return (raw as any[]).map((item) => {
    const text = [
      item.title ?? '',
      item.abstract ?? item.body_html ?? item.description ?? '',
    ].filter(Boolean).join('\n').trim();

    return {
      url: item.html_url ?? item.url ?? feed.url,
      title: item.title ?? 'Untitled',
      raw_text: text,
      published_at: item.publication_date
        ? new Date(item.publication_date)
        : item.pubDate ? new Date(item.pubDate) : undefined,
      official_reference: item.document_number ?? item.citation ?? undefined,
      checksum: computeChecksum(normalizeForChecksum(text || item.title || feed.url)),
    };
  });
}

async function storeIfNew(feed: SourceFeed, item: FetchedItem): Promise<boolean> {
  const { data: existing } = await db
    .from('source_documents')
    .select('id')
    .eq('feed_id', feed.id)
    .eq('checksum', item.checksum)
    .maybeSingle();

  if (existing) return false;

  const sourceName = (feed as any).source_name || feed.name;

  await db.from('source_documents').insert({
    feed_id: feed.id,
    source_name: sourceName,
    source_url: item.url,
    title: item.title,
    raw_text: item.raw_text,
    raw_html: item.raw_html ?? null,
    published_at: item.published_at?.toISOString() ?? null,
    checksum: item.checksum,
    official_reference: item.official_reference ?? null,
    is_processed: false,
  });

  return true;
}

async function logCheck(
  feedId: string,
  status: CheckStatus,
  documentsFound: number,
  documentsNew: number,
  durationMs: number,
  errorMessage?: string,
): Promise<void> {
  await db.from('source_check_logs').insert({
    feed_id: feedId,
    status,
    documents_found: documentsFound,
    documents_new: documentsNew,
    duration_ms: durationMs,
    error_message: errorMessage ?? null,
  });
}
