import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  ArrowLeft, Mail, Phone, StickyNote, Plus, Check, X,
  Banknote, HandCoins, Package, PackageOpen, Wrench, WrenchIcon,
  Calendar, AlertCircle, Trash2, TrendingUp, TrendingDown,
  CircleDollarSign, ChevronRight, Repeat,
} from 'lucide-react';

interface PersonDetailPageProps {
  userEmail: string;
  personId: string;
  onBack: () => void;
}

/**
 * PersonDetailPage — Fiche détail d'une personne.
 *
 * Affiche :
 *  - Header : avatar, nom, contacts, solde net (badge coloré)
 *  - Stats rapides : total prêté / total emprunté / en cours / terminés
 *  - Liste des transactions groupées par statut
 *  - Actions par transaction : ajouter remboursement (money + en_cours),
 *    clôturer, supprimer
 *
 * La création de nouvelle transaction est volontairement hors scope ici
 * (arrive au commit 1.4/4 — page Transactions dédiée avec modale globale).
 */
const PersonDetailPage: React.FC<PersonDetailPageProps> = ({ userEmail, personId, onBack }) => {
  const data = useQuery(api.loans.getPerson, { userEmail, personId });
  const [repayingTx, setRepayingTx] = useState<any | null>(null);
  const [closingTx, setClosingTx] = useState<any | null>(null);

  if (data === undefined) {
    return <div className="text-center py-12 text-gray-500">Chargement...</div>;
  }
  const { person, transactions } = data;
  if (!person) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Personne introuvable.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
        >
          Retour
        </button>
      </div>
    );
  }

  // === CALCULS STATS ===
  const activeTxs = transactions.filter((t: any) => t.status === 'en_cours');
  const finishedTxs = transactions.filter((t: any) => t.status === 'termine');
  const cancelledTxs = transactions.filter((t: any) => t.status === 'annule');

  // Pour chaque transaction, calculer le signe (qui doit quoi a qui)
  const computeNet = (t: any) => {
    const isLentType = t.type === 'money_lent' || t.type === 'item_lent' || t.type === 'service_done';
    const sign = isLentType ? 1 : -1;
    const amount = t.amount ?? 0;
    return sign * (amount - t.totalRepaid);
  };
  // Solde net global (memes regles que PeoplePage)
  const netBalance = activeTxs.reduce((s: number, t: any) => s + computeNet(t), 0);
  // Total cumule prete a cette personne (toutes transactions en_cours + terminees)
  const totalLent = transactions
    .filter((t: any) => t.type === 'money_lent')
    .reduce((s: number, t: any) => s + (t.amount ?? 0), 0);
  const totalBorrowed = transactions
    .filter((t: any) => t.type === 'money_borrowed')
    .reduce((s: number, t: any) => s + (t.amount ?? 0), 0);
  const totalRepaidAll = transactions.reduce((s: number, t: any) => s + t.totalRepaid, 0);

  // === GROUPES D'AFFICHAGE ===
  // En_cours d'abord (tries par date d'echeance), puis termine, puis annule
  const sortByDue = (a: any, b: any) => {
    if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return b.startDate - a.startDate;
  };
  const sortedActive = [...activeTxs].sort(sortByDue);

  const formatAmount = (n: number) =>
    n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const initial = person.name.charAt(0).toUpperCase();
  const balanceLabel = netBalance === 0
    ? 'Compte à l\'équilibre'
    : netBalance > 0
      ? 'On te doit'
      : 'Tu dois';
  const balanceColor = netBalance === 0
    ? 'bg-gray-100 text-gray-700'
    : netBalance > 0
      ? 'bg-green-100 text-green-700'
      : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-4">
      {/* === BOUTON RETOUR === */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux personnes
      </button>

      {/* === HEADER PERSONNE === */}
      <div className="bg-white rounded-2xl shadow-lg p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          {person.avatarUrl ? (
            <img
              src={person.avatarUrl}
              alt={person.name}
              className="w-16 h-16 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl flex-shrink-0"
              style={{ backgroundColor: person.color }}
            >
              {initial}
            </div>
          )}

          {/* Identité + contacts */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{person.name}</h1>
            <div className="mt-1 space-y-0.5 text-sm text-gray-600">
              {person.email && (
                <p className="flex items-center gap-1.5 truncate">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{person.email}</span>
                </p>
              )}
              {person.phone && (
                <p className="flex items-center gap-1.5 font-mono">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  {person.phone}
                </p>
              )}
              {!person.email && !person.phone && (
                <p className="text-gray-400 italic">Aucun contact renseigné</p>
              )}
            </div>
          </div>

          {/* Solde net (badge) */}
          <div className={`px-3 py-2 rounded-xl text-right flex-shrink-0 ${balanceColor}`}>
            <p className="text-[10px] uppercase tracking-wider font-medium opacity-80">
              {balanceLabel}
            </p>
            <p className="text-lg font-bold leading-tight">
              {netBalance !== 0 ? `${formatAmount(Math.abs(netBalance))} €` : '0 €'}
            </p>
          </div>
        </div>

        {/* Notes */}
        {person.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="flex items-start gap-1.5 text-sm text-gray-600">
              <StickyNote className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{person.notes}</span>
            </p>
          </div>
        )}
      </div>

      {/* === STATS RAPIDES === */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatMini
          label="Prêté"
          value={totalLent}
          icon={<TrendingUp className="w-4 h-4" />}
          color="text-green-600"
          bg="bg-green-50"
        />
        <StatMini
          label="Emprunté"
          value={totalBorrowed}
          icon={<TrendingDown className="w-4 h-4" />}
          color="text-red-600"
          bg="bg-red-50"
        />
        <StatMini
          label="En cours"
          value={activeTxs.length}
          icon={<CircleDollarSign className="w-4 h-4" />}
          color="text-orange-600"
          bg="bg-orange-50"
          suffix=" tx"
        />
        <StatMini
          label="Remboursé"
          value={totalRepaidAll}
          icon={<Check className="w-4 h-4" />}
          color="text-blue-600"
          bg="bg-blue-50"
        />
      </div>

      {/* === LISTE DES TRANSACTIONS === */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
            Transactions ({transactions.length})
          </h2>
        </div>

        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <p className="text-gray-500 mb-1">Aucune transaction pour l'instant</p>
            <p className="text-xs text-gray-400">
              La création de transaction arrive au commit 1.4/4.
            </p>
          </div>
        ) : (
          <>
            {/* === EN COURS === */}
            {sortedActive.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-orange-600 px-1 uppercase tracking-wider">
                  En cours ({sortedActive.length})
                </p>
                {sortedActive.map((t: any) => (
                  <TransactionCard
                    key={t._id}
                    tx={t}
                    onRepay={() => setRepayingTx(t)}
                    onClose={() => setClosingTx(t)}
                    userEmail={userEmail}
                  />
                ))}
              </div>
            )}

            {/* === TERMINÉES === */}
            {finishedTxs.length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-xs font-semibold text-green-600 px-1 uppercase tracking-wider">
                  Terminées ({finishedTxs.length})
                </p>
                {finishedTxs.map((t: any) => (
                  <TransactionCard
                    key={t._id}
                    tx={t}
                    onRepay={null}
                    onClose={null}
                    userEmail={userEmail}
                    archived
                  />
                ))}
              </div>
            )}

            {/* === ANNULÉES === */}
            {cancelledTxs.length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-xs font-semibold text-gray-500 px-1 uppercase tracking-wider">
                  Annulées ({cancelledTxs.length})
                </p>
                {cancelledTxs.map((t: any) => (
                  <TransactionCard
                    key={t._id}
                    tx={t}
                    onRepay={null}
                    onClose={null}
                    userEmail={userEmail}
                    archived
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* === MODALES === */}
      {repayingTx && (
        <RepaymentModal
          userEmail={userEmail}
          tx={repayingTx}
          onClose={() => setRepayingTx(null)}
        />
      )}
      {closingTx && (
        <CloseTxModal
          userEmail={userEmail}
          tx={closingTx}
          onClose={() => setClosingTx(null)}
        />
      )}
    </div>
  );
};

// === STAT MINI ===
const StatMini: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bg: string;
  suffix?: string;
}> = ({ label, value, icon, color, bg, suffix }) => (
  <div className={`${bg} rounded-xl p-3`}>
    <div className={`flex items-center gap-1.5 ${color} mb-1`}>
      {icon}
      <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
    </div>
    <p className={`text-lg font-bold ${color}`}>
      {typeof value === 'number'
        ? value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
        : value}
      {suffix && <span className="text-xs font-normal opacity-70">{suffix}</span>}
    </p>
  </div>
);

