import { loadConfig, saveConfig } from '../src/config/manager.js';

const config = loadConfig();
config.smtp!.secure = false;
saveConfig(config);
console.log('Set smtp.secure = false (STARTTLS on port 587)');
