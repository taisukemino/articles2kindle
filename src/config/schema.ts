export interface FeedlyConfig {
  readonly accessToken: string;
  readonly streamId: string;
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
  readonly feedly: FeedlyConfig;
  readonly smtp: SmtpConfig;
  readonly kindle: KindleConfig;
}

export function isValidConfig(config: Partial<AppConfig>): config is AppConfig {
  const hasFeedly = !!config.feedly?.accessToken && !!config.feedly?.streamId;

  const hasSmtp =
    !!config.smtp?.host &&
    typeof config.smtp?.port === 'number' &&
    !!config.smtp?.user &&
    !!config.smtp?.pass;

  const hasKindle = !!config.kindle?.email && !!config.kindle?.senderEmail;

  return hasFeedly && hasSmtp && hasKindle;
}
