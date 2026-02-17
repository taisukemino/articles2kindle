import { eq } from 'drizzle-orm';
import type { AppConfig } from '../config/schema.js';
import { getDatabase } from '../db/connection.js';
import { bundles } from '../db/schema.js';
import { markBundleSent, cleanupStaleBundles } from '../db/queries/bundles.js';
import { sendToKindle } from '../email/sender.js';

export function getAllKindleEmails(config: AppConfig): string[] {
  const allEmails = new Set<string>();
  allEmails.add(config.kindle.email);
  if (config.kindle.emails) {
    for (const email of config.kindle.emails) {
      allEmails.add(email);
    }
  }
  return [...allEmails];
}

export { cleanupStaleBundles };

export async function sendBundleToKindle(bundleId: number, config: AppConfig): Promise<string> {
  const database = getDatabase();
  const bundle = database.select().from(bundles).where(eq(bundles.id, bundleId)).get();

  if (!bundle) {
    throw new Error(`Bundle #${bundleId} not found.`);
  }
  if (!bundle.filePath) {
    throw new Error(`Bundle #${bundleId} has no file path.`);
  }

  const toEmails = getAllKindleEmails(config);

  await sendToKindle({
    smtpConfig: config.smtp,
    fromEmail: config.kindle.senderEmail,
    toEmails,
    epubPath: bundle.filePath,
    bundleTitle: bundle.title,
  });

  const allRecipients = toEmails.join(', ');
  markBundleSent(bundleId, allRecipients);

  return allRecipients;
}
