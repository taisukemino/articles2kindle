import type { SourceAdapter, SourceArticle, FetchOptions, Collection } from '../types.js';
import type { FeedlyConfig } from '../../config/schema.js';
import { FeedlyApiClient } from './api.js';
import { mapFeedlyEntry } from './mapper.js';

const PAGE_SIZE = 100;

export class FeedlyAdapter implements SourceAdapter {
  readonly name = 'feedly';
  private readonly client: FeedlyApiClient;
  private readonly streamId: string;

  constructor(config: FeedlyConfig) {
    this.client = new FeedlyApiClient(config.accessToken);
    this.streamId = config.streamId;
  }

  async validateConnection(): Promise<void> {
    await this.client.getCollections();
  }

  async *fetchArticles(options: FetchOptions): AsyncGenerator<SourceArticle[]> {
    let continuation: string | undefined;
    let totalFetched = 0;
    const maxCount = options.count ?? Infinity;

    do {
      const response = await this.client.getStreamContents({
        streamId: this.streamId,
        count: Math.min(PAGE_SIZE, maxCount - totalFetched),
        newerThan: options.newerThan,
        continuation,
      });

      const mapped = response.items.map(mapFeedlyEntry);
      if (mapped.length === 0) break;

      yield mapped;
      totalFetched += mapped.length;
      continuation = response.continuation;
    } while (continuation && totalFetched < maxCount);
  }

  async listCollections(): Promise<Collection[]> {
    const collections = await this.client.getCollections();
    return collections.map((collection) => ({ id: collection.id, label: collection.label }));
  }
}
