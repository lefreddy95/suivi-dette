import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import SignInviteModal from './SignInviteModal';
import RepaymentModal from './RepaymentModal';
import {
  Truck, Calendar, CheckCircle2, Send, Copy, ExternalLink,
  FileSignature, ChevronDown, ChevronUp, History, Banknote,
  PenLine, Wallet, Settings2,
} from 'lucide-react';

// === HELPERS DE FORMATAGE (module scope : utilises par les sous-composants) ===
const formatEUR = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const formatDateShort = (ts: number) =>
  new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

interface DebtHomePageProps {
  userEmail: string;
  onOpenSettings: () => void;
}

/**
 * DebtHomePage — LA page de l'app : le suivi de la dette du camion pizza.
 *
 * Tout est sur un seul ecran :
 *   1. Le montant qui reste a payer (le plus gros, lisible en 1 seconde)
 *   2. La prochaine echeance + le bouton pour dire "je l'ai payee"
 *   3. L'echeancier complet (repliable)
 *   4. Les versements deja faits (+ lien de confirmation pour la contrepartie)
 *   5. Le contrat (signatures des 2 parties)
 *   6. L'historique des evenements
 *
 * La perspective s'adapte : Freddy (debiteur) voit "il te reste X a payer",
 * Francky (creancier) voit "Freddy te doit X".
 */
