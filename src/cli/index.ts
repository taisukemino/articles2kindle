import { Command } from 'commander';
import { createConfigCommand } from './commands/config.js';
import { createFetchCommand } from './commands/fetch.js';
import { createListCommand } from './commands/list.js';
import { createBundleCommand } from './commands/bundle.js';
import { createSendCommand } from './commands/send.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('articles2kindle')
    .description('Fetch articles from read-later services, bundle into EPUBs, and send to Kindle')
    .version('1.0.0');

  program.addCommand(createConfigCommand());
  program.addCommand(createFetchCommand());
  program.addCommand(createListCommand());
  program.addCommand(createBundleCommand());
  program.addCommand(createSendCommand());

  return program;
}
