import { useUser } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import PizzaTruckPage from './components/pizza/PizzaTruckPage';
import LandingPage from './components/LandingPage';
import PublicTransactionPage from './components/loans/PublicTransactionPage';

/**
 * App — Routeur racine.
 *
 * 3 routes possibles selon le pathname :
 *  - /transaction/:token -> PublicTransactionPage (accessible SANS auth)
 *  - /                   -> LandingPage si non signé, PizzaTruckPage si signé
 */
function App() {
  const { isLoaded, isSignedIn } = useUser();
  const [pathname, setPathname] = useState(() => window.location.pathname);

  // Ecoute les changements de route (back/forward, push state futur)
  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Loader pendant que Clerk charge
  if (!isLoaded) {
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

  // Route publique : /transaction/:token
  const publicMatch = pathname.match(/^\/transaction\/([A-Za-z0-9_-]+)\/?$/);
  if (publicMatch) {
    return <PublicTransactionPage token={publicMatch[1]} />;
  }

  return isSignedIn ? <PizzaTruckPage /> : <LandingPage />;
}

export default App;
