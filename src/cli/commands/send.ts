import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../../config/manager.js';
import { isValidConfig } from '../../config/schema.js';
import { getLatestUnsentBundle, getBundleById } from '../../db/queries/bundles.js';
import { sendBundleToKindle, cleanupStaleBundles } from '../../services/send.js';
import { printSuccess, printError, printInfo } from '../output.js';

export function createSendCommand(): Command {
  return new Command('send')
    .description('Send an EPUB bundle to Kindle via email')
    .option('--bundle <id>', 'Specific bundle ID to send')
    .action(async (options: { bundle?: string }) => {
      const config = loadConfig();
      if (!isValidConfig(config)) {
        printError('Invalid configuration. Run "articles2kindle config init" first.');
        process.exit(1);
      }

      const staleCount = cleanupStaleBundles();
      if (staleCount > 0) {
        printInfo(`Cleaned up ${staleCount} stale bundle(s) with missing files.`);
      }

      const bundle = options.bundle
        ? getBundleById(parseInt(options.bundle, 10))
        : getLatestUnsentBundle();

      if (!bundle) {
        printInfo('No unsent bundles found. Run "articles2kindle bundle" to create one.');
        return;
      }

      if (!bundle.filePath) {
        printError(`Bundle #${bundle.id} has no file path.`);
        process.exit(1);
      }

      const spinner = ora(`Sending "${bundle.title}"...`).start();

      try {
        const sentTo = await sendBundleToKindle(bundle.id, config);
        spinner.stop();
        printSuccess(`Bundle #${bundle.id} sent to ${sentTo}`);
      } catch (error) {
        spinner.stop();
        printError(`Failed to send: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}
