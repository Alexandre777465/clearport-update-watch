import Parser from 'rss-parser';
import { computeChecksum } from './checksum';
import type { FetchedItem } from '../types';

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'ClearPort/1.0 (import-rule monitoring)' },
});

export async function parseRssFeed(url: string): Promise<FetchedItem[]> {
  const feed = await parser.parseURL(url);

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
