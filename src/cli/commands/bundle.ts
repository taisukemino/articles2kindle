import { Command } from 'commander';
import ora from 'ora';
import {
  selectArticlesByPublication,
  bundlePublication,
  formatBundleSize,
  type BundleResult,
} from '../../services/bundle.js';
import { printSuccess, printError, printInfo } from '../output.js';

function _printBundleResult(result: BundleResult): void {
  printSuccess(`Bundle #${result.bundleId} created: ${result.filePath}`);
  printInfo(`${result.articleCount} articles, ${formatBundleSize(result.fileSize)}MB`);
}

export function createBundleCommand(): Command {
  return new Command('bundle')
    .description('Create an EPUB bundle from selected articles')
    .requiredOption('--publication <name>', 'Bundle all unbundled articles by publication')
    .option('--title <title>', 'Custom bundle title')
    .option('--with-images', 'Include images in the EPUB (slower, downloads external images)')
    .action(async (options: { publication: string; title?: string; withImages?: boolean }) => {
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

      const spinner = ora(`Building EPUB with ${selection.articles.length} articles...`).start();

      try {
        const results = await bundlePublication(selection.publicationName, {
          withImages: options.withImages,
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
    });
}
