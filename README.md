# Suivi-dette

App de suivi de la dette du camion pizza : Freddy a acheté le camion à crédit à son frère Francky (30 000 €), a déjà versé 5 000 € en septembre et 500 € en octobre. L'app suit **cette seule dette** : reste a payer, prochaine echeance, echeancier complet, historique des versements et contrat signe par les deux parties.

**Stack** : Vite + React + TypeScript · Convex (backend + DB réactive) · Clerk (auth) · Tailwind CSS · PWA installable.

---

## 🎯 Fonctionnalités

### Une seule dette, un seul écran

- **Reste à payer** en gros, avec le total, le montant versé et le % remboursé
- **Prochaine échéance** en un coup d'œil (montant, date, n° d'échéance)
- Bouton **« J'ai payé cette échéance »** (prérempli) + versement libre
- **Échéancier complet** repliable (49 mensualités de 500 €)
- **Historique des versements** (montant, date, note, confirmation signée)
- **Contrat** : signatures des 2 parties, lien privé, invitation SMS/WhatsApp
- **Timeline** des événements (versements, signatures, invitations)

### Échéancier de remboursement

- Fréquence : hebdo / bi-mensuel / mensuel / trimestriel
- Calcul auto du nombre d'échéances (montant total ÷ montant d'échéance)
- Un acompte versé avant la 1re échéance reste hors échéancier (pas compté en double)
- Échéance en retard signalée automatiquement
- Plan modifiable depuis Paramètres (montant, date de départ, nombre d'échéances)

### Preuves & signatures (2 parties)

Chaque transaction peut être signée par les 2 parties (toi + contrepartie) :
- ✍️ **Signature canvas** (souris / doigt) avec hash SHA-256 pour intégrité
- 📄 **Contrat auto-généré** (5 articles : parties, objet, modalités, engagements, entrée en vigueur)
- 🌐 **Page publique `/transaction/:token`** — la contrepartie signe SANS créer de compte
- 📜 **Mention juridique** : conforme à l'article 1366 du Code civil (écrit électronique)

### Remboursements partiels

- Ajout de remboursement avec note optionnelle
- Barre de progression (% remboursé)
- Calcul auto du statut `termine` quand montant atteint
- 💡 Quick-fill "Tout" / "Moitié" dans la modale

### Envoi SMS & WhatsApp (réplique du pattern Pizza Truck)

- 🟢 **WhatsApp** : ouvre `wa.me/<phone>?text=<message>` pré-rempli
- 🔵 **SMS** : vrai SMS via worker Pushbullet → téléphone Android → MacroDroid
- ✏️ Numéro et message **éditables** dans la modale avant envoi
- 📅 **Timeline d'événements** : trace chaque envoi / signature / remboursement

### Perspective selon le lecteur

- Freddy (débiteur) : « Il te reste 24 500 € à payer à Francky »
- Francky (créancier) : « Freddy te doit 24 500 € »

### Mode multi-tenant (whitelist temporaire)

- `lefreddy95@gmail.com` = **super admin** (accès à toutes les vues, migration, debug)
- `franckylobry6@gmail.com` = utilisateur secondaire
- TODO : migrer vers Clerk JWT (multi-utilisateurs SaaS)

### PWA installable

- Manifest + icônes (€ sur gradient orange/rouge)
- Installable sur iOS et Android comme une vraie app
- Mode offline (cache des assets statiques)

---

## 🏗️ Architecture

```
src/
├── App.tsx                      # Routeur racine
├── main.tsx                     # Entry point (Clerk + Convex)
├── components/
│   ├── LandingPage.tsx          # Page marketing (non signe)
│   ├── ErrorBoundary.tsx        # Catch runtime errors
│   └── pizza/                   # Ancienne UI "Suivi Camion" (archivée)
└── components/loans/            # App mono-dette
    ├── DebtApp.tsx              # Coquille (auth, nav, routing)
    ├── DebtHomePage.tsx         # LA page : solde, échéance, échéancier, versements, contrat
    ├── DebtSettingsPage.tsx     # Paramètres (compte, plan de remboursement, sécurité)
    ├── RepaymentModal.tsx        # Enregistrer un versement (plein écran)
    ├── SignInviteModal.tsx      # Modale envoi SMS/WhatsApp
    ├── SignaturePad.tsx         # Canvas signature
    ├── ContractDocument.tsx     # Rendu contrat auto-généré
    ├── PublicTransactionPage.tsx # /transaction/:token (sans auth)
    ├── RepaymentSignPage.tsx    # /repayment/:signToken (sans auth)
    └── _legacy/                 # Anciennes pages du tracker générique (hors bundle)

convex/
├── schema.ts                    # 3 tables (people, transactions, reminders)
├── debt.ts                      # getDebtOverview : la dette unique en lecture
└── loans.ts                     # people, transactions, signatures, invitations, SMS
```

### Tables Convex (3)

| Table | Role | Cycle de vie |
|---|---|---|
| `people` | Contacts du user (multi-tenant par ownerEmail) — ici : Francky | Actif |
| `transactions` | La dette (type, montant, échéancier, remboursements, signatures, events) | Actif |
| `reminders` | Notifications à venir (rappels échéances) | Préparé, UI Phase 2 |

> Les tables legacy `pizzaConfig` / `pizzaPayments` / `pizzaAuditLog` ont été
> vidées puis retirées du schéma (les données ont été migrées vers
> `transactions`). Le code historique est archivé dans `legacy/convex/`.

```
/                          -> LandingPage (si non signe) ou DebtApp (si signe)
/parametres                -> DebtSettingsPage (admin)
/transaction/:token        -> PublicTransactionPage (sans auth, page partageable)
/repayment/:signToken      -> RepaymentSignPage (sans auth, confirmation de versement)
```

## 🚀 Setup local

### Pré-requis
- Node.js ≥ 18
- Compte Convex (https://dashboard.convex.dev)
- Compte Clerk (https://dashboard.clerk.com)
- (Optionnel) Worker Pushbullet pour les SMS

### Variables d'environnement

`.env.local` (ou dans Netlify pour la prod) :

```bash
# Convex
CONVEX_DEPLOY_KEY=...              # Pour `npx convex deploy` (Netlify prod)
VITE_CONVEX_URL=https://...convex.cloud
VITE_CONVEX_SITE_URL=https://suivi-dette.netlify.app

# Clerk
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Pushbullet (pour les SMS) — optionnel
PUSHBULLET_WORKER_URL=https://admin.ableiges.com
```

### Commandes

```bash
# Installer
npm install

# Dev (terminal 1 : Convex, terminal 2 : Vite)
npx convex dev              # Génère les types et déploie en dev
npm run dev                 # Vite + HMR

# Build prod
npm run build               # Vite build (sans Convex deploy)
npm run build:netlify       # Convex deploy + Vite build (utilisé par Netlify)

# Regénérer les icônes PWA
python scripts/generate-pwa-icons.py
```

---

## 📦 Déploiement

Hébergé sur **Netlify** : `https://suivi-dette.netlify.app`

- Auto-deploy sur push vers `main`
- Build command : `npm run build:netlify` (= Convex deploy + Vite build)
- Config : `netlify.toml` (redirects SPA, build command, env vars)
- Redirection `/*` → `/index.html` (SPA routing)

### Convex

- Projet : `different-opossum-825`
- Dashboard : https://dashboard.convex.dev/t/mr-l-e169b/suivi-dette/different-opossum-825
- Schema versionné (les changements obligatoires sur docs existants sont refusés)

---

## 🔐 Sécurité

| Mesure | État |
|---|---|
| Auth Clerk (Google / email + password) | ✅ Actif |
| Whitelist multi-tenant (`ALLOWED_USERS`) | ⚠️ Temporaire — à migrer vers Clerk JWT |
| `publicToken` (24 chars alphanumériques) | ✅ ~143 bits d'entropie |
| Hash SHA-256 des signatures canvas | ✅ Intégrité vérifiable |
| Audit log des actions (legacy pizza) | ✅ Actif |
| Mode test 1234 (bypass Clerk) | ⚠️ **À SUPPRIMER** avant prod publique |

---

```bash
# Vérifier que le build + le typecheck passent
npm run build
npx tsc --noEmit -p tsconfig.app.json

# Inspecter la base Convex déployée (lecture seule)
node scripts/inspect-db.mjs
```

Tests manuels :
1. Se connecter → l'écran affiche « 24 500 € » en reste à payer
2. Cliquer « J'ai payé cette échéance » → le solde baisse, le versement apparaît
3. Copier le lien de confirmation → l'ouvrir → signer (public, sans compte)
4. Vérifier que la 1re échéance est bien le 7 novembre 2026

---

## 📚 Roadmap

### Phase 1 — Kuidi MVP ✅ (commits 2655396 → 631774b)
- Schema, dashboard, people, transactions
- 6 types de transactions
- Échéancier de remboursement

### Phase 2 — Signatures & preuves ✅ (commits 016f75a → d834657)
- Canvas signature + hash SHA-256
- Page publique `/transaction/:token`
- Contrat auto-généré
- Envoi SMS/WhatsApp (worker Pushbullet)
- Timeline d'événements
- Migration dette camion pizza

### Phase 3 — Multi-tenant & SaaS (à venir)
- Migration Clerk JWT (suppression whitelist)
- Comptes multiples par user (vraie SaaS)
- Resend pour envoi email automatique (au lieu de Pushbullet)
- Landing page publique (déjà en place) avec pricing
- Stripe (free vs pro)
- Suppression du mode test 1234

### Phase 5 — App mono-dette ✅
- Migration des données legacy `pizzaConfig` / `pizzaPayments` → une transaction
- Nouvelle UI : `DebtApp` / `DebtHomePage` / `RepaymentModal` / `DebtSettingsPage`
- Pages du tracker générique archivées dans `src/components/loans/_legacy/`
- Tables legacy retirées du schéma Convex

### Phase 4 — UX avancée
- Rappels/notifs push (table `reminders` déjà prête)
- Photo rapide d'objet
- Recherche globale
- Mode sombre
- Export PDF des contrats signés

---

| Script | Usage |
|---|---|
| `scripts/generate-pwa-icons.py` | Régénère les 5 icônes PWA + favicon SVG |
| `scripts/inspect-db.mjs` | Lit la base Convex déployée (config legacy, people, transactions) |
| `scripts/inspect-new.mjs` | Lit seulement `people` / `transactions` / `getDashboard` |
| `scripts/check-deploy.mjs` | Vérifie que la query `debt:getDebtOverview` est déployée |
| `scripts/cleanup-legacy.mjs` | Vide les tables legacy (à lancer avant de les retirer du schéma) |

---

## 👤 Auteur

**Freddy** (`lefreddy95@gmail.com`) — super admin & créateur

Multi-comptes associés : Freddy, Francky, Mandy, Djema (chacun son Abby).

---

## 📄 Licence

Propriétaire — utilisation personnelle uniquement.
