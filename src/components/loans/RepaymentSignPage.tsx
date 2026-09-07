import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import SignaturePad from './SignaturePad';
import {
  ShieldCheck, AlertCircle, CheckCircle2, FileSignature,
  Mail, User, ArrowLeft, Banknote,
} from 'lucide-react';

interface RepaymentSignPageProps {
  signToken: string;
}

/**
 * RepaymentSignPage — Page accessible via /repayment/:signToken SANS auth.
 *
 * Affichee quand le proprietaire de la transaction (Freddy) envoie un lien
 * magique a la contrepartie (Francky) pour qu'il confirme avoir bien recu
 * un remboursement. La personne peut :
 *  - Voir le detail du remboursement (montant, date, contexte)
 *  - Signer avec le canvas + nom + email
 *
 * Pas d'auth requise : la securite repose sur le token (secret partage).
 */
const RepaymentSignPage: React.FC<RepaymentSignPageProps> = ({ signToken }) => {
  const data = useQuery(api.loans.getRepaymentBySignToken, { signToken });
  const signMut = useMutation(api.loans.signRepaymentByToken);
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signing, setSigning] = useState(false);
  const [signSuccess, setSignSuccess] = useState(false);

  if (data === undefined) {
    return <CenterMessage>Chargement...</CenterMessage>;
  }
  if (data === null) {
    return (
      <CenterMessage>
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Lien invalide</h1>
        <p className="text-gray-600">
          Ce lien de signature n'existe pas ou a expire.
        </p>
      </CenterMessage>
    );
  }

  const { repayment: r, transaction: tx, personName, ownerName } = data;
  const alreadySigned = !!r.counterpartySignature;
  const formatAmount = (n: number) =>
    n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const handleSign = async (sig: { png: string; hash: string }) => {
    if (!signerName.trim() || !signerEmail.trim()) {
      alert('Renseigne ton nom et ton email pour signer');
      return;
    }
    setSigning(true);
    try {
      await signMut({
        signToken,
        signerName: signerName.trim(),
        signerEmail: signerEmail.trim().toLowerCase(),
        signaturePng: sig.png,
        signatureHash: sig.hash,
      });
      setSignSuccess(true);
    } catch (e) {
      alert('Erreur : ' + (e instanceof Error ? e.message : 'inconnue'));
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-red-50">
      {/* === HEADER === */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-orange-100 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
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

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* === BANNIÈRE === */}
        {alreadySigned || signSuccess ? (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-green-900">Remboursement confirmé !</p>
              <p className="text-sm text-green-700">
                Merci d'avoir signé. {ownerName} a été notifié.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-4 flex items-start gap-3">
            <FileSignature className="w-6 h-6 text-blue-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-blue-900">Confirmation de remboursement</p>
              <p className="text-sm text-blue-700">
                {ownerName} te demande de confirmer avoir bien reçu un paiement.
              </p>
            </div>
          </div>
        )}

        {/* === DETAIL DU REMBOURSEMENT === */}
        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 text-green-700 rounded-full flex items-center justify-center flex-shrink-0">
              <Banknote className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-2xl font-bold text-gray-900">
                {formatAmount(r.amount)} €
              </p>
              <p className="text-sm text-gray-500">Montant du remboursement</p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
            <p>
              <span className="text-gray-500">Transaction :</span>{' '}
              <span className="font-semibold">{tx.title}</span>
            </p>
            <p>
              <span className="text-gray-500">De :</span>{' '}
              <span className="font-semibold">{ownerName}</span>
            </p>
            <p>
              <span className="text-gray-500">Vers :</span>{' '}
              <span className="font-semibold">{personName}</span>
            </p>
            <p>
              <span className="text-gray-500">Date du paiement :</span>{' '}
              <span className="font-semibold">{formatDate(r.date)}</span>
            </p>
            {r.note && (
              <p>
                <span className="text-gray-500">Note :</span>{' '}
                <span className="italic">« {r.note} »</span>
              </p>
            )}
          </div>
        </div>

        {/* === SIGNATURE === */}
        {!alreadySigned && !signSuccess && (
          <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-orange-600" />
              Signer pour confirmer
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              En signant ci-dessous, tu confirmes avoir bien reçu le paiement de {formatAmount(r.amount)} €.
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
                Enregistrement de la signature...
              </p>
            )}
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

// === MESSAGE CENTRÉ ===
const CenterMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-orange-50 via-yellow-50 to-red-50">
    <div className="text-center max-w-md">{children}</div>
  </div>
);

export default RepaymentSignPage;
