import envPaths from 'env-paths';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const paths = envPaths('articles2kindle', { suffix: '' });

export function getConfigDir(): string {
  mkdirSync(paths.config, { recursive: true });
  return paths.config;
}

export function getDataDir(): string {
  mkdirSync(paths.data, { recursive: true });
  return paths.data;
}

export function getConfigPath(): string {
  return join(getConfigDir(), 'config.toml');
}

export function getDatabasePath(): string {
  return join(getDataDir(), 'articles2kindle.db');
}

export function getBundleDir(): string {
  const bundleDir = join(getDataDir(), 'bundles');
  mkdirSync(bundleDir, { recursive: true });
  return bundleDir;
}
