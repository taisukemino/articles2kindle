import { eq, and, like, desc } from 'drizzle-orm';
import { getDatabase } from '../connection.js';
import { articles } from '../schema.js';

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
  readonly unbundledOnly?: boolean;
  readonly limit?: number;
}

export function listArticles(filter: ArticleFilter = {}) {
  const database = getDatabase();
  const conditions = [];

  if (filter.author) {
    conditions.push(like(articles.authorNormalized, `%${filter.author.toLowerCase()}%`));
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

export function getArticlesByIds(ids: number[]) {
  const database = getDatabase();
  return ids
    .map((articleId) => database.select().from(articles).where(eq(articles.id, articleId)).get())
    .filter(Boolean);
}

export function getUnbundledByAuthor(authorNormalized: string) {
  const database = getDatabase();
  return database
    .select()
    .from(articles)
    .where(and(eq(articles.authorNormalized, authorNormalized), eq(articles.bundled, false)))
    .orderBy(desc(articles.publishedAt))
    .all();
}

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
