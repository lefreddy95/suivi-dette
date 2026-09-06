import React, { useState, useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  X, HandCoins, Banknote, Package, PackageOpen, Wrench, WrenchIcon,
  Calendar, AlertCircle, StickyNote, CircleDollarSign,
} from 'lucide-react';

interface TransactionFormModalProps {
  userEmail: string;
  // Liste des personnes pour le select
  people: any[];
  // Personne pré-selectionnée (ex: depuis la fiche d'une personne)
  defaultPersonId?: string;
  // Type pré-sélectionné (ex: bouton "+ Argent prêté" sur le dashboard)
  defaultType?: TransactionType;
  onClose: () => void;
  onSaved: () => void;
}

type TransactionType =
  | 'money_lent' | 'money_borrowed'
  | 'item_lent' | 'item_borrowed'
  | 'service_done' | 'service_received';

const TYPES: Array<{
  value: TransactionType;
  label: string;
  short: string;
  icon: React.ReactNode;
  bg: string;
  text: string;
  hasAmount: boolean;
  hasItem: boolean;
  hasService: boolean;
}> = [
  {
    value: 'money_lent',
    label: 'Argent prêté',
    short: 'J\'ai prêté',
    icon: <HandCoins className="w-4 h-4" />,
    bg: 'bg-green-100', text: 'text-green-700',
    hasAmount: true, hasItem: false, hasService: false,
  },
  {
    value: 'money_borrowed',
    label: 'Argent emprunté',
    short: 'J\'ai emprunté',
    icon: <Banknote className="w-4 h-4" />,
    bg: 'bg-red-100', text: 'text-red-700',
    hasAmount: true, hasItem: false, hasService: false,
  },
  {
    value: 'item_lent',
    label: 'Objet prêté',
    short: 'J\'ai prêté',
    icon: <Package className="w-4 h-4" />,
    bg: 'bg-amber-100', text: 'text-amber-700',
    hasAmount: false, hasItem: true, hasService: false,
  },
  {
    value: 'item_borrowed',
    label: 'Objet emprunté',
    short: 'J\'ai emprunté',
    icon: <PackageOpen className="w-4 h-4" />,
    bg: 'bg-purple-100', text: 'text-purple-700',
    hasAmount: false, hasItem: true, hasService: false,
  },
  {
    value: 'service_done',
    label: 'Service rendu',
    short: 'J\'ai rendu',
    icon: <Wrench className="w-4 h-4" />,
    bg: 'bg-blue-100', text: 'text-blue-700',
    hasAmount: false, hasItem: false, hasService: true,
  },
  {
    value: 'service_received',
    label: 'Service reçu',
    short: 'On m\'a rendu',
    icon: <WrenchIcon className="w-4 h-4" />,
    bg: 'bg-cyan-100', text: 'text-cyan-700',
    hasAmount: false, hasItem: false, hasService: true,
  },
];

/**
 * TransactionFormModal — Modale de création d'une transaction.
 *
 * Gère les 6 types de transactions (money/item/service × lent/borrowed).
 * Champs affichés selon le type :
 *  - money_* : montant + date d'échéance
 *  - item_*  : description de l'objet + date d'échéance
 *  - service_* : description + heures logées + date du service + date d'échéance
 *
 * La personne est obligatoire et vient d'une liste préchargée.
 */
const TransactionFormModal: React.FC<TransactionFormModalProps> = ({
  userEmail, people, defaultPersonId, defaultType, onClose, onSaved,
}) => {
  const createMut = useMutation(api.loans.createTransaction);
  const [type, setType] = useState<TransactionType>(defaultType || 'money_lent');
  const [personId, setPersonId] = useState(defaultPersonId || '');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [hoursLogged, setHoursLogged] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Si pas de defaultPersonId, préselectionner la première personne
  useEffect(() => {
    if (!personId && people.length > 0) {
      setPersonId(people[0]._id);
    }
  }, [people, personId]);

  const typeInfo = TYPES.find((t) => t.value === type)!;

  const handleSave = async () => {
    if (!personId) {
      alert('Sélectionne une personne');
      return;
    }
    if (!title.trim()) {
      alert('Le titre est obligatoire');
      return;
    }
    if (typeInfo.hasAmount) {
      const num = parseFloat(amount);
      if (isNaN(num) || num <= 0) {
        alert('Le montant doit être supérieur à 0');
        return;
      }
    }
    setSaving(true);
    try {
      const startDateMs = startDate ? new Date(startDate).getTime() : undefined;
      const dueDateMs = dueDate ? new Date(dueDate).getTime() : undefined;
      await createMut({
        userEmail,
        personId: personId as any,
        type,
        title: title.trim(),
        amount: typeInfo.hasAmount ? parseFloat(amount) : undefined,
        startDate: startDateMs,
        dueDate: dueDateMs,
        itemDescription: typeInfo.hasItem ? itemDescription.trim() || undefined : undefined,
        hoursLogged: typeInfo.hasService && hoursLogged ? parseFloat(hoursLogged) : undefined,
        note: note.trim() || undefined,
      });
      onSaved();
    } catch (e) {
      alert('Erreur: ' + (e instanceof Error ? e.message : 'inconnue'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CircleDollarSign className="w-5 h-5 text-orange-600" />
            Nouvelle transaction
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* === TYPE (6 boutons) === */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type de transaction <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map((t) => {
              const active = type === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`px-3 py-2.5 rounded-lg border-2 text-left transition-all ${
                    active
                      ? `${t.bg} ${t.text} border-current`
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={active ? '' : 'text-gray-500'}>{t.icon}</span>
                    <span className="text-sm font-semibold">{t.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* === PERSONNE === */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Personne <span className="text-red-500">*</span>
          </label>
          {people.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Aucune personne. Va dans l'onglet "Personnes" pour en créer une d'abord.
              </span>
            </div>
          ) : (
            <select
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {people.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* === TITRE === */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Titre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              type === 'money_lent' ? 'Prêt pour les vacances' :
              type === 'money_borrowed' ? 'Emprunt pour la caution' :
              type === 'item_lent' ? 'Perceuse Bosch' :
              type === 'item_borrowed' ? 'Tente 2 places' :
              type === 'service_done' ? 'Déménagement' :
              'Réparation vélo'
            }
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        {/* === CHAMPS SPÉCIFIQUES SELON LE TYPE === */}
        {typeInfo.hasAmount && (
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
              placeholder="150"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-lg font-semibold"
            />
          </div>
        )}

        {typeInfo.hasItem && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description de l'objet
            </label>
            <input
              type="text"
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              placeholder="Perceuse sans fil 18V avec 2 batteries"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        )}

        {typeInfo.hasService && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Heures (optionnel)
            </label>
            <input
              type="number"
              value={hoursLogged}
              onChange={(e) => setHoursLogged(e.target.value)}
              min="0"
              step="0.5"
              placeholder="3.5"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        )}

        {/* === DATES === */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date <span className="text-gray-400 text-xs">(début)</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Échéance <span className="text-gray-400 text-xs">(opt.)</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={startDate}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        {/* === NOTE === */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <StickyNote className="w-3.5 h-3.5" />
            Note <span className="text-gray-400 text-xs">(optionnel)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Contexte, accord verbal, etc."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
          />
        </div>

        {/* === ACTIONS === */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim() || !personId}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {saving ? 'Création...' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionFormModal;
export { TYPES };
export type { TransactionType };
