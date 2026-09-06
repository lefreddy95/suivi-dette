import React, { useState } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { SignIn } from '@clerk/clerk-react';
import {
  HandCoins, Banknote, Package, Wrench, ShieldCheck, Smartphone, Bell,
  TrendingUp, Users as UsersIcon, CheckCircle2, ChevronRight, X,
  Mail, Lock, LogIn,
} from 'lucide-react';

/**
 * LandingPage — Page d'accueil marketing de Suivi-dette.
 *
 * Affichée quand l'user n'est PAS authentifié. Propose :
 *  - Hero avec proposition de valeur
 *  - 4 features clés (argent, objets, services, multi-perspectives)
 *  - "Comment ça marche" en 3 étapes
 *  - CTA : bouton "Se connecter" qui ouvre le SignIn Clerk en modale
 *
 * Quand l'user est signé, on redirige automatiquement vers PizzaTruckPage
 * (géré par App.tsx).
 */
const LandingPage: React.FC = () => {
  const { isSignedIn } = useUser();
  const [showSignIn, setShowSignIn] = useState(false);

  // Si déjà signé, on n'affiche PAS la landing (App.tsx devrait avoir redirigé,
  // mais c'est un filet de sécurité).
  if (isSignedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-red-50">
      {/* === HEADER === */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-orange-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <h1 className="text-lg font-bold text-gray-900">Suivi-dette</h1>
          </div>
          <button
            onClick={() => setShowSignIn(true)}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-semibold text-sm flex items-center gap-1.5 shadow-md"
          >
            <LogIn className="w-4 h-4" />
            Se connecter
          </button>
        </div>
      </header>

      {/* === HERO === */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
        <div className="inline-block px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold mb-4">
          ✨ Tracker de prêts entre particuliers
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 mb-4 leading-tight">
          Ne perds plus le fil
          <br />
          de <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500">tes prêts</span>.
        </h1>
        <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Argent, objets ou services : suis chaque prêt en 30 secondes.
          Rappels automatiques, soldes en temps réel, zéro tracas.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => setShowSignIn(true)}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-bold text-lg shadow-lg flex items-center gap-2"
          >
            Commencer gratuitement
            <ChevronRight className="w-5 h-5" />
          </button>
          <a
            href="#features"
            className="px-6 py-3 text-gray-700 hover:text-gray-900 font-semibold"
          >
            Découvrir →
          </a>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Pas de carte bancaire. Connexion via Google ou email.
        </p>
      </section>

      {/* === FEATURES === */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-3">
          4 types de prêts, 1 seule app
        </h2>
        <p className="text-center text-gray-600 mb-10 max-w-xl mx-auto">
          Que ce soit du cash, une perceuse prêtée ou 3h de ménage,
          tout est tracé au même endroit.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FeatureCard
            icon={<HandCoins className="w-6 h-6" />}
            color="bg-green-100 text-green-600"
            title="Argent prêté"
            desc="Suis les remboursements partiels, marque les mensualités, clôture en un clic."
          />
          <FeatureCard
            icon={<Banknote className="w-6 h-6" />}
            color="bg-red-100 text-red-600"
            title="Argent emprunté"
            desc="Sois honnête avec toi-même : vois ce que tu dois et à qui."
          />
          <FeatureCard
            icon={<Package className="w-6 h-6" />}
            color="bg-amber-100 text-amber-600"
            title="Objets prêtés"
            desc="Perceuse, livre, tente... plus jamais d'objet égaré."
          />
          <FeatureCard
            icon={<Wrench className="w-6 h-6" />}
            color="bg-blue-100 text-blue-600"
            title="Services rendus"
            desc="Déménagement, cours, dépannage : convertis en heures ou en €."
          />
        </div>
      </section>

      {/* === COMMENT ÇA MARCHE === */}
      <section className="bg-white/60 backdrop-blur-sm py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-10">
            Comment ça marche
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Step
              num={1}
              title="Connecte-toi"
              desc="En 10 secondes avec Google ou ton email. Aucune carte bancaire demandée."
              icon={<LogIn className="w-5 h-5" />}
            />
            <Step
              num={2}
              title="Ajoute une personne"
              desc="Un nom suffit. Optionnel : email, téléphone, notes pour te rappeler qui c'est."
              icon={<UsersIcon className="w-5 h-5" />}
            />
            <Step
              num={3}
              title="Crée ta transaction"
              desc="Choisis le type (argent, objet, service), le montant, l'échéance. Terminé !"
              icon={<CheckCircle2 className="w-5 h-5" />}
            />
          </div>
        </div>
      </section>

      {/* === POURQUOI SUIVI-DETTE === */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-10">
          Conçu pour la vraie vie
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Benefit
            icon={<Smartphone className="w-6 h-6" />}
            title="Mobile-first"
            desc="Conçu pour ton téléphone. S'ajoute à ton écran d'accueil comme une vraie app."
          />
          <Benefit
            icon={<Bell className="w-6 h-6" />}
            title="Rappels intelligents"
            desc="Notifications avant chaque échéance. Plus jamais de prêt oublié."
          />
          <Benefit
            icon={<ShieldCheck className="w-6 h-6" />}
            title="Privé et sécurisé"
            desc="Tes données sont chiffrées. Tu es le seul à voir tes transactions."
          />
        </div>
      </section>

      {/* === CTA FINAL === */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
        <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-3xl shadow-2xl p-8 sm:p-12 text-white">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
            Prêt à reprendre le contrôle ?
          </h2>
          <p className="text-lg opacity-90 mb-6 max-w-md mx-auto">
            Rejoins Suivi-dette et arrête de compter de tête.
          </p>
          <button
            onClick={() => setShowSignIn(true)}
            className="px-8 py-4 bg-white hover:bg-gray-100 text-orange-600 rounded-xl font-bold text-lg shadow-lg inline-flex items-center gap-2"
          >
            Créer mon compte gratuit
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* === FOOTER === */}
      <footer className="bg-white/60 border-t border-orange-100 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center text-sm text-gray-600">
          <p>
            💰 <span className="font-semibold">Suivi-dette</span> — Tracker de prêts entre particuliers
          </p>
          <p className="text-xs text-gray-500 mt-1">
            © 2026 Suivi-dette · Fait avec ❤️ en France
          </p>
        </div>
      </footer>

      {/* === MODALE SIGN IN === */}
      {showSignIn && (
        <SignInModal onClose={() => setShowSignIn(false)} />
      )}
    </div>
  );
};

// === FEATURE CARD ===
const FeatureCard: React.FC<{
  icon: React.ReactNode;
  color: string;
  title: string;
  desc: string;
}> = ({ icon, color, title, desc }) => (
  <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow p-5 border border-gray-100">
    <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-3`}>
      {icon}
    </div>
    <h3 className="font-bold text-gray-900 mb-1.5">{title}</h3>
    <p className="text-sm text-gray-600">{desc}</p>
  </div>
);

// === STEP ===
const Step: React.FC<{
  num: number;
  title: string;
  desc: string;
  icon: React.ReactNode;
}> = ({ num, title, desc, icon }) => (
  <div className="text-center">
    <div className="relative inline-block mb-3">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white flex items-center justify-center text-2xl font-extrabold shadow-lg">
        {num}
      </div>
      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow text-orange-500">
        {icon}
      </div>
    </div>
    <h3 className="font-bold text-gray-900 mb-1.5">{title}</h3>
    <p className="text-sm text-gray-600">{desc}</p>
  </div>
);

// === BENEFIT ===
const Benefit: React.FC<{
  icon: React.ReactNode;
  title: string;
  desc: string;
}> = ({ icon, title, desc }) => (
  <div className="flex items-start gap-3">
    <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
      {icon}
    </div>
    <div>
      <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-600">{desc}</p>
    </div>
  </div>
);

// === MODALE SIGN IN (Clerk) ===
const SignInModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  // Bloque le scroll de la page derrière la modale
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full relative max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 hover:bg-gray-100 rounded-lg"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-none rounded-2xl',
            },
          }}
          signUpUrl={undefined}
          afterSignInUrl={window.location.origin}
          afterSignUpUrl={window.location.origin}
          routing="virtual"
        />
      </div>
    </div>
  );
};

export default LandingPage;
