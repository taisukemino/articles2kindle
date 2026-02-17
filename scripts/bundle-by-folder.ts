import { loadConfig } from '../src/config/manager.js';
import { isValidConfig } from '../src/config/schema.js';
import { listPublicationNamesByFolder } from '../src/db/queries/publications.js';
import { fetchArticles } from '../src/services/fetch.js';
import { bundlePublication, formatBundleSize } from '../src/services/bundle.js';
import { sendBundleToKindle, cleanupStaleBundles } from '../src/services/send.js';

async function main() {
  const folderName = process.argv[2];
  if (!folderName) {
    console.error('Usage: npx tsx scripts/bundle-by-folder.ts <folder-name>');
    process.exit(1);
  }

  const config = loadConfig();
  if (!isValidConfig(config)) {
    console.error('Invalid configuration. Run "articles2kindle config init" first.');
    process.exit(1);
  }

  // Step 1: Fetch articles from Saved For Later
  console.log('Step 1: Fetching articles from Saved For Later...');
  const fetchResult = await fetchArticles(config);
  console.log(`  Fetched ${fetchResult.fetched} articles (${fetchResult.newCount} new)\n`);

  // Step 2: Get publication names from the folder
  console.log(`Step 2: Publications in "${folderName}" folder...`);
  const publicationNames = listPublicationNamesByFolder(folderName);
  if (publicationNames.length === 0) {
    console.log(`  No publications found in "${folderName}" folder.`);
    return;
  }
  for (const name of publicationNames) {
    console.log(`  - ${name}`);
  }
  console.log();

  // Step 3: Bundle unbundled articles for each publication
  console.log('Step 3: Bundling by publication...');
  const allBundleIds: number[] = [];

  for (const name of publicationNames) {
    const results = await bundlePublication(name);
    if (results.length === 0) continue;

    for (const result of results) {
      console.log(
        `  ${name}: ${result.articleCount} articles, ${formatBundleSize(result.fileSize)}MB`,
      );
      allBundleIds.push(result.bundleId);
    }
  }

  if (allBundleIds.length === 0) {
    console.log('  No unbundled articles to bundle.');
    return;
  }
  console.log(`  ${allBundleIds.length} bundles created\n`);

  // Step 4: Send bundles to Kindle
  console.log('Step 4: Sending to Kindle...');
  const staleCount = cleanupStaleBundles();
  if (staleCount > 0) {
    console.log(`  Cleaned up ${staleCount} stale bundle(s) with missing files.`);
  }
  for (const bundleId of allBundleIds) {
    const sentTo = await sendBundleToKindle(bundleId, config);
    console.log(`  Sent bundle #${bundleId} to ${sentTo}`);
  }

  console.log('\nDone!');
}

main();
