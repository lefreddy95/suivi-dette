// Script d'inspection de la base Convex deployee (lecture seule).
// Usage : node scripts/inspect-db.mjs
import { ConvexHttpClient } from 'convex/browser';
import fs from 'node:fs';

const env = fs.readFileSync('.env', 'utf8');
const url = (env.match(/VITE_CONVEX_URL=(.+)/) || [])[1]?.trim();
if (!url) { console.error('VITE_CONVEX_URL introuvable dans .env'); process.exit(1); }
console.log('Convex URL :', url);

const client = new ConvexHttpClient(url);
const calls = [
  ['pizza:getConfig', { userEmail: 'lefreddy95@gmail.com' }],
  ['pizza:getSummary', { userEmail: 'lefreddy95@gmail.com' }],
  ['pizza:listPayments', { userEmail: 'lefreddy95@gmail.com' }],
  ['loans:listPeople', { userEmail: 'lefreddy95@gmail.com' }],
  ['loans:listTransactions', { userEmail: 'lefreddy95@gmail.com' }],
  ['loans:getDashboard', { userEmail: 'lefreddy95@gmail.com' }],
];

for (const [fn, args] of calls) {
  try {
    const res = await client.query(fn, args);
    console.log('\n=== ' + fn + ' ===');
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.log('\n=== ' + fn + ' ERREUR ===');
    console.log(String(e).slice(0, 800));
  }
}
