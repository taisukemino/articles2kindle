import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import TOML from '@iarna/toml';
import { getConfigPath } from './paths.js';
import type { AppConfig } from './schema.js';

export function loadConfig(): Partial<AppConfig> {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return {};
  }
  const raw = readFileSync(configPath, 'utf-8');
  return TOML.parse(raw) as unknown as Partial<AppConfig>;
}

export function saveConfig(config: Partial<AppConfig>): void {
  const configPath = getConfigPath();
  const tomlString = TOML.stringify(config as unknown as TOML.JsonMap);
  writeFileSync(configPath, tomlString, 'utf-8');
}

export function maskSecrets(config: Partial<AppConfig>): Record<string, unknown> {
  const masked = JSON.parse(JSON.stringify(config)) as Record<string, Record<string, unknown>>;

  if (masked['feedly']?.['accessToken']) {
    const token = String(masked['feedly']['accessToken']);
    masked['feedly']['accessToken'] = token.slice(0, 8) + '...' + token.slice(-4);
  }
  if (masked['smtp']?.['pass']) {
    masked['smtp']['pass'] = '********';
  }

  return masked;
}
