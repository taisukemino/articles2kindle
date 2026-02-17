import { sql, desc } from 'drizzle-orm';
import { getDatabase } from '../connection.js';
import { articles } from '../schema.js';

export interface PublicationSummary {
  publicationName: string;
  articleCount: number;
  unbundledCount: number;
}

export function listPublicationNamesByFolder(folderName: string): string[] {
  const db = getDatabase();
  const rows = db
    .selectDistinct({ publicationName: articles.publicationName })
    .from(articles)
    .where(
      sql`${articles.publicationName} is not null and exists (
        select 1 from json_each(${articles.tags}) where json_each.value = ${folderName}
      )`,
    )
    .all();

  return rows.map((row) => row.publicationName).filter((name): name is string => name !== null);
}

export function listPublications(): PublicationSummary[] {
  const db = getDatabase();
  const rows = db
    .select({
      publicationName: articles.publicationName,
      articleCount: sql<number>`count(*)`.as('article_count'),
      unbundledCount: sql<number>`sum(case when ${articles.bundled} = 0 then 1 else 0 end)`.as(
        'unbundled_count',
      ),
    })
    .from(articles)
    .where(sql`${articles.publicationName} is not null`)
    .groupBy(articles.publicationName)
    .orderBy(desc(sql`article_count`))
    .all();

  return rows.map((row) => ({
    publicationName: row.publicationName ?? 'Unknown',
    articleCount: row.articleCount,
    unbundledCount: row.unbundledCount,
  }));
}
