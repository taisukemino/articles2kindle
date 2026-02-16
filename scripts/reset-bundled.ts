import { getDatabase } from '../src/db/connection.js';
import { articles } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

const db = getDatabase();
db.update(articles).set({ bundled: false, lastBundledAt: null }).where(eq(articles.bundled, true)).run();
console.log('Reset all articles to unbundled.');
