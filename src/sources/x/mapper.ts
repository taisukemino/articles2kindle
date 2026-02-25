import type { XTweet, XUser, XMedia, XEntities } from './types.js';
import type { SourceArticle } from '../types.js';

const PUBLICATION_NAME = 'X Bookmarks';
const TITLE_MAX_LENGTH = 80;

/**
 * Map a single tweet or stitched thread to a SourceArticle.
 *
 * @param threadTweets - Tweets in chronological order (1 element for standalone, N for threads)
 * @param userLookup - Map of user ID to XUser from API includes
 * @param mediaLookup - Map of media_key to XMedia from API includes
 * @returns Normalized source article representing the tweet or thread
 */
export function mapTweetsToArticle(
  threadTweets: readonly XTweet[],
  userLookup: ReadonlyMap<string, XUser>,
  mediaLookup: ReadonlyMap<string, XMedia> = new Map(),
): SourceArticle {
  const firstTweet = threadTweets[0];
  if (!firstTweet) {
    throw new Error('Cannot map an empty tweet array to an article');
  }
  const authorUser = userLookup.get(firstTweet.author_id);
  const isThread = threadTweets.length > 1;

  const title = _deriveTitle(firstTweet, authorUser, isThread);
  const contentHtml = _buildContentHtml(threadTweets, userLookup, mediaLookup);
  const fullText = threadTweets.map((tweet) => _getFullTweetText(tweet)).join(' ');
  const excerpt = fullText.slice(0, 500) || null;
  const tweetUrl = authorUser
    ? `https://x.com/${authorUser.username}/status/${firstTweet.id}`
    : null;

  return {
    sourceId: `x-thread-${firstTweet.conversation_id}`,
    sourceName: 'x',
    title,
    author: authorUser ? `${authorUser.name} (@${authorUser.username})` : null,
    contentHtml,
    excerpt,
    url: tweetUrl,
    publicationName: PUBLICATION_NAME,
    publishedAt: firstTweet.created_at ?? null,
    tags: _extractHashtags(threadTweets),
  };
}

/**
 * Build a user lookup map from the includes.users array.
 *
 * @param users - Array of user objects from API includes, or undefined
 * @returns Map keyed by user ID for fast lookup
 */
export function buildUserLookup(users: readonly XUser[] | undefined): Map<string, XUser> {
  const lookup = new Map<string, XUser>();
  if (!users) return lookup;
  for (const user of users) {
    lookup.set(user.id, user);
  }
  return lookup;
}

/**
 * Build a media lookup map from the includes.media array.
 *
 * @param media - Array of media objects from API includes, or undefined
 * @returns Map keyed by media_key for fast lookup
 */
export function buildMediaLookup(media: readonly XMedia[] | undefined): Map<string, XMedia> {
  const lookup = new Map<string, XMedia>();
  if (!media) return lookup;
  for (const item of media) {
    lookup.set(item.media_key, item);
  }
  return lookup;
}

function _getFullTweetText(tweet: XTweet): string {
  return tweet.note_tweet?.text ?? tweet.text;
}

function _deriveTitle(
  firstTweet: XTweet,
  authorUser: XUser | undefined,
  isThread: boolean,
): string {
  const rawText = _getFullTweetText(firstTweet);
  const cleanText = rawText.replace(/https?:\/\/\S+/g, '').trim();
  const truncatedText =
    cleanText.length > TITLE_MAX_LENGTH ? cleanText.slice(0, TITLE_MAX_LENGTH) + '...' : cleanText;

  if (isThread && authorUser) {
    return `@${authorUser.username}'s thread: ${truncatedText}`;
  }
  if (!truncatedText) {
    return authorUser ? `Post by @${authorUser.username}` : 'Untitled Post';
  }
  return truncatedText;
}

