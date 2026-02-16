import { sql, desc } from 'drizzle-orm';
import { getDatabase } from '../connection.js';
import { articles } from '../schema.js';

export interface AuthorSummary {
  author: string;
  authorNormalized: string;
  articleCount: number;
  unbundledCount: number;
}

export function listAuthors(): AuthorSummary[] {
  const db = getDatabase();
  const rows = db
    .select({
      author: articles.author,
      authorNormalized: articles.authorNormalized,
      articleCount: sql<number>`count(*)`.as('article_count'),
      unbundledCount: sql<number>`sum(case when ${articles.bundled} = 0 then 1 else 0 end)`.as(
        'unbundled_count',
      ),
    })
    .from(articles)
    .where(sql`${articles.authorNormalized} is not null`)
    .groupBy(articles.authorNormalized)
    .orderBy(desc(sql`article_count`))
    .all();

  return rows.map((row) => ({
    author: row.author ?? 'Unknown',
    authorNormalized: row.authorNormalized ?? '',
    articleCount: row.articleCount,
    unbundledCount: row.unbundledCount,
  }));
}
