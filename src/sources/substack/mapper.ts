import type { SubstackFullPost } from './api.js';
import type { SourceArticle } from '../types.js';

/**
 * Map a raw Substack post to a normalized SourceArticle.
 *
 * @param post - Full post data from the Substack API
 * @param publicationUrl - Base URL of the publication (used for source ID)
 * @param publicationLabel - Optional display label for the publication
 * @returns Normalized source article
 */
export function mapSubstackPost(
  post: SubstackFullPost,
  publicationUrl: string,
  publicationLabel: string | undefined,
): SourceArticle {
  const firstByline = post.publishedBylines[0];
  const excerptSource = post.description || post.truncated_body_text || '';
  const excerptText = excerptSource.slice(0, 500) || null;

  return {
    sourceId: `substack-${_normalizePublicationUrl(publicationUrl)}-${String(post.id)}`,
    sourceName: 'substack',
    title: post.title,
    author: firstByline?.name ?? null,
    contentHtml: post.body_html ?? null,
    excerpt: excerptText,
    url: post.canonical_url ?? null,
    publicationName: publicationLabel ?? _derivePublicationName(publicationUrl),
    publishedAt: post.post_date ?? null,
    tags: [],
  };
}

function _normalizePublicationUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function _derivePublicationName(publicationUrl: string): string {
  try {
    let hostname = new URL(publicationUrl).hostname;
    hostname = hostname.replace(/^www\./, '');
    hostname = hostname.replace(/\.substack\.com$/, '');
    hostname = hostname.replace(/\.com$/, '');
    return hostname;
  } catch {
    return publicationUrl;
  }
}