function _buildContentHtml(
  tweets: readonly XTweet[],
  userLookup: ReadonlyMap<string, XUser>,
  mediaLookup: ReadonlyMap<string, XMedia>,
): string {
  const tweetHtmlParts = tweets.map((tweet, index) => {
    const text = _getFullTweetText(tweet);
    const entities = tweet.note_tweet?.entities ?? tweet.entities;
    const htmlText = _tweetTextToHtml(text, entities);
    const mediaHtml = _buildMediaHtml(tweet, mediaLookup);
    const authorUser = userLookup.get(tweet.author_id);
    const timestamp = tweet.created_at ? new Date(tweet.created_at).toLocaleString() : '';

    let header = '';
    if (tweets.length > 1) {
      const authorLabel = authorUser ? `@${authorUser.username}` : 'Unknown';
      header = `<p class="article-meta">${authorLabel} · ${timestamp}</p>`;
    }

    const separator = index > 0 ? '<hr />' : '';
    return `${separator}${header}<div>${htmlText}${mediaHtml}</div>`;
  });

  return tweetHtmlParts.join('\n');
}

function _buildMediaHtml(tweet: XTweet, mediaLookup: ReadonlyMap<string, XMedia>): string {
  const mediaKeys = tweet.attachments?.media_keys;
  if (!mediaKeys || mediaKeys.length === 0) return '';

  const parts: string[] = [];
  for (const key of mediaKeys) {
    const media = mediaLookup.get(key);
    if (!media) continue;

    switch (media.type) {
      case 'photo': {
        const src = media.url ?? '';
        const alt = _escapeHtmlAttribute(media.alt_text ?? 'Image');
        if (src) {
          parts.push(`<img src="${_escapeHtmlAttribute(src)}" alt="${alt}" />`);
        }
        break;
      }
      case 'video':
        parts.push('<p><em>[Video]</em></p>');
        break;
      case 'animated_gif':
        parts.push('<p><em>[GIF]</em></p>');
        break;
    }
  }

  return parts.join('\n');
}

/**
 * Convert tweet plain text into HTML, expanding entity references into links.
 * Processes text segments between entities to properly HTML-escape non-entity text.
 *
 * @param text - Raw tweet text content
 * @param entities - Optional tweet entities (URLs, mentions, hashtags)
 * @returns HTML string with linked entities and escaped text
 */
function _tweetTextToHtml(text: string, entities: XEntities | undefined): string {
  const replacements: Array<{ start: number; end: number; html: string }> = [];

  if (entities?.urls) {
    for (const urlEntity of entities.urls) {
      replacements.push({
        start: urlEntity.start,
        end: urlEntity.end,
        html: `<a href="${_escapeHtmlAttribute(urlEntity.expanded_url)}">${_escapeHtml(urlEntity.display_url)}</a>`,
      });
    }
  }

  if (entities?.mentions) {
    for (const mention of entities.mentions) {
      replacements.push({
        start: mention.start,
        end: mention.end,
        html: `<a href="https://x.com/${_escapeHtmlAttribute(mention.username)}">@${_escapeHtml(mention.username)}</a>`,
      });
    }
  }

  replacements.sort((a, b) => a.start - b.start);

  const parts: string[] = [];
  let cursor = 0;

  for (const { start, end, html } of replacements) {
    if (start > cursor) {
      parts.push(_escapeHtml(text.slice(cursor, start)));
    }
    parts.push(html);
    cursor = end;
  }

  if (cursor < text.length) {
    parts.push(_escapeHtml(text.slice(cursor)));
  }

  const joined = parts.join('');
  const paragraphs = joined
    .split(/\n\n+/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br />')}</p>`);

  return paragraphs.join('\n');
}

function _escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _escapeHtmlAttribute(text: string): string {
  return _escapeHtml(text).replace(/'/g, '&#39;');
}

function _extractHashtags(tweets: readonly XTweet[]): string[] {
  const tags = new Set<string>();
  for (const tweet of tweets) {
    const entities = tweet.note_tweet?.entities ?? tweet.entities;
    if (entities?.hashtags) {
      for (const hashtag of entities.hashtags) {
        tags.add(hashtag.tag.toLowerCase());
      }
    }
  }
  return [...tags];
}
