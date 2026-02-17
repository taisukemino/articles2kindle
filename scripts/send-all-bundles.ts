import { readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { loadConfig } from '../src/config/manager.js';
import { isValidConfig } from '../src/config/schema.js';
import { sendToKindle } from '../src/email/sender.js';
import { getAllKindleEmails } from '../src/services/send.js';

const BUNDLES_DIR = '/Users/tai/Library/Application Support/articles2kindle/bundles';

async function sendAllBundles() {
  const config = loadConfig();
  if (!isValidConfig(config)) {
    console.error('Invalid configuration. Run "articles2kindle config init" first.');
    process.exit(1);
  }

  const toEmails = getAllKindleEmails(config);
  const epubFiles = readdirSync(BUNDLES_DIR).filter((f) => f.endsWith('.epub'));

  console.log(`Found ${epubFiles.length} EPUB files to send to ${toEmails.join(', ')}`);
  console.log('---');

  let sent = 0;
  let failed = 0;

  for (const file of epubFiles) {
    const epubPath = join(BUNDLES_DIR, file);
    const bundleTitle = basename(file, '.epub');

    try {
      console.log(`[${sent + failed + 1}/${epubFiles.length}] Sending: ${bundleTitle}`);
      await sendToKindle({
        smtpConfig: config.smtp,
        fromEmail: config.kindle.senderEmail,
        toEmails,
        epubPath,
        bundleTitle,
      });
      sent++;
      console.log(`  -> Sent successfully`);
    } catch (error) {
      failed++;
      console.error(`  -> FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log('---');
  console.log(`Done. Sent: ${sent}, Failed: ${failed}, Total: ${epubFiles.length}`);
}

sendAllBundles();
