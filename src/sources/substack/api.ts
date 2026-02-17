const ARCHIVE_PAGE_SIZE = 12;
const DELAY_BETWEEN_REQUESTS_MS = 200;

export interface SubstackByline {
  readonly id: number;
  readonly name: string;
}

export interface SubstackArchivePost {
  readonly id: number;
  readonly title: string;
  readonly slug: string;
  readonly post_date: string;
  readonly audience: 'everyone' | 'only_paid';
  readonly wordcount: number;
  readonly description: string;
  readonly truncated_body_text: string;
  readonly canonical_url: string;
  readonly publishedBylines: readonly SubstackByline[];
}

export interface SubstackFullPost extends SubstackArchivePost {
  readonly body_html: string | null;
}

function _delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class SubstackApiClient {
  private readonly connectSid: string | undefined;

  constructor() {
    this.connectSid = process.env['SUBSTACK_CONNECT_SID'];
  }

  private _stripTrailingSlashes(url: string): string {
    return url.replace(/\/+$/, '');
  }

  async fetchArchivePage(publicationUrl: string, offset: number): Promise<SubstackArchivePost[]> {
    const baseUrl = this._stripTrailingSlashes(publicationUrl);
    const url = new URL(`${baseUrl}/api/v1/archive`);
    url.searchParams.set('sort', 'new');
    url.searchParams.set('limit', String(ARCHIVE_PAGE_SIZE));
    url.searchParams.set('offset', String(offset));

    const response = await fetch(url.toString(), {
      headers: this._buildRequestHeaders(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Substack archive API error ${response.status}: ${body}`);
    }

    return response.json() as Promise<SubstackArchivePost[]>;
  }

  async fetchFullPost(publicationUrl: string, slug: string): Promise<SubstackFullPost> {
    const baseUrl = this._stripTrailingSlashes(publicationUrl);
    const url = `${baseUrl}/api/v1/posts/${slug}`;

    await _delay(DELAY_BETWEEN_REQUESTS_MS);

    const response = await fetch(url, {
      headers: this._buildRequestHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `Substack auth failed (${response.status}). Your SUBSTACK_CONNECT_SID cookie may be expired. ` +
            'Update it from browser DevTools → Application → Cookies → connect.sid',
        );
      }
      const body = await response.text();
      throw new Error(`Substack post API error ${response.status}: ${body}`);
    }

    return response.json() as Promise<SubstackFullPost>;
  }

  hasAuthentication(): boolean {
    return !!this.connectSid;
  }

  private _buildRequestHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'articles2kindle/1.0',
    };
    if (this.connectSid) {
      headers['Cookie'] = `connect.sid=${this.connectSid}`;
    }
    return headers;
  }
}
