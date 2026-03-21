import type { XBookmarksResponse, XSearchResponse } from './types.js';
import { refreshAccessToken } from './oauth.js';

const X_API_BASE_URL = 'https://api.twitter.com';
const BOOKMARKS_PAGE_SIZE = 100;
const DELAY_BETWEEN_REQUESTS_MS = 200;

const TWEET_FIELDS =
  'conversation_id,author_id,created_at,referenced_tweets,in_reply_to_user_id,note_tweet,entities,attachments,article';
const EXPANSIONS = 'author_id,attachments.media_keys,article.cover_media,article.media_entities';
const USER_FIELDS = 'name,username';
const MEDIA_FIELDS = 'media_key,type,url,preview_image_url,alt_text';

function _delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class XApiClient {
  private accessToken: string;
  private readonly userId: string;
  private hasAttemptedRefresh = false;

  /**
   * Create an X API client, reading credentials from environment variables.
   */
  constructor() {
    this.accessToken = process.env['X_ACCESS_TOKEN'] ?? '';
    this.userId = process.env['X_USER_ID'] ?? '';
  }

  /**
   * Check whether access token and user ID are both available.
   *
   * @returns True if the client has valid credentials
   */
  hasAuthentication(): boolean {
    return !!this.accessToken && !!this.userId;
  }

  /**
   * Fetch a single page of bookmarked tweets.
   *
   * @param paginationToken - Optional token for fetching subsequent pages
   * @param pageSize - Number of tweets per page (10–100, defaults to 100)
   * @returns Paginated bookmarks response with tweets and user includes
   */
  async fetchBookmarksPage(
    paginationToken?: string,
    pageSize?: number,
  ): Promise<XBookmarksResponse> {
    const url = new URL(`${X_API_BASE_URL}/2/users/${this.userId}/bookmarks`);
    url.searchParams.set('max_results', String(pageSize ?? BOOKMARKS_PAGE_SIZE));
    url.searchParams.set('tweet.fields', TWEET_FIELDS);
    url.searchParams.set('expansions', EXPANSIONS);
    url.searchParams.set('user.fields', USER_FIELDS);
    url.searchParams.set('media.fields', MEDIA_FIELDS);
    if (paginationToken) {
      url.searchParams.set('pagination_token', paginationToken);
    }

    return this._fetchWithAutoRefresh(url);
  }

  /**
   * Search for all tweets in a conversation by a specific author.
   * Used to fetch full threads when a thread starter is bookmarked.
   * Note: search/recent only covers the last 7 days on Basic access.
   *
   * @param conversationId - Conversation ID to search within
   * @param authorUsername - Username of the thread author for search filtering
   * @returns Search response containing matching tweets
   */
  async searchThreadTweets(
    conversationId: string,
    authorUsername: string,
  ): Promise<XSearchResponse> {
    const url = new URL(`${X_API_BASE_URL}/2/tweets/search/recent`);
    url.searchParams.set('query', `conversation_id:${conversationId} from:${authorUsername}`);
    url.searchParams.set('max_results', String(BOOKMARKS_PAGE_SIZE));
    url.searchParams.set('tweet.fields', TWEET_FIELDS);
    url.searchParams.set('expansions', EXPANSIONS);
    url.searchParams.set('user.fields', USER_FIELDS);
    url.searchParams.set('media.fields', MEDIA_FIELDS);

    return this._fetchWithAutoRefresh(url);
  }

  /**
   * Validate that the current credentials work by calling the /users/me endpoint.
   */
  async validateCredentials(): Promise<void> {
    const url = new URL(`${X_API_BASE_URL}/2/users/me`);
    await this._fetchWithAutoRefresh(url);
  }

  /**
   * Make an API request, auto-refreshing the access token on 401 if a refresh token is available.
   * Only attempts refresh once per client instance to avoid infinite loops.
   *
   * @param url - Fully constructed URL to fetch
   * @returns Parsed JSON response
   */
  private async _fetchWithAutoRefresh<T>(url: URL): Promise<T> {
    await _delay(DELAY_BETWEEN_REQUESTS_MS);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (response.status === 401 && !this.hasAttemptedRefresh) {
      const refreshed = await this._tryRefreshToken();
      if (refreshed) {
        const retryResponse = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });
        if (retryResponse.ok) {
          return retryResponse.json() as Promise<T>;
        }
        const body = await retryResponse.text();
        throw new Error(
          `X API error ${retryResponse.status} after token refresh. Run "articles2kindle x auth" to re-authenticate. ${body}`,
        );
      }
    }

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 401) {
        throw new Error(
          `X access token expired. Run "articles2kindle x auth" to re-authenticate. ${body}`,
        );
      }
      if (response.status === 429) {
        throw new Error(`X API rate limit exceeded. Try again later. ${body}`);
      }
      throw new Error(`X API error ${response.status}: ${body}`);
    }

    return response.json() as Promise<T>;
  }

  private async _tryRefreshToken(): Promise<boolean> {
    this.hasAttemptedRefresh = true;
    const clientId = process.env['X_CLIENT_ID'];
    const refreshToken = process.env['X_REFRESH_TOKEN'];

    if (!clientId || !refreshToken) {
      return false;
    }

    try {
      this.accessToken = await refreshAccessToken(clientId, refreshToken);
      return true;
    } catch {
      return false;
    }
  }
}
