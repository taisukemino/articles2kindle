import { desc, eq } from 'drizzle-orm';
import type { AppConfig } from '../config/schema.js';
import { getAdapter } from '../sources/registry.js';
import { upsertArticle } from '../db/queries/articles.js';
import { getDatabase } from '../db/connection.js';
import { syncLog } from '../db/schema.js';

function normalizeAuthor(author: string | null): string | null {
  if (!author) return null;
  return author.toLowerCase().trim().replace(/\s+/g, ' ');
}

function countWords(html: string | null): number | null {
  if (!html) return null;
  const textOnly = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return textOnly.split(' ').filter(Boolean).length;
}

function getLastFetchTimestamp(sourceName: string): number | undefined {
  const database = getDatabase();
  const lastEntry = database
    .select({ completedAt: syncLog.completedAt })
    .from(syncLog)
    .where(eq(syncLog.sourceName, sourceName))
    .orderBy(desc(syncLog.completedAt))
    .limit(1)
    .get();

  if (lastEntry?.completedAt) {
    return new Date(lastEntry.completedAt).getTime();
  }
  return undefined;
}

export interface FetchResult {
  readonly fetched: number;
  readonly newCount: number;
}

export interface FetchProgress {
  readonly fetched: number;
  readonly newCount: number;
}

export async function fetchArticles(
  config: AppConfig,
  options: { full?: boolean; onProgress?: (progress: FetchProgress) => void } = {},
): Promise<FetchResult> {
  const database = getDatabase();
  const newerThan = options.full ? undefined : getLastFetchTimestamp('feedly');

  const logEntry = database
    .insert(syncLog)
    .values({ sourceName: 'feedly', startedAt: new Date().toISOString(), status: 'running' })
    .returning({ id: syncLog.id })
    .get();

  try {
    const adapter = getAdapter('feedly', config);
    let fetched = 0;
    let newCount = 0;

    for await (const batch of adapter.fetchArticles({ newerThan })) {
      for (const article of batch) {
        const isNew = upsertArticle({
          ...article,
          authorNormalized: normalizeAuthor(article.author),
          fetchedAt: new Date().toISOString(),
          wordCount: countWords(article.contentHtml),
        });
        fetched++;
        if (isNew) newCount++;
      }
      options.onProgress?.({ fetched, newCount });
    }

    database
      .update(syncLog)
      .set({
        completedAt: new Date().toISOString(),
        fetched,
        newArticles: newCount,
        status: 'completed',
      })
      .where(eq(syncLog.id, logEntry.id))
      .run();

    return { fetched, newCount };
  } catch (error) {
    database
      .update(syncLog)
      .set({ completedAt: new Date().toISOString(), status: 'failed' })
      .where(eq(syncLog.id, logEntry.id))
      .run();
    throw error;
  }
}
