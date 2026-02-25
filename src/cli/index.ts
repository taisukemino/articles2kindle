import { Command } from 'commander';
import { createFetchCommand } from './commands/fetch.js';
import { createListCommand } from './commands/list.js';
import { createBundleCommand } from './commands/bundle.js';
import { createSendCommand } from './commands/send.js';
import { createXCommand } from './commands/x.js';

/**
 * Creates the root CLI program with all subcommands registered.
 *
 * @returns The configured Commander program instance
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('articles2kindle')
    .description('Fetch articles from read-later services, bundle into EPUBs, and send to Kindle')
    .version('1.0.0');

  program.addCommand(createFetchCommand());
  program.addCommand(createListCommand());
  program.addCommand(createBundleCommand());
  program.addCommand(createSendCommand());
  program.addCommand(createXCommand());

  return program;
}
