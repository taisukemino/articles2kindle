import { listPublications } from '../src/db/queries/publications.js';

const publications = listPublications();
const unbundled = publications.filter((pub) => pub.unbundledCount > 0);
console.log('Total publications:', publications.length);
console.log('Publications with unbundled articles:', unbundled.length);
console.log(
  'Total unbundled articles:',
  unbundled.reduce((sum, pub) => sum + pub.unbundledCount, 0),
);
console.log('');
console.log('Publications by unbundled count:');
unbundled
  .sort((first, second) => second.unbundledCount - first.unbundledCount)
  .forEach((pub) => {
    console.log(`  ${pub.unbundledCount}\t${pub.publicationName}`);
  });
