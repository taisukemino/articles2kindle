import { Command } from 'commander';
import ora from 'ora';
import { getUnbundledByPublication } from '../../db/queries/articles.js';
import { listPublications } from '../../db/queries/publications.js';
import {
  bundlePublication,
  formatBundleSize,
  type ArticleRow,
} from '../../services/bundle.js';
import { printSuccess, printError, printInfo } from '../output.js';

function selectArticlesByPublication(
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

      const spinner = ora(
        `Building EPUB with ${selection.articles.length} articles...`,
      ).start();

      try {
        const results = await bundlePublication(selection.publicationName, {
          onProgress: (message) => {
            spinner.text = message;
          },
        });

        spinner.stop();

        for (const result of results) {
          printSuccess(`Bundle #${result.bundleId} created: ${result.filePath}`);
          printInfo(`${result.articleCount} articles, ${formatBundleSize(result.fileSize)}MB`);
        }

        if (results.length > 1) {
          printSuccess(`Split into ${results.length} parts.`);
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
