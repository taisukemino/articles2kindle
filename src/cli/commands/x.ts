import { Command } from 'commander';
import { printSuccess, printInfo, printError } from '../output.js';
import { runOAuthPkceFlow } from '../../sources/x/oauth.js';

/**
 * Creates the CLI command for X/Twitter bookmarks configuration and authentication.
 *
 * @returns The configured Commander command for X integration
 */
export function createXCommand(): Command {
  const xCmd = new Command('x').description('X/Twitter bookmarks configuration');

  xCmd
    .command('auth')
    .description('Authenticate with X via OAuth 2.0 (opens browser)')
    .action(async () => {
      const clientId = process.env['X_CLIENT_ID'];
      if (!clientId) {
        printError(
          'X_CLIENT_ID is not set. Add your Client ID from the X Developer Portal to your .env file.',
        );
        printInfo('  1. Go to https://developer.x.com/en/portal/dashboard');
        printInfo('  2. Select your app → Keys and tokens');
        printInfo(
          '  3. Copy "Client Secret ID" and add to .env: X_CLIENT_ID=your-client-secret-id',
        );
        process.exitCode = 1;
        return;
      }

      printInfo('Opening browser for X authorization...');
      printInfo('Waiting for callback on http://localhost:8739/callback');

      try {
        const { userId, username } = await runOAuthPkceFlow(clientId);
        printSuccess(`Authenticated as @${username} (user ID: ${userId})`);
        printSuccess('Tokens saved to .env. You can now run: articles2kindle fetch --source x');
      } catch (error) {
        printError(
          `Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        process.exitCode = 1;
      }
    });

  return xCmd;
}
