# 🍕 Suivi-Dette — App dédiée au suivi de paiement du camion pizza

App extraite de [lobry-sms-brocante](https://github.com/lefreddy95/lobry-sms-brocante) pour avoir une UI dédiée, légère, sans le reste de l'app SMS brocante.

**Fonction** : suivre le paiement du camion pizza acheté par Freddy (acheteur) à son frère Francky (vendeur), 30 000 € au total, versé en mensualités de 500 € (modifiable).

## Stack

- **Vite** + **React** + **TypeScript**
- **Convex** (même projet que `lobry-sms-brocante` pour partager les données)
- **Clerk** (même instance Clerk, 2 users autorisés : Freddy + Francky)
- **Lucide React** (icônes)
- **Framer Motion** (animations camion pizza)
- **Tailwind CSS** (styles)

## Setup local

```bash
npm install

# 1. Link Convex to the shared project (interactive, ask for "use existing project" → affable-cod-552)
npx convex dev

# 2. Fill in .env with your Clerk publishable key
cp .env.example .env
# Edit .env and set VITE_CLERK_PUBLISHABLE_KEY

# 3. Run dev
npm run dev
```

## Build & deploy

```bash
# Local build
npm run build

# Deploy Convex + Vite to Netlify (CI/CD via build:netlify)
git push origin main  # Netlify auto-deploys
```

## Variables d'env Netlify

| Variable | Valeur |
|---|---|
| `VITE_CONVEX_URL` | `https://affable-cod-552.eu-west-1.convex.cloud` |
| `VITE_CLERK_PUBLISHABLE_KEY` | (même clé que lobry-sms-brocante) |
| `CONVEX_DEPLOY_KEY` | (clé prod, même projet Convex) |

## Routes

| URL | Description |
|---|---|
| `/` | Page unique : `PizzaTruckPage` (calendrier + signatures) |
| `/?sign=PAYMENT_ID` | Deep link pour signer un paiement (envoyé par WhatsApp) |

## Whitelist

Seuls 2 emails ont accès (vérifié côté Convex dans `pizza.ts`) :
- `lefreddy95@gmail.com` (acheteur, Freddy)
- `franckylobry6@gmail.com` (vendeur, Francky)

Tout autre email → page "Accès refusé".
