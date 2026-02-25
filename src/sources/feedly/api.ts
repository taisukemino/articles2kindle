const FEEDLY_BASE_URL = 'https://cloud.feedly.com';

export interface FeedlyStreamResponse {
  id: string;
  continuation?: string;
  items: FeedlyEntry[];
}

export interface FeedlyEntry {
  id: string;
  title?: string;
  author?: string;
  content?: { content: string };
  summary?: { content: string };
  alternate?: Array<{ href: string; type?: string }>;
  origin?: { title: string; streamId: string; htmlUrl?: string };
  published?: number;
  tags?: Array<{ id: string; label?: string }>;
  categories?: Array<{ id: string; label?: string }>;
}

export interface StreamContentsParams {
  streamId: string;
  count?: number;
  newerThan?: number;
  continuation?: string;
}

export class FeedlyApiClient {
  private readonly accessToken: string;

  /**
   * Create a Feedly API client.
   *
   * @param accessToken - Feedly developer access token for authentication
   */
  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Fetch a page of entries from a Feedly stream.
   *
   * @param params - Stream query parameters (streamId, count, newerThan, continuation)
   * @returns Paginated stream response containing entries and optional continuation token
   */
  async getStreamContents(params: StreamContentsParams): Promise<FeedlyStreamResponse> {
    const url = new URL(`${FEEDLY_BASE_URL}/v3/streams/contents`);
    url.searchParams.set('streamId', params.streamId);
    url.searchParams.set('count', String(params.count ?? 100));
    if (params.newerThan) {
      url.searchParams.set('newerThan', String(params.newerThan));
    }
    if (params.continuation) {
      url.searchParams.set('continuation', params.continuation);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Feedly API error ${response.status}: ${body}`);
    }

    return response.json() as Promise<FeedlyStreamResponse>;
  }

  /**
   * Fetch all collections (categories/boards) for the authenticated user.
   *
   * @returns Array of collections with id and label
   */
  async getCollections(): Promise<Array<{ id: string; label: string }>> {
    const response = await fetch(`${FEEDLY_BASE_URL}/v3/collections`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Feedly API error ${response.status}`);
    }

    return response.json() as Promise<Array<{ id: string; label: string }>>;
  }
}
