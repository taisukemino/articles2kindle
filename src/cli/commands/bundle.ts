import { Command } from 'commander';
import ora from 'ora';
import {
  selectArticlesByPublication,
  selectArticlesBySource,
  bundleArticles,
  formatBundleSize,
  type BundleResult,
  type ArticleRow,
} from '../../services/bundle.js';
import { printSuccess, printError, printInfo } from '../output.js';

function _printBundleResult(result: BundleResult): void {
  printSuccess(`Bundle #${result.bundleId} created: ${result.filePath}`);
  printInfo(`${result.articleCount} articles, ${formatBundleSize(result.fileSize)}MB`);
}

/**
 * Creates the CLI command for bundling articles into EPUB files.
 *
 * @returns The configured Commander command for bundling
 */
export function createBundleCommand(): Command {
  return new Command('bundle')
    .description('Create an EPUB bundle from selected articles')
    .option('--publication <name>', 'Bundle all unbundled articles by publication')
    .option('--source <name>', 'Bundle all unbundled articles by source (e.g. feedly, substack, x)')
    .option('--title <title>', 'Custom bundle title')
    .option('--no-images', 'Exclude images from the EPUB')
    .action(
      async (options: {
        publication?: string;
        source?: string;
        title?: string;
        images: boolean;
      }) => {
        if (!options.publication && !options.source) {
          printError(
            'Specify --publication or --source. Run "articles2kindle list" to see articles.',
          );
          process.exit(1);
        }

        let label: string;
        let bundleArticleRows: ArticleRow[];

        if (options.source) {
          const selection = selectArticlesBySource(options.source);
          if (!selection) {
            printInfo(`No unbundled articles found for source "${options.source}".`);
            return;
          }
          label = selection.label;
          bundleArticleRows = selection.articles;
        } else {
          const selection = selectArticlesByPublication(options.publication!);
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
          label = selection.publicationName;
          bundleArticleRows = selection.articles;
        }

        const spinner = ora(`Building EPUB with ${bundleArticleRows.length} articles...`).start();

        try {
          const results = await bundleArticles(label, bundleArticleRows, {
            withImages: options.images,
            onProgress: (message) => {
              spinner.text = message;
            },
          });

          spinner.stop();

          for (const result of results) {
            _printBundleResult(result);
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
      },
    );
}
