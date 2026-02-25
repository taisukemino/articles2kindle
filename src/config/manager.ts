import type { AppConfig, SubstackPublication } from './schema.js';

function parseSubstackUrls(raw: string): SubstackPublication[] {
  return raw
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url) => ({ url }));
}

function parseKindleEmails(raw: string): string[] {
  return raw
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
}

function parseSmtpPort(raw: string | undefined): number | undefined {
  const value = raw ?? '587';
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return undefined;
  }

  return parsed;
}

/**
 * Loads the application configuration from environment variables.
 *
 * @returns The parsed configuration built from env vars
 */
export function loadConfig(): Partial<AppConfig> {
  const feedlyAccessToken = process.env['FEEDLY_ACCESS_TOKEN'];
  const feedlyStreamId = process.env['FEEDLY_STREAM_ID'];

  const substackUrls = process.env['SUBSTACK_URLS'];
  const substackPublications = substackUrls ? parseSubstackUrls(substackUrls) : [];

  const smtpHost = process.env['SMTP_HOST'];
  const smtpUser = process.env['SMTP_USER'];
  const smtpPass = process.env['SMTP_PASS'];
  const smtpPort = parseSmtpPort(process.env['SMTP_PORT']);

  const kindleEmail = process.env['KINDLE_EMAIL'];
  const kindleSenderEmail = process.env['KINDLE_SENDER_EMAIL'];
  const extraEmails = process.env['KINDLE_EMAILS'];

  return {
    ...(feedlyAccessToken && feedlyStreamId
      ? { feedly: { accessToken: feedlyAccessToken, streamId: feedlyStreamId } }
      : {}),
    ...(substackPublications.length > 0
      ? { substack: { publications: substackPublications } }
      : {}),
    ...(smtpHost && smtpUser && smtpPass && smtpPort !== undefined
      ? {
          smtp: {
            host: smtpHost,
            port: smtpPort,
            secure: process.env['SMTP_SECURE'] !== 'false',
            user: smtpUser,
            pass: smtpPass,
          },
        }
      : {}),
    ...(kindleEmail && kindleSenderEmail
      ? {
          kindle: {
            email: kindleEmail,
            senderEmail: kindleSenderEmail,
            ...(extraEmails ? { emails: parseKindleEmails(extraEmails) } : {}),
          },
        }
      : {}),
  };
}
