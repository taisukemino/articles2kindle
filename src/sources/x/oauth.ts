import { createServer, type Server } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { exec } from 'node:child_process';

const X_AUTHORIZE_URL = 'https://twitter.com/i/oauth2/authorize';
const X_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const SCOPES = 'bookmark.read tweet.read users.read offline.access';
const CALLBACK_PORT = 8739;
const CALLBACK_PATH = '/callback';

interface TokenResponse {
  readonly access_token: string;
  readonly refresh_token?: string;
  readonly expires_in: number;
  readonly token_type: string;
}

interface UserMeResponse {
  readonly data: {
    readonly id: string;
    readonly name: string;
    readonly username: string;
  };
}

/**
 * Run the full OAuth 2.0 PKCE flow: open browser, catch callback, exchange code, save tokens.
 *
 * @param clientId - X OAuth 2.0 client ID
 * @returns Object containing the authenticated user's ID and username
 */
export async function runOAuthPkceFlow(
  clientId: string,
): Promise<{ userId: string; username: string }> {
  const codeVerifier = _generateCodeVerifier();
  const codeChallenge = _generateCodeChallenge(codeVerifier);
  const state = randomBytes(16).toString('hex');
  const redirectUri = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;

  const authorizationCode = await _startCallbackServerAndOpenBrowser(
    clientId,
    codeChallenge,
    state,
    redirectUri,
  );

  const tokens = await _exchangeCodeForTokens(
    clientId,
    authorizationCode,
    codeVerifier,
    redirectUri,
  );

  const userInfo = await _fetchUserInfo(tokens.access_token);

  _updateEnvFile({
    X_ACCESS_TOKEN: tokens.access_token,
    X_REFRESH_TOKEN: tokens.refresh_token ?? '',
    X_USER_ID: userInfo.data.id,
  });

  return { userId: userInfo.data.id, username: userInfo.data.username };
}

/**
 * Refresh the access token using the refresh token.
 * Updates the .env file with new tokens and returns the new access token.
 *
 * @param clientId - X OAuth 2.0 client ID
 * @param refreshToken - Current refresh token to exchange for a new access token
 * @returns The new access token
 */
export async function refreshAccessToken(clientId: string, refreshToken: string): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const response = await fetch(X_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Token refresh failed (${response.status}). Run "articles2kindle x auth" to re-authenticate. ${body}`,
    );
  }

  const tokens = (await response.json()) as TokenResponse;

  _updateEnvFile({
    X_ACCESS_TOKEN: tokens.access_token,
    ...(tokens.refresh_token ? { X_REFRESH_TOKEN: tokens.refresh_token } : {}),
  });

  // Also update process.env so the current run uses the new token
  process.env['X_ACCESS_TOKEN'] = tokens.access_token;
  if (tokens.refresh_token) {
    process.env['X_REFRESH_TOKEN'] = tokens.refresh_token;
  }

  return tokens.access_token;
}

function _generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

function _generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Start a local HTTP server, open the browser to X's auth page,
 * and wait for the callback with the authorization code.
 *
 * @param clientId - X OAuth 2.0 client ID
 * @param codeChallenge - PKCE code challenge derived from the verifier
 * @param state - Random state string for CSRF protection
 * @param redirectUri - Local callback URL the server listens on
 * @returns The authorization code received from the callback
 */
function _startCallbackServerAndOpenBrowser(
  clientId: string,
  codeChallenge: string,
  state: string,
  redirectUri: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const server: Server = createServer((req, res) => {
      const requestUrl = new URL(req.url ?? '/', `http://localhost:${CALLBACK_PORT}`);

      if (requestUrl.pathname !== CALLBACK_PATH) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const returnedState = requestUrl.searchParams.get('state');
      const code = requestUrl.searchParams.get('code');
      const error = requestUrl.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorization failed</h1><p>You can close this tab.</p>');
        server.close();
        reject(new Error(`Authorization denied: ${error}`));
        return;
      }

      if (returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Invalid state</h1><p>Possible CSRF attack. Try again.</p>');
        server.close();
        reject(new Error('OAuth state mismatch'));
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Missing code</h1><p>Try again.</p>');
        server.close();
        reject(new Error('No authorization code received'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Authorized!</h1><p>You can close this tab and return to the terminal.</p>');
      server.close();
      resolve(code);
    });

    server.listen(CALLBACK_PORT, () => {
      const authUrl = new URL(X_AUTHORIZE_URL);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', SCOPES);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');

      _openBrowser(authUrl.toString());
    });

    server.on('error', (error) => {
      reject(
        new Error(`Could not start callback server on port ${CALLBACK_PORT}: ${error.message}`),
      );
    });
  });
}

async function _exchangeCodeForTokens(
  clientId: string,
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  const response = await fetch(X_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<TokenResponse>;
}

async function _fetchUserInfo(accessToken: string): Promise<UserMeResponse> {
  const response = await fetch('https://api.twitter.com/2/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch user info (${response.status}): ${body}`);
  }

  return response.json() as Promise<UserMeResponse>;
}

/**
 * Update specific keys in the .env file, preserving all other content.
 * Creates the file if it doesn't exist.
 *
 * @param updates - Key-value pairs to upsert into the .env file
 */
function _updateEnvFile(updates: Record<string, string>): void {
  const envPath = resolve(process.cwd(), '.env');
  let lines: string[] = [];

  if (existsSync(envPath)) {
    lines = readFileSync(envPath, 'utf-8').split('\n');
  }

  for (const [key, value] of Object.entries(updates)) {
    const lineIndex = lines.findIndex((line) => {
      const trimmed = line.trim();
      return trimmed.startsWith(`${key}=`) || trimmed === key;
    });

    if (lineIndex >= 0) {
      lines[lineIndex] = `${key}=${value}`;
    } else {
      lines.push(`${key}=${value}`);
    }
  }

  writeFileSync(envPath, lines.join('\n'), 'utf-8');
}

function _openBrowser(url: string): void {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${command} "${url}"`);
}
