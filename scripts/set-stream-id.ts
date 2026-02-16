import { loadConfig, saveConfig } from '../src/config/manager.js';

const config = loadConfig();
config.feedly!.streamId = 'user/952ae1c8-ec98-46dc-81c6-ac71d8d64a4c/tag/global.saved';
saveConfig(config);
console.log('Stream ID set to: ' + config.feedly!.streamId);
