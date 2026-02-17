import { existsSync } from 'node:fs';
import { eq, isNull, desc } from 'drizzle-orm';
import { getDatabase } from '../connection.js';
import { bundles, bundleArticles } from '../schema.js';

export interface InsertBundle {
  readonly title: string;
  readonly filePath: string;
  readonly fileSize: number;
  readonly articleCount: number;
  readonly articleIds: readonly number[];
}

export function createBundle(bundle: InsertBundle): number {
  const database = getDatabase();
  const now = new Date().toISOString();

  const result = database
    .insert(bundles)
    .values({
      title: bundle.title,
      createdAt: now,
      filePath: bundle.filePath,
      fileSize: bundle.fileSize,
      articleCount: bundle.articleCount,
    })
    .returning({ id: bundles.id })
    .get();

  bundle.articleIds.forEach((articleId, orderIndex) => {
    database
      .insert(bundleArticles)
      .values({
        bundleId: result.id,
        articleId,
        orderIndex,
      })
      .run();
  });

  return result.id;
}

export function listBundles() {
  const database = getDatabase();
  return database
    .select({
      id: bundles.id,
      title: bundles.title,
      createdAt: bundles.createdAt,
      sentAt: bundles.sentAt,
      sentTo: bundles.sentTo,
      articleCount: bundles.articleCount,
      fileSize: bundles.fileSize,
    })
    .from(bundles)
    .orderBy(desc(bundles.createdAt))
    .all();
}

export function getLatestUnsentBundle() {
  const database = getDatabase();
  return database
    .select()
    .from(bundles)
    .where(isNull(bundles.sentAt))
    .orderBy(desc(bundles.createdAt))
    .limit(1)
    .get();
}

export function getBundleById(id: number) {
  const database = getDatabase();
  return database.select().from(bundles).where(eq(bundles.id, id)).get();
}

export function cleanupStaleBundles(): number {
  const database = getDatabase();
  const all = database.select({ id: bundles.id, filePath: bundles.filePath }).from(bundles).all();

  let deleted = 0;
  for (const bundle of all) {
    const fileIsMissing = !bundle.filePath || !existsSync(bundle.filePath);
    if (fileIsMissing) {
      database.delete(bundleArticles).where(eq(bundleArticles.bundleId, bundle.id)).run();
      database.delete(bundles).where(eq(bundles.id, bundle.id)).run();
      deleted++;
    }
  }
  return deleted;
}

export function markBundleSent(bundleId: number, sentTo: string): void {
  const database = getDatabase();
  const now = new Date().toISOString();
  database.update(bundles).set({ sentAt: now, sentTo }).where(eq(bundles.id, bundleId)).run();
}
