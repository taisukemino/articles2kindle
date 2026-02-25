import type { SourceAdapter, SourceArticle, FetchOptions, Collection } from '../types.js';
import type { SubstackConfig } from '../../config/schema.js';
import { SubstackApiClient } from './api.js';
import { mapSubstackPost } from './mapper.js';

export class SubstackAdapter implements SourceAdapter {
  readonly name = 'substack';
  private readonly client: SubstackApiClient;
  private readonly publications: SubstackConfig['publications'];

  /**
   * Create a Substack adapter with the given configuration.
   *
   * @param config - Substack-specific configuration (list of publications)
   */
  constructor(config: SubstackConfig) {
    this.client = new SubstackApiClient();
    this.publications = config.publications;
  }

  /**
   * Validate the Substack connection by fetching the first publication's archive.
   */
  async validateConnection(): Promise<void> {
    const firstPublication = this.publications[0];
    if (!firstPublication) {
      throw new Error('No Substack publications configured.');
    }
    await this.client.fetchArchivePage(firstPublication.url, 0);
  }

  /**
   * Fetch articles from all configured Substack publications, yielding batches.
   *
   * @param options - Fetch constraints (count limit, newerThan cutoff)
   * @returns Async generator yielding batches of mapped source articles
   */
  async *fetchArticles(options: FetchOptions): AsyncGenerator<SourceArticle[]> {
    let totalFetched = 0;
    const maxCount = options.count ?? Infinity;

    for (const publication of this.publications) {
      if (totalFetched >= maxCount) break;

      let offset = 0;
      let reachedOldPosts = false;

      while (!reachedOldPosts && totalFetched < maxCount) {
        const archivePage = await this.client.fetchArchivePage(publication.url, offset);

        if (archivePage.length === 0) break;

        const batch: SourceArticle[] = [];

        for (const archivePost of archivePage) {
          if (totalFetched >= maxCount) break;

          if (options.newerThan) {
            const postTimestamp = new Date(archivePost.post_date).getTime();
            if (postTimestamp <= options.newerThan) {
              reachedOldPosts = true;
              break;
            }
          }

          const isPaidPost = archivePost.audience === 'only_paid';
          if (isPaidPost && !this.client.hasAuthentication()) {
            console.warn(
              `  Skipping paid post "${archivePost.title}" — set SUBSTACK_CONNECT_SID to fetch paid content`,
            );
            continue;
          }

          const fullPost = await this.client.fetchFullPost(publication.url, archivePost.slug);
          const article = mapSubstackPost(fullPost, publication.url, publication.label);
          batch.push(article);
          totalFetched++;
        }

        if (batch.length > 0) {
          yield batch;
        }

        offset += archivePage.length;
      }
    }
  }

  /**
   * List configured Substack publications as collections.
   *
   * @returns Array of collections derived from configured publications
   */
  async listCollections(): Promise<Collection[]> {
    return this.publications.map((publication) => ({
      id: publication.url,
      label: publication.label ?? publication.url,
    }));
  }
}
