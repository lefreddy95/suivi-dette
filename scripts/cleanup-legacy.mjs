// Vide les tables legacy (pizzaConfig / pizzaPayments / pizzaAuditLog).
// A lancer AVANT de retirer ces tables du schema (Convex refuse sinon).
// Usage : node scripts/cleanup-legacy.mjs
import { ConvexHttpClient } from 'convex/browser';
import fs from 'node:fs';

const env = fs.readFileSync('.env', 'utf8');
const url = (env.match(/VITE_CONVEX_URL=(.+)/) || [])[1]?.trim();
const client = new ConvexHttpClient(url);

const res = await client.mutation('loans:cleanupLegacyPizza', {
  userEmail: 'lefreddy95@gmail.com',
});
console.log(JSON.stringify(res, null, 2));

// Verification : la dette unique doit toujours etre la
const overview = await client.query('debt:getDebtOverview', {
  userEmail: 'lefreddy95@gmail.com',
});
console.log('\nDette unique :', overview?.debt?.title);
console.log('Reste a payer :', overview?.summary?.remaining, 'EUR');
console.log('Deja verse    :', overview?.summary?.paid, 'EUR');
