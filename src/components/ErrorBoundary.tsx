import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Filet de securite : si un composant React crash (etat corrompu, donnees
 * manquantes, etc.), on affiche un message d'erreur clair au lieu d'une page
 * blanche muette. Le user peut recharger pour retenter sa chance.
 *
 * Note : un ErrorBoundary ne catch PAS les erreurs de Convex (qui sont
 * remontees via alert() dans les handlers), ni les erreurs async (useEffect,
 * promises). Il catch uniquement les erreurs synchrones du render React.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    // Log dans la console pour debug
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-lg w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Oups, une erreur est survenue</h1>
              <p className="text-sm text-gray-600 mt-2">
                L'app a rencontre un probleme inattendu. Pas de panique, tes donnees sont sauvegardees.
              </p>
            </div>

            {this.state.error && (
              <details className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs">
                <summary className="font-semibold text-red-800 cursor-pointer">
                  Details techniques (a envoyer au dev)
                </summary>
                <pre className="mt-2 whitespace-pre-wrap break-words text-red-900">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-2">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium"
              >
                Reessayer
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Recharger
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
