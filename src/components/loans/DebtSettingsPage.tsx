import React, { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  ArrowLeft, User, Mail, LogOut, ShieldCheck, HelpCircle, Wrench,
  AlertTriangle, Check, Info, Calendar, Wallet,
} from 'lucide-react';

interface DebtSettingsPageProps {
  userEmail: string;
  isAdmin: boolean;
  onBack: () => void;
  onSignOut: () => void;
}

const toDateInput = (ts?: number) =>
  ts ? new Date(ts).toISOString().slice(0, 10) : '';
const fromDateInput = (value: string) =>
  value ? new Date(value + 'T12:00:00').getTime() : undefined;

/**
 * DebtSettingsPage — Parametres de Suivi-dette.
 *
 * Sections :
 *  1. Mon compte (email Clerk, role)
 *  2. L'echeancier (montant mensuel, 1re echeance, nombre d'echeances)
 *     -> c'est ici qu'on rectifie le plan de remboursement si besoin
 *  3. Aide
 *  4. Securite
 *  5. Deconnexion
 */
const DebtSettingsPage: React.FC<DebtSettingsPageProps> = ({
  userEmail, isAdmin, onBack, onSignOut,
}) => {
  const { user } = useUser();
  const { openUserProfile } = useClerk();
  const overview = useQuery(api.debt.getDebtOverview, { userEmail });
  const updateMut = useMutation(api.loans.updateTransaction);
  const migrateMut = useMutation(api.migrate.migrateLegacyPizzaToSingleDebt);

  const debt = overview?.debt;
  const [monthly, setMonthly] = useState('');
  const [startDate, setStartDate] = useState('');
  const [count, setCount] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Remplit le formulaire une fois les donnees chargees
  useEffect(() => {
    if (!debt) return;
    setMonthly(debt.installmentAmount ? String(debt.installmentAmount) : '');
    setStartDate(toDateInput(debt.installmentStartDate));
    setCount(debt.installmentCount ? String(debt.installmentCount) : '');
  }, [debt]);

  const saveSchedule = async () => {
    if (!debt) return;
    setSaving(true);
    try {
      await updateMut({
        userEmail,
        transactionId: debt._id,
        installmentAmount: monthly ? Number(monthly) : undefined,
        installmentStartDate: startDate ? fromDateInput(startDate) : undefined,
        installmentCount: count ? Number(count) : undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert('Erreur : ' + (e instanceof Error ? e.message : 'inconnue'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* === RETOUR === */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" />
        Retour au suivi de la dette
      </button>

      {/* === HEADER === */}
      <div className="bg-white rounded-2xl shadow-lg p-6 flex items-start gap-4">
        <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center flex-shrink-0 text-white text-2xl">
          🚚
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
          <p className="text-sm text-gray-600 mt-0.5">Suivi-dette — la dette du camion pizza</p>
        </div>
      </div>

      {/* === MON COMPTE === */}
      <section className="bg-white rounded-2xl shadow-lg p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <User className="w-4 h-4" />
          Mon compte
        </h2>
        <Row label="Nom" value={user?.fullName || user?.firstName || 'Non renseigné'} />
        <Row label="Email" value={userEmail} icon={<Mail className="w-3.5 h-3.5" />} />
        <Row label="Rôle" value={isAdmin ? 'Administrateur (Freddy)' : 'Créancier (Francky)'} />
        <button
          onClick={() => openUserProfile()}
          className="w-full mt-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-semibold flex items-center justify-center gap-2"
        >
          <User className="w-4 h-4" />
          Modifier mon profil (Clerk)
        </button>
      </section>

      {/* === ECHEANCIER === */}
      {debt && (
        <section className="bg-white rounded-2xl shadow-lg p-5 space-y-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            Le plan de remboursement
          </h2>
          <p className="text-xs text-gray-500">
            Rectifie ici le plan si les mensualités changent (montant, date de départ,
            nombre d'échéances).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Mensualité (€)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                1re échéance
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nombre d'échéances
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          <button
            onClick={saveSchedule}
            disabled={saving}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saved ? (
              <><Check className="w-4 h-4" /> Enregistré</>
            ) : (
              <><Wallet className="w-4 h-4" /> {saving ? 'Enregistrement…' : 'Enregistrer le plan'}</>
            )}
          </button>
        </section>
      )}

      {/* === AIDE === */}
      <section className="bg-white rounded-2xl shadow-lg p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4" />
          Aide
        </h2>
        <HelpLink
          title="Suivre la dette"
          desc="Un seul écran : ce qui reste a payer, la prochaine echeance, l'echeancier complet et l'historique des versements."
        />
        <HelpLink
          title="Enregistrer un versement"
          desc="Clique sur « J'ai paye cette echeance » (ou « Enregistrer un autre versement ») : le solde se met a jour instantanement."
        />
        <HelpLink
          title="Faire confirmer par Francky"
          desc="Apres chaque versement, un lien de confirmation est propose : Francky le signe pour prouver qu'il a bien recu l'argent."
        />
        <HelpLink
          title="Le contrat"
          desc="Le contrat est genere automatiquement et signe par les deux parties. Le lien est prive : ne le partage pas."
        />
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Pour aller plus loin : voir le <strong>README</strong> du projet
            ou la documentation Convex sur dashboard.convex.dev.
          </span>
        </div>
      </section>

      {/* === OUTILS ADMIN (migration one-off) === */}
      {isAdmin && (
        <section className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
            <Wrench className="w-4 h-4" />
            Outils (admin)
          </h2>
          <p className="text-xs text-blue-800">
            Migration des anciennes donnees « camion pizza » vers la dette unique.
            A utiliser une seule fois.
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
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
          >
            <Wrench className="w-4 h-4" />
            Migrer les anciennes donnees
          </button>
        </section>
      )}

      {/* === SECURITE === */}
      <section className="bg-white rounded-2xl shadow-lg p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4" />
          Sécurité
        </h2>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800 flex items-start gap-2">
          <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Authentification via Clerk (Google / email). Toutes les données sont chiffrées en transit.
          </span>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            ⚠️ Le <strong>mode test 1234</strong> (bypass Clerk) est encore actif.
            À SUPPRIMER avant toute mise en production publique.
          </span>
        </div>
      </section>

      {/* === DECONNEXION === */}
      <section className="bg-white rounded-2xl shadow-lg p-5">
        <button
          onClick={onSignOut}
          className="w-full px-4 py-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
        <p className="text-[10px] text-gray-400 text-center mt-2">{userEmail}</p>
      </section>
    </div>
  );
};

// === COMPOSANTS INTERNES ===
const Row: React.FC<{ label: string; value: string; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="flex items-center justify-between gap-2 text-sm">
    <span className="text-gray-500 flex items-center gap-1">
      {icon}
      {label}
    </span>
    <span className="font-semibold text-gray-900 text-right">{value}</span>
  </div>
);

const HelpLink: React.FC<{ title: string; desc: string }> = ({ title, desc }) => (
  <div className="p-3 border border-gray-200 rounded-lg">
    <p className="font-semibold text-sm text-gray-900">{title}</p>
    <p className="text-xs text-gray-600 mt-0.5">{desc}</p>
  </div>
);

export default DebtSettingsPage;
