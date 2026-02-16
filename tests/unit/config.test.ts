import { describe, it, expect } from 'vitest';
import { isValidConfig } from '../../src/config/schema.js';
import { maskSecrets } from '../../src/config/manager.js';

describe('isValidConfig', () => {
  it('should return false for empty config', () => {
    expect(isValidConfig({})).toBe(false);
  });

  it('should return true for complete config', () => {
    const config = {
      feedly: {
        accessToken: 'test-token',
        streamId: 'user/abc/category/global.all',
      },
      smtp: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: true,
        user: 'user@gmail.com',
        pass: 'password',
      },
      kindle: {
        email: 'user@kindle.com',
        senderEmail: 'user@gmail.com',
      },
    };
    expect(isValidConfig(config)).toBe(true);
  });

  it('should return false when feedly is missing', () => {
    const config = {
      smtp: { host: 'smtp.gmail.com', port: 587, secure: true, user: 'u', pass: 'p' },
      kindle: { email: 'a@kindle.com', senderEmail: 'b@gmail.com' },
    };
    expect(isValidConfig(config)).toBe(false);
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
