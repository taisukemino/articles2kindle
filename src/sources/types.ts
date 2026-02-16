export interface SourceArticle {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly title: string;
  readonly author: string | null;
  readonly contentHtml: string | null;
  readonly excerpt: string | null;
  readonly url: string | null;
  readonly publicationName: string | null;
  readonly publishedAt: string | null;
  readonly tags: readonly string[];
}

export interface FetchOptions {
  readonly newerThan?: number;
  readonly count?: number;
}

export interface Collection {
  readonly id: string;
  readonly label: string;
}

export interface SourceAdapter {
  readonly name: string;
  validateConnection(): Promise<void>;
  fetchArticles(options: FetchOptions): AsyncGenerator<SourceArticle[]>;
  listCollections(): Promise<Collection[]>;
}
