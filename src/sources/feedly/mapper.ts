import type { FeedlyEntry } from './api.js';
import type { SourceArticle } from '../types.js';

function extractLabels(items: Array<{ label?: string }> | undefined): string[] {
  if (!items) return [];
  return items.map((item) => item.label).filter((label): label is string => label !== undefined);
}

export function mapFeedlyEntry(entry: FeedlyEntry): SourceArticle {
  const contentHtml = entry.content?.content ?? entry.summary?.content ?? null;
  const url = entry.alternate?.[0]?.href ?? null;
  const tags = [...extractLabels(entry.tags), ...extractLabels(entry.categories)];

  return {
    sourceId: entry.id,
    sourceName: 'feedly',
    title: entry.title ?? 'Untitled',
    author: entry.author ?? null,
    contentHtml,
    excerpt: entry.summary?.content?.slice(0, 500) ?? null,
    url,
    publicationName: entry.origin?.title ?? null,
    publishedAt: entry.published ? new Date(entry.published).toISOString() : null,
    tags,
  };
}
