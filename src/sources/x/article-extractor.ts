import type { XTweet } from './types.js';

const JINA_READER_BASE_URL = 'https://r.jina.ai';
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Check whether a set of tweets contains only URLs with no meaningful text.
 * A tweet is "link-only" when its text, after stripping all URLs, is empty or whitespace.
 *
 * @param tweets - Tweets to check (typically a single tweet or thread)
 * @returns True if the combined tweet text is purely URLs
 */
export function isLinkOnlyTweet(tweets: readonly XTweet[]): boolean {
  const combinedText = tweets.map((tweet) => tweet.note_tweet?.text ?? tweet.text).join(' ');
  const textWithoutUrls = combinedText.replace(/https?:\/\/\S+/g, '').trim();
  return textWithoutUrls.length === 0;
}

/**
 * Extract the first expanded URL from tweet entities.
 *
 * @param tweets - Tweets to extract URLs from
 * @returns The first expanded URL found, or null
 */
export function extractFirstArticleUrl(tweets: readonly XTweet[]): string | null {
  for (const tweet of tweets) {
    const entities = tweet.note_tweet?.entities ?? tweet.entities;
    if (entities?.urls && entities.urls.length > 0) {
      const firstUrl = entities.urls[0];
      if (firstUrl) {
        return firstUrl.expanded_url;
      }
    }
  }
  return null;
}

/**
 * Fetch full article content from a URL using Jina Reader.
 * Returns null on any failure (network error, timeout, empty content).
 *
 * @param url - The article URL to fetch content from
 * @returns Object with title and contentHtml, or null if extraction fails
 */
export async function fetchLinkedArticleContent(
  url: string,
): Promise<{ title: string; contentHtml: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(`${JINA_READER_BASE_URL}/${url}`, {
      headers: { Accept: 'text/plain' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const markdown = await response.text();
    if (!markdown.trim()) return null;

    const { title, body } = _parseJinaResponse(markdown);
    if (!body) return null;

    return { title, contentHtml: _markdownToHtml(body) };
  } catch {
    return null;
  }
}

/**
 * Parse Jina Reader's plain-text response into title and body.
 * Jina returns a format like:
 *   Title: ...
 *   URL Source: ...
 *   Markdown Content:
 *   ...actual content...
 *
 * @param raw - Raw response text from Jina Reader
 * @returns Parsed title and body content
 */
function _parseJinaResponse(raw: string): { title: string; body: string } {
  const lines = raw.split('\n');
  let title = '';
  let bodyStartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.startsWith('Title:')) {
      title = line.slice('Title:'.length).trim();
    } else if (line.startsWith('Markdown Content:')) {
      bodyStartIndex = i + 1;
      break;
    } else if (line.startsWith('URL Source:')) {
      continue;
    } else if (line.trim() && !title) {
      // If no structured headers, treat entire content as body
      bodyStartIndex = 0;
      break;
    }
  }

  const body = lines.slice(bodyStartIndex).join('\n').trim();
  return { title: title || 'Untitled', body };
}

/**
 * Convert basic markdown to HTML suitable for EPUB rendering.
 * Handles headings, paragraphs, bold, italic, links, and line breaks.
 *
 * @param markdown - Markdown text to convert
 * @returns HTML string
 */
export function markdownToHtml(markdown: string): string {
  return _markdownToHtml(markdown);
}

function _markdownToHtml(markdown: string): string {
  const blocks = markdown.split(/\n\n+/);
  const htmlBlocks: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('### ')) {
      htmlBlocks.push(`<h3>${_inlineMarkdown(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith('## ')) {
      htmlBlocks.push(`<h2>${_inlineMarkdown(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith('# ')) {
      htmlBlocks.push(`<h1>${_inlineMarkdown(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith('> ')) {
      const quoteContent = trimmed
        .split('\n')
        .map((line) => line.replace(/^>\s?/, ''))
        .join('<br />');
      htmlBlocks.push(`<blockquote>${_inlineMarkdown(quoteContent)}</blockquote>`);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items = trimmed.split('\n').map((line) => {
        const content = line.replace(/^[-*]\s+/, '');
        return `<li>${_inlineMarkdown(content)}</li>`;
      });
      htmlBlocks.push(`<ul>${items.join('\n')}</ul>`);
    } else {
      const withBreaks = trimmed.replace(/\n/g, '<br />');
      htmlBlocks.push(`<p>${_inlineMarkdown(withBreaks)}</p>`);
    }
  }

  return htmlBlocks.join('\n');
}

function _inlineMarkdown(text: string): string {
  return (
    text
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
  );
}
