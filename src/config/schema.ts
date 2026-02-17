export interface FeedlyConfig {
  readonly accessToken: string;
  readonly streamId: string;
}

export interface SubstackPublication {
  readonly url: string;
  readonly label?: string;
}

export interface SubstackConfig {
  readonly publications: readonly SubstackPublication[];
}

export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user: string;
  readonly pass: string;
}

export interface KindleConfig {
  readonly email: string;
  readonly emails?: readonly string[];
  readonly senderEmail: string;
}

export interface AppConfig {
  readonly feedly?: FeedlyConfig;
  readonly substack?: SubstackConfig;
  readonly smtp: SmtpConfig;
  readonly kindle: KindleConfig;
}

export function hasValidFeedlyConfig(
  config: Partial<AppConfig>,
): config is AppConfig & { feedly: FeedlyConfig } {
  return !!config.feedly?.accessToken && !!config.feedly?.streamId;
}

export function hasValidSubstackConfig(
  config: Partial<AppConfig>,
): config is AppConfig & { substack: SubstackConfig } {
  return !!config.substack?.publications && config.substack.publications.length > 0;
}

export function isValidConfig(config: Partial<AppConfig>): config is AppConfig {
  const hasSource = hasValidFeedlyConfig(config) || hasValidSubstackConfig(config);

  const hasSmtp =
    !!config.smtp?.host &&
    typeof config.smtp?.port === 'number' &&
    !!config.smtp?.user &&
    !!config.smtp?.pass;

  const hasKindle = !!config.kindle?.email && !!config.kindle?.senderEmail;

  return hasSource && hasSmtp && hasKindle;
}
