import React, { useState } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  ArrowLeft, User, Mail, LogOut, Bell, Smartphone, ShieldCheck,
  HelpCircle, Wrench, AlertTriangle, Wrench as WrenchIcon, Check, Info,
} from 'lucide-react';

interface KuidiSettingsPageProps {
  userEmail: string;
  isAcheteur: boolean;
  onBack: () => void;
  onSignOut: () => void;
}

/**
 * KuidiSettingsPage — Parametres de l'app Kuidi (tracker de prets).
 *
 * SUCCEDE a SettingsPage (qui contenait les params de la dette legacy
 * camion-pizza : prix, mensualite, vendeur phone, etc.). Cette page est
 * adaptee a la nouvelle app Kuidi.
 *
 * Sections :
 *  1. Mon compte : nom, email (Clerk-managed, lecture seule)
 *  2. Notifications : preferences rappels (TODO Phase 2)
 *  3. Migration Kuidi : outils dev (migrer transaction camion)
 *  4. Aide : liens documentation
 *  5. Deconnexion
 */
const KuidiSettingsPage: React.FC<KuidiSettingsPageProps> = ({
  userEmail, isAcheteur, onBack, onSignOut,
}) => {
  const { user } = useUser();
  const { openUserProfile } = useClerk();
  const migrateCamionMut = useMutation(api.loans.migrateCamionToKuidi);
  const [migrating, setMigrating] = useState(false);
  // Prefs notifications (stockees en local pour l'instant, Phase 2 = backend)
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(3);

  return (
    <div className="space-y-4">
      {/* === BOUTON RETOUR === */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" />
        Retour au dashboard
      </button>

      {/* === HEADER === */}
      <div className="bg-white rounded-2xl shadow-lg p-6 flex items-start gap-4">
        <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center flex-shrink-0 text-white text-2xl">
          💰
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parametres</h1>
          <p className="text-sm text-gray-600 mt-0.5">Suivi-dette — tracker de prets multi-categorie</p>
        </div>
      </div>

      {/* === MON COMPTE === */}
      <section className="bg-white rounded-2xl shadow-lg p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <User className="w-4 h-4" />
          Mon compte
        </h2>
        <Row label="Nom" value={user?.fullName || user?.firstName || 'Non renseigne'} />
        <Row label="Email" value={userEmail} icon={<Mail className="w-3.5 h-3.5" />} />
        <Row label="Role" value={isAcheteur ? 'Administrateur (Freddy)' : 'Utilisateur'} />
        <button
          onClick={() => openUserProfile()}
          className="w-full mt-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-semibold flex items-center justify-center gap-2"
        >
          <User className="w-4 h-4" />
          Modifier mon profil (Clerk)
        </button>
      </section>

      {/* === NOTIFICATIONS === */}
      <section className="bg-white rounded-2xl shadow-lg p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <Bell className="w-4 h-4" />
          Notifications
        </h2>
        <p className="text-xs text-gray-500 -mt-1">Preferences (Phase 2 : backend)</p>
        <Toggle
          label="Notifications par email"
          description="Recapitulatif quotidien des echeances"
          icon={<Mail className="w-4 h-4" />}
          checked={notifyEmail}
          onChange={setNotifyEmail}
        />
        <Toggle
          label="Notifications par SMS"
          description="SMS 24h avant chaque echeance (via worker Pushbullet)"
          icon={<Smartphone className="w-4 h-4" />}
          checked={notifySms}
          onChange={setNotifySms}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rappel avant echeance (jours)
          </label>
          <input
            type="number"
            min="0"
            max="30"
            value={reminderDaysBefore}
            onChange={(e) => setReminderDaysBefore(parseInt(e.target.value || '0', 10))}
            className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </section>

      {/* === AIDE === */}
      <section className="bg-white rounded-2xl shadow-lg p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4" />
          Aide
        </h2>
        <HelpLink
          title="6 types de transactions"
          desc="Argent prete/emprunte, objet prete/emprunte, service rendu/recu"
        />
        <HelpLink
          title="Echeances et remboursements partiels"
          desc="Configure un montant + frequence, suis les paiements au fur et a mesure"
        />
        <HelpLink
          title="Signatures 2 parties"
          desc="Chaque transaction peut etre signee par toi ET la contrepartie via une URL partageable"
        />
        <HelpLink
          title="Envoi SMS / WhatsApp"
          desc="Envoie un lien de signature a l'autre personne en 1 clic"
        />
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Pour aller plus loin : voir le <strong>README</strong> du projet
            ou la documentation Convex sur dashboard.convex.dev.
          </span>
        </div>
      </section>

      {/* === MIGRATION KUIDI (admin only, dev) === */}
      {isAcheteur && (
        <section className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
            <Wrench className="w-4 h-4" />
            Migration Kuidi (admin)
          </h2>
          <p className="text-xs text-blue-800">
            Outils de migration de donnees. A utiliser avec precaution.
          </p>
          <button
            onClick={async () => {
              if (!window.confirm('Lancer la migration de la transaction "camion" ?')) return;
              setMigrating(true);
              try {
                const result = await migrateCamionMut({});
                alert(`✓ ${result.message}${result.migrated > 0 ? `\nID(s) : ${result.ids.join(', ')}` : ''}`);
              } catch (e) {
                alert('Erreur: ' + (e instanceof Error ? e.message : 'inconnue'));
              } finally {
                setMigrating(false);
              }
            }}
            disabled={migrating}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Wrench className="w-4 h-4" />
            {migrating ? 'Migration en cours...' : 'Migrer la transaction camion (legacy)'}
          </button>
          <p className="text-[10px] text-blue-700 italic">
            Idempotent : ne fait rien si deja migre.
          </p>
        </section>
      )}

      {/* === SECURITE === */}
      <section className="bg-white rounded-2xl shadow-lg p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4" />
          Securite
        </h2>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800 flex items-start gap-2">
          <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Authentification via Clerk (Google / email). Toutes les donnees sont chiffrees en transit.
          </span>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            ⚠️ Le <strong>mode test 1234</strong> (bypass Clerk) est encore actif.
            A SUPPRIMER avant toute mise en production publique.
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
          Se deconnecter
        </button>
        <p className="text-[10px] text-gray-400 text-center mt-2">
          {userEmail}
        </p>
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

const Toggle: React.FC<{
  label: string;
  description: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, description, icon, checked, onChange }) => (
  <label className="flex items-center justify-between gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
    <div className="flex items-start gap-2 flex-1 min-w-0">
      <div className="text-gray-500 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
        checked ? 'bg-orange-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  </label>
);

const HelpLink: React.FC<{ title: string; desc: string }> = ({ title, desc }) => (
  <div className="p-3 border border-gray-200 rounded-lg">
    <p className="font-semibold text-sm text-gray-900">{title}</p>
    <p className="text-xs text-gray-600 mt-0.5">{desc}</p>
  </div>
);

export default KuidiSettingsPage;
