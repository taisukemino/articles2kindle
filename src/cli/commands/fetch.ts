import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../../config/manager.js';
import { isValidConfig } from '../../config/schema.js';
import { fetchFromSource, getSourceNames } from '../../services/fetch.js';
import { printSuccess, printError } from '../output.js';

/**
 * Creates the CLI command for fetching articles from configured sources.
 *
 * @returns The configured Commander command for fetching
 */
export function createFetchCommand(): Command {
  return new Command('fetch')
    .description('Fetch new articles from configured sources')
    .option('--source <name>', 'Fetch from a specific source (feedly, substack, x)')
    .option('--full', 'Full re-fetch ignoring last timestamp')
    .option('--limit <number>', 'Maximum number of articles to fetch', parseInt)
    .action(async (options: { source?: string; full?: boolean; limit?: number }) => {
      const config = loadConfig();
      if (!isValidConfig(config)) {
        printError(
          'Invalid configuration. Check your .env file — see .env.example for required variables.',
        );
        process.exit(1);
      }

      const sourceNames = getSourceNames(config, options.source);

      if (sourceNames.length === 0) {
        printError(
          'No sources configured. Check your .env file — see .env.example for required variables.',
        );
        process.exit(1);
      }

      for (const sourceName of sourceNames) {
        const spinner = ora(`Fetching articles from ${sourceName}...`).start();

        try {
          const result = await fetchFromSource(sourceName, config, {
            full: options.full,
            limit: options.limit,
            onProgress: (progress) => {
              spinner.text = `[${sourceName}] Fetched ${progress.fetchedCount} articles (${progress.newArticleCount} new)...`;
            },
          });

          spinner.stop();
          printSuccess(
            `[${sourceName}] Fetch complete: ${result.fetchedCount} fetched, ${result.newArticleCount} new articles`,
          );
        } catch (error) {
          spinner.stop();
          printError(
            `[${sourceName}] Fetch failed: ${error instanceof Error ? error.message : String(error)}`,
          );
          process.exit(1);
        }
      }
    });
}
