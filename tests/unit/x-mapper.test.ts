import { describe, it, expect } from 'vitest';
import {
  mapTweetsToArticle,
  buildUserLookup,
  buildMediaLookup,
} from '../../src/sources/x/mapper.js';
import type { XTweet, XUser, XMedia } from '../../src/sources/x/types.js';

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

function createUser(overrides: Partial<XUser> = {}): XUser {
  return {
    id: 'user-1',
    name: 'Jane Doe',
    username: 'janedoe',
    ...overrides,
  };
}

function createUserLookup(users: XUser[]): Map<string, XUser> {
  return buildUserLookup(users);
}

describe('mapTweetsToArticle', () => {
  it('should map a single tweet to a SourceArticle', () => {
    const tweet = createTweet({ text: 'This is a great insight about TypeScript' });
    const userLookup = createUserLookup([createUser()]);

    const result = mapTweetsToArticle([tweet], userLookup);

    expect(result.sourceId).toBe('x-thread-100');
    expect(result.sourceName).toBe('x');
    expect(result.title).toBe('This is a great insight about TypeScript');
    expect(result.author).toBe('Jane Doe (@janedoe)');
    expect(result.publicationName).toBe('X Bookmarks');
    expect(result.url).toBe('https://x.com/janedoe/status/100');
    expect(result.publishedAt).toBe('2024-01-15T10:00:00.000Z');
  });

  it('should truncate title at 80 characters', () => {
    const longText =
      'This is a very long tweet that exceeds the eighty character limit for titles and should be truncated with an ellipsis';
    const tweet = createTweet({ text: longText });
    const userLookup = createUserLookup([createUser()]);

    const result = mapTweetsToArticle([tweet], userLookup);

    expect(result.title.length).toBeLessThanOrEqual(83); // 80 + "..."
    expect(result.title).toContain('...');
  });

  it('should prefix thread titles with author username', () => {
    const tweet1 = createTweet({ id: '100', text: 'Thread start' });
    const tweet2 = createTweet({
      id: '101',
      text: 'Thread continuation',
      conversation_id: '100',
      created_at: '2024-01-15T10:01:00.000Z',
    });
    const userLookup = createUserLookup([createUser()]);

    const result = mapTweetsToArticle([tweet1, tweet2], userLookup);

    expect(result.title).toBe("@janedoe's thread: Thread start");
  });

  it('should fall back to "Post by @username" when text is only URLs', () => {
    const tweet = createTweet({ text: 'https://example.com https://other.com' });
    const userLookup = createUserLookup([createUser()]);

    const result = mapTweetsToArticle([tweet], userLookup);

    expect(result.title).toBe('Post by @janedoe');
  });

  it('should fall back to "Untitled Post" without author', () => {
    const tweet = createTweet({ text: 'https://example.com', author_id: 'unknown' });
    const userLookup = createUserLookup([]);

    const result = mapTweetsToArticle([tweet], userLookup);

    expect(result.title).toBe('Untitled Post');
  });

  it('should handle missing author gracefully', () => {
    const tweet = createTweet({ author_id: 'unknown' });
    const userLookup = createUserLookup([]);

    const result = mapTweetsToArticle([tweet], userLookup);

    expect(result.author).toBeNull();
    expect(result.url).toBeNull();
  });

  it('should prefer note_tweet.text for long-form tweets', () => {
    const tweet = createTweet({
      text: 'Truncated version...',
      note_tweet: {
        text: 'This is the full long-form tweet text that exceeds 280 characters and contains the complete content',
      },
    });
    const userLookup = createUserLookup([createUser()]);

    const result = mapTweetsToArticle([tweet], userLookup);

    expect(result.contentHtml).toContain('full long-form tweet text');
    expect(result.contentHtml).not.toContain('Truncated version');
  });

  it('should expand URL entities into anchor tags', () => {
    const tweet = createTweet({
      text: 'Check this out https://t.co/abc123 cool right?',
      entities: {
        urls: [
          {
            start: 15,
            end: 38,
            url: 'https://t.co/abc123',
            expanded_url: 'https://example.com/full-article',
            display_url: 'example.com/full-article',
          },
        ],
      },
    });
    const userLookup = createUserLookup([createUser()]);

    const result = mapTweetsToArticle([tweet], userLookup);

    expect(result.contentHtml).toContain(
      '<a href="https://example.com/full-article">example.com/full-article</a>',
    );
    expect(result.contentHtml).not.toContain('https://t.co/abc123');
  });

  it('should expand mention entities into profile links', () => {
    const tweet = createTweet({
      text: 'Hey @johndoe check this',
      entities: {
        mentions: [{ start: 4, end: 13, username: 'johndoe' }],
      },
    });
    const userLookup = createUserLookup([createUser()]);

    const result = mapTweetsToArticle([tweet], userLookup);

    expect(result.contentHtml).toContain('<a href="https://x.com/johndoe">@johndoe</a>');
  });

  it('should HTML-escape text outside entities', () => {
    const tweet = createTweet({ text: 'Use <div> & "quotes" in HTML' });
    const userLookup = createUserLookup([createUser()]);

    const result = mapTweetsToArticle([tweet], userLookup);

    expect(result.contentHtml).toContain('&lt;div&gt;');
    expect(result.contentHtml).toContain('&amp;');
    expect(result.contentHtml).toContain('&quot;quotes&quot;');
  });

  it('should separate thread tweets with <hr /> dividers', () => {
    const tweet1 = createTweet({ id: '100', text: 'First tweet' });
    const tweet2 = createTweet({
      id: '101',
      text: 'Second tweet',
      conversation_id: '100',
      created_at: '2024-01-15T10:01:00.000Z',
    });
    const userLookup = createUserLookup([createUser()]);

    const result = mapTweetsToArticle([tweet1, tweet2], userLookup);

    expect(result.contentHtml).toContain('<hr />');
    expect(result.contentHtml).toContain('First tweet');
    expect(result.contentHtml).toContain('Second tweet');
  });

  it('should extract and deduplicate hashtags', () => {
    const tweet1 = createTweet({
      id: '100',
      entities: {
        hashtags: [
          { start: 0, end: 5, tag: 'TypeScript' },
          { start: 6, end: 10, tag: 'React' },
        ],
      },
    });
    const tweet2 = createTweet({
      id: '101',
      conversation_id: '100',
      created_at: '2024-01-15T10:01:00.000Z',
      entities: {
        hashtags: [{ start: 0, end: 5, tag: 'typescript' }],
      },
    });
    const userLookup = createUserLookup([createUser()]);

    const result = mapTweetsToArticle([tweet1, tweet2], userLookup);

    expect(result.tags).toEqual(['typescript', 'react']);
  });

  it('should generate excerpt from full text', () => {
    const tweet = createTweet({ text: 'A short tweet' });
    const userLookup = createUserLookup([createUser()]);

    const result = mapTweetsToArticle([tweet], userLookup);

    expect(result.excerpt).toBe('A short tweet');
  });

  it('should use conversation_id as sourceId for deduplication', () => {
    const tweet = createTweet({ id: '200', conversation_id: '100' });
    const userLookup = createUserLookup([createUser()]);

    const result = mapTweetsToArticle([tweet], userLookup);

    expect(result.sourceId).toBe('x-thread-100');
  });

  it('should embed photo attachments as img tags', () => {
    const tweet = createTweet({
      text: 'Look at this',
      attachments: { media_keys: ['media-1'] },
    });
    const userLookup = createUserLookup([createUser()]);
    const mediaLookup = buildMediaLookup([
      {
        media_key: 'media-1',
        type: 'photo',
        url: 'https://pbs.twimg.com/media/photo1.jpg',
        alt_text: 'A sunset',
      },
    ]);

    const result = mapTweetsToArticle([tweet], userLookup, mediaLookup);

    expect(result.contentHtml).toContain(
      '<img src="https://pbs.twimg.com/media/photo1.jpg" alt="A sunset" />',
    );
  });

  it('should show [Video] placeholder for video attachments', () => {
    const tweet = createTweet({
      text: 'Watch this',
      attachments: { media_keys: ['media-2'] },
    });
    const userLookup = createUserLookup([createUser()]);
    const mediaLookup = buildMediaLookup([
      {
        media_key: 'media-2',
        type: 'video',
        preview_image_url: 'https://pbs.twimg.com/preview.jpg',
      },
    ]);

    const result = mapTweetsToArticle([tweet], userLookup, mediaLookup);

    expect(result.contentHtml).toContain('<em>[Video]</em>');
    expect(result.contentHtml).not.toContain('<img');
  });

  it('should show [GIF] placeholder for animated_gif attachments', () => {
    const tweet = createTweet({
      text: 'Funny GIF',
      attachments: { media_keys: ['media-3'] },
    });
    const userLookup = createUserLookup([createUser()]);
    const mediaLookup = buildMediaLookup([
      {
        media_key: 'media-3',
        type: 'animated_gif',
        preview_image_url: 'https://pbs.twimg.com/gif.jpg',
      },
    ]);

    const result = mapTweetsToArticle([tweet], userLookup, mediaLookup);

    expect(result.contentHtml).toContain('<em>[GIF]</em>');
    expect(result.contentHtml).not.toContain('<img');
  });

  it('should handle tweets without attachments', () => {
    const tweet = createTweet({ text: 'No media here' });
    const userLookup = createUserLookup([createUser()]);
    const mediaLookup = buildMediaLookup([]);

    const result = mapTweetsToArticle([tweet], userLookup, mediaLookup);

    expect(result.contentHtml).not.toContain('<img');
    expect(result.contentHtml).not.toContain('[Video]');
    expect(result.contentHtml).not.toContain('[GIF]');
  });

  it('should handle mixed media types in a single tweet', () => {
    const tweet = createTweet({
      text: 'Mixed media',
      attachments: { media_keys: ['media-1', 'media-2'] },
    });
    const userLookup = createUserLookup([createUser()]);
    const mediaLookup = buildMediaLookup([
      { media_key: 'media-1', type: 'photo', url: 'https://pbs.twimg.com/photo.jpg' },
      {
        media_key: 'media-2',
        type: 'video',
        preview_image_url: 'https://pbs.twimg.com/preview.jpg',
      },
    ]);

    const result = mapTweetsToArticle([tweet], userLookup, mediaLookup);

    expect(result.contentHtml).toContain('<img src="https://pbs.twimg.com/photo.jpg"');
    expect(result.contentHtml).toContain('<em>[Video]</em>');
  });

  it('should skip unknown media keys gracefully', () => {
    const tweet = createTweet({
      text: 'Missing media',
      attachments: { media_keys: ['nonexistent'] },
    });
    const userLookup = createUserLookup([createUser()]);
    const mediaLookup = buildMediaLookup([]);

    const result = mapTweetsToArticle([tweet], userLookup, mediaLookup);

    expect(result.contentHtml).not.toContain('<img');
    expect(result.contentHtml).not.toContain('[Video]');
  });
});

