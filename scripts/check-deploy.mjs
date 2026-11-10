// Verifie que le deploiement Convex contient la nouvelle query getDebtOverview.
// Usage : node scripts/check-deploy.mjs
import { ConvexHttpClient } from 'convex/browser';
import fs from 'node:fs';

const env = fs.readFileSync('.env', 'utf8');
const url = (env.match(/VITE_CONVEX_URL=(.+)/) || [])[1]?.trim();
const client = new ConvexHttpClient(url);

try {
  const res = await client.query('debt:getDebtOverview', { userEmail: 'lefreddy95@gmail.com' });
  console.log('DEPLOY OK — getDebtOverview disponible');
  console.log(JSON.stringify(res, null, 2).slice(0, 2500));
} catch (e) {
  console.log('DEPLOY PAS ENCORE EFFECTUÉ :');
  console.log(String(e).slice(0, 400));
}
