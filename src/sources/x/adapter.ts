import type { SourceAdapter, SourceArticle, FetchOptions, Collection } from '../types.js';
import type { XTweet, XUser, XMedia } from './types.js';
import { XApiClient } from './api.js';
import { mapTweetsToArticle, buildUserLookup, buildMediaLookup } from './mapper.js';
import {
  isLinkOnlyTweet,
  extractFirstArticleUrl,
  fetchLinkedArticleContent,
} from './article-extractor.js';

const BATCH_YIELD_SIZE = 20;

export class XAdapter implements SourceAdapter {
  readonly name = 'x';
  private readonly client: XApiClient;

  /**
   * Create an X (Twitter) adapter using credentials from environment variables.
   */
  constructor() {
    this.client = new XApiClient();
  }

  /**
   * Validate the X API connection by checking current credentials.
   */
  async validateConnection(): Promise<void> {
    await this.client.validateCredentials();
  }

  /**
   * Fetch bookmarked tweets from X, expanding threads, and yield as article batches.
   *
   * @param options - Fetch constraints (count limit, newerThan cutoff, knownSourceIds)
   * @returns Async generator yielding batches of mapped source articles
   */
  async *fetchArticles(options: FetchOptions): AsyncGenerator<SourceArticle[]> {
    const maxCount = options.count ?? Infinity;
    const knownSourceIds = options.knownSourceIds;

    const allBookmarkedTweets: XTweet[] = [];
    const allUsers = new Map<string, XUser>();
    const allMedia = new Map<string, XMedia>();

    // Phase 1: Paginate through bookmarks, stopping early when we have enough or all are known
    // Use a smaller page size when a limit is set to minimize API calls (X API minimum is 10)
    const bookmarksPageSize = maxCount < 100 ? Math.max(maxCount, 10) : undefined;
    let paginationToken: string | undefined;
    const seenConversationIds = new Set<string>();
    do {
      const response = await this.client.fetchBookmarksPage(paginationToken, bookmarksPageSize);

      if (!response.data || response.data.length === 0) break;

      for (const tweet of response.data) {
        allBookmarkedTweets.push(tweet);
        seenConversationIds.add(tweet.conversation_id);
      }

      const pageUsers = buildUserLookup(response.includes?.users);
      for (const [userId, user] of pageUsers) {
        allUsers.set(userId, user);
      }

      const pageMedia = buildMediaLookup(response.includes?.media);
      for (const [mediaKey, media] of pageMedia) {
        allMedia.set(mediaKey, media);
      }

      if (knownSourceIds && _isEntirePageKnown(response.data, knownSourceIds)) {
        break;
      }

      // Stop paginating once we have enough unique conversations for the requested limit
      const newConversationCount = knownSourceIds
        ? [...seenConversationIds].filter((id) => !knownSourceIds.has(`x-thread-${id}`)).length
        : seenConversationIds.size;
      if (newConversationCount >= maxCount) break;

      paginationToken = response.meta.next_token;
    } while (paginationToken);

    // Phase 2: Group by conversation_id to identify threads
    const conversationGroups = _groupByConversationId(allBookmarkedTweets);

    // Phase 3: Expand threads and map to articles
    let totalYielded = 0;
    const articles: SourceArticle[] = [];

    for (const [conversationId, bookmarkedTweets] of conversationGroups) {
      if (totalYielded >= maxCount) break;

      // Skip conversations that are already stored — avoids thread expansion API calls
      if (knownSourceIds?.has(`x-thread-${conversationId}`)) {
        continue;
      }

      const firstTweet = bookmarkedTweets[0];
      if (!firstTweet) continue;

      const isThreadStarter = firstTweet.conversation_id === firstTweet.id;
      const authorUser = allUsers.get(firstTweet.author_id);
      const hasSelfReply = bookmarkedTweets.some(
        (tweet) => tweet.in_reply_to_user_id === tweet.author_id,
      );

      let threadTweets: XTweet[];

      if ((isThreadStarter || hasSelfReply) && authorUser) {
        threadTweets = await _fetchFullThread(
          this.client,
          conversationId,
          authorUser.username,
          bookmarkedTweets,
          allMedia,
        );
      } else {
        threadTweets = _sortChronologically(bookmarkedTweets);
      }

      if (options.newerThan) {
        const lastTweet = threadTweets[threadTweets.length - 1];
        if (lastTweet) {
          const latestTimestamp = new Date(lastTweet.created_at).getTime();
          if (latestTimestamp <= options.newerThan) {
            continue;
          }
        }
      }

      let article = mapTweetsToArticle(threadTweets, allUsers, allMedia);

      // For link-only tweets, fetch the full content from the linked URL
      if (isLinkOnlyTweet(threadTweets)) {
        const articleUrl = extractFirstArticleUrl(threadTweets);
        if (articleUrl) {
          const linkedContent = await fetchLinkedArticleContent(articleUrl);
          if (linkedContent) {
            const plainExcerpt = linkedContent.contentHtml.replace(/<[^>]+>/g, '');
            article = {
              ...article,
              title: linkedContent.title,
              contentHtml: linkedContent.contentHtml,
              excerpt: plainExcerpt.slice(0, 500) || null,
            };
          }
        }
      }

      articles.push(article);
      totalYielded++;

      if (articles.length >= BATCH_YIELD_SIZE) {
        yield articles.splice(0);
      }
    }

    if (articles.length > 0) {
      yield articles;
    }
  }

