import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  ArrowLeft, Send, Banknote, Calendar, User, FileSignature, ExternalLink,
  CheckCircle2, History, AlertCircle, Edit2, Clock, Copy, Plus,
  Check, X, Trash2, Repeat, AlertOctagon, ShoppingBag, Wrench, WrenchIcon,
  Package, PackageOpen, HandCoins, TrendingUp, TrendingDown, ChevronRight,
} from 'lucide-react';
import SignInviteModal from './SignInviteModal';

interface TransactionDetailPageProps {
  userEmail: string;
  transactionId: string;
  onBack: () => void;
  // Callback pour naviguer vers la fiche personne
  onSelectPerson?: (personId: string) => void;
}

/**
 * TransactionDetailPage — Page dediee pour UNE transaction (owner-only).
 *
 * URL : /tx/:transactionId
 * Affiche : titre, type, montant, progression animee, contrepartie,
 *           echeancier, remboursements, signatures, events
 * Actions : inviter a signer, ajouter remboursement, cloturer, supprimer
 *
 * Reproduit le pattern "page detail riche" comme la page Camion Pizza,
 * mais adaptable a tous types de transactions (money, item, service).
 */
const TransactionDetailPage: React.FC<TransactionDetailPageProps> = ({
  userEmail, transactionId, onBack, onSelectPerson,
}) => {
  const tx = useQuery(api.loans.getTransaction, { userEmail, transactionId: transactionId as any });
  const people = useQuery(api.loans.listPeople, { userEmail });
  const deleteMut = useMutation(api.loans.deleteTransaction);
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (tx === undefined || people === undefined) {
    return <CenterMessage>Chargement...</CenterMessage>;
  }
  if (tx === null) {
    return (
      <CenterMessage>
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Transaction introuvable</h1>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
        >
          Retour
        </button>
      </CenterMessage>
    );
  }

  const person = people.find((p) => p._id === tx.personId);
  const formatAmount = (n: number) =>
    n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatAmountInt = (n: number) =>
    n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // === SENS DE LA TRANSACTION ===
  const isMoneyLent = tx.type === 'money_lent';
  const isMoneyBorrowed = tx.type === 'money_borrowed';
  const isMoney = isMoneyLent || isMoneyBorrowed;
  const isItem = tx.type.startsWith('item_');
  const isService = tx.type.startsWith('service_');
  const lentTo = isMoneyLent || tx.type === 'item_lent' || tx.type === 'service_done';
  // Si on prete, la personne nous doit. Sinon, on doit a la personne.
  const direction = lentTo ? 'de' : 'à';

  // === PROGRESSION ===
  // Pour money : % rembourse. Pour item : 0% puis 100% au retour.
  // Pour service : 0% puis 100% a la realisation.
  let progressPercent = 0;
  if (isMoney && tx.amount && tx.amount > 0) {
    progressPercent = Math.min(100, (tx.totalRepaid / tx.amount) * 100);
  } else if (tx.status === 'termine') {
    progressPercent = 100;
  }

  // === ECHEANCIER : prochaine echeance non payee ===
  const hasSchedule = isMoney && tx.installmentAmount && tx.installmentFrequency && tx.installmentStartDate;
  let nextInstallmentDate: number | null = null;
  let installmentsPaid = 0;
  let nextInstallmentNum = 0;
  let totalCount = 0;
  if (hasSchedule) {
    installmentsPaid = Math.floor(tx.totalRepaid / tx.installmentAmount);
    nextInstallmentNum = installmentsPaid + 1;
    totalCount = tx.installmentCount ?? Math.ceil((tx.amount ?? 0) / tx.installmentAmount);
    if (nextInstallmentNum <= totalCount) {
      const d = new Date(tx.installmentStartDate);
      const n = nextInstallmentNum - 1;
      if (tx.installmentFrequency === 'weekly') d.setDate(d.getDate() + n * 7);
      else if (tx.installmentFrequency === 'biweekly') d.setDate(d.getDate() + n * 14);
      else if (tx.installmentFrequency === 'monthly') d.setMonth(d.getMonth() + n);
      else if (tx.installmentFrequency === 'quarterly') d.setMonth(d.getMonth() + n * 3);
      nextInstallmentDate = d.getTime();
    }
  }

  // === ICONE TYPE ===
  const getTypeIcon = () => {
    switch (tx.type) {
      case 'money_lent': return <HandCoins className="w-5 h-5" />;
      case 'money_borrowed': return <Banknote className="w-5 h-5" />;
      case 'item_lent': return <Package className="w-5 h-5" />;
      case 'item_borrowed': return <PackageOpen className="w-5 h-5" />;
      case 'service_done': return <Wrench className="w-5 h-5" />;
      case 'service_received': return <WrenchIcon className="w-5 h-5" />;
      default: return <Banknote className="w-5 h-5" />;
    }
  };
  const getTypeLabel = () => {
    switch (tx.type) {
      case 'money_lent': return 'Argent prete';
      case 'money_borrowed': return 'Argent emprunte';
      case 'item_lent': return 'Objet prete';
      case 'item_borrowed': return 'Objet emprunte';
      case 'service_done': return 'Service rendu';
      case 'service_received': return 'Service recu';
      default: return tx.type;
    }
  };
  const getTypeBg = () => {
    switch (tx.type) {
      case 'money_lent': return 'bg-green-100 text-green-700';
      case 'money_borrowed': return 'bg-red-100 text-red-700';
      case 'item_lent': return 'bg-amber-100 text-amber-700';
      case 'item_borrowed': return 'bg-purple-100 text-purple-700';
      case 'service_done': return 'bg-blue-100 text-blue-700';
      case 'service_received': return 'bg-cyan-100 text-cyan-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // === COULEUR SELON SENS ===
  const isPositive = lentTo;  // on prete -> la personne nous doit (positif pour nous)
  const amountColor = isMoney ? (isPositive ? 'text-green-600' : 'text-red-600') : 'text-gray-900';
  const amountBg = isMoney ? (isPositive ? 'from-green-500 to-emerald-600' : 'from-red-500 to-orange-600') : 'from-orange-500 to-red-500';

  const copyLink = () => {
    if (!tx.publicToken) return;
    const url = `${window.location.origin}/transaction/${tx.publicToken}`;
    navigator.clipboard.writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => prompt('Copie ce lien :', url));
  };

  const handleDelete = async () => {
    if (window.confirm(`Supprimer "${tx.title}" ? Cette action est IRREVERSIBLE.`)) {
      try {
        await deleteMut({ userEmail, transactionId: tx._id });
        onBack();
      } catch (e) {
        alert('Erreur: ' + (e instanceof Error ? e.message : 'inconnue'));
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-red-50">
      {/* === HEADER === */}
      <header className="bg-white border-b-2 border-orange-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{tx.title}</h1>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${getTypeBg()}`}>
            {getTypeIcon()}
            <span className="hidden sm:inline">{getTypeLabel()}</span>
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* === BANDEAU STATUT === */}
        {tx.status === 'termine' ? (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-green-900">Transaction terminee</p>
              <p className="text-sm text-green-700">Cette transaction a ete entierement soldee.</p>
            </div>
          </div>
        ) : tx.status === 'annule' ? (
          <div className="bg-gray-50 border-2 border-gray-300 rounded-2xl p-4 flex items-start gap-3">
            <AlertOctagon className="w-6 h-6 text-gray-500 flex-shrink-0" />
            <div>
              <p className="font-bold text-gray-900">Transaction annulee</p>
              <p className="text-sm text-gray-700">Cette transaction n'a pas eu lieu.</p>
            </div>
          </div>
        ) : null}

        {/* === PROGRESSION (style camion qui avance) === */}
        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          {/* Montant en haut */}
          {isMoney && tx.amount && (
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                {lentTo ? 'Tu lui pretes' : 'Il/Elle te prete'}
              </p>
              <p className={`text-4xl font-extrabold ${amountColor}`}>
                {formatAmount(tx.amount)} €
              </p>
              {tx.totalRepaid > 0 && (
                <p className="text-sm text-gray-600 mt-1">
                  {formatAmount(tx.totalRepaid)} € rembourses
                </p>
              )}
            </div>
          )}

          {/* Barre de progression (le "camion qui avance") */}
          <ProgressionBar percent={progressPercent} amountBg={amountBg} isMoney={isMoney} />

          {/* Prochaine echeance / statut */}
          {hasSchedule && nextInstallmentDate && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-gray-700">
                  Prochaine echeance :{' '}
                  <span className="font-semibold text-orange-700">
                    {formatAmount(tx.installmentAmount!)} € le {new Date(nextInstallmentDate).toLocaleDateString('fr-FR')}
                  </span>
                </p>
                <p className="text-[10px] text-gray-500">
                  Echeance n°{nextInstallmentNum} sur {totalCount}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* === ACTIONS RAPIDES === */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {tx.publicToken && tx.counterpartyEmail && (
            <button
              onClick={() => setInviting(true)}
              className="px-3 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 text-sm shadow-md"
            >
              <Send className="w-4 h-4" />
              Inviter
            </button>
          )}
          {tx.publicToken && (
            <button
              onClick={copyLink}
              className="px-3 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 text-sm shadow-md"
            >
              {copied ? <><Check className="w-4 h-4" /> Copie</> : <><Copy className="w-4 h-4" /> Lien</>}
            </button>
          )}
          {tx.publicToken && (
            <a
              href={`/transaction/${tx.publicToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 text-sm shadow-md"
            >
              <ExternalLink className="w-4 h-4" />
              Apercu public
            </a>
          )}
          <button
            onClick={handleDelete}
            className="px-3 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-semibold flex items-center justify-center gap-1.5 text-sm col-span-2 sm:col-span-1"
          >
            <Trash2 className="w-4 h-4" />
            Supprimer
          </button>
        </div>

        {/* === DETAILS === */}
        <div className="bg-white rounded-2xl shadow-lg p-5 space-y-3 text-sm">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Details</h2>
          <DetailRow icon={<User className="w-4 h-4" />} label="Personne">
            {person ? (
              <button
                onClick={() => onSelectPerson && onSelectPerson(person._id)}
                className="font-semibold text-blue-600 hover:underline"
              >
                {person.name}
              </button>
            ) : (
              <span className="text-gray-400">Inconnue</span>
            )}
          </DetailRow>
          {tx.counterpartyName && (
            <DetailRow icon={<User className="w-4 h-4" />} label="Contrepartie (contrat)">
              {tx.counterpartyName}
              {tx.counterpartyEmail && (
                <span className="text-gray-500 text-xs ml-1">&lt;{tx.counterpartyEmail}&gt;</span>
              )}
            </DetailRow>
          )}
          <DetailRow icon={<Calendar className="w-4 h-4" />} label="Date de debut">
            {formatDate(tx.startDate)}
          </DetailRow>
          {tx.dueDate && (
            <DetailRow icon={<Calendar className="w-4 h-4" />} label="Echeance finale">
              {formatDate(tx.dueDate)}
            </DetailRow>
          )}
          {tx.itemDescription && (
            <DetailRow icon={<Package className="w-4 h-4" />} label="Description objet">
              {tx.itemDescription}
            </DetailRow>
          )}
          {tx.hoursLogged && (
            <DetailRow icon={<Clock className="w-4 h-4" />} label="Heures">
              {tx.hoursLogged} h
            </DetailRow>
          )}
          {tx.note && (
            <DetailRow icon={<Edit2 className="w-4 h-4" />} label="Note">
              <span className="italic">{tx.note}</span>
            </DetailRow>
          )}
          {tx.notePhotoUrl && (
            <DetailRow icon={<Edit2 className="w-4 h-4" />} label="Photo jointe">
              <img src={tx.notePhotoUrl} alt="Note" className="mt-1 max-w-xs rounded-lg border" />
            </DetailRow>
          )}
        </div>

        {/* === REMBOURSEMENTS === */}
        {isMoney && tx.repayments && tx.repayments.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
              Remboursements ({tx.repayments.length})
            </h2>
            <ul className="space-y-2">
              {tx.repayments.map((r: any, i: number) => (
                <RepaymentItem
                  key={i}
                  index={i}
                  repayment={r}
                  txTitle={tx.title}
                  txAmount={tx.amount}
                />
              ))}
            </ul>
          </div>
        )}

        {/* === SIGNATURES DU CONTRAT === */}
        {tx.signatures && tx.signatures.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FileSignature className="w-4 h-4" />
              Signatures du contrat ({tx.signatures.length}/2)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['owner', 'counterparty'] as const).map((role) => {
                const sig = tx.signatures!.find((s: any) => s.signerRole === role);
                return (
                  <div
                    key={role}
                    className={`border-2 rounded-lg p-3 ${
                      sig ? 'border-green-300 bg-green-50' : 'border-dashed border-gray-300 bg-gray-50'
                    }`}
                  >
                    <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                      {role === 'owner' ? 'Toi (owner)' : 'Contrepartie'}
                    </p>
                    {sig ? (
                      <>
                        <img
                          src={sig.signaturePng}
                          alt={`Signature de ${sig.signerName}`}
                          className="h-16 bg-white rounded mx-auto"
                        />
                        <p className="text-[10px] text-gray-500 mt-1 text-center">
                          {sig.signerName} · {new Date(sig.signedAt).toLocaleDateString('fr-FR')}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400 italic text-center py-3">En attente</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* === EVENTS === */}
        {tx.events && tx.events.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <History className="w-4 h-4" />
              Historique ({tx.events.length})
            </h2>
            <ol className="space-y-2">
              {tx.events.slice(-15).reverse().map((e: any, i: number) => (
                <li key={i} className="text-xs flex items-start gap-2">
                  <span className="text-gray-400 flex-shrink-0 w-20">
                    {new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </span>
                  <span className="flex-1">
                    <span className="font-semibold">{getEventLabel(e.type)}</span>
                    {e.signerName && <span className="text-gray-500"> · par {e.signerName}</span>}
                    {e.details && <span className="text-gray-500"> — {e.details}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* === ESPACE EN BAS === */}
        <div className="h-8" />
      </main>

      {/* === MODALE INVITER === */}
      {inviting && (
        <SignInviteModal
          userEmail={userEmail}
          transactionId={tx._id}
          counterpartyName={tx.counterpartyName}
          counterpartyPhone={tx.counterpartyPhone}
          transactionType={tx.type}
          transactionTitle={tx.title}
          transactionAmount={tx.amount}
          onClose={() => setInviting(false)}
          fullScreen
        />
      )}
    </div>
  );
};

// === BARRE DE PROGRESSION (style "camion qui avance") ===
const ProgressionBar: React.FC<{ percent: number; amountBg: string; isMoney: boolean }> = ({
  percent, amountBg, isMoney,
}) => {
  // Animate le remplissage
  const [animatedPercent, setAnimatedPercent] = useState(0);
  React.useEffect(() => {
    const t = setTimeout(() => setAnimatedPercent(percent), 100);
    return () => clearTimeout(t);
  }, [percent]);

  return (
    <div className="relative pt-6 pb-2">
      {/* La "route" */}
      <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${amountBg} transition-all duration-1000 ease-out rounded-full`}
          style={{ width: `${animatedPercent}%` }}
        />
      </div>
      {/* Le "camion" emoji qui avance sur la barre */}
      {isMoney && (
        <div
          className="absolute -top-1 transition-all duration-1000 ease-out text-2xl"
          style={{ left: `calc(${animatedPercent}% - 12px)` }}
        >
          🚚
        </div>
      )}
      {/* Labels sous la barre */}
      <div className="flex items-center justify-between mt-1 text-[10px] text-gray-500 uppercase tracking-wider">
        <span>Debut</span>
        <span className="font-bold text-gray-700">{Math.round(percent)}%</span>
        <span>Termine</span>
      </div>
    </div>
  );
};

// === LIGNE DE DETAIL ===
const DetailRow: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({
  icon, label, children,
}) => (
  <div className="flex items-start gap-2">
    <span className="text-gray-400 mt-0.5">{icon}</span>
    <span className="text-gray-500 min-w-[110px]">{label}:</span>
    <span className="flex-1 font-semibold text-gray-900">{children}</span>
  </div>
);

// === REMBOURSEMENT ITEM ===
const RepaymentItem: React.FC<{
  index: number;
  repayment: any;
  txTitle: string;
  txAmount?: number;
}> = ({ index, repayment: r, txTitle, txAmount }) => {
  const [expanded, setExpanded] = useState(false);
  const formatAmount = (n: number) =>
    n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const alreadySigned = !!r.counterpartySignature;
  const isLast = index === (txAmount ? Math.ceil(txAmount / r.amount) - 1 : 0);

  const copyRepaymentLink = () => {
    if (!r.signToken) return;
    const url = `${window.location.origin}/repayment/${r.signToken}`;
    navigator.clipboard.writeText(url)
      .then(() => alert('✓ Lien de signature copie !'))
      .catch(() => prompt('Copie ce lien :', url));
  };

  return (
    <li className={`border rounded-lg overflow-hidden ${alreadySigned ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}>
      <div className="flex items-center gap-3 p-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          alreadySigned ? 'bg-green-500 text-white' : 'bg-orange-100 text-orange-600'
        }`}>
          {alreadySigned ? <Check className="w-4 h-4" /> : <span className="text-sm font-bold">{index + 1}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">
            {formatAmount(r.amount)} €
          </p>
          <p className="text-xs text-gray-500">
            {formatDate(r.date)}
            {r.note && ` · ${r.note}`}
            {alreadySigned && r.counterpartySignature && (
              <span className="text-green-700"> · signe par {r.counterpartySignature.signerName}</span>
            )}
          </p>
        </div>
        {!alreadySigned && r.signToken && (
          <button
            onClick={copyRepaymentLink}
            className="text-xs text-blue-600 hover:underline whitespace-nowrap"
            title="Copier le lien de signature"
          >
            <Copy className="w-3 h-3 inline" /> Lien
          </button>
        )}
        {alreadySigned && (
          <span className="text-[10px] font-semibold text-green-700 uppercase tracking-wider">
            Signe
          </span>
        )}
      </div>
    </li>
  );
};

// === EVENT LABEL ===
function getEventLabel(type: string): string {
  switch (type) {
    case 'contract_sign_requested': return 'Invitation envoyee';
    case 'contract_signed': return 'Contrat signe';
    case 'repayment_added': return 'Remboursement ajoute';
    case 'repayment_signed': return 'Remboursement confirme';
    case 'item_returned': return 'Objet recupere';
    case 'service_done': return 'Service effectue';
    case 'annule': return 'Transaction annulee';
    default: return type;
  }
}

// === MESSAGE CENTRÉ ===
const CenterMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-orange-50 via-yellow-50 to-red-50">
    <div className="text-center max-w-md">{children}</div>
  </div>
);

export default TransactionDetailPage;
