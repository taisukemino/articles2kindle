import { describe, it, expect } from 'vitest';
import {
  isValidConfig,
  hasValidFeedlyConfig,
  hasValidSubstackConfig,
} from '../../src/config/schema.js';
import { maskSecrets } from '../../src/config/manager.js';

const VALID_SMTP = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: true,
  user: 'user@gmail.com',
  pass: 'password',
};

const VALID_KINDLE = {
  email: 'user@kindle.com',
  senderEmail: 'user@gmail.com',
};

const VALID_FEEDLY = {
  accessToken: 'test-token',
  streamId: 'user/abc/category/global.all',
};

const VALID_SUBSTACK = {
  publications: [{ url: 'https://www.techemails.com' }],
};

describe('isValidConfig', () => {
  it('should return false for empty config', () => {
    expect(isValidConfig({})).toBe(false);
  });

  it('should return true for feedly-only config', () => {
    const config = { feedly: VALID_FEEDLY, smtp: VALID_SMTP, kindle: VALID_KINDLE };
    expect(isValidConfig(config)).toBe(true);
  });

  it('should return true for substack-only config', () => {
    const config = { substack: VALID_SUBSTACK, smtp: VALID_SMTP, kindle: VALID_KINDLE };
    expect(isValidConfig(config)).toBe(true);
  });

  it('should return true for both feedly and substack config', () => {
    const config = {
      feedly: VALID_FEEDLY,
      substack: VALID_SUBSTACK,
      smtp: VALID_SMTP,
      kindle: VALID_KINDLE,
    };
    expect(isValidConfig(config)).toBe(true);
  });

  it('should return false when no source is configured', () => {
    const config = { smtp: VALID_SMTP, kindle: VALID_KINDLE };
    expect(isValidConfig(config)).toBe(false);
  });
});

describe('hasValidFeedlyConfig', () => {
  it('should return true when feedly is fully configured', () => {
    expect(hasValidFeedlyConfig({ feedly: VALID_FEEDLY })).toBe(true);
  });

  it('should return false when feedly is missing', () => {
    expect(hasValidFeedlyConfig({})).toBe(false);
  });
});

describe('hasValidSubstackConfig', () => {
  it('should return true when substack has publications', () => {
    expect(hasValidSubstackConfig({ substack: VALID_SUBSTACK })).toBe(true);
  });

  it('should return false when substack has empty publications', () => {
    expect(hasValidSubstackConfig({ substack: { publications: [] } })).toBe(false);
  });

  it('should return false when substack is missing', () => {
    expect(hasValidSubstackConfig({})).toBe(false);
  });
});

describe('maskSecrets', () => {
  it('should mask feedly token and smtp password', () => {
    const config = {
      feedly: { accessToken: 'abcdefghijklmnop', streamId: 'stream/1' },
      smtp: { host: 'smtp.gmail.com', port: 587, secure: true, user: 'u', pass: 'mysecret' },
      kindle: { email: 'a@kindle.com', senderEmail: 'b@gmail.com' },
    };
    const masked = maskSecrets(config);
    const feedlyConfig = masked['feedly'] as Record<string, string>;
    const smtpConfig = masked['smtp'] as Record<string, string>;
    expect(feedlyConfig['accessToken']).toBe('abcdefgh...mnop');
    expect(smtpConfig['pass']).toBe('********');
  });
});
