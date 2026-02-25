import envPaths from 'env-paths';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const paths = envPaths('articles2kindle', { suffix: '' });

/**
 * Returns the platform-specific data directory, creating it if necessary.
 *
 * @returns The absolute path to the data directory
 */
export function getDataDir(): string {
  mkdirSync(paths.data, { recursive: true });
  return paths.data;
}

/**
 * Returns the full path to the SQLite database file.
 *
 * @returns The absolute path to articles2kindle.db
 */
export function getDatabasePath(): string {
  return join(getDataDir(), 'articles2kindle.db');
}

/**
 * Returns the directory used for storing article bundles, creating it if necessary.
 *
 * @returns The absolute path to the bundles directory
 */
export function getBundleDir(): string {
  const bundleDir = join(getDataDir(), 'bundles');
  mkdirSync(bundleDir, { recursive: true });
  return bundleDir;
}
