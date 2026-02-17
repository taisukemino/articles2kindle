import { Command } from 'commander';
import { createInterface, type Interface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { loadConfig, saveConfig, maskSecrets } from '../../config/manager.js';
import { getConfigPath } from '../../config/paths.js';
import { printSuccess, printInfo } from '../output.js';
import type {
  AppConfig,
  FeedlyConfig,
  SmtpConfig,
  KindleConfig,
  SubstackConfig,
  SubstackPublication,
} from '../../config/schema.js';

async function promptFeedlyConfig(
  prompt: Interface,
  existing: Partial<AppConfig>,
): Promise<FeedlyConfig | undefined> {
  const wantFeedly = await prompt.question(
    `Configure Feedly?${existing.feedly ? ' (currently configured)' : ''} (y/N): `,
  );
  if (wantFeedly.toLowerCase() !== 'y') {
    return existing.feedly;
  }

  const accessToken = await prompt.question(
    `Feedly access token${existing.feedly?.accessToken ? ' (press Enter to keep current)' : ''}: `,
  );
  const streamId = await prompt.question(
    `Feedly stream ID (e.g., user/UUID/category/global.all)${existing.feedly?.streamId ? ' (press Enter to keep current)' : ''}: `,
  );
  return {
    accessToken: accessToken || existing.feedly?.accessToken || '',
    streamId: streamId || existing.feedly?.streamId || '',
  };
}

async function promptSubstackConfig(
  prompt: Interface,
  existing: Partial<AppConfig>,
): Promise<SubstackConfig | undefined> {
  const existingUrls = existing.substack?.publications
    ?.map((publication) => publication.url)
    .join(', ');
  const wantSubstack = await prompt.question(
    `Configure Substack?${existingUrls ? ` (currently: ${existingUrls})` : ''} (y/N): `,
  );
  if (wantSubstack.toLowerCase() !== 'y') {
    return existing.substack;
  }

  const urlsInput = await prompt.question(
    `Publication URLs (comma-separated, e.g., https://example.substack.com)${existingUrls ? `\n  Current: ${existingUrls}\n  Press Enter to keep, or enter new URLs` : ''}: `,
  );

  let publications: SubstackPublication[];
  if (urlsInput.trim()) {
    publications = urlsInput
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean)
      .map((url) => ({ url }));
  } else {
    publications = [...(existing.substack?.publications ?? [])];
  }

  if (publications.length === 0) {
    printInfo('No publications configured for Substack.');
    return undefined;
  }

  printInfo(
    'Set the SUBSTACK_CONNECT_SID environment variable with your connect.sid cookie for paywalled content.',
  );
  printInfo('Get it from: browser DevTools → Application → Cookies → connect.sid');

  return { publications };
}

async function promptSmtpConfig(
  prompt: Interface,
  existing: Partial<AppConfig>,
): Promise<SmtpConfig> {
  const host = await prompt.question(
    `SMTP host${existing.smtp?.host ? ` [${existing.smtp.host}]` : ''}: `,
  );
  const port = await prompt.question(
    `SMTP port${existing.smtp?.port ? ` [${existing.smtp.port}]` : ' [587]'}: `,
  );
  const secure = await prompt.question(
    `SMTP secure (true/false)${existing.smtp?.secure !== undefined ? ` [${existing.smtp.secure}]` : ' [true]'}: `,
  );
  const user = await prompt.question(
    `SMTP username${existing.smtp?.user ? ` [${existing.smtp.user}]` : ''}: `,
  );
  const pass = await prompt.question(
    `SMTP password${existing.smtp?.pass ? ' (press Enter to keep current)' : ''}: `,
  );
  return {
    host: host || existing.smtp?.host || '',
    port: parseInt(port || String(existing.smtp?.port ?? 587), 10),
    secure: secure ? secure === 'true' : (existing.smtp?.secure ?? true),
    user: user || existing.smtp?.user || '',
    pass: pass || existing.smtp?.pass || '',
  };
}

async function promptKindleConfig(
  prompt: Interface,
  existing: Partial<AppConfig>,
): Promise<KindleConfig> {
  const email = await prompt.question(
    `Kindle email (@kindle.com)${existing.kindle?.email ? ` [${existing.kindle.email}]` : ''}: `,
  );
  const senderEmail = await prompt.question(
    `Sender email (must be approved in Amazon)${existing.kindle?.senderEmail ? ` [${existing.kindle.senderEmail}]` : ''}: `,
  );
  return {
    email: email || existing.kindle?.email || '',
    senderEmail: senderEmail || existing.kindle?.senderEmail || '',
  };
}

export function createConfigCommand(): Command {
  const configCmd = new Command('config').description('Manage configuration');

  configCmd
    .command('init')
    .description('Interactive setup wizard')
    .action(async () => {
      const readlineInterface = createInterface({ input: stdin, output: stdout });

      try {
        const existing = loadConfig();
        printInfo('articles2kindle configuration wizard\n');

        const feedly = await promptFeedlyConfig(readlineInterface, existing);
        const substack = await promptSubstackConfig(readlineInterface, existing);
        const smtp = await promptSmtpConfig(readlineInterface, existing);
        const kindle = await promptKindleConfig(readlineInterface, existing);

        const config: Partial<AppConfig> = {
          ...(feedly ? { feedly } : {}),
          ...(substack ? { substack } : {}),
          smtp,
          kindle,
        };
        saveConfig(config);
        printSuccess(`Config saved to ${getConfigPath()}`);
      } finally {
        readlineInterface.close();
      }
    });

  configCmd
    .command('show')
    .description('Display current configuration (secrets masked)')
    .action(() => {
      const config = loadConfig();
      if (Object.keys(config).length === 0) {
        printInfo('No configuration found. Run "articles2kindle config init" to set up.');
        return;
      }
      const masked = maskSecrets(config);
      console.log(JSON.stringify(masked, null, 2));
    });

  return configCmd;
}
