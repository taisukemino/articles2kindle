import { writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { listPublications } from '../src/db/queries/publications.js';
import { getUnbundledByPublication, markArticlesBundled } from '../src/db/queries/articles.js';
import { createBundle } from '../src/db/queries/bundles.js';
import { buildEpub, type EpubArticle } from '../src/epub/builder.js';
import { getBundleDir } from '../src/config/paths.js';

const MAX_BUNDLE_SIZE = 20 * 1024 * 1024;

interface ArticleRow {
  readonly id: number;
  readonly title: string;
  readonly author: string | null;
  readonly contentHtml: string | null;
  readonly publicationName: string | null;
  readonly publishedAt: string | null;
  readonly url: string | null;
}

function toEpubArticle(article: ArticleRow): EpubArticle {
  return {
    title: article.title,
    author: article.author ?? null,
    contentHtml: article.contentHtml ?? null,
    publicationName: article.publicationName ?? null,
    publishedAt: article.publishedAt ?? null,
    url: article.url ?? null,
  };
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^\p{L}\p{N}\-_ ()]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarizeAuthorNames(articles: ArticleRow[]): string {
  const uniqueAuthors = [
    ...new Set(articles.map((article) => article.author).filter(Boolean)),
  ] as string[];
  if (uniqueAuthors.length === 0) return 'Various Authors';
  if (uniqueAuthors.length <= 2) return uniqueAuthors.join(', ');
  return `${uniqueAuthors.slice(0, 2).join(', ')} and ${uniqueAuthors.length - 2} others`;
}

function saveBundleToDisk(
  title: string,
  epubBuffer: Buffer,
  articleIds: number[],
): { bundleId: number; filePath: string; fileSize: number } {
  const fileName = `${sanitizeFileName(title)}.epub`;
  const filePath = join(getBundleDir(), fileName);
  writeFileSync(filePath, epubBuffer);
  const fileSize = statSync(filePath).size;

  const bundleId = createBundle({
    title,
    filePath,
    fileSize,
    articleCount: articleIds.length,
    articleIds,
  });
  markArticlesBundled(articleIds);

  return { bundleId, filePath, fileSize };
}

async function bundlePublication(publicationName: string): Promise<void> {
  const articles = getUnbundledByPublication(publicationName) as ArticleRow[];
  if (articles.length === 0) return;

  const authorSummary = summarizeAuthorNames(articles);
  const dateLabel = new Date().toISOString().slice(0, 10);
  const baseTitle = `${publicationName} - ${authorSummary} - Created ${dateLabel}`;

  // Try building as a single EPUB first
  const epubBuffer = await buildEpub(baseTitle, articles.map(toEpubArticle));

  if (epubBuffer.length <= MAX_BUNDLE_SIZE) {
    const articleIds = articles.map((article) => article.id);
    const result = saveBundleToDisk(baseTitle, epubBuffer, articleIds);
    console.log(
      `  Bundle #${result.bundleId}: ${articles.length} articles, ${(result.fileSize / 1024 / 1024).toFixed(1)}MB`,
    );
    return;
  }

  // Split into parts if too large
  let currentChunk: ArticleRow[] = [];
  let partNumber = 1;
  let lastGoodBuffer: Buffer | null = null;

  for (const article of articles) {
    currentChunk.push(article);
    const testBuffer = await buildEpub(
      `${baseTitle} (Part ${partNumber})`,
      currentChunk.map(toEpubArticle),
    );

    if (testBuffer.length > MAX_BUNDLE_SIZE && currentChunk.length > 1) {
      currentChunk.pop();
      const partTitle = `${baseTitle} (Part ${partNumber})`;
      const articleIds = currentChunk.map((a) => a.id);
      const result = saveBundleToDisk(partTitle, lastGoodBuffer!, articleIds);
      console.log(
        `  Bundle #${result.bundleId}: ${currentChunk.length} articles, ${(result.fileSize / 1024 / 1024).toFixed(1)}MB (Part ${partNumber})`,
      );
      partNumber++;
      currentChunk = [article];
      lastGoodBuffer = null;
    } else {
      lastGoodBuffer = testBuffer;
    }
  }

  if (currentChunk.length > 0) {
    const partTitle = partNumber === 1 ? baseTitle : `${baseTitle} (Part ${partNumber})`;
    const finalBuffer =
      lastGoodBuffer ?? (await buildEpub(partTitle, currentChunk.map(toEpubArticle)));
    const articleIds = currentChunk.map((a) => a.id);
    const result = saveBundleToDisk(partTitle, finalBuffer, articleIds);
    console.log(
      `  Bundle #${result.bundleId}: ${currentChunk.length} articles, ${(result.fileSize / 1024 / 1024).toFixed(1)}MB${partNumber > 1 ? ` (Part ${partNumber})` : ''}`,
    );
  }
}

async function main() {
  const publications = listPublications();
  const unbundled = publications
    .filter((pub) => pub.unbundledCount > 0)
    .sort((first, second) => second.unbundledCount - first.unbundledCount);

  console.log(`Bundling ${unbundled.length} publications...\n`);

  let completed = 0;
  let failed = 0;

  for (const publication of unbundled) {
    console.log(
      `[${completed + 1}/${unbundled.length}] ${publication.publicationName} (${publication.unbundledCount} articles)`,
    );
    try {
      await bundlePublication(publication.publicationName);
      completed++;
    } catch (error) {
      console.error(`  FAILED: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }

  console.log(`\nDone! ${completed} publications bundled, ${failed} failed.`);
}

main();
