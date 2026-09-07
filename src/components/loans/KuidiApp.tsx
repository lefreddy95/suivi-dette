import React, { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import {
  Home, Users as UsersIcon, ArrowLeftRight, Settings as SettingsIcon,
  LogOut, X, Smartphone, Bell, ShieldCheck, User, ChevronRight,
  HelpCircle, Wrench, AlertTriangle,
} from 'lucide-react';
import DashboardPage from './DashboardPage';
import PeoplePage from './PeoplePage';
import PersonDetailPage from './PersonDetailPage';
import TransactionsPage from './TransactionsPage';
import TransactionDetailPage from './TransactionDetailPage';
import KuidiSettingsPage from './KuidiSettingsPage';

const ALLOWED_EMAILS = new Set([
  'lefreddy95@gmail.com',
  'franckylobry6@gmail.com',
]);

/**
 * KuidiApp — Application principale (tracker de prets multi-categorie).
 *
 * SUCCEDE a PizzaTruckPage (qui contenait la dette legacy du camion pizza).
 * Cette version est PROPRE : pas de code legacy, pas de tables pizza.
 *
 * Routing (state local + history.replaceState pour URLs bookmarkables) :
 *   /                    -> Dashboard
 *   /transactions        -> Liste globale transactions
 *   /people              -> Liste personnes
 *   /person/:id          -> Fiche personne
 *   /tx/:id              -> Page dediee transaction (owner-only)
 *   /parametres          -> Parametres
 */
type KuidiView = 'kuidi' | 'kuidi-people' | 'kuidi-person-detail' | 'kuidi-transactions' | 'kuidi-transaction' | 'parametres';

const KuidiApp: React.FC = () => {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [bypassUser, setBypassUser] = useState<{ email: string } | null>(null);
  const [testCode, setTestCode] = useState('');
  const [currentView, setCurrentView] = useState<KuidiView>(() => {
    const p = window.location.pathname;
    if (p === '/transactions') return 'kuidi-transactions';
    if (p === '/people' || p === '/personnes') return 'kuidi-people';
    if (p === '/parametres' || p === '/settings') return 'parametres';
    if (/^\/person\//.test(p)) return 'kuidi-person-detail';
    if (/^\/tx\//.test(p)) return 'kuidi-transaction';
    return 'kuidi';
  });
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(() => {
    const m = window.location.pathname.match(/^\/person\/([A-Za-z0-9_-]+)\/?$/);
    return m ? m[1] : null;
  });
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(() => {
    const m = window.location.pathname.match(/^\/tx\/([A-Za-z0-9_-]+)\/?$/);
    return m ? m[1] : null;
  });
  const [transactionFilterPersonId, setTransactionFilterPersonId] = useState<string | null>(null);
  const [autoCreateTransaction, setAutoCreateTransaction] = useState(false);
  const [showBypassModal, setShowBypassModal] = useState(false);

  // Identite effective (Clerk ou bypass mode test 1234)
  const clerkUserEmail = user?.emailAddresses?.[0]?.emailAddress || null;
  const userEmail = bypassUser?.email || clerkUserEmail;
  const isLoadedEffective = bypassUser !== null ? true : isLoaded;
  const isSignedInEffective = !!userEmail;
  const isAllowed = userEmail && ALLOWED_EMAILS.has(userEmail);
  const isAcheteur = userEmail === 'lefreddy95@gmail.com';
  const showAdminActions = isAcheteur;

  // Sync URL <-> state
  useEffect(() => {
    let url = '/';
    if (currentView === 'kuidi-transactions') url = '/transactions';
    else if (currentView === 'kuidi-people') url = '/people';
    else if (currentView === 'kuidi-person-detail' && selectedPersonId) url = `/person/${selectedPersonId}`;
    else if (currentView === 'kuidi-transaction' && selectedTransactionId) url = `/tx/${selectedTransactionId}`;
    else if (currentView === 'parametres') url = '/parametres';
    if (window.location.pathname !== url) {
      window.history.replaceState(null, '', url);
    }
  }, [currentView, selectedPersonId, selectedTransactionId]);

  const handleSignOut = () => {
    if (bypassUser !== null) setBypassUser(null);
    else signOut({ redirectUrl: window.location.origin });
  };

  // === CHARGEMENT ===
  if (!isLoadedEffective) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-yellow-50 to-red-50">
        <div className="text-center">
          <div className="text-5xl mb-3">💰</div>
          <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-gray-500 text-sm">Chargement…</p>
        </div>
      </div>
    );
  }

  // === ACCÈS REFUSÉ ===
  if (!isSignedInEffective) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <AlertTriangle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Suivi-dette</h1>
          <p className="text-gray-600 mb-4">Connecte-toi pour acceder a ton suivi de prets.</p>
          <div className="space-y-2">
            <a
              href="/"
              className="block w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-semibold"
            >
              Se connecter
            </a>
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
          <h1 className="text-xl font-bold text-gray-900 mb-2">Acces refuse</h1>
          <p className="text-gray-600 text-sm mb-4">
            L'email <strong>{userEmail}</strong> n'est pas autorise a acceder a cette app.
          </p>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
          >
            Se deconnecter
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
            <span className="text-2xl">💰</span>
            <h1 className="text-lg font-bold text-gray-900">Suivi-dette</h1>
          </div>
          <div className="flex items-center gap-1">
            <NavButton active={currentView === 'kuidi'} onClick={() => setCurrentView('kuidi')} icon={<Home className="w-3.5 h-3.5" />}>
              Dashboard
            </NavButton>
            <NavButton
              active={currentView === 'kuidi-people' || currentView === 'kuidi-person-detail'}
              onClick={() => { setCurrentView('kuidi-people'); setSelectedPersonId(null); }}
              icon={<UsersIcon className="w-3.5 h-3.5" />}
            >
              Personnes
            </NavButton>
            <NavButton
              active={currentView === 'kuidi-transactions'}
              onClick={() => { setCurrentView('kuidi-transactions'); setTransactionFilterPersonId(null); setAutoCreateTransaction(false); }}
              icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
            >
              Transactions
            </NavButton>
            {showAdminActions && (
              <NavButton
                active={currentView === 'parametres'}
                onClick={() => setCurrentView('parametres')}
                icon={<SettingsIcon className="w-3.5 h-3.5" />}
              >
                Parametres
              </NavButton>
            )}
            <button
              onClick={handleSignOut}
              className="ml-1 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
              title="Se deconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {currentView === 'kuidi' && (
          <DashboardPage
            userEmail={userEmail!}
            onSelectPerson={(id) => { setSelectedPersonId(id); setCurrentView('kuidi-person-detail'); }}
            onSelectTransaction={(id) => { setTransactionFilterPersonId(null); setAutoCreateTransaction(false); setCurrentView('kuidi-transactions'); }}
            onNewTransaction={() => { setTransactionFilterPersonId(null); setAutoCreateTransaction(true); setCurrentView('kuidi-transactions'); }}
            onViewAllTransactions={() => { setTransactionFilterPersonId(null); setAutoCreateTransaction(false); setCurrentView('kuidi-transactions'); }}
            onSelectTransactionPage={(id) => { setSelectedTransactionId(id); setCurrentView('kuidi-transaction'); }}
            onViewPeople={() => { setCurrentView('kuidi-people'); setSelectedPersonId(null); }}
          />
        )}
        {currentView === 'kuidi-people' && (
          <PeoplePage
            userEmail={userEmail!}
            onSelectPerson={(id) => { setSelectedPersonId(id); setCurrentView('kuidi-person-detail'); }}
          />
        )}
        {currentView === 'kuidi-person-detail' && selectedPersonId && (
          <PersonDetailPage
            userEmail={userEmail!}
            personId={selectedPersonId}
            onBack={() => setCurrentView('kuidi-people')}
            onSelectTransaction={(id) => { setSelectedTransactionId(id); setCurrentView('kuidi-transaction'); }}
          />
        )}
        {currentView === 'kuidi-transaction' && selectedTransactionId && (
          <TransactionDetailPage
            userEmail={userEmail!}
            transactionId={selectedTransactionId}
            onBack={() => setCurrentView('kuidi-transactions')}
            onSelectPerson={(id) => { setSelectedPersonId(id); setCurrentView('kuidi-person-detail'); }}
          />
        )}
        {currentView === 'kuidi-transactions' && (
          <TransactionsPage
            userEmail={userEmail!}
            initialPersonId={transactionFilterPersonId ?? undefined}
            autoCreate={autoCreateTransaction}
            onSelectPerson={(id) => { setSelectedPersonId(id); setCurrentView('kuidi-person-detail'); }}
            onSelectTransaction={(id) => { setSelectedTransactionId(id); setCurrentView('kuidi-transaction'); }}
          />
        )}
        {currentView === 'parametres' && (
          <KuidiSettingsPage
            userEmail={userEmail!}
            isAcheteur={isAcheteur}
            onBack={() => setCurrentView('kuidi')}
            onSignOut={handleSignOut}
          />
        )}
      </main>
    </div>
  );
};

// === BOUTON DE NAV ===
const NavButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ active, onClick, icon, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-1.5 ${
      active ? 'bg-orange-100 text-orange-700' : 'text-gray-600 hover:bg-gray-100'
    }`}
  >
    {icon}
    <span className="hidden sm:inline">{children}</span>
  </button>
);

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
          <p className="text-sm text-gray-600 mb-3">⚠️ A SUPPRIMER avant la prod publique</p>
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

export default KuidiApp;
