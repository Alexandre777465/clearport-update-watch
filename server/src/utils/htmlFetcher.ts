import axios from 'axios';
import * as cheerio from 'cheerio';
import { computeChecksum } from './checksum';
import type { FetchedContent } from '../types';

const HTTP = axios.create({
  timeout: 25000,
  headers: {
    'User-Agent': 'ClearPort/1.0 (+https://clearport.io; import-rule monitoring)',
    Accept: 'application/json, application/rss+xml, application/xml, text/html;q=0.9, */*;q=0.8',
  },
  // Don't throw on 3xx; follow redirects (axios follows by default).
});

// Retry transient failures (timeouts, 5xx, network errors) with backoff.
// 4xx responses are not retried — they indicate a bad URL/query.
async function getWithRetry<T = any>(url: string, attempts = 3): Promise<{ data: T }> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await HTTP.get<T>(url);
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status;
      if (typeof status === 'number' && status >= 400 && status < 500) throw err; // not transient
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function fetchHtmlPage(url: string): Promise<FetchedContent> {
  const { data: html } = await getWithRetry<string>(url);
  const $ = cheerio.load(html);

  // Remove boilerplate nodes
  $('script, style, nav, footer, header, .nav, .footer, .header, .sidebar').remove();

  const title = $('title').text().trim() || $('h1').first().text().trim();
  const raw_text = $('body').text().replace(/\s+/g, ' ').trim();

  return {
    url,
    title,
    raw_text,
    raw_html: html,
    checksum: computeChecksum(raw_text),
  };
}

export async function fetchJsonFeed(url: string): Promise<FetchedContent & { items?: any[] }> {
  const { data } = await getWithRetry(url);
  const raw_text = JSON.stringify(data);
  const items = Array.isArray(data) ? data : data?.results ?? data?.articles ?? [];

  return {
    url,
    raw_text,
    checksum: computeChecksum(raw_text),
    items,
  };
}

export function extractLinksFromHtml(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    try {
      links.push(new URL(href, baseUrl).toString());
    } catch {
      // skip malformed URLs
    }
  });
  return [...new Set(links)];
}
