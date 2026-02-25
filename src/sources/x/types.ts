export interface XUrlEntity {
  readonly start: number;
  readonly end: number;
  readonly url: string;
  readonly expanded_url: string;
  readonly display_url: string;
  readonly title?: string;
}

export interface XMentionEntity {
  readonly start: number;
  readonly end: number;
  readonly username: string;
}

export interface XHashtagEntity {
  readonly start: number;
  readonly end: number;
  readonly tag: string;
}

export interface XEntities {
  readonly urls?: readonly XUrlEntity[];
  readonly mentions?: readonly XMentionEntity[];
  readonly hashtags?: readonly XHashtagEntity[];
}

export interface XNoteTweet {
  readonly text: string;
  readonly entities?: XEntities;
}

export interface XMedia {
  readonly media_key: string;
  readonly type: 'photo' | 'video' | 'animated_gif';
  readonly url?: string;
  readonly preview_image_url?: string;
  readonly alt_text?: string;
}

export interface XAttachments {
  readonly media_keys?: readonly string[];
}

export interface XReferencedTweet {
  readonly type: 'replied_to' | 'quoted' | 'retweeted';
  readonly id: string;
}

export interface XTweet {
  readonly id: string;
  readonly text: string;
  readonly author_id: string;
  readonly conversation_id: string;
  readonly created_at: string;
  readonly referenced_tweets?: readonly XReferencedTweet[];
  readonly in_reply_to_user_id?: string;
  readonly entities?: XEntities;
  readonly note_tweet?: XNoteTweet;
  readonly attachments?: XAttachments;
}

export interface XUser {
  readonly id: string;
  readonly name: string;
  readonly username: string;
}

export interface XPaginationMeta {
  readonly result_count: number;
  readonly next_token?: string;
}

export interface XBookmarksResponse {
  readonly data?: readonly XTweet[];
  readonly includes?: {
    readonly users?: readonly XUser[];
    readonly media?: readonly XMedia[];
  };
  readonly meta: XPaginationMeta;
}

export interface XSearchResponse {
  readonly data?: readonly XTweet[];
  readonly includes?: {
    readonly users?: readonly XUser[];
    readonly media?: readonly XMedia[];
  };
  readonly meta: XPaginationMeta;
}
