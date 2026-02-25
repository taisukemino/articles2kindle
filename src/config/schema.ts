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

/**
 * Checks whether the configuration contains valid Feedly credentials.
 *
 * @param config - The application configuration to validate
 * @returns True if both accessToken and streamId are present
 */
export function hasValidFeedlyConfig(
  config: Partial<AppConfig>,
): config is AppConfig & { feedly: FeedlyConfig } {
  return !!config.feedly?.accessToken && !!config.feedly?.streamId;
}

/**
 * Checks whether the configuration contains at least one Substack publication.
 *
 * @param config - The application configuration to validate
 * @returns True if the publications list is non-empty
 */
export function hasValidSubstackConfig(
  config: Partial<AppConfig>,
): config is AppConfig & { substack: SubstackConfig } {
  return !!config.substack?.publications && config.substack.publications.length > 0;
}

/**
 * Checks whether the required X (Twitter) environment variables are set.
 *
 * @returns True if both X_ACCESS_TOKEN and X_USER_ID are present
 */
export function hasValidXEnv(): boolean {
  return !!process.env['X_ACCESS_TOKEN'] && !!process.env['X_USER_ID'];
}

/**
 * Validates that the configuration has at least one source, SMTP settings, and Kindle settings.
 *
 * @param config - The application configuration to validate
 * @returns True if the configuration is complete enough to run the application
 */
export function isValidConfig(config: Partial<AppConfig>): config is AppConfig {
  const hasSource =
    hasValidFeedlyConfig(config) || hasValidSubstackConfig(config) || hasValidXEnv();

  const hasSmtp =
    !!config.smtp?.host &&
    Number.isInteger(config.smtp?.port) &&
    config.smtp?.port > 0 &&
    config.smtp?.port <= 65535 &&
    !!config.smtp?.user &&
    !!config.smtp?.pass;

  const hasKindle = !!config.kindle?.email && !!config.kindle?.senderEmail;

  return hasSource && hasSmtp && hasKindle;
}
