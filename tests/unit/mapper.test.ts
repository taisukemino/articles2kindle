import { describe, it, expect } from 'vitest';
import { mapFeedlyEntry } from '../../src/sources/feedly/mapper.js';
import type { FeedlyEntry } from '../../src/sources/feedly/api.js';

describe('mapFeedlyEntry', () => {
  it('should map a complete feedly entry', () => {
    const entry: FeedlyEntry = {
      id: 'entry-123',
      title: 'Test Article',
      author: 'John Doe',
      content: { content: '<p>Hello World</p>' },
      summary: { content: 'Hello World summary' },
      alternate: [{ href: 'https://example.com/article', type: 'text/html' }],
      origin: { title: 'Example Blog', streamId: 'feed/1' },
      published: 1700000000000,
      tags: [{ id: 'tag/1', label: 'tech' }],
      categories: [{ id: 'cat/1', label: 'engineering' }],
    };

    const result = mapFeedlyEntry(entry);

    expect(result.sourceId).toBe('entry-123');
    expect(result.sourceName).toBe('feedly');
    expect(result.title).toBe('Test Article');
    expect(result.author).toBe('John Doe');
    expect(result.contentHtml).toBe('<p>Hello World</p>');
    expect(result.url).toBe('https://example.com/article');
    expect(result.publicationName).toBe('Example Blog');
    expect(result.tags).toEqual(['tech', 'engineering']);
  });

  it('should handle missing fields gracefully', () => {
    const entry: FeedlyEntry = { id: 'entry-456' };

    const result = mapFeedlyEntry(entry);

    expect(result.sourceId).toBe('entry-456');
    expect(result.title).toBe('Untitled');
    expect(result.author).toBeNull();
    expect(result.contentHtml).toBeNull();
    expect(result.url).toBeNull();
  });
});
