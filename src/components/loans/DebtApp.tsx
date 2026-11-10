import React, { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import {
  Settings as SettingsIcon, LogOut, Wrench, Truck, ShieldCheck,
} from 'lucide-react';
import DebtHomePage from './DebtHomePage';
import DebtSettingsPage from './DebtSettingsPage';

const ALLOWED_EMAILS = new Set([
  'lefreddy95@gmail.com',
  'franckylobry6@gmail.com',
]);

/**
 * DebtApp — Coquille de l'app Suivi-dette.
 *
 * L'app ne suit plus qu'UNE seule dette : le camion pizza acheté à crédit
 * par Freddy à Francky. Plus de liste de personnes, plus de tracker
 * multi-catégories : une seule page de suivi.
 *
 * Routing (state local + history.replaceState pour URLs bookmarkables) :
 *   /             -> Suivi de la dette
 *   /parametres   -> Parametres (admin)
 */
type DebtView = 'dette' | 'parametres';

const DebtApp: React.FC = () => {
  const { user, isLoaded } = useUser();
  const { signOut, openSignIn } = useClerk();
  const [bypassUser, setBypassUser] = useState<{ email: string } | null>(null);
  const [testCode, setTestCode] = useState('');
  const [currentView, setCurrentView] = useState<DebtView>(() => {
    const p = window.location.pathname;
    return p === '/parametres' || p === '/settings' ? 'parametres' : 'dette';
  });
  const [showBypassModal, setShowBypassModal] = useState(false);

  // Identite effective (Clerk ou bypass mode test 1234)
  const clerkUserEmail = user?.emailAddresses?.[0]?.emailAddress || null;
  const userEmail = bypassUser?.email || clerkUserEmail;
  const isLoadedEffective = bypassUser !== null ? true : isLoaded;
  const isSignedInEffective = !!userEmail;
  const isAllowed = userEmail && ALLOWED_EMAILS.has(userEmail);
  const isAdmin = userEmail === 'lefreddy95@gmail.com';

  // Sync URL <-> state
  useEffect(() => {
    const url = currentView === 'parametres' ? '/parametres' : '/';
    if (window.location.pathname !== url) {
      window.history.replaceState(null, '', url);
    }
  }, [currentView]);

  const handleSignOut = () => {
    if (bypassUser !== null) setBypassUser(null);
    else signOut({ redirectUrl: window.location.origin });
  };

  // === CHARGEMENT ===
  if (!isLoadedEffective) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-yellow-50 to-red-50">
        <div className="text-center">
          <div className="text-5xl mb-3">🚚</div>
          <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-gray-500 text-sm">Chargement…</p>
        </div>
      </div>
    );
  }

  // === ACCES REFUSÉ ===
  if (!isSignedInEffective) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Suivi-dette</h1>
          <p className="text-gray-600 mb-4">Connecte-toi pour suivre la dette du camion pizza.</p>
          <div className="space-y-2">
            <button
              onClick={() => openSignIn({})}
              className="block w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-semibold"
            >
              Se connecter
            </button>
            <button
              onClick={() => setShowBypassModal(true)}
              className="block w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm"
            >
              Mode test (dev)
            </button>
          </div>
        </div>
        {showBypassModal && (
          <BypassModal
            testCode={testCode}
            onChange={setTestCode}
            onSubmit={() => {
              if (testCode === '1234') {
                setBypassUser({ email: 'lefreddy95@gmail.com' });
                setShowBypassModal(false);
              } else {
                alert('Code incorrect');
              }
            }}
            onClose={() => setShowBypassModal(false)}
          />
        )}
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Accès refusé</h1>
          <p className="text-gray-600 text-sm mb-4">
            L'email <strong>{userEmail}</strong> n'est pas autorisé à accéder à cette dette.
          </p>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  // === RENDER PRINCIPAL ===
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-red-50">
      <header className="bg-white border-b-2 border-orange-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚚</span>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Suivi-dette</h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Camion pizza</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <button
                onClick={() => setCurrentView('parametres')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-1.5 ${
                  currentView === 'parametres' ? 'bg-orange-100 text-orange-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <SettingsIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Paramètres</span>
              </button>
            )}
            <button
              onClick={handleSignOut}
              className="ml-1 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {currentView === 'dette' && (
          <DebtHomePage userEmail={userEmail!} onOpenSettings={() => setCurrentView('parametres')} />
        )}
        {currentView === 'parametres' && (
          <DebtSettingsPage
            userEmail={userEmail!}
            isAdmin={isAdmin}
            onBack={() => setCurrentView('dette')}
            onSignOut={handleSignOut}
          />
        )}
      </main>
    </div>
  );
};

// === MODALE BYPASS (mode test 1234) ===
const BypassModal: React.FC<{
  testCode: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}> = ({ testCode, onChange, onSubmit, onClose }) => (
  <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start gap-3">
        <Wrench className="w-6 h-6 text-gray-500 flex-shrink-0" />
        <div className="flex-1">
          <h2 className="font-bold text-gray-900">Mode test (dev)</h2>
          <p className="text-sm text-gray-600 mb-3">⚠️ À SUPPRIMER avant la prod publique</p>
          <input
            type="password"
            value={testCode}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Code"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3"
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium">
              Annuler
            </button>
            <button onClick={onSubmit} className="flex-1 px-3 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-semibold">
              Valider
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default DebtApp;
