import { listPublications } from '../src/db/queries/publications.js';
import { bundlePublication, formatBundleSize } from '../src/services/bundle.js';

async function main() {
  const publications = listPublications();
  const unbundled = publications
    .filter((pub) => pub.unbundledCount > 0)
    .sort((first, second) => second.unbundledCount - first.unbundledCount);

  console.log(`Bundling ${unbundled.length} publications...\n`);

  let completed = 0;
  let failed = 0;

  for (const publication of unbundled) {
    console.log(
      `[${completed + 1}/${unbundled.length}] ${publication.publicationName} (${publication.unbundledCount} articles)`,
    );
    try {
      const results = await bundlePublication(publication.publicationName);
      for (const result of results) {
        console.log(
          `  Bundle #${result.bundleId}: ${result.articleCount} articles, ${formatBundleSize(result.fileSize)}MB`,
        );
      }
      completed++;
    } catch (error) {
      console.error(`  FAILED: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }

  console.log(`\nDone! ${completed} publications bundled, ${failed} failed.`);
}

main();
