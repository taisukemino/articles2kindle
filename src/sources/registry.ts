import type { SourceAdapter } from './types.js';
import { FeedlyAdapter } from './feedly/adapter.js';
import { SubstackAdapter } from './substack/adapter.js';
import type { AppConfig } from '../config/schema.js';
import { hasValidFeedlyConfig, hasValidSubstackConfig } from '../config/schema.js';

export function getAdapter(name: string, config: AppConfig): SourceAdapter {
  switch (name) {
    case 'feedly':
      if (!config.feedly) {
        throw new Error('Feedly is not configured. Add [feedly] section to config.');
      }
      return new FeedlyAdapter(config.feedly);
    case 'substack':
      if (!config.substack) {
        throw new Error('Substack is not configured. Add [[substack.publications]] to config.');
      }
      return new SubstackAdapter(config.substack);
    default:
      throw new Error(`Unknown source adapter: ${name}`);
  }
}

export function getConfiguredAdapterNames(config: Partial<AppConfig>): string[] {
  const names: string[] = [];
  if (hasValidFeedlyConfig(config)) names.push('feedly');
  if (hasValidSubstackConfig(config)) names.push('substack');
  return names;
}
