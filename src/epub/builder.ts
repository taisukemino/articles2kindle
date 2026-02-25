import { EPub, type Chapter, type Options } from 'epub-gen-memory';
import { EPUB_CSS, sanitizeArticleHtml } from './templates.js';
import { preDownloadImages, replaceImageUrls, cleanupTempImages } from './image-downloader.js';

const FETCH_TIMEOUT = 5000;
const RETRY_TIMES = 1;

export interface EpubArticle {
  readonly title: string;
  readonly author: string | null;
  readonly contentHtml: string | null;
  readonly publicationName: string | null;
  readonly publishedAt: string | null;
  readonly url: string | null;
}

/**
 * Build an EPUB buffer from a list of articles.
 * When withImages is true, images are pre-downloaded to local temp files
 * to avoid epub-gen-memory's unreliable external fetch timeouts.
 *
 * @param title - EPUB title
 * @param articleList - Articles to include as chapters
 * @param withImages - Whether to include images in the EPUB
 * @returns EPUB file as a Buffer
 */
export async function buildEpub(
  title: string,
  articleList: EpubArticle[],
  withImages = false,
): Promise<Buffer> {
  const chapters: Chapter[] = articleList.map((article) => {
    const meta = buildArticleMeta(article);
    const cleanHtml = article.contentHtml
      ? sanitizeArticleHtml(article.contentHtml, withImages)
      : '<p>No content available.</p>';
    const fullContent = `<div class="article-meta">${meta}</div>${cleanHtml}`;

    return {
      title: article.title,
      content: fullContent,
    };
  });

  // Pre-download images to local files so epub-gen-memory reads file:// paths
  // instead of fetching external URLs (which can hang indefinitely)
  let imageUrlMap: Map<string, string> | undefined;
  if (withImages) {
    imageUrlMap = await preDownloadImages(chapters.map((chapter) => chapter.content));
    for (const chapter of chapters) {
      chapter.content = replaceImageUrls(chapter.content, imageUrlMap);
    }
  }

  const options: Options = {
    title,
    author: summarizeAuthors(articleList),
    css: EPUB_CSS,
    ignoreFailedDownloads: true,
    fetchTimeout: FETCH_TIMEOUT,
    retryTimes: RETRY_TIMES,
  };

  try {
    return await new EPub(options, chapters).genEpub();
  } finally {
    if (imageUrlMap) {
      cleanupTempImages(imageUrlMap);
    }
  }
}

function buildArticleMeta(article: EpubArticle): string {
  const parts: string[] = [];
  if (article.author) {
    parts.push(`By ${article.author}`);
  }
  if (article.publicationName) {
    parts.push(article.publicationName);
  }
  if (article.publishedAt) {
    const date = new Date(article.publishedAt);
    parts.push(
      date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    );
  }
  if (article.url) {
    parts.push(`<a href="${article.url}">Original</a>`);
  }
  return parts.join(' · ');
}

function summarizeAuthors(articleList: EpubArticle[]): string {
  const uniqueAuthors = [
    ...new Set(
      articleList
        .map((article) => article.author)
        .filter((author): author is string => author !== null),
    ),
  ];
  if (uniqueAuthors.length === 0) return 'Various Authors';
  if (uniqueAuthors.length <= 3) return uniqueAuthors.join(', ');
  return `${uniqueAuthors.slice(0, 2).join(', ')} and ${uniqueAuthors.length - 2} others`;
}
