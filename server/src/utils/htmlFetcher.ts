import axios from 'axios';
import * as cheerio from 'cheerio';
import { computeChecksum } from './checksum';
import type { FetchedContent } from '../types';

const HTTP = axios.create({
  timeout: 20000,
  headers: { 'User-Agent': 'ClearPort/1.0 (import-rule monitoring)' },
});

export async function fetchHtmlPage(url: string): Promise<FetchedContent> {
  const { data: html } = await HTTP.get<string>(url);
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
  const { data } = await HTTP.get(url);
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
