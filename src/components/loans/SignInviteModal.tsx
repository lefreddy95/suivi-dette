import React, { useState, useEffect } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  X, MessageCircle, Send, Copy, Check, Smartphone,
  Edit2, ExternalLink, AlertCircle, Loader2,
} from 'lucide-react';

interface SignInviteModalProps {
  // Email de l'owner (pour la mutation)
  userEmail: string;
  // Transaction concernée
  transactionId: string;
  // Nom de la contrepartie (pour pré-remplir)
  counterpartyName?: string;
  counterpartyPhone?: string;
  // Type de transaction (pour générer le bon message)
  transactionType: string;
  transactionTitle: string;
  transactionAmount?: number;
  // Callback quand l'envoi est fait
  onClose: () => void;
  onSent?: (method: 'whatsapp' | 'sms') => void;
}

/**
 * SignInviteModal — Modale d'envoi d'une invitation à signer.
 *
 * Reprend EXACTEMENT le pattern de la page Camion Pizza (openWhatsapp +
 * handleSendSms) : 2 canaux possibles, modale avec preview du message
 * éditable, numéro éditable.
 *
 * - WhatsApp : ouvre wa.me/<phone>?text=<message> dans un nouvel onglet
 * - SMS : appelle l'action Convex sendInvite qui relaie via le worker
 *   Pushbullet (même système que Pizza Truck)
 *
 * Le message est généré automatiquement à partir des infos de la
 * transaction (titre, montant, type) et contient toujours le lien public
 * /transaction/:token.
 */
const SignInviteModal: React.FC<SignInviteModalProps> = ({
  userEmail, transactionId, counterpartyName, counterpartyPhone,
  transactionType, transactionTitle, transactionAmount, onClose, onSent,
}) => {
  const sendInviteAct = useAction(api.loans.sendInvite);
  const setPhoneMut = useMutation(api.loans.setCounterpartyPhone);
  const [phone, setPhone] = useState(counterpartyPhone || '');
  const [editingPhone, setEditingPhone] = useState(!counterpartyPhone);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Génère le message par défaut au mount
  useEffect(() => {
    if (message) return;
    const typeLabel = transactionType === 'money_lent' ? 'Prêt d\'argent'
      : transactionType === 'money_borrowed' ? 'Emprunt d\'argent'
      : transactionType === 'item_lent' ? 'Prêt d\'objet'
      : transactionType === 'item_borrowed' ? 'Emprunt d\'objet'
      : transactionType === 'service_done' ? 'Service rendu'
      : 'Service reçu';
    const formatAmount = (n: number) =>
      n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const link = `${window.location.origin}/transaction/...`;
    let base = `💰 *${typeLabel}* — ${transactionTitle}`;
    if (transactionAmount) base += `\n\nMontant : *${formatAmount(transactionAmount)} €*`;
    base += `\n\n👉 Connecte-toi ici pour signer :\n${link}`;
    setMessage(base);
  }, [message, transactionType, transactionTitle, transactionAmount]);

  // Bloque le scroll derrière la modale
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Formate le numéro pour wa.me (juste chiffres, sans + ni espaces)
  const formatForWhatsApp = (p: string) => p.replace(/[^\d]/g, '');
  const canSend = phone.trim().length >= 8;  // au moins 8 chiffres

  const handleSendWhatsApp = () => {
    if (!canSend) {
      setError('Renseigne un numéro de téléphone valide');
      return;
    }
    const url = `https://wa.me/${formatForWhatsApp(phone)}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    onSent?.('whatsapp');
    onClose();
  };

  const handleSendSms = async () => {
    if (!canSend) {
      setError('Renseigne un numéro de téléphone valide');
      return;
    }
    setSending(true);
    setError(null);
    try {
      // Sauvegarde le numéro si modifié
      if (phone !== counterpartyPhone) {
        await setPhoneMut({ userEmail, transactionId: transactionId as any, phone });
      }
      // Envoie le SMS via Convex action (Pushbullet worker)
      await sendInviteAct({ userEmail, transactionId: transactionId as any });
      onSent?.('sms');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = async () => {
    // Extraire le lien du message pour le copier
    const linkMatch = message.match(/(https?:\/\/[^\s\n]+)/);
    if (linkMatch) {
      try {
        await navigator.clipboard.writeText(linkMatch[1]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // fallback
        prompt('Copie ce lien :', linkMatch[1]);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Send className="w-5 h-5 text-orange-600" />
              Inviter à signer
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Envoie un lien sécurisé à {counterpartyName || 'la contrepartie'} pour qu'il/elle signe
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Téléphone */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
            <Smartphone className="w-3.5 h-3.5" />
            Numéro de téléphone
          </label>
          {editingPhone ? (
            <div className="flex gap-2">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+33612345678"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                autoFocus
              />
              {counterpartyPhone && (
                <button
                  type="button"
                  onClick={() => setEditingPhone(false)}
                  className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                >
                  OK
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-700">
                {counterpartyPhone}
              </span>
              <button
                type="button"
                onClick={() => setEditingPhone(true)}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                title="Modifier"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Message */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">
              Message (éditable)
            </label>
            <button
              type="button"
              onClick={handleCopyLink}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              {copied ? <><Check className="w-3 h-3" /> Copié</> : <><Copy className="w-3 h-3" /> Copier le lien</>}
            </button>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono resize-none"
          />
          <p className="text-[10px] text-gray-500 mt-1">
            💡 Le lien est généré automatiquement à partir du token de la transaction.
          </p>
        </div>

        {/* Erreur */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          <button
            onClick={handleSendWhatsApp}
            disabled={!canSend}
            className="px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp
            <ExternalLink className="w-3 h-3 opacity-70" />
          </button>
          <button
            onClick={handleSendSms}
            disabled={!canSend || sending}
            className="px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
          >
            {sending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi...</>
              : <><Send className="w-4 h-4" /> SMS (vrai)</>}
          </button>
        </div>

        <p className="text-[10px] text-gray-400 text-center">
          WhatsApp ouvre une conversation pré-remplie. SMS envoie via ton téléphone Android
          (worker Pushbullet → MacroDroid). Les deux ajoutent un événement à la timeline.
        </p>
      </div>
    </div>
  );
};

export default SignInviteModal;
