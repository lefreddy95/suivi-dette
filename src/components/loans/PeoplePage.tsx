import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  Plus, Search, ChevronRight, User as UserIcon, Edit2, Trash2, X,
  Mail, Phone, StickyNote, Users as UsersIcon,
} from 'lucide-react';

interface PeoplePageProps {
  userEmail: string;
  onSelectPerson: (personId: string) => void;
}

/**
 * PeoplePage — Liste des personnes (contacts) du user.
 *
 * Affiche chaque personne avec son avatar (initiale + couleur), son
 * solde net (ce que le user lui doit ou ce que la personne lui doit),
 * et le nombre de transactions en cours.
 *
 * Permet de creer, editer et supprimer des personnes via la modale.
 */
const PeoplePage: React.FC<PeoplePageProps> = ({ userEmail, onSelectPerson }) => {
  const people = useQuery(api.loans.listPeople, { userEmail });
  const deleteMut = useMutation(api.loans.deletePerson);
  const [search, setSearch] = useState('');
  const [editingPerson, setEditingPerson] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  if (people === undefined) {
    return <div className="text-center py-12 text-gray-500">Chargement des personnes...</div>;
  }

  const filtered = people.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.phone?.includes(q) ||
      p.notes?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* === BARRE DE RECHERCHE + BOUTON AJOUTER === */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, email, telephone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
          />
        </div>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-semibold flex items-center gap-2 shadow-md flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouvelle</span>
        </button>
      </div>

      {/* === LISTE === */}
      {people.length === 0 ? (
        <EmptyPeople onCreate={() => setCreating(true)} />
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => (
            <PersonCard
              key={p._id}
              person={p}
              onClick={() => onSelectPerson(p._id)}
              onEdit={() => setEditingPerson(p)}
              onDelete={async () => {
                if (window.confirm(
                  `Supprimer "${p.name}" ?\n\n` +
                  'Cette action supprime aussi toutes les transactions et ' +
                  'reminders associés. IRREVERSIBLE.'
                )) {
                  try {
                    await deleteMut({ userEmail, personId: p._id });
                  } catch (e) {
                    alert('Erreur: ' + (e instanceof Error ? e.message : 'inconnue'));
                  }
                }
              }}
            />
          ))}
        </ul>
      )}

      {/* === MODALES === */}
      {creating && (
        <PersonFormModal
          userEmail={userEmail}
          onClose={() => setCreating(false)}
          onSaved={() => setCreating(false)}
        />
      )}
      {editingPerson && (
        <PersonFormModal
          userEmail={userEmail}
          person={editingPerson}
          onClose={() => setEditingPerson(null)}
          onSaved={() => setEditingPerson(null)}
        />
      )}
    </div>
  );
};

// === EMPTY STATE ===
const EmptyPeople: React.FC<{ onCreate: () => void }> = ({ onCreate }) => (
  <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
    <div className="w-16 h-16 bg-blue-50 rounded-full mx-auto mb-4 flex items-center justify-center">
      <UsersIcon className="w-8 h-8 text-blue-500" />
    </div>
    <h2 className="text-xl font-bold text-gray-900 mb-2">Aucune personne</h2>
    <p className="text-gray-600 mb-6 max-w-sm mx-auto">
      Cree ta premiere personne pour commencer à suivre tes prets, tes dettes
      et les services rendus.
    </p>
    <button
      onClick={onCreate}
      className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-semibold flex items-center gap-2 mx-auto"
    >
      <Plus className="w-4 h-4" />
      Creer une personne
    </button>
  </div>
);

// === CARTE PERSONNE ===
const PersonCard: React.FC<{
  person: any;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ person, onClick, onEdit, onDelete }) => {
  const initial = person.name.charAt(0).toUpperCase();
  const balance = person.netBalance || 0;
  const balanceAbs = Math.abs(balance);
  // Si balance > 0 : on me doit (vert)
  // Si balance < 0 : je dois (rouge)
  // Si = 0 : a l'equilibre
  const balanceLabel = balance === 0
    ? 'A l\'equilibre'
    : balance > 0
      ? 'On te doit'
      : 'Tu dois';
  const balanceColor = balance === 0
    ? 'text-gray-500'
    : balance > 0
      ? 'text-green-600'
      : 'text-red-600';

  return (
    <li className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 p-3">
        {/* Avatar (cliquable pour ouvrir le detail) */}
        <button onClick={onClick} className="flex-shrink-0">
          {person.avatarUrl ? (
            <img
              src={person.avatarUrl}
              alt={person.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: person.color }}
            >
              {initial}
            </div>
          )}
        </button>
        {/* Infos principales (cliquables) */}
        <button onClick={onClick} className="flex-1 min-w-0 text-left">
          <p className="font-bold text-gray-900 truncate">{person.name}</p>
          <p className="text-xs text-gray-500 truncate">
            {person.email || person.phone || (person.activeCount > 0 ? `${person.activeCount} transaction(s) en cours` : 'Aucun contact')}
          </p>
        </button>
        {/* Solde net */}
        <div className="text-right flex-shrink-0">
          {balance !== 0 && (
            <p className={`text-sm font-bold ${balanceColor}`}>
              {balanceAbs.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
            </p>
          )}
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">
            {balanceLabel}
          </p>
        </div>
        {/* Actions */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="Modifier"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="Supprimer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <button onClick={onClick} className="flex-shrink-0">
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>
    </li>
  );
};

// === MODALE CREATION/EDITION ===
const PersonFormModal: React.FC<{
  userEmail: string;
  person?: any;
  onClose: () => void;
  onSaved: () => void;
}> = ({ userEmail, person, onClose, onSaved }) => {
  const isEdit = !!person;
  const createMut = useMutation(api.loans.createPerson);
  const updateMut = useMutation(api.loans.updatePerson);
  const [name, setName] = useState(person?.name || '');
  const [email, setEmail] = useState(person?.email || '');
  const [phone, setPhone] = useState(person?.phone || '');
  const [notes, setNotes] = useState(person?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Le nom est obligatoire');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await updateMut({
          userEmail,
          personId: person._id,
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        await createMut({
          userEmail,
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      }
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
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-orange-600" />
            {isEdit ? 'Modifier la personne' : 'Nouvelle personne'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nom <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Francky, Maman, Paul..."
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" />
            Email <span className="text-gray-400 text-xs">(optionnel)</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="francky@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <Phone className="w-3.5 h-3.5" />
            Telephone <span className="text-gray-400 text-xs">(optionnel)</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+33612345678"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <StickyNote className="w-3.5 h-3.5" />
            Notes <span className="text-gray-400 text-xs">(optionnel)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="ami d'enfance, voisin, collegue..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
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
            disabled={saving || !name.trim()}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : isEdit ? 'Modifier' : 'Creer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PeoplePage;
