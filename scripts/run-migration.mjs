// Lance la migration ONE-OFF : tables legacy pizza -> dette unique.
// Usage : node scripts/run-migration.mjs
import { ConvexHttpClient } from 'convex/browser';
import fs from 'node:fs';

const env = fs.readFileSync('.env', 'utf8');
const url = (env.match(/VITE_CONVEX_URL=(.+)/) || [])[1]?.trim();
const client = new ConvexHttpClient(url);

const res = await client.mutation('migrate:migrateLegacyPizzaToSingleDebt', {
  userEmail: 'lefreddy95@gmail.com',
});
console.log(JSON.stringify(res, null, 2));

const overview = await client.query('debt:getDebtOverview', {
  userEmail: 'lefreddy95@gmail.com',
});
console.log('\n--- APERCU DE LA DETTE ---');
console.log(JSON.stringify({
  summary: overview?.summary,
  debt: overview?.debt?.title,
  next: overview?.summary?.next,
  payments: overview?.payments,
  scheduleHead: overview?.schedule?.slice(0, 3),
  scheduleTail: overview?.schedule?.slice(-2),
}, null, 2));
