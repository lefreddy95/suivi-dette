import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  Plus, Search, Filter, ListChecks, HandCoins, Banknote, Package, PackageOpen,
  Wrench, WrenchIcon, Calendar, AlertCircle, Trash2, Check, CircleDollarSign,
  TrendingUp, TrendingDown,
} from 'lucide-react';
import TransactionFormModal, { TYPES, type TransactionType } from './TransactionFormModal';

interface TransactionsPageProps {
  userEmail: string;
  // Filtre pré-appliqué (ex: "Voir les transactions d'une personne")
  initialPersonId?: string;
  // Ouvre automatiquement la modale de création au mount (ex: bouton "+" du Dashboard)
  autoCreate?: boolean;
  // Callback pour ouvrir une personne
  onSelectPerson?: (personId: string) => void;
}

/**
 * TransactionsPage — Liste globale des transactions avec filtres.
 *
 * Filtres disponibles :
 *  - Statut : tous / en cours / terminées / annulées
 *  - Type : tous + 6 types
 *  - Recherche : titre ou nom de personne
 *  - Personne : via le sous-filtre (si initialPersonId fourni)
 *
 * Bouton "+" en haut à droite pour ouvrir la modale de création.
 */
const TransactionsPage: React.FC<TransactionsPageProps> = ({
  userEmail, initialPersonId, autoCreate, onSelectPerson,
}) => {
  // Auto-open modale au mount si demandé (ex: clic sur "+" du Dashboard)
  useEffect(() => {
    if (autoCreate) setCreating(true);
  }, [autoCreate]);
  // === ÉTATS FILTRES ===
  const [statusFilter, setStatusFilter] = useState<'all' | 'en_cours' | 'termine' | 'annule'>('en_cours');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [creatingType, setCreatingType] = useState<TransactionType | undefined>(undefined);

  // === QUERIES ===
  const txs = useQuery(api.loans.listTransactions, {
    userEmail,
    status: statusFilter === 'all' ? undefined : statusFilter,
    type: typeFilter === 'all' ? undefined : typeFilter,
    personId: initialPersonId,
  });
  const people = useQuery(api.loans.listPeople, { userEmail });
  const deleteMut = useMutation(api.loans.deleteTransaction);

  // === INDEX people pour résolution du nom (rapide) ===
  const peopleById = useMemo(() => {
    const map: Record<string, any> = {};
    for (const p of people ?? []) map[p._id] = p;
    return map;
  }, [people]);

  if (txs === undefined || people === undefined) {
    return <div className="text-center py-12 text-gray-500">Chargement...</div>;
  }

  // === FILTRE RECHERCHE (côté client, sur titre + nom personne) ===
  const filtered = txs.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const personName = peopleById[t.personId]?.name?.toLowerCase() || '';
    return (
      t.title.toLowerCase().includes(q) ||
      personName.includes(q)
    );
  });

  // === HANDLERS ===
  const handleDelete = async (tx: any) => {
    if (window.confirm(`Supprimer "${tx.title}" ?\n\nCette action est IRREVERSIBLE.`)) {
      try {
        await deleteMut({ userEmail, transactionId: tx._id });
      } catch (e) {
        alert('Erreur: ' + (e instanceof Error ? e.message : 'inconnue'));
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* === HEADER + BOUTONS D'ACTION RAPIDE === */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => { setCreatingType('money_lent'); setCreating(true); }}
          className="flex-1 min-w-[120px] px-3 py-2.5 bg-gradient-to-br from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border-2 border-green-200 text-green-800 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
        >
          <HandCoins className="w-4 h-4" />
          Prêté €
        </button>
        <button
          onClick={() => { setCreatingType('money_borrowed'); setCreating(true); }}
          className="flex-1 min-w-[120px] px-3 py-2.5 bg-gradient-to-br from-red-50 to-rose-50 hover:from-red-100 hover:to-rose-100 border-2 border-red-200 text-red-800 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
        >
          <Banknote className="w-4 h-4" />
          Emprunté €
        </button>
        <button
          onClick={() => { setCreatingType('item_lent'); setCreating(true); }}
          className="flex-1 min-w-[120px] px-3 py-2.5 bg-gradient-to-br from-amber-50 to-yellow-50 hover:from-amber-100 hover:to-yellow-100 border-2 border-amber-200 text-amber-800 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
        >
          <Package className="w-4 h-4" />
          Prêté objet
        </button>
        <button
          onClick={() => { setCreatingType('service_done'); setCreating(true); }}
          className="flex-1 min-w-[120px] px-3 py-2.5 bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-2 border-blue-200 text-blue-800 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
        >
          <Wrench className="w-4 h-4" />
          Service rendu
        </button>
      </div>

      {/* === BARRE RECHERCHE === */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher par titre ou personne..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
        />
      </div>

      {/* === FILTRES STATUT (chips) === */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[
          { value: 'all', label: 'Toutes' },
          { value: 'en_cours', label: 'En cours' },
          { value: 'termine', label: 'Terminées' },
          { value: 'annule', label: 'Annulées' },
        ].map((s) => {
          const active = statusFilter === s.value;
          return (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                active
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* === FILTRES TYPE (chips) === */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1 ${
            typeFilter === 'all'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Filter className="w-3 h-3" />
          Tous types
        </button>
        {TYPES.map((t) => {
          const active = typeFilter === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1 ${
                active
                  ? `${t.bg} ${t.text} border border-current`
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* === LISTE === */}
      {filtered.length === 0 ? (
        <EmptyTransactions onCreate={() => { setCreatingType(undefined); setCreating(true); }} hasFilter={search || typeFilter !== 'all' || statusFilter !== 'en_cours'} />
      ) : (
        <ul className="space-y-2">
          {filtered.map((t) => (
            <TransactionRow
              key={t._id}
              tx={t}
              person={peopleById[t.personId]}
              onPersonClick={onSelectPerson ? () => onSelectPerson(t.personId) : undefined}
              onDelete={() => handleDelete(t)}
            />
          ))}
        </ul>
      )}

      {/* === MODALE === */}
      {creating && (
        <TransactionFormModal
          userEmail={userEmail}
          people={people}
          defaultType={creatingType}
          defaultPersonId={initialPersonId}
          onClose={() => setCreating(false)}
          onSaved={() => setCreating(false)}
        />
      )}
    </div>
  );
};

// === EMPTY STATE ===
const EmptyTransactions: React.FC<{ onCreate: () => void; hasFilter: boolean }> = ({ onCreate, hasFilter }) => (
  <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
    <div className="w-16 h-16 bg-orange-50 rounded-full mx-auto mb-4 flex items-center justify-center">
      <ListChecks className="w-8 h-8 text-orange-500" />
    </div>
    <h2 className="text-xl font-bold text-gray-900 mb-2">
      {hasFilter ? 'Aucun résultat' : 'Aucune transaction'}
    </h2>
    <p className="text-gray-600 mb-6 max-w-sm mx-auto">
      {hasFilter
        ? 'Essaie de modifier ou enlever les filtres.'
        : 'Crée ta première transaction pour commencer à suivre tes prêts et dettes.'}
    </p>
    {!hasFilter && (
      <button
        onClick={onCreate}
        className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-semibold flex items-center gap-2 mx-auto"
      >
        <Plus className="w-4 h-4" />
        Créer une transaction
      </button>
    )}
  </div>
);

// === LIGNE TRANSACTION (compacte) ===
const TransactionRow: React.FC<{
  tx: any;
  person: any;
  onPersonClick?: () => void;
  onDelete: () => void;
}> = ({ tx, person, onPersonClick, onDelete }) => {
  const colors = getTypeColor(tx.type);
  const remaining = (tx.amount ?? 0) - tx.totalRepaid;
  const isMoney = tx.type === 'money_lent' || tx.type === 'money_borrowed';
  const isOverdue = tx.dueDate && tx.dueDate < Date.now() && tx.status === 'en_cours';

  const formatAmount = (n: number) =>
    n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  const statusBadge = tx.status === 'en_cours'
    ? 'bg-orange-100 text-orange-700'
    : tx.status === 'termine'
      ? 'bg-green-100 text-green-700'
      : 'bg-gray-100 text-gray-600';

  return (
    <li className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex items-center gap-3">
      {/* Badge type */}
      <div className={`w-10 h-10 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center flex-shrink-0`}>
        {getTypeIcon(tx.type)}
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 truncate">{tx.title}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {onPersonClick && person ? (
                <button
                  onClick={onPersonClick}
                  className="text-xs text-blue-600 hover:underline truncate max-w-[120px]"
                >
                  {person.name}
                </button>
              ) : person ? (
                <span className="text-xs text-gray-500 truncate max-w-[120px]">
                  {person.name}
                </span>
              ) : null}
              {tx.status !== 'en_cours' && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase font-semibold tracking-wider ${statusBadge}`}>
                  {tx.status === 'termine' ? 'OK' : 'Annulée'}
                </span>
              )}
            </div>
          </div>
          {/* Montant */}
          {isMoney && (
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-gray-900">
                {tx.status === 'en_cours' ? formatAmount(remaining) : formatAmount(tx.amount ?? 0)} €
              </p>
              {tx.status === 'en_cours' && tx.amount && (
                <p className="text-[10px] text-gray-400">
                  / {formatAmount(tx.amount)} €
                </p>
              )}
            </div>
          )}
        </div>
        {/* Meta */}
        <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
          {tx.dueDate && (
            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-semibold' : ''}`}>
              <Calendar className="w-3 h-3" />
              {formatDate(tx.dueDate)}
              {isOverdue && <AlertCircle className="w-3 h-3" />}
            </span>
          )}
          {tx.itemDescription && (
            <span className="truncate">📦 {tx.itemDescription}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <button
        onClick={onDelete}
        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded flex-shrink-0"
        title="Supprimer"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </li>
  );
};

// === HELPERS type ===
function getTypeIcon(type: string) {
  switch (type) {
    case 'money_lent': return <HandCoins className="w-4 h-4" />;
    case 'money_borrowed': return <Banknote className="w-4 h-4" />;
    case 'item_lent': return <Package className="w-4 h-4" />;
    case 'item_borrowed': return <PackageOpen className="w-4 h-4" />;
    case 'service_done': return <Wrench className="w-4 h-4" />;
    case 'service_received': return <WrenchIcon className="w-4 h-4" />;
    default: return <CircleDollarSign className="w-4 h-4" />;
  }
}

function getTypeColor(type: string): { bg: string; text: string } {
  switch (type) {
    case 'money_lent': return { bg: 'bg-green-100', text: 'text-green-700' };
    case 'money_borrowed': return { bg: 'bg-red-100', text: 'text-red-700' };
    case 'item_lent': return { bg: 'bg-amber-100', text: 'text-amber-700' };
    case 'item_borrowed': return { bg: 'bg-purple-100', text: 'text-purple-700' };
    case 'service_done': return { bg: 'bg-blue-100', text: 'text-blue-700' };
    case 'service_received': return { bg: 'bg-cyan-100', text: 'text-cyan-700' };
    default: return { bg: 'bg-gray-100', text: 'text-gray-700' };
  }
}

export default TransactionsPage;
