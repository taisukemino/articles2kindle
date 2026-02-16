import { Command } from 'commander';
import { listArticles } from '../../db/queries/articles.js';
import { listAuthors } from '../../db/queries/authors.js';
import { listBundles } from '../../db/queries/bundles.js';
import { printTable, printInfo, truncate, formatDate, formatFileSize } from '../output.js';

export function createListCommand(): Command {
  const listCmd = new Command('list')
    .description('List articles, authors, or bundles')
    .option('--author <name>', 'Filter by author name')
    .option('--all', 'Include bundled articles')
    .option('--limit <n>', 'Limit number of results', '50')
    .action((options: { author?: string; all?: boolean; limit: string }) => {
      const articleRows = listArticles({
        author: options.author,
        unbundledOnly: !options.all,
        limit: parseInt(options.limit, 10),
      });

      if (articleRows.length === 0) {
        printInfo('No articles found. Run "articles2kindle fetch" to fetch articles.');
        return;
      }

      printTable(
        ['ID', 'Title', 'Author', 'Publication', 'Date', 'Words', 'Bundled'],
        articleRows.map((article) => [
          String(article.id),
          truncate(article.title, 40),
          truncate(article.author ?? '—', 20),
          truncate(article.publicationName ?? '—', 20),
          formatDate(article.publishedAt),
          article.wordCount ? String(article.wordCount) : '—',
          article.bundled ? 'Yes' : 'No',
        ]),
      );
    });

  listCmd
    .command('authors')
    .description('List all authors with article counts')
    .action(() => {
      const authors = listAuthors();

      if (authors.length === 0) {
        printInfo('No authors found. Run "articles2kindle fetch" to fetch articles.');
        return;
      }

      printTable(
        ['Author', 'Total Articles', 'Unbundled'],
        authors.map((authorRow) => [
          authorRow.author,
          String(authorRow.articleCount),
          String(authorRow.unbundledCount),
        ]),
      );
    });

  listCmd
    .command('bundles')
    .description('List all bundles')
    .action(() => {
      const bundleRows = listBundles();

      if (bundleRows.length === 0) {
        printInfo('No bundles found. Run "articles2kindle bundle" to create one.');
        return;
      }

      printTable(
        ['ID', 'Title', 'Articles', 'Size', 'Created', 'Sent'],
        bundleRows.map((bundle) => [
          String(bundle.id),
          truncate(bundle.title, 40),
          String(bundle.articleCount),
          formatFileSize(bundle.fileSize),
          formatDate(bundle.createdAt),
          bundle.sentAt ? `${formatDate(bundle.sentAt)} → ${bundle.sentTo ?? ''}` : 'No',
        ]),
      );
    });

  return listCmd;
}
