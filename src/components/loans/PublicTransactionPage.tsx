import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import ContractDocument, { generateContractText } from './ContractDocument';
import SignaturePad from './SignaturePad';
import {
  ShieldCheck, AlertCircle, CheckCircle2, Clock, FileSignature,
  Mail, User, ArrowRight, Sparkles,
} from 'lucide-react';

interface PublicTransactionPageProps {
  token: string;
}

/**
 * PublicTransactionPage — Page accessible via /transaction/:token SANS auth.
 *
 * Affichée quand quelqu'un clique sur un lien partagé par l'owner.
 * La personne peut :
 *  - Voir le contrat complet (généré auto depuis la transaction)
 *  - Signer le contrat (canvas + nom + email)
 *  - Voir l'historique des remboursements
 *  - Confirmer chaque remboursement avec sa signature
 *
 * Pas d'auth requise : la sécurité repose sur le token (secret partagé).
 * Le token fait 24 chars alphanumériques (~143 bits d'entropie).
 */
const PublicTransactionPage: React.FC<PublicTransactionPageProps> = ({ token }) => {
  const data = useQuery(api.loans.getPublicTransaction, { token });
  const signMut = useMutation(api.loans.signPublicTransaction);
  const confirmRepaymentMut = useMutation(api.loans.confirmRepaymentPublic);
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signerRole, setSignerRole] = useState<'owner' | 'counterparty'>('counterparty');
  const [signing, setSigning] = useState(false);
  const [signSuccess, setSignSuccess] = useState(false);

  // Pre-remplir l'email si on sait qui est la contrepartie
  useEffect(() => {
    if (data?.transaction?.counterpartyEmail && !signerEmail) {
      setSignerEmail(data.transaction.counterpartyEmail);
    }
  }, [data, signerEmail]);

  // Determiner si l'email du signataire correspond a l'owner ou a la contrepartie.
  // IMPORTANT : declare ce useEffect AVANT les early returns, sinon violation
  // des Regles des Hooks (cf. memory : useEffect avant early returns).
  // Le callback reference 'tx' qui sera defini plus bas dans le scope — c'est
  // OK car le callback n'est execute qu'apres le render, quand 'tx' existe.
  useEffect(() => {
    const tx = data?.transaction;
    if (signerEmail && tx) {
      if (signerEmail.toLowerCase() === tx.ownerEmail.toLowerCase()) {
        setSignerRole('owner');
      } else {
        setSignerRole('counterparty');
      }
    }
  }, [signerEmail, data]);

  if (data === undefined) {
    return <CenterMessage>Chargement…</CenterMessage>;
  }
  if (data === null) {
    return (
      <CenterMessage>
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Lien invalide</h1>
        <p className="text-gray-600">
          Cette transaction n'existe pas ou le lien a expiré.
        </p>
      </CenterMessage>
    );
  }

  const { transaction: tx, ownerName, personName } = data;
  const isMoney = tx.type === 'money_lent' || tx.type === 'money_borrowed';
  const remaining = (tx.amount ?? 0) - tx.totalRepaid;
  const formatAmount = (n: number) =>
    n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Verifier si cette personne a deja signe
  const alreadySignedAsRole = (role: 'owner' | 'counterparty') =>
    tx.signatures?.some(
      (s: any) => s.signerRole === role
    ) ?? false;
  const hasOwnerSigned = alreadySignedAsRole('owner');
  const hasCounterpartySigned = alreadySignedAsRole('counterparty');
  const bothSigned = hasOwnerSigned && hasCounterpartySigned;

  const handleSign = async (sig: { png: string; hash: string }) => {
    if (!signerName.trim() || !signerEmail.trim()) {
      alert('Renseigne ton nom et ton email pour signer');
      return;
    }
    setSigning(true);
    try {
      const contractText = generateContractText(tx, ownerName, personName);
      await signMut({
        token,
        signerName: signerName.trim(),
        signerEmail: signerEmail.trim().toLowerCase(),
        signerRole,
        signaturePng: sig.png,
        signatureHash: sig.hash,
        contractText,
        ipAddress: undefined,
        userAgent: navigator.userAgent,
      });
      setSignSuccess(true);
    } catch (e) {
      alert('Erreur : ' + (e instanceof Error ? e.message : 'inconnue'));
    } finally {
      setSigning(false);
    }
  };

  const handleConfirmRepayment = async (
    repaymentIndex: number,
    sig: { png: string; hash: string }
  ) => {
    if (!signerName.trim() || !signerEmail.trim()) {
      alert('Renseigne ton nom et ton email avant de confirmer');
      return;
    }
    try {
      await confirmRepaymentMut({
        token,
        repaymentIndex,
        signerName: signerName.trim(),
        signerEmail: signerEmail.trim().toLowerCase(),
        signaturePng: sig.png,
        signatureHash: sig.hash,
      });
      alert('✓ Remboursement confirmé');
    } catch (e) {
      alert('Erreur : ' + (e instanceof Error ? e.message : 'inconnue'));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-red-50">
      {/* === HEADER === */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-orange-100 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <h1 className="text-lg font-bold text-gray-900">Suivi-dette</h1>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
            <span>Lien sécurisé</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* === BANNIÈRE DE STATUT === */}
        <StatusBanner
          hasOwnerSigned={hasOwnerSigned}
          hasCounterpartySigned={hasCounterpartySigned}
          ownerName={ownerName}
          personName={tx.counterpartyName || personName}
        />

        {/* === RÉSUMÉ RAPIDE === */}
        <div className="bg-white rounded-2xl shadow-lg p-5">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Résumé
          </h2>
          <div className="space-y-1.5 text-sm">
            <p>
              <span className="text-gray-500">De :</span>{' '}
              <span className="font-semibold">{ownerName}</span>{' '}
              <ArrowRight className="w-3 h-3 inline mx-1" />{' '}
              <span className="font-semibold">{tx.counterpartyName || personName}</span>
            </p>
            <p>
              <span className="text-gray-500">Objet :</span>{' '}
              <span className="font-semibold">{tx.title}</span>
            </p>
            {isMoney && tx.amount && (
              <p>
                <span className="text-gray-500">Montant total :</span>{' '}
                <span className="font-bold text-orange-700">
                  {formatAmount(tx.amount)} {tx.currency || 'EUR'}
                </span>
                {remaining > 0 && remaining < tx.amount && (
                  <span className="text-gray-500 text-xs ml-2">
                    (reste {formatAmount(remaining)} €)
                  </span>
                )}
              </p>
            )}
            {tx.installmentAmount && (
              <p>
                <span className="text-gray-500">Échéancier :</span>{' '}
                <span className="font-semibold">
                  {formatAmount(tx.installmentAmount)} {tx.currency || 'EUR'}{' '}
                  par {tx.installmentFrequency === 'weekly' ? 'semaine'
                    : tx.installmentFrequency === 'biweekly' ? '2 semaines'
                    : tx.installmentFrequency === 'monthly' ? 'mois'
                    : 'trimestre'}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* === CONTRAT === */}
        <ContractDocument
          transaction={tx}
          ownerName={ownerName}
          personName={personName}
        />

        {/* === SIGNATURE === */}
        {tx.status !== 'annule' && (
          <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-6">
            {signSuccess || bothSigned ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  {bothSigned ? 'Contrat signé par les 2 parties' : 'Signature enregistrée'}
                </h2>
                <p className="text-sm text-gray-600">
                  {bothSigned
                    ? '🎉 Ce contrat est désormais pleinement valide.'
                    : 'En attente de la signature de l\'autre partie.'}
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <FileSignature className="w-5 h-5 text-orange-600" />
                  Signer ce contrat
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  En signant, tu confirmes avoir lu et accepté les conditions ci-dessus.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      Ton nom complet
                    </label>
                    <input
                      type="text"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Jean Dupont"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      Ton email
                    </label>
                    <input
                      type="email"
                      value={signerEmail}
                      onChange={(e) => setSignerEmail(e.target.value)}
                      placeholder="jean@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <SignaturePad onSign={handleSign} disabled={signing} />

                {signing && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Enregistrement de la signature…
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* === HISTORIQUE DES REMBOURSEMENTS === */}
        {isMoney && tx.repayments && tx.repayments.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-3">
              Remboursements ({tx.repayments.length})
            </h2>
            <ul className="space-y-2">
              {tx.repayments.map((r: any, i: number) => (
                <RepaymentItem
                  key={i}
                  index={i}
                  repayment={r}
                  alreadySigned={!!r.counterpartySignature}
                  onConfirm={(sig) => handleConfirmRepayment(i, sig)}
                  signerName={signerName}
                  signerEmail={signerEmail}
                />
              ))}
            </ul>
          </div>
        )}

        {/* === FOOTER === */}
        <footer className="text-center text-xs text-gray-500 py-4">
          <p>
            💰 Suivi-dette · Cette page est privée et sécurisée par token.
          </p>
          <p className="mt-1 text-[10px] text-gray-400">
            Tu as reçu ce lien de la part de {ownerName}. Ne le partage pas.
          </p>
        </footer>
      </main>
    </div>
  );
};

// === BANNIÈRE DE STATUT ===
const StatusBanner: React.FC<{
  hasOwnerSigned: boolean;
  hasCounterpartySigned: boolean;
  ownerName: string;
  personName: string;
}> = ({ hasOwnerSigned, hasCounterpartySigned, ownerName, personName }) => {
  if (hasOwnerSigned && hasCounterpartySigned) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-4 flex items-start gap-3">
        <Sparkles className="w-6 h-6 text-green-600 flex-shrink-0" />
        <div>
          <p className="font-bold text-green-900">Contrat pleinement signé</p>
          <p className="text-sm text-green-700">
            Les deux parties se sont engagées. La transaction est officiellement reconnue.
          </p>
        </div>
      </div>
    );
  }
  if (hasOwnerSigned) {
    return (
      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3">
        <Clock className="w-6 h-6 text-amber-600 flex-shrink-0" />
        <div>
          <p className="font-bold text-amber-900">En attente de la signature de {personName}</p>
          <p className="text-sm text-amber-700">
            {ownerName} a déjà signé. Le contrat sera valide dès que {personName} signera aussi.
          </p>
        </div>
      </div>
    );
  }
  if (hasCounterpartySigned) {
    return (
      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3">
        <Clock className="w-6 h-6 text-amber-600 flex-shrink-0" />
        <div>
          <p className="font-bold text-amber-900">En attente de la signature de {ownerName}</p>
          <p className="text-sm text-amber-700">
            {personName} a déjà signé. Le contrat sera valide dès que {ownerName} signera aussi.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-orange-50 border-2 border-orange-300 rounded-2xl p-4 flex items-start gap-3">
      <FileSignature className="w-6 h-6 text-orange-600 flex-shrink-0" />
      <div>
        <p className="font-bold text-orange-900">Contrat à signer par les 2 parties</p>
        <p className="text-sm text-orange-700">
          Lis le contrat ci-dessous, puis signe en bas de page avec ton nom et ton email.
        </p>
      </div>
    </div>
  );
};

// === REMBOURSEMENT ITEM ===
const RepaymentItem: React.FC<{
  index: number;
  repayment: any;
  alreadySigned: boolean;
  onConfirm: (sig: { png: string; hash: string }) => void;
  signerName: string;
  signerEmail: string;
}> = ({ index, repayment, alreadySigned, onConfirm, signerName, signerEmail }) => {
  const [expanded, setExpanded] = useState(false);
  const formatAmount = (n: number) =>
    n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <li className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          alreadySigned ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {alreadySigned ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-sm font-bold">{index + 1}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {formatAmount(repayment.amount)} €
          </p>
          <p className="text-xs text-gray-500">
            {formatDate(repayment.date)}
            {repayment.note && ` · ${repayment.note}`}
          </p>
        </div>
        {alreadySigned ? (
          <div className="text-right">
            <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wider">Signé</p>
            <p className="text-[10px] text-gray-500">par {repayment.counterpartySignature.signerName}</p>
          </div>
        ) : (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:underline whitespace-nowrap"
          >
            {expanded ? 'Annuler' : 'Confirmer'}
          </button>
        )}
      </div>
      {expanded && !alreadySigned && (
        <div className="border-t border-gray-100 bg-gray-50 p-3">
          <p className="text-xs text-gray-600 mb-2">
            En signant ci-dessous, tu confirmes avoir bien reçu ce paiement de {formatAmount(repayment.amount)} €.
          </p>
          {(signerName && signerEmail) ? (
            <SignaturePad onSign={onConfirm} />
          ) : (
            <p className="text-xs text-amber-700">
              ⚠️ Renseigne ton nom et ton email dans la section "Signer ce contrat" plus haut avant de confirmer.
            </p>
          )}
        </div>
      )}
    </li>
  );
};

// === MESSAGE CENTRÉ ===
const CenterMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-orange-50 via-yellow-50 to-red-50">
    <div className="text-center max-w-md">{children}</div>
  </div>
);

export default PublicTransactionPage;
