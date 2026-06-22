import Parser from 'rss-parser';
import { computeChecksum } from './checksum';
import type { FetchedItem } from '../types';

const parser = new Parser({
  timeout: 20000,
  headers: {
    'User-Agent': 'ClearPort/1.0 (+https://clearport.io; import-rule monitoring)',
    Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
  },
});

export async function parseRssFeed(url: string): Promise<FetchedItem[]> {
  // Retry transient network/timeout failures with backoff.
  let feed;
  let lastErr: any;
  for (let i = 0; i < 3; i++) {
    try {
      feed = await parser.parseURL(url);
      break;
    } catch (err) {
      lastErr = err;
      if (i < 2) await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  if (!feed) throw lastErr;

  return (feed.items ?? []).map((item) => {
    const rawText = [item.title, item.contentSnippet ?? item.content ?? ''].join('\n').trim();
    return {
      url: item.link ?? url,
      title: item.title ?? 'Untitled',
      raw_text: rawText,
      raw_html: item.content,
      published_at: item.pubDate ? new Date(item.pubDate) : undefined,
      checksum: computeChecksum(rawText),
    };
  });
}
