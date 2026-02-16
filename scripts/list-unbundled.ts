import { listAuthors } from '../src/db/queries/authors.js';

const authors = listAuthors();
const unbundled = authors.filter((author) => author.unbundledCount > 0);
console.log('Total authors:', authors.length);
console.log('Authors with unbundled articles:', unbundled.length);
console.log(
  'Total unbundled articles:',
  unbundled.reduce((sum, author) => sum + author.unbundledCount, 0),
);
console.log('');
console.log('Authors by unbundled count:');
unbundled
  .sort((first, second) => second.unbundledCount - first.unbundledCount)
  .forEach((author) => {
    console.log(`  ${author.unbundledCount}\t${author.author}`);
  });
