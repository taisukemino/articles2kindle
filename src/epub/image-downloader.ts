import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const IMAGE_DOWNLOAD_TIMEOUT_MS = 5000;

const CONTENT_TYPE_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

/**
 * Extract all unique HTTP/HTTPS image src URLs from an array of HTML strings.
 *
 * @param htmlList - Array of HTML content strings to scan for image tags
 * @returns Deduplicated array of image URLs
 */
export function extractImageUrls(htmlList: readonly string[]): string[] {
  const urls = new Set<string>();
  const imgTagPattern = /<img[^>]+src="([^"]+)"/g;
  for (const html of htmlList) {
    let match;
    while ((match = imgTagPattern.exec(html)) !== null) {
      const url = match[1];
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        urls.add(url);
      }
    }
  }
  return [...urls];
}

/**
 * Download a single image with an AbortController timeout.
 *
 * @param url - Image URL to download
 * @param destinationDirectory - Directory to save the downloaded image to
 * @returns Local file path of the downloaded image, or null on failure
 */
async function _downloadImage(url: string, destinationDirectory: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IMAGE_DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
    const extension = CONTENT_TYPE_TO_EXTENSION[contentType] ?? _extensionFromUrl(url) ?? 'jpg';
    const filePath = join(destinationDirectory, `${randomUUID()}.${extension}`);
    writeFileSync(filePath, buffer);
    return filePath;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function _extensionFromUrl(url: string): string | undefined {
  const match = url.match(/\.(\w{3,4})(?:\?|$)/);
  const extension = match?.[1]?.toLowerCase();
  if (extension && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
    return extension;
  }
  return undefined;
}

/**
 * Pre-download all images found in the HTML strings to local temp files.
 * Returns a map from original URL to local file:// URI.
 *
 * @param htmlList - Array of HTML content strings containing image tags
 * @returns Map from original image URL to file:// URI of the downloaded file
 */
export async function preDownloadImages(htmlList: readonly string[]): Promise<Map<string, string>> {
  const urls = extractImageUrls(htmlList);
  if (urls.length === 0) return new Map();

  const tempDirectory = mkdtempSync(join(tmpdir(), 'epub-images-'));
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const localPath = await _downloadImage(url, tempDirectory);
      return { url, localPath };
    }),
  );

  const urlMap = new Map<string, string>();
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.localPath) {
      urlMap.set(result.value.url, `file://${result.value.localPath}`);
    }
  }

  return urlMap;
}

/**
 * Replace external image URLs in HTML with local file:// paths.
 * Images that failed to download are replaced with an "[Image unavailable]" placeholder.
 *
 * @param html - HTML string with external image URLs
 * @param urlMap - Map from original URL to local file:// URI
 * @returns HTML with image URLs replaced
 */
export function replaceImageUrls(html: string, urlMap: ReadonlyMap<string, string>): string {
  return html.replace(
    /<img([^>]*)src="([^"]+)"([^>]*)\/?>/g,
    (match: string, before: string, src: string, after: string) => {
      if (!src.startsWith('http://') && !src.startsWith('https://')) {
        return match;
      }
      const localPath = urlMap.get(src);
      if (localPath) {
        return `<img${before}src="${localPath}"${after}/>`;
      }
      return '<em>[Image unavailable]</em>';
    },
  );
}

/**
 * Remove the temporary directory created by preDownloadImages.
 *
 * @param urlMap - Map returned by preDownloadImages (used to find the temp directory)
 */
export function cleanupTempImages(urlMap: ReadonlyMap<string, string>): void {
  const firstPath = urlMap.values().next().value;
  if (!firstPath) return;

  // Extract the temp directory from the first file:// path
  const filePath = firstPath.replace('file://', '');
  const tempDirectory = join(filePath, '..');
  try {
    rmSync(tempDirectory, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup
  }
}
