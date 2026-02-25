import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isLinkOnlyTweet,
  extractFirstArticleUrl,
  fetchLinkedArticleContent,
  markdownToHtml,
} from '../../src/sources/x/article-extractor.js';
import type { XTweet } from '../../src/sources/x/types.js';

function createTweet(overrides: Partial<XTweet> = {}): XTweet {
  return {
    id: '100',
    text: 'Hello world',
    author_id: 'user-1',
    conversation_id: '100',
    created_at: '2024-01-15T10:00:00.000Z',
    ...overrides,
  };
}

describe('isLinkOnlyTweet', () => {
  it('should return true when tweet text is only a URL', () => {
    const tweet = createTweet({ text: 'https://example.com/article' });
    expect(isLinkOnlyTweet([tweet])).toBe(true);
  });

  it('should return true when tweet text is multiple URLs', () => {
    const tweet = createTweet({ text: 'https://example.com https://other.com' });
    expect(isLinkOnlyTweet([tweet])).toBe(true);
  });

  it('should return false when tweet has meaningful text', () => {
    const tweet = createTweet({ text: 'Check this out https://example.com' });
    expect(isLinkOnlyTweet([tweet])).toBe(false);
  });

  it('should return false for normal text without URLs', () => {
    const tweet = createTweet({ text: 'Just a regular tweet' });
    expect(isLinkOnlyTweet([tweet])).toBe(false);
  });

  it('should prefer note_tweet text when available', () => {
    const tweet = createTweet({
      text: 'https://t.co/short',
      note_tweet: { text: 'This is a long-form tweet with actual content https://example.com' },
    });
    expect(isLinkOnlyTweet([tweet])).toBe(false);
  });

  it('should return true when note_tweet text is also just a URL', () => {
    const tweet = createTweet({
      text: 'https://t.co/short',
      note_tweet: { text: 'https://example.com/full-article' },
    });
    expect(isLinkOnlyTweet([tweet])).toBe(true);
  });

  it('should handle multiple tweets in a thread', () => {
    const tweet1 = createTweet({ text: 'https://example.com' });
    const tweet2 = createTweet({ text: 'https://other.com' });
    expect(isLinkOnlyTweet([tweet1, tweet2])).toBe(true);
  });

  it('should return false if any tweet in thread has text', () => {
    const tweet1 = createTweet({ text: 'https://example.com' });
    const tweet2 = createTweet({ text: 'Here is some context' });
    expect(isLinkOnlyTweet([tweet1, tweet2])).toBe(false);
  });
});

describe('extractFirstArticleUrl', () => {
  it('should return the first expanded URL from entities', () => {
    const tweet = createTweet({
      text: 'https://t.co/abc',
      entities: {
        urls: [
          {
            start: 0,
            end: 20,
            url: 'https://t.co/abc',
            expanded_url: 'https://example.com/full-article',
            display_url: 'example.com/full-art...',
          },
        ],
      },
    });
    expect(extractFirstArticleUrl([tweet])).toBe('https://example.com/full-article');
  });

  it('should return null when there are no URL entities', () => {
    const tweet = createTweet({ text: 'No URLs here' });
    expect(extractFirstArticleUrl([tweet])).toBeNull();
  });

  it('should return null when entities are undefined', () => {
    const tweet = createTweet({ text: 'https://example.com' });
    expect(extractFirstArticleUrl([tweet])).toBeNull();
  });

  it('should prefer note_tweet entities when available', () => {
    const tweet = createTweet({
      text: 'https://t.co/short',
      entities: {
        urls: [
          {
            start: 0,
            end: 20,
            url: 'https://t.co/short',
            expanded_url: 'https://short.com',
            display_url: 'short.com',
          },
        ],
      },
      note_tweet: {
        text: 'https://t.co/full',
        entities: {
          urls: [
            {
              start: 0,
              end: 19,
              url: 'https://t.co/full',
              expanded_url: 'https://full-article.com/content',
              display_url: 'full-article.com/con...',
            },
          ],
        },
      },
    });
    expect(extractFirstArticleUrl([tweet])).toBe('https://full-article.com/content');
  });

  it('should check subsequent tweets if first has no URLs', () => {
    const tweet1 = createTweet({ text: 'No URL here' });
    const tweet2 = createTweet({
      text: 'https://t.co/abc',
      entities: {
        urls: [
          {
            start: 0,
            end: 20,
            url: 'https://t.co/abc',
            expanded_url: 'https://second-tweet.com/article',
            display_url: 'second-tweet.com/art...',
          },
        ],
      },
    });
    expect(extractFirstArticleUrl([tweet1, tweet2])).toBe('https://second-tweet.com/article');
  });
});