describe('buildUserLookup', () => {
  it('should create a map from user ID to user object', () => {
    const users: XUser[] = [
      { id: 'u1', name: 'Alice', username: 'alice' },
      { id: 'u2', name: 'Bob', username: 'bob' },
    ];

    const lookup = buildUserLookup(users);

    expect(lookup.size).toBe(2);
    expect(lookup.get('u1')?.username).toBe('alice');
    expect(lookup.get('u2')?.username).toBe('bob');
  });

  it('should return empty map for undefined input', () => {
    const lookup = buildUserLookup(undefined);
    expect(lookup.size).toBe(0);
  });
});

describe('buildMediaLookup', () => {
  it('should create a map from media_key to media object', () => {
    const media: XMedia[] = [
      { media_key: 'mk1', type: 'photo', url: 'https://example.com/1.jpg' },
      { media_key: 'mk2', type: 'video', preview_image_url: 'https://example.com/2.jpg' },
    ];

    const lookup = buildMediaLookup(media);

    expect(lookup.size).toBe(2);
    expect(lookup.get('mk1')?.type).toBe('photo');
    expect(lookup.get('mk2')?.type).toBe('video');
  });

  it('should return empty map for undefined input', () => {
    const lookup = buildMediaLookup(undefined);
    expect(lookup.size).toBe(0);
  });
});
