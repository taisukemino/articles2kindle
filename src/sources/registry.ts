import type { SourceAdapter } from './types.js';
import { FeedlyAdapter } from './feedly/adapter.js';
import type { AppConfig } from '../config/schema.js';

export function getAdapter(name: string, config: AppConfig): SourceAdapter {
  switch (name) {
    case 'feedly':
      return new FeedlyAdapter(config.feedly);
    default:
      throw new Error(`Unknown source adapter: ${name}`);
  }
}
