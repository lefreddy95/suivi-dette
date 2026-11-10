// Inspection ciblée des nouvelles tables (people / transactions / dashboard).
import { ConvexHttpClient } from 'convex/browser';
import fs from 'node:fs';

const env = fs.readFileSync('.env', 'utf8');
const url = (env.match(/VITE_CONVEX_URL=(.+)/) || [])[1]?.trim();
const client = new ConvexHttpClient(url);
const EMAIL = 'lefreddy95@gmail.com';

for (const [fn, args] of [
  ['loans:listPeople', { userEmail: EMAIL }],
  ['loans:listTransactions', { userEmail: EMAIL }],
  ['loans:getDashboard', { userEmail: EMAIL }],
]) {
  try {
    const res = await client.query(fn, args);
    console.log('\n=== ' + fn + ' ===');
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.log('\n=== ' + fn + ' ERREUR ===');
    console.log(String(e).slice(0, 600));
  }
}
