// Petite correction du titre de la dette (capitalisation).
import { ConvexHttpClient } from 'convex/browser';
import fs from 'node:fs';

const env = fs.readFileSync('.env', 'utf8');
const url = (env.match(/VITE_CONVEX_URL=(.+)/) || [])[1]?.trim();
const client = new ConvexHttpClient(url);
const EMAIL = 'lefreddy95@gmail.com';

const overview = await client.query('debt:getDebtOverview', { userEmail: EMAIL });
const id = overview.debt._id;
console.log('titre actuel :', overview.debt.title);

const res = await client.mutation('loans:updateTransaction', {
  userEmail: EMAIL,
  transactionId: id,
  title: 'Camion pizza - achat à crédit',
});
console.log('maj ->', JSON.stringify(res));

const after = await client.query('debt:getDebtOverview', { userEmail: EMAIL });
console.log('titre final  :', after.debt.title);
console.log('reste        :', after.summary.remaining, 'EUR');
console.log('versements   :', after.payments.map((p) => `${p.amount} EUR - ${p.note}`).join(' | '));
