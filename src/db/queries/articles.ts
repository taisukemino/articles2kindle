import { eq, and, like, desc } from 'drizzle-orm';
import { getDatabase } from '../connection.js';
import { articles } from '../schema.js';

/**
 * Normalizes an author name to lowercase, trimmed, single-spaced format.
 *
 * @param author - The raw author name to normalize
 * @returns The normalized author name, or null if the input is falsy
 */
export function normalizeAuthor(author: string | null): string | null {
  if (!author) return null;
  return author.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Counts the number of words in an HTML string after stripping all tags.
 *
 * @param html - The HTML content to count words in
 * @returns The word count, or null if the input is falsy
 */
export function countWordsInHtml(html: string | null): number | null {
  if (!html) return null;
  const textOnly = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return textOnly.split(' ').filter(Boolean).length;
}

export interface InsertArticle {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly title: string;
  readonly author: string | null;
  readonly authorNormalized: string | null;
  readonly contentHtml: string | null;
  readonly excerpt: string | null;
  readonly url: string | null;
  readonly publicationName: string | null;
  readonly publishedAt: string | null;
  readonly fetchedAt: string;
  readonly wordCount: number | null;
  readonly tags: readonly string[] | null;
}

/**
 * Inserts an article if it does not already exist for the given source name and source ID.
 *
 * @param article - The article data to insert
 * @returns True if a new article was inserted, false if it already existed
 */
export function upsertArticle(article: InsertArticle): boolean {
  const database = getDatabase();
  const existing = database
    .select({ id: articles.id })
    .from(articles)
    .where(
      and(eq(articles.sourceName, article.sourceName), eq(articles.sourceId, article.sourceId)),
    )
    .get();

  if (existing) {
    return false;
  }

  database
    .insert(articles)
    .values({ ...article, tags: article.tags ? [...article.tags] : null })
    .run();
  return true;
}

export interface ArticleFilter {
  readonly author?: string;
  readonly sourceName?: string;
  readonly unbundledOnly?: boolean;
  readonly limit?: number;
}

/**
 * Lists articles matching the given filter criteria, ordered by published date descending.
 *
 * @param filter - Criteria to filter articles by author, bundled status, or limit
 * @returns An array of matching article summary objects
 */
export function listArticles(filter: ArticleFilter = {}) {
  const database = getDatabase();
  const conditions = [];

  if (filter.author) {
    conditions.push(like(articles.authorNormalized, `%${filter.author.toLowerCase()}%`));
  }
  if (filter.sourceName) {
    conditions.push(eq(articles.sourceName, filter.sourceName));
  }
  if (filter.unbundledOnly) {
    conditions.push(eq(articles.bundled, false));
  }

  const query = database
    .select({
      id: articles.id,
      title: articles.title,
      author: articles.author,
      publicationName: articles.publicationName,
      publishedAt: articles.publishedAt,
      wordCount: articles.wordCount,
      bundled: articles.bundled,
      url: articles.url,
    })
    .from(articles)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(articles.publishedAt));

  if (filter.limit) {
    return query.limit(filter.limit).all();
  }
  return query.all();
}

/**
 * Retrieves all known source IDs for a given source name.
 *
 * @param sourceName - The source name to look up (e.g. "feedly", "x")
 * @returns A set of source IDs already stored for that source
 */
export function getSourceIds(sourceName: string): Set<string> {
  const database = getDatabase();
  const rows = database
    .select({ sourceId: articles.sourceId })
    .from(articles)
    .where(eq(articles.sourceName, sourceName))
    .all();
  return new Set(rows.map((row) => row.sourceId));
}

/**
 * Fetches full article records by their database IDs.
 *
 * @param ids - The article database IDs to retrieve
 * @returns An array of article records (excludes any IDs not found)
 */
export function getArticlesByIds(ids: number[]) {
  const database = getDatabase();
  return ids
    .map((articleId) => database.select().from(articles).where(eq(articles.id, articleId)).get())
    .filter(Boolean);
}

/**
 * Retrieves all unbundled articles for a given publication, ordered by published date descending.
 *
 * @param publicationName - The publication name to filter by
 * @returns An array of unbundled article records for the publication
 */
export function getUnbundledByPublication(publicationName: string) {
  const database = getDatabase();
  return database
    .select()
    .from(articles)
    .where(and(eq(articles.publicationName, publicationName), eq(articles.bundled, false)))
    .orderBy(desc(articles.publishedAt))
    .all();
}

/**
 * Retrieves all unbundled articles for a given source, ordered by published date descending.
 *
 * @param sourceName - The source name to filter by (e.g. "feedly", "substack", "x")
 * @returns An array of unbundled article records for the source
 */
export function getUnbundledBySource(sourceName: string) {
  const database = getDatabase();
  return database
    .select()
    .from(articles)
    .where(and(eq(articles.sourceName, sourceName), eq(articles.bundled, false)))
    .orderBy(desc(articles.publishedAt))
    .all();
}

/**
 * Marks the given articles as bundled and records the current timestamp.
 *
 * @param articleIds - The database IDs of articles to mark as bundled
 */
export function markArticlesBundled(articleIds: number[]): void {
  const database = getDatabase();
  const now = new Date().toISOString();
  for (const articleId of articleIds) {
    database
      .update(articles)
      .set({ bundled: true, lastBundledAt: now })
      .where(eq(articles.id, articleId))
      .run();
  }
}
