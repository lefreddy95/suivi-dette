import { useUser } from '@clerk/clerk-react';
import PizzaTruckPage from './components/pizza/PizzaTruckPage';
import LandingPage from './components/LandingPage';

/**
 * App — Routeur racine de l'application.
 *
 * - Tant que Clerk charge → affiche un loader centré
 * - Si user NON signé → LandingPage (marketing + bouton "Se connecter")
 * - Si user signé → PizzaTruckPage (l'app de suivi de prêts)
 */
function App() {
  const { isLoaded, isSignedIn } = useUser();

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

  return isSignedIn ? <PizzaTruckPage /> : <LandingPage />;
}

export default App;
