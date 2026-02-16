import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const articles = sqliteTable(
  'articles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sourceId: text('source_id').notNull(),
    sourceName: text('source_name').notNull(),
    title: text('title').notNull(),
    author: text('author'),
    authorNormalized: text('author_normalized'),
    contentHtml: text('content_html'),
    excerpt: text('excerpt'),
    url: text('url'),
    publicationName: text('publication_name'),
    publishedAt: text('published_at'),
    fetchedAt: text('fetched_at').notNull(),
    wordCount: integer('word_count'),
    tags: text('tags', { mode: 'json' }).$type<string[]>(),
    bundled: integer('bundled', { mode: 'boolean' }).default(false),
    lastBundledAt: text('last_bundled_at'),
  },
  (table) => [
    uniqueIndex('source_unique_idx').on(table.sourceName, table.sourceId),
    index('author_normalized_idx').on(table.authorNormalized),
    index('publication_name_idx').on(table.publicationName),
  ],
);

export const bundles = sqliteTable('bundles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  createdAt: text('created_at').notNull(),
  sentAt: text('sent_at'),
  sentTo: text('sent_to'),
  filePath: text('file_path'),
  fileSize: integer('file_size'),
  articleCount: integer('article_count').notNull(),
});

export const bundleArticles = sqliteTable(
  'bundle_articles',
  {
    bundleId: integer('bundle_id')
      .notNull()
      .references(() => bundles.id),
    articleId: integer('article_id')
      .notNull()
      .references(() => articles.id),
    orderIndex: integer('order_index').notNull(),
  },
  (table) => [uniqueIndex('bundle_article_unique_idx').on(table.bundleId, table.articleId)],
);

export const syncLog = sqliteTable('sync_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceName: text('source_name').notNull(),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  fetched: integer('fetched').default(0),
  newArticles: integer('new_articles').default(0),
  status: text('status').notNull().default('running'),
});
