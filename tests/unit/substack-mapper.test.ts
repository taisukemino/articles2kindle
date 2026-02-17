import { describe, it, expect } from 'vitest';
import { mapSubstackPost } from '../../src/sources/substack/mapper.js';
import type { SubstackFullPost } from '../../src/sources/substack/api.js';

describe('mapSubstackPost', () => {
  const completePost: SubstackFullPost = {
    id: 186480875,
    title: '"The fate of civilization is at stake"',
    slug: 'the-fate-of-civilization-is-at-stake',
    post_date: '2026-02-01T19:36:46.140Z',
    audience: 'everyone',
    wordcount: 1995,
    description: 'Text messages from Sam Altman, Satya Nadella, and Elon Musk.',
    truncated_body_text: 'Welcome to Internal Tech Emails...',
    canonical_url: 'https://www.techemails.com/p/the-fate-of-civilization-is-at-stake',
    publishedBylines: [{ id: 1, name: 'Liz Hoffman' }],
    body_html: '<p>Full article content here</p>',
  };

  it('should map a complete substack post', () => {
    const result = mapSubstackPost(
      completePost,
      'https://www.techemails.com',
      'Internal Tech Emails',
    );

    expect(result.sourceId).toBe('substack-www.techemails.com-186480875');
    expect(result.sourceName).toBe('substack');
    expect(result.title).toBe('"The fate of civilization is at stake"');
    expect(result.author).toBe('Liz Hoffman');
    expect(result.contentHtml).toBe('<p>Full article content here</p>');
    expect(result.url).toBe('https://www.techemails.com/p/the-fate-of-civilization-is-at-stake');
    expect(result.publicationName).toBe('Internal Tech Emails');
    expect(result.publishedAt).toBe('2026-02-01T19:36:46.140Z');
    expect(result.tags).toEqual([]);
  });

  it('should handle missing fields gracefully', () => {
    const minimalPost: SubstackFullPost = {
      id: 12345,
      title: 'Test Post',
      slug: 'test-post',
      post_date: '2026-01-01T00:00:00.000Z',
      audience: 'everyone',
      wordcount: 0,
      description: '',
      truncated_body_text: '',
      canonical_url: 'https://example.substack.com/p/test-post',
      publishedBylines: [],
      body_html: null,
    };

    const result = mapSubstackPost(minimalPost, 'https://example.substack.com', undefined);

    expect(result.author).toBeNull();
    expect(result.contentHtml).toBeNull();
    expect(result.excerpt).toBeNull();
  });

  it('should derive publication name from substack.com subdomain', () => {
    const result = mapSubstackPost(completePost, 'https://techemails.substack.com', undefined);

    expect(result.publicationName).toBe('techemails');
  });

  it('should derive publication name from custom domain', () => {
    const result = mapSubstackPost(completePost, 'https://www.techemails.com', undefined);

    expect(result.publicationName).toBe('techemails');
  });

  it('should use label as publication name when provided', () => {
    const result = mapSubstackPost(completePost, 'https://www.techemails.com', 'My Label');

    expect(result.publicationName).toBe('My Label');
  });
});
