import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  X, Banknote, CheckCircle2, Copy, Send, AlertCircle, ArrowRight,
} from 'lucide-react';

interface RepaymentModalProps {
  userEmail: string;
  transactionId: string;
  defaultAmount?: number;
  defaultNote?: string;
  creditorName: string;
  onClose: () => void;
}

/**
 * RepaymentModal — Enregistrer un versement (page plein ecran).
 *
 * 1. L'user saisit le montant verse (et une note facultative)
 * 2. Le versement est enregistre dans l'historique
 * 3. On propose le lien de confirmation a envoyer a la contrepartie :
 *    il signe pour confirmer avoir bien recu l'argent.
 */
const RepaymentModal: React.FC<RepaymentModalProps> = ({
  userEmail, transactionId, defaultAmount, defaultNote, creditorName, onClose,
}) => {
  const addRepaymentMut = useMutation(api.loans.addRepayment);
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : '');
  const [note, setNote] = useState(defaultNote || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signToken, setSignToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const parsed = Number.parseFloat(amount.replace(',', '.'));
  const valid = !Number.isNaN(parsed) && parsed > 0;

  const handleSubmit = async () => {
    if (!valid) {
      setError('Indique un montant supérieur à 0.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await addRepaymentMut({
        userEmail,
        transactionId: transactionId as any,
        amount: parsed,
        note: note.trim() || undefined,
      });
      setSignToken(res.signToken || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    if (!signToken) return;
    const url = `${window.location.origin}/repayment/${signToken}`;
    navigator.clipboard.writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => prompt('Copie ce lien :', url));
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-orange-50 via-yellow-50 to-red-50 overflow-y-auto">
      <div className="min-h-screen flex items-start justify-center p-4 sm:p-8">
        <div className="w-full max-w-lg">
          {/* === BARRE HAUTE === */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-orange-600" />
              {signToken ? 'Versement enregistré' : 'Enregistrer un versement'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-white rounded-lg"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {signToken ? (
            /* === ETAPE 2 : ENVOYER LA CONFIRMATION === */
            <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {parsed.toLocaleString('fr-FR')} € enregistrés
                </h3>
                <p className="text-sm text-gray-600">
                  Le solde de la dette a été mis à jour.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-900 mb-1">
                  Étape suivante : faire confirmer par {creditorName}
                </p>
                <p className="text-xs text-blue-800 mb-3">
                  Envoie-lui ce lien. En le signant, {creditorName} confirme avoir bien
                  reçu {parsed.toLocaleString('fr-FR')} €.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={copyLink}
                    className="flex-1 px-3 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5"
                  >
                    {copied ? <><CheckCircle2 className="w-4 h-4" /> Copié</> : <><Copy className="w-4 h-4" /> Copier le lien</>}
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Bonjour ${creditorName}, peux-tu me confirmer avoir reçu ${parsed.toLocaleString('fr-FR')} € ? ${window.location.origin}/repayment/${signToken}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-3 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-4 h-4" /> WhatsApp
                  </a>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold"
              >
                Fermer
              </button>
            </div>
          ) : (
            /* === ETAPE 1 : SAISIR LE MONTANT === */
            <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Montant versé (€)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500"
                  autoFocus
                  className="w-full px-4 py-3 text-2xl font-bold text-gray-900 border-2 border-orange-200 focus:border-orange-500 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Note (facultatif)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Mensualité de novembre"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={saving || !valid}
                className="w-full px-4 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-bold text-lg shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? 'Enregistrement…' : (
                  <>
                    Enregistrer le versement
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <button
                onClick={onClose}
                className="w-full px-4 py-2.5 text-gray-600 hover:bg-gray-50 rounded-lg font-medium text-sm"
              >
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RepaymentModal;
