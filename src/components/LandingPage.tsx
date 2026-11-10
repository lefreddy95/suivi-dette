import React, { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { SignIn } from '@clerk/clerk-react';
import {
  Wallet, Calendar, ShieldCheck, Smartphone, CheckCircle2, ChevronRight, X,
  LogIn,
} from 'lucide-react';

/**
 * LandingPage — Page d'accueil de Suivi-dette.
 *
 * Affichée quand l'user n'est PAS authentifié. Propose :
 *  - Hero centré sur la dette (camion pizza)
 *  - 4 points clés (solde, échéances, versements signés, contrat privé)
 *  - "Comment ça marche" en 3 étapes
 *  - CTA : bouton "Se connecter" qui ouvre le SignIn Clerk en modale
 *
 * Quand l'user est signé, App.tsx affiche l'app de suivi de la dette.
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
            <span className="text-2xl">🚚</span>
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
          🚚 Le suivi de la dette du camion pizza
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 mb-4 leading-tight">
          Le chemin de la dette,
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500">échéance après échéance</span>.
        </h1>
        <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Un achat à crédit, un plan de remboursement clair, et chaque versement
          confirmé d'un clic par les deux parties.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => setShowSignIn(true)}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-bold text-lg shadow-lg flex items-center gap-2"
          >
            Suivre ma dette
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
          Tout tient sur un seul écran
        </h2>
        <p className="text-center text-gray-600 mb-10 max-w-xl mx-auto">
          Pas d'onglets à fouiller, pas de tableur : le reste à payer, la prochaine
          échéance et l'historique sont toujours visibles.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FeatureCard
            icon={<Wallet className="w-6 h-6" />}
            color="bg-red-100 text-red-600"
            title="Le solde en un coup d'œil"
            desc="Le reste à payer, le total et le pourcentage remboursé, calculés en direct."
          />
          <FeatureCard
            icon={<Calendar className="w-6 h-6" />}
            color="bg-orange-100 text-orange-600"
            title="Les échéances"
            desc="Mensualité, date de la prochaine, fin prévue : le plan est limpide."
          />
          <FeatureCard
            icon={<CheckCircle2 className="w-6 h-6" />}
            color="bg-green-100 text-green-600"
            title="Des versements signés"
            desc="Chaque versement est confirmé par la signature de la contrepartie."
          />
          <FeatureCard
            icon={<ShieldCheck className="w-6 h-6" />}
            color="bg-purple-100 text-purple-600"
            title="Un contrat privé"
            desc="Le contrat est généré et signé par les deux parties, via un lien privé."
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
              title="L'échéancier est déjà prêt"
              desc="30 000 €, 500 € par mois, et le détail de ce qui a déjà été versé."
              icon={<Calendar className="w-5 h-5" />}
            />
            <Step
              num={3}
              title="Tu valides les versements"
              desc="Un clic quand tu paies, un lien de confirmation envoyé à l'autre partie."
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
            icon={<CheckCircle2 className="w-6 h-6" />}
            title="Chaque versement horodaté"
            desc="Montant, date, note : l'historique se construit tout seul, sans effort."
          />
          <Benefit
            icon={<ShieldCheck className="w-6 h-6" />}
            title="Privé et sécurisé"
            desc="Seuls Freddy et Francky voient la dette. Les liens de signature sont privés."
          />
        </div>
      </section>

      {/* === CTA FINAL === */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
        <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-3xl shadow-2xl p-8 sm:p-12 text-white">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
            Prêt à tout avoir en clair ?
          </h2>
          <p className="text-lg opacity-90 mb-6 max-w-md mx-auto">
            Connecte-toi et arrête de compter de tête.
          </p>
          <button
            onClick={() => setShowSignIn(true)}
            className="px-8 py-4 bg-white hover:bg-gray-100 text-orange-600 rounded-xl font-bold text-lg shadow-lg inline-flex items-center gap-2"
          >
            Ouvrir mon suivi de dette
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* === FOOTER === */}
      <footer className="bg-white/60 border-t border-orange-100 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center text-sm text-gray-600">
          <p>
            🚚 <span className="font-semibold">Suivi-dette</span> — Le suivi de la dette, simplement
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
