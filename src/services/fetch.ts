import { desc, eq } from 'drizzle-orm';
import type { AppConfig } from '../config/schema.js';
import { getAdapter, getConfiguredAdapterNames } from '../sources/registry.js';
import { upsertArticle, normalizeAuthor, countWordsInHtml } from '../db/queries/articles.js';
import { getDatabase } from '../db/connection.js';
import { syncLog } from '../db/schema.js';

function _getLastFetchTimestamp(sourceName: string): number | undefined {
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
  readonly fetchedCount: number;
  readonly newArticleCount: number;
}

export interface FetchProgress {
  readonly fetchedCount: number;
  readonly newArticleCount: number;
}

export function getSourceNames(config: AppConfig, sourceFilter?: string): string[] {
  return sourceFilter ? [sourceFilter] : getConfiguredAdapterNames(config);
}

export async function fetchFromSource(
  sourceName: string,
  config: AppConfig,
  options: { full?: boolean; onProgress?: (progress: FetchProgress) => void } = {},
): Promise<FetchResult> {
  const database = getDatabase();
  const newerThan = options.full ? undefined : _getLastFetchTimestamp(sourceName);

  const logEntry = database
    .insert(syncLog)
    .values({ sourceName, startedAt: new Date().toISOString(), status: 'running' })
    .returning({ id: syncLog.id })
    .get();

  try {
    const adapter = getAdapter(sourceName, config);
    let fetchedCount = 0;
    let newArticleCount = 0;

    for await (const batch of adapter.fetchArticles({ newerThan })) {
      for (const article of batch) {
        const isNew = upsertArticle({
          ...article,
          authorNormalized: normalizeAuthor(article.author),
          fetchedAt: new Date().toISOString(),
          wordCount: countWordsInHtml(article.contentHtml),
        });
        fetchedCount++;
        if (isNew) newArticleCount++;
      }
      options.onProgress?.({ fetchedCount, newArticleCount });
    }

    database
      .update(syncLog)
      .set({
        completedAt: new Date().toISOString(),
        fetched: fetchedCount,
        newArticles: newArticleCount,
        status: 'completed',
      })
      .where(eq(syncLog.id, logEntry.id))
      .run();

    return { fetchedCount, newArticleCount };
  } catch (error) {
    database
      .update(syncLog)
      .set({ completedAt: new Date().toISOString(), status: 'failed' })
      .where(eq(syncLog.id, logEntry.id))
      .run();
    throw error;
  }
}
