import { loadConfig, saveConfig } from '../src/config/manager.js';

const config = loadConfig();
config.kindle!.emails = [
  'stereophonics0215_4U7GdO@kindle.com',
  'stereophonics0215_9Rvjam@kindle.com',
  'stereophonics0215_0WWoQU@kindle.com',
];
saveConfig(config);
console.log('Added 3 Kindle emails:', config.kindle!.emails.join(', '));
