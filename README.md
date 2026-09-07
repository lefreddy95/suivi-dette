# Suivi-dette

App de suivi de prêts entre particuliers. Suivez chaque prêt d'argent, d'objet ou de service en quelques secondes, avec preuves de signature, échéancier de remboursement et rappels.

**Stack** : Vite + React + TypeScript · Convex (backend + DB réactive) · Clerk (auth) · Tailwind CSS · PWA installable.

---

## 🎯 Fonctionnalités

### Suivi multi-catégorie (6 types de transactions)

- 💰 **Argent prêté** — tu prêtes, on te doit
- 💸 **Argent emprunté** — tu empruntes, tu dois
- 📦 **Objet prêté** — perceuse, livre, tente...
- 📥 **Objet emprunté** — à rendre
- 🔧 **Service rendu** — déménagement, cours, dépannage
- 🙋 **Service reçu** — on t'a rendu un service

### Échéancier de remboursement (money_)

- Fréquence : hebdo / bi-mensuel / mensuel / trimestriel
- Calcul auto du nombre d'échéances (montant total ÷ montant / échéance)
- Aperçu live des 3 prochaines échéances
- Badge "prochaine échéance" dans la fiche personne
- 🎉 Alerte "Échéancier terminé" quand tout est remboursé

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

### Dashboard & insights

- Hero card "À l'équilibre / On te doit / Tu dois"
- 4 stats rapides (items prêtés, services, en cours, remboursé)
- Prochaines échéances (30 jours)
- Activité récente
- **Intégration dette camion pizza** (legacy) en carte ambre

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
├── App.tsx                      # Routeur racine (3 routes)
├── main.tsx                     # Entry point (Clerk + Convex)
├── components/
│   ├── LandingPage.tsx          # Page marketing (non signé)
│   ├── ErrorBoundary.tsx        # Catch runtime errors
│   └── pizza/                   # Module legacy "Suivi Camion"
│       ├── PizzaTruckPage.tsx   # Page principale (camion)
│       ├── ContractPage.tsx     # Contrat signable
│       ├── SettingsPage.tsx     # Paramètres (admin)
│       ├── PizzaTruckAnimation.tsx
│       └── pizza-animations.css
└── components/loans/            # Module "Suivi-dette" (Kuidi)
    ├── DashboardPage.tsx        # Home / stats
    ├── PeoplePage.tsx           # Liste des personnes
    ├── PersonDetailPage.tsx     # Fiche personne + transactions + timeline
    ├── TransactionsPage.tsx     # Liste globale transactions + filtres
    ├── TransactionFormModal.tsx # Modale création (6 types + échéancier)
    ├── SignInviteModal.tsx      # Modale envoi SMS/WhatsApp
    ├── SignaturePad.tsx         # Canvas signature
    ├── ContractDocument.tsx     # Rendu contrat auto-généré
    └── PublicTransactionPage.tsx # /transaction/:token (sans auth)

convex/
├── schema.ts                    # 7 tables (pizzaConfig, pizzaPayments, pizzaAuditLog, people, transactions, reminders, ...)
├── pizza.ts                     # Backend legacy (camion)
└── loans.ts                     # Backend Kuidi (people, transactions, public, sendInvite, logEvent)
```

### Tables Convex (7)

| Table | Rôle | Cycle de vie |
|---|---|---|
| `pizzaConfig` | Config singleton (prix, mensualité, dates, signatures contrat) | Actif (legacy) |
| `pizzaPayments` | 60 mensualités du camion + ponctuel | Actif (legacy) |
| `pizzaAuditLog` | Traçabilité juridique de chaque action | Actif (legacy) |
| `people` | Contacts du user (multi-tenant par ownerEmail) | Actif |
| `transactions` | Toutes les transactions (6 types + échéancier + signatures + events) | Actif |
| `reminders` | Notifications à venir (rappels échéances) | Préparé, UI Phase 2 |

### Routing (`App.tsx`)

```
/                          → LandingPage (si non signé) ou PizzaTruckPage (si signé)
/transaction/:token        → PublicTransactionPage (sans auth, page partageable)
```

---

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

## 🧪 Tests manuels

```bash
# Vérifier que le build passe
npm run build

# Tester une migration DB
# Aller dans Paramètres → Section "Migration Kuidi" → Cliquer "Migrer la transaction camion"
```

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

### Phase 4 — UX avancée
- Rappels/notifs push (table `reminders` déjà prête)
- Photo rapide d'objet
- Recherche globale
- Mode sombre
- Export PDF des contrats signés

---

## 🧰 Scripts

| Script | Usage |
|---|---|
| `scripts/generate-pwa-icons.py` | Regénère les 5 icônes PWA + favicon SVG (design : € sur gradient) |

---

## 👤 Auteur

**Freddy** (`lefreddy95@gmail.com`) — super admin & créateur

Multi-comptes associés : Freddy, Francky, Mandy, Djema (chacun son Abby).

---

## 📄 Licence

Propriétaire — utilisation personnelle uniquement.