const DebtHomePage: React.FC<DebtHomePageProps> = ({ userEmail, onOpenSettings }) => {
  const data = useQuery(api.debt.getDebtOverview, { userEmail });
  const migrateMut = useMutation(api.migrate.migrateLegacyPizzaToSingleDebt);
  const [showRepayment, setShowRepayment] = useState(false);
  const [repaymentPreset, setRepaymentPreset] = useState<{ amount?: number; note?: string }>({});
  const [showInvite, setShowInvite] = useState(false);
  const [showAllSchedule, setShowAllSchedule] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
      })
      .catch(() => prompt('Copie ce lien :', text));
  };

  // === CHARGEMENT ===
  if (data === undefined) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 h-40 animate-pulse bg-gray-50" />
        <div className="bg-white rounded-2xl shadow-lg p-5 h-24 animate-pulse bg-gray-50" />
      </div>
    );
  }

  // === PAS ENCORE DE DETTE EN BASE ===
  if (data === null) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Truck className="w-8 h-8 text-orange-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Aucune dette enregistrée</h1>
        <p className="text-sm text-gray-600 mb-4">
          Les données du contrat camion pizza (30 000 €, 500 €/mois, 5 000 € versés en
          septembre et 500 € en octobre) doivent être migrées une première fois.
        </p>
        <button
          onClick={async () => {
            try {
              const res = await migrateMut({ userEmail });
              alert(res.message || (res.migrated ? 'Migration OK' : 'Rien a faire'));
            } catch (e) {
              alert('Erreur : ' + (e instanceof Error ? e.message : 'inconnue'));
            }
          }}
          className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-semibold"
        >
          Migrer la dette du camion pizza
        </button>
      </div>
    );
  }

  const { debt, summary, schedule, payments, isOwner } = data;
  const creditor = debt.counterpartyName || 'Francky';
  const debtor = debt.ownerName || 'Freddy';
  const publicUrl = debt.publicToken
    ? `${window.location.origin}/transaction/${debt.publicToken}`
    : '';
  const next = summary.next;
  const visibleSchedule = showAllSchedule ? schedule : schedule.slice(0, 8);

  return (
    <div className="space-y-4">
      {/* ================================================================
       * 1. LE MONTANT QUI RESTE A PAYER
       * ================================================================ */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
          {isOwner ? 'Reste à payer' : 'Tu es créancier'}
        </p>
        <h1 className="text-4xl font-extrabold text-red-600 mb-1">
          {formatEUR(summary.remaining)} €
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          {isOwner ? (
            <>
              Il te reste <strong>{formatEUR(summary.remaining)} €</strong> à payer à{' '}
              <strong>{creditor}</strong> pour le {debt.title.toLowerCase()}.
            </>
          ) : (
            <>
              <strong>{debtor}</strong> te doit <strong>{formatEUR(summary.remaining)} €</strong>{' '}
              sur le {debt.title.toLowerCase()}.
            </>
          )}
        </p>

        {/* Barre de progression */}
        <div className="relative pt-6 pb-2">
          <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all duration-1000 ease-out rounded-full"
              style={{ width: `${summary.percent}%` }}
            />
          </div>
          <div
            className="absolute -top-1 transition-all duration-1000 ease-out text-2xl"
            style={{ left: `calc(${summary.percent}% - 12px)` }}
          >
            🚚
          </div>
          <div className="flex items-center justify-between mt-1 text-[10px] text-gray-500 uppercase tracking-wider">
            <span>Début</span>
            <span className="font-bold text-gray-700">{summary.percent}% remboursé</span>
            <span>Terminé</span>
          </div>
        </div>

        {/* 3 chiffres clés */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <StatTile
            icon={<Wallet className="w-4 h-4 text-orange-600" />}
            label="Total"
            value={`${formatEUR(summary.total)} €`}
          />
          <StatTile
            icon={<CheckCircle2 className="w-4 h-4 text-green-600" />}
            label="Déjà versé"
            value={`${formatEUR(summary.paid)} €`}
          />
          <StatTile
            icon={<Calendar className="w-4 h-4 text-blue-600" />}
            label="Mensualité"
            value={`${formatEUR(summary.monthly)} €`}
          />
        </div>
        {summary.endDate && (
          <p className="text-xs text-gray-500 mt-3 text-center">
            {summary.installmentsPaid} échéance(s) sur {summary.installmentsTotal} payée(s) ·
            fin prévue le <strong>{formatDate(summary.endDate)}</strong>
          </p>
        )}
      </div>

      {/* ================================================================
       * 2. PROCHAINE ECHEANCE + ACTIONS
       * ================================================================ */}
      {next ? (
        <div
          className={`rounded-2xl shadow-lg p-5 border-2 ${
            summary.overdue ? 'bg-red-50 border-red-300' : 'bg-white border-orange-200'
          }`}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Prochaine échéance
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {formatEUR(next.amount)} € le {formatDate(next.date)}
                </p>
                <p className="text-xs text-gray-500">
                  Échéance n°{next.num} sur {summary.installmentsTotal}
                  {summary.overdue && (
                    <span className="text-red-600 font-semibold"> · en retard</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {isOwner ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setRepaymentPreset({
                    amount: next.amount,
                    note: `Mensualité de ${new Date(next.date).toLocaleDateString('fr-FR', { month: 'long' })}`,
                  });
                  setShowRepayment(true);
                }}
                className="px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-md"
              >
                <CheckCircle2 className="w-5 h-5" />
                J'ai payé cette échéance
              </button>
              <button
                onClick={() => {
                  setRepaymentPreset({});
                  setShowRepayment(true);
                }}
                className="px-4 py-3 bg-white hover:bg-gray-50 border-2 border-orange-300 text-orange-700 rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                <Banknote className="w-5 h-5" />
                Enregistrer un autre versement
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-md"
              >
                <CheckCircle2 className="w-5 h-5" />
                Confirmer un versement reçu
              </a>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-3 bg-white hover:bg-gray-50 border-2 border-orange-300 text-orange-700 rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                <FileSignature className="w-5 h-5" />
                Voir et signer le contrat
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-green-50 border-2 border-green-300 rounded-2xl shadow-lg p-5 flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-bold text-green-900">Dette soldée 🎉</p>
            <p className="text-sm text-green-700">
              Les {formatEUR(summary.total)} € ont été remboursés. Le contrat reste consultable
              ci-dessous.
            </p>
          </div>
        </div>
      )}

      {/* ================================================================
       * 3. LE CONTRAT (signatures des 2 parties)
       * ================================================================ */}
      <div className="bg-white rounded-2xl shadow-lg p-5">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <FileSignature className="w-4 h-4" />
          Le contrat
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <SignatureSlot
            label={`${debtor} (débiteur)`}
            signature={debt.signatures.find((s: any) => s.signerRole === 'owner')}
          />
          <SignatureSlot
            label={`${creditor} (créancier)`}
            signature={debt.signatures.find((s: any) => s.signerRole === 'counterparty')}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {isOwner && (
            <button
              onClick={() => setShowInvite(true)}
              className="px-3 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 text-sm shadow-md"
            >
              <Send className="w-4 h-4" />
              Envoyer à {creditor}
            </button>
          )}
          <button
            onClick={() => copy(publicUrl, 'contract')}
            className="px-3 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 text-sm shadow-md"
          >
            {copied === 'contract' ? <><CheckCircle2 className="w-4 h-4" /> Copié</> : <><Copy className="w-4 h-4" /> Copier le lien</>}
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 text-sm shadow-md"
          >
            <ExternalLink className="w-4 h-4" />
            Ouvrir la page
          </a>
        </div>
      </div>

      {/* ================================================================
       * 4. L'ECHEANCIER
       * ================================================================ */}
      {schedule.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Échéancier ({schedule.length})
            </h2>
            {schedule.length > 8 && (
              <button
                onClick={() => setShowAllSchedule(!showAllSchedule)}
                className="text-xs font-semibold text-orange-600 hover:underline flex items-center gap-1"
              >
                {showAllSchedule ? (
                  <>Réduire <ChevronUp className="w-3 h-3" /></>
                ) : (
                  <>Tout voir ({schedule.length}) <ChevronDown className="w-3 h-3" /></>
                )}
              </button>
            )}
          </div>
          <button
            onClick={onOpenSettings}
            className="mb-3 text-xs font-semibold text-gray-500 hover:text-orange-600 flex items-center gap-1"
            title="Modifier le montant, la date de départ ou le nombre d'échéances"
          >
            <Settings2 className="w-3 h-3" /> Modifier le plan de remboursement
          </button>
          <ul className="space-y-1.5">
            {visibleSchedule.map((s: any) => (
              <li
                key={s.num}
                className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                  s.status === 'payee'
                    ? 'border-green-200 bg-green-50/60'
                    : s.status === 'en_retard'
                    ? 'border-red-300 bg-red-50'
                    : s.status === 'partielle'
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    s.status === 'payee'
                      ? 'bg-green-500 text-white'
                      : s.status === 'en_retard'
                      ? 'bg-red-500 text-white'
                      : 'bg-orange-100 text-orange-700'
                  }`}
                >
                  {s.status === 'payee' ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatEUR(s.amount)} €
                    <span className="font-normal text-gray-500"> · {formatDateShort(s.date)}</span>
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {s.status === 'payee'
                      ? `Payée${s.paymentDate ? ` le ${formatDateShort(s.paymentDate)}` : ''}`
                      : s.status === 'en_retard'
                      ? 'En retard'
                      : s.status === 'partielle'
                      ? `Partiellement payée (${formatEUR(s.paid)} €)`
                      : 'À payer'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ================================================================
       * 5. LES VERSEMENTS DEJA FAITS
       * ================================================================ */}
      <div className="bg-white rounded-2xl shadow-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Banknote className="w-4 h-4" />
            Versements ({payments.length})
          </h2>
          {isOwner && (
            <button
              onClick={() => {
                setRepaymentPreset({});
                setShowRepayment(true);
              }}
              className="text-xs font-semibold text-orange-600 hover:underline flex items-center gap-1"
            >
              <PenLine className="w-3 h-3" /> Ajouter
            </button>
          )}
        </div>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun versement enregistré pour l'instant.</p>
        ) : (
          <ul className="space-y-2">
            {payments.map((p: any, i: number) => (
              <li
                key={i}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  p.signed ? 'border-green-200 bg-green-50/40' : 'border-gray-200'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    p.signed ? 'bg-green-500 text-white' : 'bg-orange-100 text-orange-600'
                  }`}
                >
                  {p.signed ? <CheckCircle2 className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{formatEUR(p.amount)} €</p>
                  <p className="text-xs text-gray-500">
                    {formatDateShort(p.date)}
                    {p.note && ` · ${p.note}`}
                    {p.offSchedule && (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-semibold">
                        acompte
                      </span>
                    )}
                  </p>
                  {p.signed && (
                    <p className="text-[11px] text-green-700">
                      Confirmé reçu par {p.signedBy}
                    </p>
                  )}
                </div>
                {!p.signed && p.signToken && (
                  <button
                    onClick={() => copy(`${window.location.origin}/repayment/${p.signToken}`, `pay-${i}`)}
                    className="text-xs text-blue-600 hover:underline whitespace-nowrap flex items-center gap-1"
                    title="Copier le lien de confirmation"
                  >
                    {copied === `pay-${i}` ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    Confirmer
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ================================================================
       * 6. HISTORIQUE
       * ================================================================ */}
      {debt.events.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4" />
              Historique
            </h2>
            {debt.events.length > 5 && (
              <button
                onClick={() => setShowAllEvents(!showAllEvents)}
                className="text-xs font-semibold text-orange-600 hover:underline flex items-center gap-1"
              >
                {showAllEvents ? 'Réduire' : 'Tout voir'}
              </button>
            )}
          </div>
          <ol className="space-y-2">
            {(showAllEvents ? [...debt.events].reverse() : [...debt.events].reverse().slice(0, 5)).map(
              (e: any, i: number) => (
                <li key={i} className="text-xs flex items-start gap-2">
                  <span className="text-gray-400 flex-shrink-0 w-20">
                    {formatDateShort(e.date)}
                  </span>
                  <span className="flex-1">
                    <span className="font-semibold text-gray-900">{eventLabel(e.type)}</span>
                    {e.details && <span className="text-gray-500"> — {e.details}</span>}
                  </span>
                </li>
              )
            )}
          </ol>
        </div>
      )}

      <div className="h-4" />

      {/* ================================================================
       * MODALES
       * ================================================================ */}
      {showRepayment && (
        <RepaymentModal
          userEmail={userEmail}
          transactionId={debt._id}
          defaultAmount={repaymentPreset.amount}
          defaultNote={repaymentPreset.note}
          creditorName={creditor}
          onClose={() => setShowRepayment(false)}
        />
      )}

      {showInvite && (
        <SignInviteModal
          userEmail={userEmail}
          transactionId={debt._id}
          counterpartyName={creditor}
          counterpartyPhone={debt.counterpartyPhone}
          transactionType={debt.type}
          transactionTitle={debt.title}
          transactionAmount={debt.amount}
          onClose={() => setShowInvite(false)}
          fullScreen
        />
      )}
    </div>
  );
};

// === TUILE DE STAT ===
const StatTile: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({
  icon, label, value,
}) => (
  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
    <div className="flex items-center justify-center gap-1 mb-1">{icon}</div>
    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</p>
    <p className="text-sm font-bold text-gray-900">{value}</p>
  </div>
);

// === EMPLACEMENT DE SIGNATURE ===
const SignatureSlot: React.FC<{ label: string; signature?: any }> = ({ label, signature }) => {
  if (!signature) {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center">
        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
          {label}
        </p>
        <div className="h-14 flex items-center justify-center">
          <p className="text-xs text-gray-400 italic">En attente de signature</p>
        </div>
      </div>
    );
  }
  return (
    <div className="border-2 border-green-300 bg-green-50 rounded-lg p-3 text-center">
      <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wider mb-1">
        {label}
      </p>
      {signature.signaturePng ? (
        <img
          src={signature.signaturePng}
          alt={`Signature de ${signature.signerName}`}
          className="h-14 bg-white rounded mx-auto"
        />
      ) : (
        <p className="text-xs text-green-700 italic py-2">Signé le contrat d'origine</p>
      )}
      <p className="text-[10px] text-gray-500 mt-1">
        {signature.signerName} · {formatDateShort(signature.signedAt)}
      </p>
    </div>
  );
};

// === LIBELLE DES EVENEMENTS ===
function eventLabel(type: string): string {
  switch (type) {
    case 'contract_sign_requested': return 'Invitation envoyée';
    case 'contract_signed': return 'Contrat signé';
    case 'repayment_added': return 'Versement ajouté';
    case 'repayment_signed': return 'Versement confirmé';
    default: return type;
  }
}

export default DebtHomePage;
