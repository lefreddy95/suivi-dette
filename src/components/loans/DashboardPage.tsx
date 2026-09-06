import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  TrendingUp, TrendingDown, Package, Wrench, Users, Clock,
  Plus, ChevronRight, Calendar, AlertCircle, Sparkles,
} from 'lucide-react';

interface DashboardPageProps {
  userEmail: string;
  onSelectPerson: (personId: string) => void;
  onSelectTransaction: (transactionId: string) => void;
  onNewTransaction: () => void;
  onViewAllTransactions: () => void;
  onViewPeople: () => void;
}

/**
 * DashboardPage — Page d'accueil de Kuidi.
 *
 * Affiche 4 grandes cards d'avancement (on te doit / tu dois / items / services),
 * les prochaines échéances, l'activité récente et un bouton d'action rapide
 * pour créer une nouvelle transaction.
 *
 * Données chargées via la query getDashboard qui agrege tout cote serveur.
 */
const DashboardPage: React.FC<DashboardPageProps> = ({
  userEmail,
  onSelectPerson, onSelectTransaction,
  onNewTransaction, onViewAllTransactions, onViewPeople,
}) => {
  const dashboard = useQuery(api.loans.getDashboard, { userEmail });

  if (dashboard === undefined) {
    return (
      <div className="text-center py-12 text-gray-500">Chargement du dashboard...</div>
    );
  }

  const { summary, upcoming, recent } = dashboard;
  const hasData = summary.peopleCount > 0;
  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // === ÉCRAN VIDE (premiere visite) ===
  if (!hasData) {
    return (
      <div className="space-y-6">
        <EmptyState onNewTransaction={onNewTransaction} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* === SECTION 1 : HERO (2 grandes cards) === */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* On te doit */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold uppercase tracking-wider opacity-90">
              On te doit
            </span>
            <TrendingUp className="w-6 h-6 opacity-80" />
          </div>
          <p className="text-4xl sm:text-5xl font-bold mb-1">
            {fmt(summary.owedToMe)} <span className="text-2xl">€</span>
          </p>
          <p className="text-sm opacity-90">
            {summary.activeCount > 0
              ? `de ${summary.peopleCount} personne${summary.peopleCount > 1 ? 's' : ''}`
              : 'Aucun pret en cours'}
          </p>
        </div>

        {/* Tu dois */}
        <div className="bg-gradient-to-br from-red-500 to-orange-600 text-white rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold uppercase tracking-wider opacity-90">
              Tu dois
            </span>
            <TrendingDown className="w-6 h-6 opacity-80" />
          </div>
          <p className="text-4xl sm:text-5xl font-bold mb-1">
            {fmt(summary.iOwe)} <span className="text-2xl">€</span>
          </p>
          <p className="text-sm opacity-90">
            {summary.iOwe > 0 ? 'À rembourser' : 'Aucun pret à rembourser'}
          </p>
        </div>
      </section>

      {/* === SECTION 2 : 4 STATS === */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<Package className="w-5 h-5" />}
          label="Objets prêtes"
          value={summary.itemsLent}
          color="orange"
          onClick={onViewAllTransactions}
        />
        <StatCard
          icon={<Wrench className="w-5 h-5" />}
          label="Services"
          value={summary.servicesTodo}
          color="purple"
          onClick={onViewAllTransactions}
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Personnes"
          value={summary.peopleCount}
          color="blue"
          onClick={onViewPeople}
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="En cours"
          value={summary.activeCount}
          color="gray"
          onClick={onViewAllTransactions}
        />
      </section>

      {/* === SECTION 2b : DETTE CAMION PIZZA (legacy suivi-dette) === */}
      {summary.pizzaDebt && summary.pizzaDebt.remaining > 0 && (
        <section className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-5 shadow-md">
          <div className="flex items-start gap-3">
            <div className="text-3xl flex-shrink-0">🚗</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wider text-amber-800 font-bold">
                Dette speciale
              </p>
              <h2 className="text-lg font-bold text-amber-900">
                {summary.pizzaDebt.camionName}
              </h2>
              <p className="text-sm text-amber-800 mt-1">
                Mensualites de <strong>{summary.pizzaDebt.mensualite.toLocaleString('fr-FR')} €</strong> ·{' '}
                {summary.pizzaDebt.paidCount}/{summary.pizzaDebt.totalCount} payees
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-2xl font-bold text-amber-900">
                  {summary.pizzaDebt.remaining.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                </span>
                <button
                  onClick={() => onViewAllTransactions()}
                  className="text-xs text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-1"
                >
                  Voir le calendrier
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* === SECTION 3 : PROCHAINES ÉCHÉANCES === */}
      {upcoming.length > 0 && (
        <section className="bg-white rounded-2xl shadow-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-600" />
              Prochaines échéances
            </h2>
            <span className="text-xs text-gray-500">Dans les 30 jours</span>
          </div>
          <ul className="space-y-2">
            {upcoming.map((tx) => (
              <UpcomingRow
                key={tx._id}
                tx={tx}
                onClick={() => onSelectTransaction(tx._id)}
              />
            ))}
          </ul>
        </section>
      )}

      {/* === SECTION 4 : ACTIVITÉ RÉCENTE === */}
      {recent.length > 0 && (
        <section className="bg-white rounded-2xl shadow-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Activité récente
            </h2>
            <button
              onClick={onViewAllTransactions}
              className="text-xs text-orange-600 hover:text-orange-700 font-semibold flex items-center gap-1"
            >
              Voir tout
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <ul className="space-y-1">
            {recent.slice(0, 5).map((tx) => (
              <RecentRow
                key={tx._id}
                tx={tx}
                onClick={() => onSelectTransaction(tx._id)}
              />
            ))}
          </ul>
        </section>
      )}

      {/* === BOUTON FLOTTANT : + NOUVELLE TRANSACTION === */}
      <button
        onClick={onNewTransaction}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition-transform z-20"
        title="Nouvelle transaction"
      >
        <Plus className="w-8 h-8" />
      </button>
    </div>
  );
};

// === COMPOSANTS INTERNES ===

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'orange' | 'purple' | 'blue' | 'gray';
  onClick: () => void;
}> = ({ icon, label, value, color, onClick }) => {
  const colorMap = {
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
  };
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-xl border-2 text-left hover:shadow-md transition-shadow ${colorMap[color]}`}
    >
      <div className="flex items-center justify-between mb-1">
        {icon}
        <ChevronRight className="w-4 h-4 opacity-40" />
      </div>
      <p className="text-2xl font-bold leading-none mb-1">{value}</p>
      <p className="text-xs opacity-80">{label}</p>
    </button>
  );
};

const UpcomingRow: React.FC<{ tx: any; onClick: () => void }> = ({ tx, onClick }) => {
  const dueIn = Math.ceil((tx.dueDate - Date.now()) / (24 * 60 * 60 * 1000));
  const isOverdue = dueIn < 0;
  const iconForType = {
    money_lent: '💸',
    money_borrowed: '💰',
    item_lent: '📦',
    item_borrowed: '📥',
    service_done: '🔧',
    service_received: '🙋',
  }[tx.type] || '📋';
  return (
    <li>
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-left"
      >
        <span className="text-2xl">{iconForType}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{tx.title}</p>
          <p className="text-xs text-gray-500">
            Échéance : {new Date(tx.dueDate).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          {tx.amount !== undefined && (
            <p className="font-semibold text-gray-900 text-sm">
              {tx.amount.toLocaleString('fr-FR', { minimumFractionDigits: 0 })} €
            </p>
          )}
          <p className={`text-xs ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
            {isOverdue ? `En retard de ${-dueIn}j` : `Dans ${dueIn}j`}
          </p>
        </div>
      </button>
    </li>
  );
};

const RecentRow: React.FC<{ tx: any; onClick: () => void }> = ({ tx, onClick }) => {
  const iconForType = {
    money_lent: '💸',
    money_borrowed: '💰',
    item_lent: '📦',
    item_borrowed: '📥',
    service_done: '🔧',
    service_received: '🙋',
  }[tx.type] || '📋';
  const labelForType = {
    money_lent: 'Prêt d\'argent',
    money_borrowed: 'Emprunt d\'argent',
    item_lent: 'Objet prêté',
    item_borrowed: 'Objet emprunté',
    service_done: 'Service rendu',
    service_received: 'Service reçu',
  }[tx.type] || tx.type;
  return (
    <li>
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg text-left"
      >
        <span className="text-xl">{iconForType}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{tx.title}</p>
          <p className="text-xs text-gray-500">
            {labelForType} · {new Date(tx.createdAt).toLocaleDateString('fr-FR')}
          </p>
        </div>
        {tx.amount !== undefined && (
          <span className="text-sm font-semibold text-gray-700">
            {tx.amount.toLocaleString('fr-FR', { minimumFractionDigits: 0 })} €
          </span>
        )}
      </button>
    </li>
  );
};

const EmptyState: React.FC<{ onNewTransaction: () => void }> = ({ onNewTransaction }) => (
  <div className="bg-white rounded-2xl shadow-lg p-8 sm:p-12 text-center">
    <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-red-500 rounded-full mx-auto mb-6 flex items-center justify-center">
      <Sparkles className="w-10 h-10 text-white" />
    </div>
    <h2 className="text-2xl font-bold text-gray-900 mb-3">Bienvenue sur Kuidi !</h2>
    <p className="text-gray-600 mb-6 max-w-md mx-auto">
      Le tracker de prêts entre particuliers. Ne perds plus le fil de ce que tu
      prêtes, ce qu'on te doit, et ce que tu dois.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 max-w-2xl mx-auto text-left">
      <div className="p-3 bg-blue-50 rounded-lg">
        <p className="text-2xl mb-1">💸</p>
        <p className="text-sm font-semibold text-gray-900">Prêts d'argent</p>
        <p className="text-xs text-gray-600">Avec remboursements partiels</p>
      </div>
      <div className="p-3 bg-orange-50 rounded-lg">
        <p className="text-2xl mb-1">📦</p>
        <p className="text-sm font-semibold text-gray-900">Prêts d'objets</p>
        <p className="text-xs text-gray-600">Avec photo pour identifier</p>
      </div>
      <div className="p-3 bg-purple-50 rounded-lg">
        <p className="text-2xl mb-1">🔧</p>
        <p className="text-sm font-semibold text-gray-900">Services rendus</p>
        <p className="text-xs text-gray-600">Avec dates pour les rappels</p>
      </div>
    </div>
    <button
      onClick={onNewTransaction}
      className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-bold text-lg shadow-lg flex items-center gap-2 mx-auto"
    >
      <Plus className="w-5 h-5" />
      Créer ma première transaction
    </button>
    <p className="text-xs text-gray-500 mt-4">
      Tu peux aussi créer des personnes avant via l'onglet "Personnes"
    </p>
  </div>
);

export default DashboardPage;
