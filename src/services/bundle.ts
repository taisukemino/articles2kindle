import { writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  getUnbundledByPublication,
  getUnbundledBySource,
  getAllBySource,
  markArticlesBundled,
} from '../db/queries/articles.js';
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

/**
 * Summarize the unique author names from a list of articles into a readable string.
 *
 * @param articles - The articles to extract author names from
 * @returns A comma-separated summary of author names, truncated with "and N others" if more than two
 */
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

/**
 * Build a descriptive bundle title from the publication name, authors, and current date.
 *
 * @param publicationName - The name of the publication
 * @param articles - The articles included in the bundle
 * @returns A formatted title string like "Publication - Authors - Created YYYY-MM-DD"
 */
export function buildBundleTitle(publicationName: string, articles: ArticleRow[]): string {
  const authorSummary = summarizeAuthorNames(articles);
  const dateLabel = new Date().toISOString().slice(0, 10);
  return `${publicationName} - ${authorSummary} - Created ${dateLabel}`;
}

/**
 * Format a byte count as a human-readable megabyte string.
 *
 * @param bytes - The file size in bytes
 * @returns The size formatted as megabytes with one decimal place (e.g. "1.5")
 */
export function formatBundleSize(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

/**
 * Find a publication matching the query and return its unbundled articles.
 *
 * @param publicationQuery - A full or partial publication name to search for
 * @returns The matched publication name and its unbundled articles, or null if no match is found
 */
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
 * Return all unbundled articles for a source.
 *
 * @param sourceName - The source name (e.g. "feedly", "substack", "x")
 * @returns The source label and its unbundled articles, or null if none exist
 */
export function selectArticlesBySource(
  sourceName: string,
): { label: string; articles: ArticleRow[] } | null {
  // X bundles all current bookmarks (snapshot), other sources bundle only new articles
  const articles =
    sourceName === 'x'
      ? (getAllBySource(sourceName) as ArticleRow[])
      : (getUnbundledBySource(sourceName) as ArticleRow[]);
  if (articles.length === 0) return null;

  const SOURCE_LABELS: Record<string, string> = {
    feedly: 'Feedly',
    substack: 'Substack',
    x: 'X Bookmarks',
  };
  const label = SOURCE_LABELS[sourceName] ?? sourceName;
  return { label, articles };
}

interface BundleOptions {
  readonly withImages?: boolean;
  readonly onProgress?: (message: string) => void;
}

/**
 * Bundle a list of articles into one or more EPUBs.
 * Automatically splits into parts if the EPUB exceeds MAX_BUNDLE_SIZE.
 *
 * @param label - Human-readable label used in the bundle title (e.g. publication name or source name)
 * @param articles - The articles to bundle
 * @param options - Configuration for the bundling process
 * @returns The list of created bundles (empty if no articles provided)
 */
export async function bundleArticles(
  label: string,
  articles: ArticleRow[],
  options: BundleOptions = {},
): Promise<BundleResult[]> {
  if (articles.length === 0) return [];

  const withImages = options.withImages ?? false;
  const baseTitle = buildBundleTitle(label, articles);
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

/**
 * Bundle all unbundled articles for a publication into one or more EPUBs.
 *
 * @param publicationName - The publication to bundle articles for
 * @param options - Configuration for the bundling process
 * @returns The list of created bundles (empty if no unbundled articles exist)
 */
export async function bundlePublication(
  publicationName: string,
  options: BundleOptions = {},
): Promise<BundleResult[]> {
  const articles = getUnbundledByPublication(publicationName) as ArticleRow[];
  return bundleArticles(publicationName, articles, options);
}
