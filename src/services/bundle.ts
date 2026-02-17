import { writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getUnbundledByPublication, markArticlesBundled } from '../db/queries/articles.js';
import { listPublications } from '../db/queries/publications.js';
import { createBundle } from '../db/queries/bundles.js';
import { buildEpub, type EpubArticle } from '../epub/builder.js';
import { getBundleDir } from '../config/paths.js';

const MAX_BUNDLE_SIZE = 20 * 1024 * 1024; // 20MB to stay under Gmail's 25MB SMTP limit

export interface ArticleRow {
  readonly id: number;
  readonly title: string;
  readonly author: string | null;
  readonly contentHtml: string | null;
  readonly publicationName: string | null;
  readonly publishedAt: string | null;
  readonly url: string | null;
}

export interface BundleResult {
  readonly bundleId: number;
  readonly filePath: string;
  readonly fileSize: number;
  readonly articleCount: number;
}

function _toEpubArticle(article: ArticleRow): EpubArticle {
  return {
    title: article.title,
    author: article.author ?? null,
    contentHtml: article.contentHtml ?? null,
    publicationName: article.publicationName ?? null,
    publishedAt: article.publishedAt ?? null,
    url: article.url ?? null,
  };
}

function _sanitizeFileName(name: string): string {
  return name
    .replace(/[^\p{L}\p{N}\-_ ()]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function summarizeAuthorNames(articles: ArticleRow[]): string {
  const uniqueAuthors = [
    ...new Set(articles.map((article) => article.author).filter(Boolean)),
  ] as string[];
  if (uniqueAuthors.length === 0) return 'Various Authors';
  if (uniqueAuthors.length <= 2) return uniqueAuthors.join(', ');
  return `${uniqueAuthors.slice(0, 2).join(', ')} and ${uniqueAuthors.length - 2} others`;
}

function _saveBundleToDisk(title: string, epubBuffer: Buffer, articleIds: number[]): BundleResult {
  const fileName = `${_sanitizeFileName(title)}.epub`;
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

  return { bundleId, filePath, fileSize, articleCount: articleIds.length };
}

export function buildBundleTitle(publicationName: string, articles: ArticleRow[]): string {
  const authorSummary = summarizeAuthorNames(articles);
  const dateLabel = new Date().toISOString().slice(0, 10);
  return `${publicationName} - ${authorSummary} - Created ${dateLabel}`;
}

export function formatBundleSize(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

export function selectArticlesByPublication(
  publicationQuery: string,
): { publicationName: string; articles: ArticleRow[] } | null {
  const publications = listPublications();
  const query = publicationQuery.toLowerCase().trim();
  const matched =
    publications.find((entry) => entry.publicationName.toLowerCase() === query) ??
    publications.find((entry) => entry.publicationName.toLowerCase().includes(query));

  if (!matched) return null;

  const articles = getUnbundledByPublication(matched.publicationName) as ArticleRow[];
  return { publicationName: matched.publicationName, articles };
}

/**
 * Bundle all unbundled articles for a publication into one or more EPUBs.
 * Automatically splits into parts if the EPUB exceeds MAX_BUNDLE_SIZE.
 */
export async function bundlePublication(
  publicationName: string,
  options: { withImages?: boolean; onProgress?: (message: string) => void } = {},
): Promise<BundleResult[]> {
  const articles = getUnbundledByPublication(publicationName) as ArticleRow[];
  if (articles.length === 0) return [];

  const withImages = options.withImages ?? false;
  const baseTitle = buildBundleTitle(publicationName, articles);
  const epubBuffer = await buildEpub(baseTitle, articles.map(_toEpubArticle), withImages);

  if (epubBuffer.length <= MAX_BUNDLE_SIZE) {
    const result = _saveBundleToDisk(
      baseTitle,
      epubBuffer,
      articles.map((article) => article.id),
    );
    return [result];
  }

  options.onProgress?.('Bundle too large, splitting into parts...');
  const results: BundleResult[] = [];
  let currentChunk: ArticleRow[] = [];
  let partNumber = 1;
  let lastGoodBuffer: Buffer | null = null;

  for (const article of articles) {
    currentChunk.push(article);
    options.onProgress?.(`Sizing part ${partNumber}: ${currentChunk.length} articles...`);

    const testBuffer = await buildEpub(
      `${baseTitle} (Part ${partNumber})`,
      currentChunk.map(_toEpubArticle),
      withImages,
    );

    if (testBuffer.length > MAX_BUNDLE_SIZE && currentChunk.length > 1) {
      currentChunk.pop();
      const partTitle = `${baseTitle} (Part ${partNumber})`;
      const articleIds = currentChunk.map((chunkArticle) => chunkArticle.id);
      const result = _saveBundleToDisk(partTitle, lastGoodBuffer!, articleIds);
      results.push(result);
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
      lastGoodBuffer ?? (await buildEpub(partTitle, currentChunk.map(_toEpubArticle), withImages));
    const articleIds = currentChunk.map((chunkArticle) => chunkArticle.id);
    const result = _saveBundleToDisk(partTitle, finalBuffer, articleIds);
    results.push(result);
  }

  return results;
}
