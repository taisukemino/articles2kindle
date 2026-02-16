import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../../config/manager.js';
import { isValidConfig } from '../../config/schema.js';
import { getLatestUnsentBundle, getBundleById, markBundleSent } from '../../db/queries/bundles.js';
import { sendToKindle } from '../../email/sender.js';
import { printSuccess, printError, printInfo } from '../output.js';

function getAllKindleEmails(config: {
  kindle: { email: string; emails?: readonly string[] };
}): string[] {
  const allEmails = new Set<string>();
  allEmails.add(config.kindle.email);
  if (config.kindle.emails) {
    for (const email of config.kindle.emails) {
      allEmails.add(email);
    }
  }
  return [...allEmails];
}

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

      const kindleEmails = getAllKindleEmails(config);
      const spinner = ora(
        `Sending "${bundle.title}" to ${kindleEmails.length} device(s)...`,
      ).start();

      try {
        await sendToKindle({
          smtpConfig: config.smtp,
          fromEmail: config.kindle.senderEmail,
          toEmails: kindleEmails,
          epubPath: bundle.filePath,
          bundleTitle: bundle.title,
        });

        const allRecipients = kindleEmails.join(', ');
        markBundleSent(bundle.id, allRecipients);

        spinner.stop();
        printSuccess(`Bundle #${bundle.id} sent to ${allRecipients}`);
      } catch (error) {
        spinner.stop();
        printError(`Failed to send: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}
