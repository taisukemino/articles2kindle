import { Command } from 'commander';
import { writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ora from 'ora';
import { getUnbundledByPublication, markArticlesBundled } from '../../db/queries/articles.js';
import { listPublications } from '../../db/queries/publications.js';
import { createBundle } from '../../db/queries/bundles.js';
import { buildEpub, type EpubArticle } from '../../epub/builder.js';
import { getBundleDir } from '../../config/paths.js';
import { printSuccess, printError, printInfo } from '../output.js';

const MAX_BUNDLE_SIZE = 20 * 1024 * 1024; // 20MB to stay under Gmail's 25MB SMTP limit

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

function extractArticleIds(articles: ArticleRow[]): number[] {
  return articles.map((article) => article.id);
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

function formatBundleSize(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

function printBundleResult(
  result: { bundleId: number; filePath: string; fileSize: number },
  articleCount: number,
): void {
  printSuccess(`Bundle #${result.bundleId} created: ${result.filePath}`);
  printInfo(`${articleCount} articles, ${formatBundleSize(result.fileSize)}MB`);
}

/**
 * Split articles into chunks where each chunk's EPUB is under MAX_BUNDLE_SIZE.
 * Builds incrementally: adds articles one by one, and when the next article
 * would push the EPUB over the limit, starts a new chunk.
 */
async function splitIntoParts(
  baseTitle: string,
  articles: ArticleRow[],
  spinner: ReturnType<typeof ora>,
): Promise<void> {
  let currentChunk: ArticleRow[] = [];
  let partNumber = 1;
  let lastGoodBuffer: Buffer | null = null;

  for (let index = 0; index < articles.length; index++) {
    const currentArticle = articles[index]!;
    currentChunk.push(currentArticle);
    spinner.text = `Sizing part ${partNumber}: ${currentChunk.length} articles...`;

    const testBuffer = await buildEpub(
      `${baseTitle} (Part ${partNumber})`,
      currentChunk.map(toEpubArticle),
    );

    const isOverLimit = testBuffer.length > MAX_BUNDLE_SIZE && currentChunk.length > 1;

    if (isOverLimit) {
      currentChunk.pop();
      const partTitle = `${baseTitle} (Part ${partNumber})`;
      const result = saveBundleToDisk(partTitle, lastGoodBuffer!, extractArticleIds(currentChunk));
      spinner.stop();
      printBundleResult(result, currentChunk.length);
      spinner.start();

      partNumber++;
      currentChunk = [currentArticle];
      lastGoodBuffer = null;
    } else {
      lastGoodBuffer = testBuffer;
    }
  }

  if (currentChunk.length > 0) {
    const partTitle = partNumber === 1 ? baseTitle : `${baseTitle} (Part ${partNumber})`;
    spinner.text = `Building final part with ${currentChunk.length} articles...`;

    const finalBuffer =
      lastGoodBuffer ?? (await buildEpub(partTitle, currentChunk.map(toEpubArticle)));
    const result = saveBundleToDisk(partTitle, finalBuffer, extractArticleIds(currentChunk));
    spinner.stop();
    printBundleResult(result, currentChunk.length);
  }

  if (partNumber > 1) {
    printSuccess(`Split into ${partNumber} parts.`);
  }
}

function selectArticlesByPublication(
  publicationQuery: string,
): { articles: ArticleRow[]; title: string } | null {
  const publications = listPublications();
  const query = publicationQuery.toLowerCase().trim();
  const matched =
    publications.find((entry) => entry.publicationName.toLowerCase() === query) ??
    publications.find((entry) => entry.publicationName.toLowerCase().includes(query));

  if (!matched) return null;

  const articles = getUnbundledByPublication(matched.publicationName) as ArticleRow[];
  const authorSummary = summarizeAuthorNames(articles);
  const dateLabel = new Date().toISOString().slice(0, 10);
  const title = `${matched.publicationName} - ${authorSummary} - Created ${dateLabel}`;
  return { articles, title };
}

export function createBundleCommand(): Command {
  return new Command('bundle')
    .description('Create an EPUB bundle from selected articles')
    .requiredOption('--publication <name>', 'Bundle all unbundled articles by publication')
    .option('--title <title>', 'Custom bundle title')
    .action(async (options: { publication: string; title?: string }) => {
      const selection = selectArticlesByPublication(options.publication);
      if (!selection) {
        printError(
          `Publication "${options.publication}" not found. Run "articles2kindle list publications" to see available publications.`,
        );
        process.exit(1);
      }
      if (selection.articles.length === 0) {
        printInfo('No unbundled articles found for this publication.');
        return;
      }

      const bundleTitle = options.title ?? selection.title;
      const selectedArticles = selection.articles;

      const spinner = ora(`Building EPUB with ${selectedArticles.length} articles...`).start();

      try {
        const epubBuffer = await buildEpub(bundleTitle, selectedArticles.map(toEpubArticle));

        if (epubBuffer.length <= MAX_BUNDLE_SIZE) {
          const result = saveBundleToDisk(
            bundleTitle,
            epubBuffer,
            extractArticleIds(selectedArticles),
          );
          spinner.stop();
          printBundleResult(result, selectedArticles.length);
        } else {
          spinner.text = 'Bundle too large, splitting into parts...';
          await splitIntoParts(bundleTitle, selectedArticles, spinner);
        }
      } catch (error) {
        spinner.stop();
        printError(
          `Failed to create bundle: ${error instanceof Error ? error.message : String(error)}`,
        );
        process.exit(1);
      }
    });
}
