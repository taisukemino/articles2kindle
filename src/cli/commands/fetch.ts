import { Command } from 'commander';
import ora from 'ora';
import { loadConfig } from '../../config/manager.js';
import { isValidConfig } from '../../config/schema.js';
import { getAdapter } from '../../sources/registry.js';
import { upsertArticle } from '../../db/queries/articles.js';
import { getDatabase } from '../../db/connection.js';
import { syncLog } from '../../db/schema.js';
import { desc, eq } from 'drizzle-orm';
import { printSuccess, printError } from '../output.js';

function normalizeAuthor(author: string | null): string | null {
  if (!author) return null;
  return author.toLowerCase().trim().replace(/\s+/g, ' ');
}

function countWords(html: string | null): number | null {
  if (!html) return null;
  const textOnly = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return textOnly.split(' ').filter(Boolean).length;
}

function getLastFetchTimestamp(sourceName: string): number | undefined {
  const database = getDatabase();
  const lastEntry = database
    .select({ completedAt: syncLog.completedAt })
    .from(syncLog)
    .where(eq(syncLog.sourceName, sourceName))
    .orderBy(desc(syncLog.completedAt))
    .limit(1)
    .get();

  if (lastEntry?.completedAt) {
    return new Date(lastEntry.completedAt).getTime();
  }
  return undefined;
}

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

      const database = getDatabase();
      const spinner = ora('Fetching articles from Feedly...').start();

      const newerThan = options.full ? undefined : getLastFetchTimestamp('feedly');

      const logEntry = database
        .insert(syncLog)
        .values({
          sourceName: 'feedly',
          startedAt: new Date().toISOString(),
          status: 'running',
        })
        .returning({ id: syncLog.id })
        .get();

      try {
        const adapter = getAdapter('feedly', config);
        let fetched = 0;
        let newCount = 0;

        for await (const batch of adapter.fetchArticles({ newerThan })) {
          for (const article of batch) {
            const isNew = upsertArticle({
              ...article,
              authorNormalized: normalizeAuthor(article.author),
              fetchedAt: new Date().toISOString(),
              wordCount: countWords(article.contentHtml),
            });
            fetched++;
            if (isNew) newCount++;
          }
          spinner.text = `Fetched ${fetched} articles (${newCount} new)...`;
        }

        database
          .update(syncLog)
          .set({
            completedAt: new Date().toISOString(),
            fetched,
            newArticles: newCount,
            status: 'completed',
          })
          .where(eq(syncLog.id, logEntry.id))
          .run();

        spinner.stop();
        printSuccess(`Fetch complete: ${fetched} fetched, ${newCount} new articles`);
      } catch (error) {
        database
          .update(syncLog)
          .set({
            completedAt: new Date().toISOString(),
            status: 'failed',
          })
          .where(eq(syncLog.id, logEntry.id))
          .run();

        spinner.stop();
        printError(`Fetch failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}
