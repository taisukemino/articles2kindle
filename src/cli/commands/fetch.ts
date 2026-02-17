import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../../config/manager.js';
import { isValidConfig } from '../../config/schema.js';
import { fetchArticles } from '../../services/fetch.js';
import { printSuccess, printError } from '../output.js';

export function createFetchCommand(): Command {
  return new Command('fetch')
    .description('Fetch new articles from Feedly Saved For Later')
    .option('--full', 'Full re-fetch ignoring last timestamp')
    .action(async (options: { full?: boolean }) => {
      const config = loadConfig();
      if (!isValidConfig(config)) {
        printError('Invalid configuration. Run "articles2kindle config init" first.');
        process.exit(1);
      }

      const spinner = ora('Fetching articles from Feedly...').start();

      try {
        const result = await fetchArticles(config, {
          full: options.full,
          onProgress: (progress) => {
            spinner.text = `Fetched ${progress.fetched} articles (${progress.newCount} new)...`;
          },
        });

        spinner.stop();
        printSuccess(`Fetch complete: ${result.fetched} fetched, ${result.newCount} new articles`);
      } catch (error) {
        spinner.stop();
        printError(`Fetch failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}