// === TYPE ICON ===
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

function getTypeLabel(type: string): string {
  switch (type) {
    case 'money_lent': return 'Argent prêté';
    case 'money_borrowed': return 'Argent emprunté';
    case 'item_lent': return 'Objet prêté';
    case 'item_borrowed': return 'Objet emprunté';
    case 'service_done': return 'Service rendu';
    case 'service_received': return 'Service reçu';
    default: return type;
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

// === TRANSACTION CARD ===
const TransactionCard: React.FC<{
  tx: any;
  onRepay: (() => void) | null;
  onClose: (() => void) | null;
  userEmail: string;
  archived?: boolean;
}> = ({ tx, onRepay, onClose, userEmail, archived }) => {
  const deleteMut = useMutation(api.loans.deleteTransaction);
  const [expanded, setExpanded] = useState(false);
  const colors = getTypeColor(tx.type);
  const remaining = (tx.amount ?? 0) - tx.totalRepaid;
  const isMoney = tx.type === 'money_lent' || tx.type === 'money_borrowed';
  const isOverdue = tx.dueDate && tx.dueDate < Date.now() && !archived;

  const formatAmount = (n: number) =>
    n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleDelete = async () => {
    if (window.confirm(
      `Supprimer "${tx.title}" ?\n\nCette action est IRREVERSIBLE.`
    )) {
      try {
        await deleteMut({ userEmail, transactionId: tx._id });
      } catch (e) {
        alert('Erreur: ' + (e instanceof Error ? e.message : 'inconnue'));
      }
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border ${archived ? 'border-gray-100 opacity-75' : 'border-gray-200'}`}>
      <div className="p-3 flex items-start gap-3">
        {/* Badge type */}
        <div className={`w-10 h-10 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center flex-shrink-0`}>
          {getTypeIcon(tx.type)}
        </div>

        {/* Contenu principal */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{tx.title}</p>
              <p className={`text-[10px] uppercase tracking-wider font-medium ${colors.text}`}>
                {getTypeLabel(tx.type)}
              </p>
            </div>
            {/* Montant / reste */}
            {tx.amount !== undefined && (
              <div className="text-right flex-shrink-0">
                {isMoney && !archived && (
                  <p className="text-sm font-bold text-gray-900">
                    {formatAmount(remaining)} €
                  </p>
                )}
                {isMoney && (
                  <p className="text-[10px] text-gray-500">
                    sur {formatAmount(tx.amount)} €
                  </p>
                )}
                {!isMoney && (
                  <p className="text-sm font-bold text-gray-900">
                    {tx.hoursLogged ? `${tx.hoursLogged}h` : '—'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Meta : date + icones */}
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-500">
            {tx.dueDate && (
              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-semibold' : ''}`}>
                <Calendar className="w-3 h-3" />
                Échéance : {formatDate(tx.dueDate)}
                {isOverdue && <AlertCircle className="w-3 h-3" />}
              </span>
            )}
            {tx.itemDescription && (
              <span className="truncate">📦 {tx.itemDescription}</span>
            )}
          </div>

          {/* Barre de progression (prêts d'argent en cours) */}
          {isMoney && !archived && tx.amount > 0 && (
            <div className="mt-2">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all"
                  style={{ width: `${Math.min(100, (tx.totalRepaid / tx.amount) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {formatAmount(tx.totalRepaid)} € remboursé sur {formatAmount(tx.amount)} €
              </p>
            </div>
          )}

          {/* Échéancier de remboursement (si défini) */}
          {isMoney && !archived && tx.installmentAmount && tx.installmentFrequency && tx.installmentStartDate && (
            <ScheduleBadge tx={tx} />
          )}
        </button>
      </div>

      {/* === ACTIONS === */}
      {!archived && (
        <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-end gap-1">
          {tx.repayments && tx.repayments.length > 0 && (
            <span className="text-[10px] text-gray-400 mr-auto">
              {tx.repayments.length} remboursement{tx.repayments.length > 1 ? 's' : ''}
            </span>
          )}
          {onRepay && remaining > 0 && (
            <button
              onClick={onRepay}
              className="px-2.5 py-1 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-md flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Remboursement
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="px-2.5 py-1 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-1"
            >
              <Check className="w-3 h-3" />
              Clôturer
            </button>
          )}
          <button
            onClick={handleDelete}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="Supprimer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* === REPAMENT HISTORY (expandable) === */}
      {expanded && tx.repayments && tx.repayments.length > 0 && (
        <div className="border-t border-gray-100 px-3 py-2 space-y-1 bg-gray-50">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Historique des remboursements
          </p>
          {tx.repayments.map((r: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-gray-600">
                {formatDate(r.date)}
                {r.note && <span className="text-gray-400"> — {r.note}</span>}
              </span>
              <span className="font-semibold text-green-700">
                +{formatAmount(r.amount)} €
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// === MODALE REMBOURSEMENT ===
const RepaymentModal: React.FC<{
  userEmail: string;
  tx: any;
  onClose: () => void;
}> = ({ userEmail, tx, onClose }) => {
  const addRepaymentMut = useMutation(api.loans.addRepayment);
  const remaining = (tx.amount ?? 0) - tx.totalRepaid;
  const [amount, setAmount] = useState(remaining.toString());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Montant invalide');
      return;
    }
    if (numAmount > remaining) {
      if (!window.confirm(
        `Le montant (${numAmount}€) dépasse le reste à rembourser (${remaining}€).\n` +
        'La transaction sera automatiquement marquée comme terminée. Continuer ?'
      )) {
        return;
      }
    }
    setSaving(true);
    try {
      const result = await addRepaymentMut({
        userEmail,
        transactionId: tx._id,
        amount: numAmount,
        note: note.trim() || undefined,
      });
      onClose();
      if (result.isComplete) {
        setTimeout(() => alert('🎉 Transaction terminée !'), 100);
      }
    } catch (e) {
      alert('Erreur: ' + (e instanceof Error ? e.message : 'inconnue'));
    } finally {
      setSaving(false);
    }
  };

  const formatAmount = (n: number) =>
    n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Plus className="w-5 h-5 text-green-600" />
            Ajouter un remboursement
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <p className="font-semibold text-gray-900">{tx.title}</p>
          <p className="text-gray-600 mt-0.5">
            Reste à rembourser :{' '}
            <span className="font-bold text-orange-600">{formatAmount(remaining)} €</span>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Montant (€) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0.01"
            step="0.01"
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-lg font-semibold"
          />
          <div className="flex gap-1 mt-2">
            <button
              type="button"
              onClick={() => setAmount(remaining.toString())}
              className="text-xs px-2 py-1 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded"
            >
              Tout ({formatAmount(remaining)} €)
            </button>
            <button
              type="button"
              onClick={() => setAmount((remaining / 2).toFixed(2))}
              className="text-xs px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded"
            >
              Moitié
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Note <span className="text-gray-400 text-xs">(optionnel)</span>
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="virement, espèces, etc."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !amount}
            className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Valider'}
          </button>
        </div>
      </div>
    </div>
  );
};

// === MODALE CLOTURE (sans remboursement) ===
const CloseTxModal: React.FC<{
  userEmail: string;
  tx: any;
  onClose: () => void;
}> = ({ userEmail, tx, onClose }) => {
  const updateMut = useMutation(api.loans.updateTransaction);
  const [saving, setSaving] = useState(false);

  const handleClose = async (status: 'termine' | 'annule') => {
    setSaving(true);
    try {
      await updateMut({ userEmail, transactionId: tx._id, status });
      onClose();
    } catch (e) {
      alert('Erreur: ' + (e instanceof Error ? e.message : 'inconnue'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Clôturer la transaction</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600">
          Que veux-tu faire avec <span className="font-semibold">"{tx.title}"</span> ?
        </p>

        <div className="space-y-2">
          <button
            onClick={() => handleClose('termine')}
            disabled={saving}
            className="w-full px-4 py-3 bg-green-50 hover:bg-green-100 border-2 border-green-200 text-green-800 rounded-lg text-left disabled:opacity-50"
          >
            <p className="font-semibold flex items-center gap-2">
              <Check className="w-4 h-4" />
              Marquer comme terminée
            </p>
            <p className="text-xs mt-0.5 text-green-700">
              La transaction est soldée (ex: objet rendu, service effectué).
            </p>
          </button>
          <button
            onClick={() => handleClose('annule')}
            disabled={saving}
            className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 text-gray-800 rounded-lg text-left disabled:opacity-50"
          >
            <p className="font-semibold flex items-center gap-2">
              <X className="w-4 h-4" />
              Annuler
            </p>
            <p className="text-xs mt-0.5 text-gray-600">
              La transaction ne se fera finalement pas (ex: prêt annulé).
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PersonDetailPage;

// === BADGE ÉCHÉANCIER (sous la barre de progression) ===
const ScheduleBadge: React.FC<{ tx: any }> = ({ tx }) => {
  // Calcule la prochaine échéance non payée
  const installmentsPaid = Math.floor(tx.totalRepaid / tx.installmentAmount);
  const nextInstallmentNum = installmentsPaid + 1;
  const nextDate = computeNextInstallmentDate(
    tx.installmentStartDate,
    tx.installmentFrequency,
    nextInstallmentNum
  );
  const totalCount = tx.installmentCount
    ?? Math.ceil(tx.amount / tx.installmentAmount);
  const isLast = nextInstallmentNum > totalCount;
  const freqLabel = tx.installmentFrequency === 'weekly' ? '/sem.'
    : tx.installmentFrequency === 'biweekly' ? '/2 sem.'
    : tx.installmentFrequency === 'monthly' ? '/mois'
    : '/trimestre';

  const formatAmount = (n: number) =>
    n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="mt-2 flex items-center gap-2 px-2 py-1.5 bg-orange-50 border border-orange-200 rounded-md text-xs">
      <Repeat className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-gray-700">
          <span className="font-semibold text-orange-700">
            {formatAmount(tx.installmentAmount)} € {freqLabel}
          </span>
          {tx.installmentCount && (
            <span className="text-gray-500"> · {tx.installmentCount} échéances</span>
          )}
        </p>
        {!isLast && nextDate && (
          <p className="text-[10px] text-gray-500">
            Prochaine : <span className="font-semibold">{formatDate(nextDate)}</span>
            {' '}(n°{nextInstallmentNum}/{totalCount})
          </p>
        )}
        {isLast && (
          <p className="text-[10px] text-green-600 font-semibold">
            🎉 Échéancier terminé
          </p>
        )}
      </div>
    </div>
  );
};

// Helper : calcule la date de la n-ième échéance à partir de la date de début
function computeNextInstallmentDate(
  startDateMs: number,
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly',
  n: number
): number {
  const d = new Date(startDateMs);
  if (frequency === 'weekly') d.setDate(d.getDate() + (n - 1) * 7);
  else if (frequency === 'biweekly') d.setDate(d.getDate() + (n - 1) * 14);
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + (n - 1));
  else if (frequency === 'quarterly') d.setMonth(d.getMonth() + (n - 1) * 3);
  return d.getTime();
}