  /**
   * List available X collections (currently only bookmarks).
   *
   * @returns Array containing a single bookmarks collection
   */
  async listCollections(): Promise<Collection[]> {
    return [{ id: 'bookmarks', label: 'X Bookmarks' }];
  }
}

/**
 * Check if every tweet on a page belongs to an already-known conversation.
 * Bookmarks are returned newest-bookmarked-first, so once we hit a page of
 * entirely known conversations, all subsequent pages are also known.
 *
 * @param pageTweets - Array of tweets from a single bookmarks page
 * @param knownSourceIds - Set of source IDs already stored in the database
 * @returns True if all tweets on the page belong to known conversations
 */
function _isEntirePageKnown(
  pageTweets: readonly XTweet[],
  knownSourceIds: ReadonlySet<string>,
): boolean {
  return pageTweets.every((tweet) => knownSourceIds.has(`x-thread-${tweet.conversation_id}`));
}

function _groupByConversationId(tweets: readonly XTweet[]): Map<string, XTweet[]> {
  const groups = new Map<string, XTweet[]>();
  for (const tweet of tweets) {
    const existing = groups.get(tweet.conversation_id);
    if (existing) {
      existing.push(tweet);
    } else {
      groups.set(tweet.conversation_id, [tweet]);
    }
  }
  return groups;
}

/**
 * Fetch all tweets in a thread via search/recent endpoint.
 * Falls back to only the bookmarked tweets if search fails (e.g. tweet older than 7 days).
 *
 * @param client - X API client instance
 * @param conversationId - Conversation ID to search for
 * @param authorUsername - Username of the thread author for search filtering
 * @param fallbackTweets - Bookmarked tweets to use if search fails or returns nothing
 * @param allMedia - Media lookup map to accumulate search result media into
 * @returns Chronologically sorted array of thread tweets
 */
async function _fetchFullThread(
  client: XApiClient,
  conversationId: string,
  authorUsername: string,
  fallbackTweets: XTweet[],
  allMedia: Map<string, XMedia>,
): Promise<XTweet[]> {
  try {
    const searchResponse = await client.searchThreadTweets(conversationId, authorUsername);

    if (!searchResponse.data || searchResponse.data.length === 0) {
      return _sortChronologically(fallbackTweets);
    }

    // Accumulate media from search results
    const searchMedia = buildMediaLookup(searchResponse.includes?.media);
    for (const [mediaKey, media] of searchMedia) {
      allMedia.set(mediaKey, media);
    }

    // Merge search results with bookmarked tweets, deduplicating by tweet ID
    const tweetMap = new Map<string, XTweet>();
    for (const tweet of fallbackTweets) {
      tweetMap.set(tweet.id, tweet);
    }
    for (const tweet of searchResponse.data) {
      tweetMap.set(tweet.id, tweet);
    }

    return _sortChronologically([...tweetMap.values()]);
  } catch {
    // Thread search is best-effort; fall back to bookmarked tweets only
    return _sortChronologically(fallbackTweets);
  }
}

function _sortChronologically(tweets: XTweet[]): XTweet[] {
  return [...tweets].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}
