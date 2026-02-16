import sanitizeHtml from 'sanitize-html';

export const EPUB_CSS = `
body {
  font-family: Georgia, serif;
  line-height: 1.6;
  margin: 1em;
  color: #333;
}
h1 {
  font-size: 1.4em;
  margin-bottom: 0.5em;
}
h2 {
  font-size: 1.2em;
  margin-bottom: 0.4em;
}
p {
  margin-bottom: 0.8em;
  text-align: justify;
}
blockquote {
  margin: 1em 0;
  padding-left: 1em;
  border-left: 3px solid #ccc;
  color: #555;
}
img {
  max-width: 100%;
  height: auto;
}
pre, code {
  font-family: monospace;
  font-size: 0.9em;
  background: #f5f5f5;
  padding: 0.2em 0.4em;
}
pre {
  padding: 1em;
  overflow-x: auto;
}
a {
  color: #1a0dab;
}
.article-meta {
  font-size: 0.85em;
  color: #666;
  margin-bottom: 1.5em;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.5em;
}
`;

export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img',
      'h1',
      'h2',
      'h3',
      'figure',
      'figcaption',
      'pre',
      'code',
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title'],
      a: ['href', 'title'],
    },
    allowedSchemes: ['http', 'https'],
  });
}