describe('fetchLinkedArticleContent', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('should fetch and parse Jina Reader response', async () => {
    const jinaResponse = [
      'Title: My Great Article',
      'URL Source: https://example.com/article',
      'Markdown Content:',
      'This is the **first** paragraph.',
      '',
      'This is the second paragraph with a [link](https://example.com).',
    ].join('\n');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(jinaResponse),
    });

    const result = await fetchLinkedArticleContent('https://example.com/article');

    expect(result).not.toBeNull();
    if (!result) throw new Error('result should not be null');
    expect(result.title).toBe('My Great Article');
    expect(result.contentHtml).toContain('<strong>first</strong>');
    expect(result.contentHtml).toContain('<a href="https://example.com">link</a>');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://r.jina.ai/https://example.com/article',
      expect.objectContaining({ headers: { Accept: 'text/plain' } }),
    );
  });

  it('should return null on fetch failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const result = await fetchLinkedArticleContent('https://example.com/article');
    expect(result).toBeNull();
  });

  it('should return null on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await fetchLinkedArticleContent('https://example.com/article');
    expect(result).toBeNull();
  });

  it('should return null for empty response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''),
    });

    const result = await fetchLinkedArticleContent('https://example.com/article');
    expect(result).toBeNull();
  });
});

describe('markdownToHtml', () => {
  it('should convert paragraphs', () => {
    const result = markdownToHtml('First paragraph.\n\nSecond paragraph.');
    expect(result).toBe('<p>First paragraph.</p>\n<p>Second paragraph.</p>');
  });

  it('should convert headings', () => {
    expect(markdownToHtml('# Heading 1')).toBe('<h1>Heading 1</h1>');
    expect(markdownToHtml('## Heading 2')).toBe('<h2>Heading 2</h2>');
    expect(markdownToHtml('### Heading 3')).toBe('<h3>Heading 3</h3>');
  });

  it('should convert bold and italic', () => {
    const result = markdownToHtml('This is **bold** and *italic* text.');
    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('<em>italic</em>');
  });

  it('should convert links', () => {
    const result = markdownToHtml('Click [here](https://example.com) for more.');
    expect(result).toContain('<a href="https://example.com">here</a>');
  });

  it('should convert blockquotes', () => {
    const result = markdownToHtml('> This is a quote');
    expect(result).toBe('<blockquote>This is a quote</blockquote>');
  });

  it('should convert unordered lists', () => {
    const result = markdownToHtml('- Item one\n- Item two\n- Item three');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>Item one</li>');
    expect(result).toContain('<li>Item two</li>');
    expect(result).toContain('<li>Item three</li>');
  });

  it('should convert inline code', () => {
    const result = markdownToHtml('Use the `console.log` function.');
    expect(result).toContain('<code>console.log</code>');
  });

  it('should handle single-line breaks as <br />', () => {
    const result = markdownToHtml('Line one\nLine two');
    expect(result).toBe('<p>Line one<br />Line two</p>');
  });

  it('should skip empty blocks', () => {
    const result = markdownToHtml('Content\n\n\n\nMore content');
    expect(result).toBe('<p>Content</p>\n<p>More content</p>');
  });
});
