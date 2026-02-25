import type { SourceAdapter } from './types.js';
import { FeedlyAdapter } from './feedly/adapter.js';
import { SubstackAdapter } from './substack/adapter.js';
import { XAdapter } from './x/adapter.js';
import type { AppConfig } from '../config/schema.js';
import { hasValidFeedlyConfig, hasValidSubstackConfig, hasValidXEnv } from '../config/schema.js';

/**
 * Resolve a source adapter by name, validating that its configuration exists.
 *
 * @param name - Adapter identifier (e.g. "feedly", "substack", "x")
 * @param config - Full application configuration
 * @returns The instantiated source adapter
 */
export function getAdapter(name: string, config: AppConfig): SourceAdapter {
  switch (name) {
    case 'feedly':
      if (!config.feedly) {
        throw new Error(
          'Feedly is not configured. Set FEEDLY_ACCESS_TOKEN and FEEDLY_STREAM_ID in .env.',
        );
      }
      return new FeedlyAdapter(config.feedly);
    case 'substack':
      if (!config.substack) {
        throw new Error('Substack is not configured. Set SUBSTACK_URLS in .env.');
      }
      return new SubstackAdapter(config.substack);
    case 'x':
      if (!hasValidXEnv()) {
        throw new Error(
          'X is not configured. Set X_CLIENT_SECRET_ID in your .env file and run "articles2kindle x auth".',
        );
      }
      return new XAdapter();
    default:
      throw new Error(`Unknown source adapter: ${name}`);
  }
}

/**
 * List the names of all adapters whose configuration is present and valid.
 *
 * @param config - Partial application configuration to inspect
 * @returns Array of adapter names that are properly configured
 */
export function getConfiguredAdapterNames(config: Partial<AppConfig>): string[] {
  const names: string[] = [];
  if (hasValidFeedlyConfig(config)) names.push('feedly');
  if (hasValidSubstackConfig(config)) names.push('substack');
  if (hasValidXEnv()) names.push('x');
  return names;
}
