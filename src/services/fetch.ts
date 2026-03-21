import { desc, eq } from 'drizzle-orm';
import type { AppConfig } from '../config/schema.js';
import { getAdapter, getConfiguredAdapterNames } from '../sources/registry.js';
import {
  upsertArticle,
  normalizeAuthor,
  countWordsInHtml,
  getSourceIds,
  removeUnbookmarkedArticles,
} from '../db/queries/articles.js';
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
  readonly removedCount: number;
}

export interface FetchProgress {
  readonly fetchedCount: number;
  readonly newArticleCount: number;
}

/**
 * Resolve which source names to fetch from, either a single filter or all configured sources.
 *
 * @param config - The application configuration containing source definitions
 * @param sourceFilter - Optional source name to restrict fetching to a single source
 * @returns The list of source names to fetch from
 */
export function getSourceNames(config: AppConfig, sourceFilter?: string): string[] {
  return sourceFilter ? [sourceFilter] : getConfiguredAdapterNames(config);
}

/**
 * Fetch articles from a single source, upsert them into the database, and log the sync.
 *
 * @param sourceName - The name of the source to fetch from
 * @param config - The application configuration
 * @param options - Configuration for the fetch operation
 * @param options.full - Whether to perform a full fetch ignoring the last sync timestamp
 * @param options.limit
 * @param options.onProgress - Callback invoked after each batch with running totals
 * @returns The total number of articles fetched and the count of newly inserted articles
 */
export async function fetchFromSource(
  sourceName: string,
  config: AppConfig,
  options: { full?: boolean; limit?: number; onProgress?: (progress: FetchProgress) => void } = {},
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
    const isFullXFetch = sourceName === 'x' && options.full;
    const knownSourceIds =
      sourceName === 'x' && !options.full ? getSourceIds(sourceName) : undefined;
    let fetchedCount = 0;
    let newArticleCount = 0;
    const seenSourceIds = new Set<string>();

    for await (const batch of adapter.fetchArticles({
      newerThan,
      knownSourceIds,
      count: options.limit,
    })) {
      for (const article of batch) {
        seenSourceIds.add(article.sourceId);
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

    // Remove articles that were unbookmarked on X (only during full fetch)
    let removedCount = 0;
    if (isFullXFetch && seenSourceIds.size > 0) {
      removedCount = removeUnbookmarkedArticles(sourceName, seenSourceIds);
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

    return { fetchedCount, newArticleCount, removedCount };
  } catch (error) {
    database
      .update(syncLog)
      .set({ completedAt: new Date().toISOString(), status: 'failed' })
      .where(eq(syncLog.id, logEntry.id))
      .run();
    throw error;
  }
}
