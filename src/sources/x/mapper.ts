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
  const tweetUrl = authorUser
    ? `https://x.com/${authorUser.username}/status/${firstTweet.id}`
    : null;

  // If the tweet contains an X Article, use its content directly
  const article = threadTweets.find((tweet) => tweet.article)?.article;
  if (article?.plain_text) {
    const articleHtml = _articleTextToHtml(article.plain_text);
    return {
      sourceId: `x-thread-${firstTweet.conversation_id}`,
      sourceName: 'x',
      title: article.title,
      author: authorUser ? `${authorUser.name} (@${authorUser.username})` : null,
      contentHtml: articleHtml,
      excerpt: article.plain_text.slice(0, 500) || null,
      url: tweetUrl,
      publicationName: PUBLICATION_NAME,
      publishedAt: firstTweet.created_at ?? null,
      tags: _extractHashtags(threadTweets),
    };
  }

  const isThread = threadTweets.length > 1;
  const title = _deriveTitle(firstTweet, authorUser, isThread);
  const contentHtml = _buildContentHtml(threadTweets, userLookup, mediaLookup);
  const fullText = threadTweets.map((tweet) => _getFullTweetText(tweet)).join(' ');
  const excerpt = fullText.slice(0, 500) || null;

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

function _isHeadingLine(line: string, nextLine: string | undefined): boolean {
  if (!line || line.length > 100) return false;
  // Japanese section markers: ■, ●, ◆, 【...】
  if (/^[■●◆▶]/.test(line)) return true;
  if (/^【.+】$/.test(line)) return true;
  // Short line followed by a longer paragraph suggests a heading
  if (nextLine && line.length <= 60 && !line.endsWith('.') && !line.endsWith('。') && nextLine.length > line.length * 2) {
    return true;
  }
  return false;
}

function _isSubHeadingLine(line: string): boolean {
  // Numbered items like "1. Title" or "第1章：Title"
  return /^\d+\.\s/.test(line) || /^第\d+章/.test(line);
}

function _articleTextToHtml(plainText: string): string {
  // Split into individual lines first, then group into paragraphs and headings
  const lines = plainText.split('\n');
  const htmlBlocks: string[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const text = paragraphLines.join('<br />');
    htmlBlocks.push(`<p>${text}</p>`);
    paragraphLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const nextNonEmpty = lines.slice(i + 1).find((l) => l.trim())?.trim();

    if (_isHeadingLine(trimmed, nextNonEmpty)) {
      flushParagraph();
      htmlBlocks.push(`<h2>${_escapeHtml(trimmed)}</h2>`);
    } else if (_isSubHeadingLine(trimmed)) {
      flushParagraph();
      htmlBlocks.push(`<h3>${_escapeHtml(trimmed)}</h3>`);
    } else {
      paragraphLines.push(_escapeHtml(trimmed));
    }
  }

  flushParagraph();
  return htmlBlocks.join('\n');
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
