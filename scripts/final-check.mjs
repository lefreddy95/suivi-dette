// Verifie l'etat final du deploiement Convex + du site Netlify.
// Usage : node scripts/final-check.mjs
import { ConvexHttpClient } from 'convex/browser';
import fs from 'node:fs';

const env = fs.readFileSync('.env', 'utf8');
const url = (env.match(/VITE_CONVEX_URL=(.+)/) || [])[1]?.trim();
const client = new ConvexHttpClient(url);

// 1. La dette unique
const overview = await client.query('debt:getDebtOverview', {
  userEmail: 'lefreddy95@gmail.com',
});
console.log('DETTE :', overview?.debt?.title);
console.log('  total      :', overview?.summary?.total, 'EUR');
console.log('  deja verse :', overview?.summary?.paid, 'EUR');
console.log('  reste      :', overview?.summary?.remaining, 'EUR');
console.log('  mensualite :', overview?.summary?.monthly, 'EUR x', overview?.summary?.installmentsTotal);
console.log('  prochaine  :', new Date(overview?.summary?.next?.date).toLocaleDateString('fr-FR'));
console.log('  fin prevue :', new Date(overview?.summary?.endDate).toLocaleDateString('fr-FR'));
console.log('  versements :', overview?.payments?.length, '| signatures :', overview?.debt?.signatures?.length);

// 2. Les tables legacy doivent avoir disparu
try {
  await client.query('pizza:getConfig', { userEmail: 'lefreddy95@gmail.com' });
  console.log('\nLEGACY : encore deploye (normal si le deploy n\'est pas passe)');
} catch (e) {
  console.log('\nLEGACY : functions pizza retirees (', String(e).slice(0, 90), ')');
}

// 3. Le site Netlify
const site = 'https://suivi-dette.netlify.app';
try {
  const res = await fetch(site);
  const html = await res.text();
  console.log('SITE :', res.status, '| titre :', (html.match(/<title>(.*?)<\/title>/) || [])[1]);
} catch (e) {
  console.log('SITE : erreur', String(e).slice(0, 120));
}
