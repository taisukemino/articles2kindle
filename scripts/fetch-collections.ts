import { loadConfig } from '../src/config/manager.js';
import { FeedlyApiClient } from '../src/sources/feedly/api.js';

async function main() {
  const config = loadConfig();
  if (!config.feedly?.accessToken) {
    console.error('No Feedly access token configured.');
    process.exit(1);
  }
  const client = new FeedlyApiClient(config.feedly.accessToken);
  const collections = await client.getCollections();
  for (const c of collections) {
    console.log(`${c.id}  →  ${c.label}`);
  }
}

main();
