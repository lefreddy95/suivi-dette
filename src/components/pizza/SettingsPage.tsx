import React, { useEffect, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  Settings, Save, X, MessageCircle, Calendar, Upload, Camera, Image as ImageIcon,
  AlertTriangle, RefreshCw, FileSignature, Wrench,
} from 'lucide-react';

const ACHETEUR_EMAIL = 'lefreddy95@gmail.com';
const VENDEUR_EMAIL = 'franckylobry6@gmail.com';

interface SettingsPageProps {
  config: any;
  userEmail: string;
  isAcheteur: boolean;
  onClose: () => void;
  onSaved: () => void;
  // Actions admin supplementaires (botons dangers)
  onRecalculate: () => void;
  onResetContract?: () => void;
}

/**
 * SettingsPage — Page dediee pleine ecran pour les parametres.
 *
 * Remplace l'ancien EditConfigModal (qui etait trop petit / sortait de l'ecran
 * sur petits viewports). Toute la config (nom du camion, prix, mensualites,
 * date de demarrage, photos, telephone vendeur) peut etre editee ici.
 *
 * Accessible seulement a l'acheteur (les autres utilisateurs voient un message
 * "acces refuse"). Les champs non-autorises (emails acheteur/vendeur) sont
 * bloques en lecture seule pour eviter une modification accidentelle de la
 * whitelist.
 */
const SettingsPage: React.FC<SettingsPageProps> = ({
  config, userEmail, isAcheteur, onClose, onSaved,
  onRecalculate, onResetContract,
}) => {
  const updateConfigMut = useMutation(api.pizza.updateConfig);
  const migrateCamionMut = useMutation(api.loans.migrateCamionToKuidi);
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // === ÉTATS LOCAUX (formulaire) ===
  const [prixTotal, setPrixTotal] = useState(config.prixTotal);
  const [montantMensuel, setMontantMensuel] = useState(config.montantMensuel);
  const [nomCamion, setNomCamion] = useState(config.nomCamion);
  const [dateDebut, setDateDebut] = useState<string>(
    new Date(config.dateDebut).toISOString().split('T')[0]
  );
  const [acheteurNom, setAcheteurNom] = useState(config.acheteurNom || 'Freddy');
  const [vendeurNom, setVendeurNom] = useState(config.vendeurNom || 'Francky');
  const [acheteurEmail] = useState(config.acheteurEmail || ACHETEUR_EMAIL);
  const [vendeurEmail] = useState(config.vendeurEmail || VENDEUR_EMAIL);
  const [acheteurPhotoUrl, setAcheteurPhotoUrl] = useState(config.acheteurPhotoUrl || '');
  const [vendeurPhotoUrl, setVendeurPhotoUrl] = useState(config.vendeurPhotoUrl || '');
  const [vendeurPhone, setVendeurPhone] = useState(config.vendeurPhone || '');
  const [uploadingAcheteur, setUploadingAcheteur] = useState(false);
  const [uploadingVendeur, setUploadingVendeur] = useState(false);

  // === UPLOAD PHOTO ===
  const handlePhotoUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string) => void,
    setLoading?: (loading: boolean) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Le fichier doit etre une image (JPG, PNG, WebP...)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Image trop grosse (> 2 Mo). Compresse-la avant de l\'uploader.');
      return;
    }
    if (setLoading) setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setter(reader.result as string);
      if (setLoading) setLoading(false);
    };
    reader.onerror = () => {
      alert('Erreur de lecture du fichier');
      if (setLoading) setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  // === HELPERS ===
  const prixChanged = prixTotal !== config.prixTotal;
  const mensuelChanged = montantMensuel !== config.montantMensuel;
  const prixOuMensuelChanged = prixChanged || mensuelChanged;
  const dateDebutChanged = dateDebut !== new Date(config.dateDebut).toISOString().split('T')[0];

  const handleSave = async () => {
    if (!userEmail) return;
    // Avertissement si prix ou mensuel change (impact le calendrier)
    if (prixChanged) {
      const ok = window.confirm(
        `Confirmer le changement de prix total ?\n\n` +
        `Actuel : ${config.prixTotal.toLocaleString('fr-FR')} €\n` +
        `Nouveau : ${prixTotal.toLocaleString('fr-FR')} €\n\n` +
        `Le calendrier des mensualites ne sera PAS recalcule automatiquement.\n` +
        `Utilise le bouton 'Recalculer' plus bas pour regenerer le calendrier.`
      );
      if (!ok) return;
    }
    if (mensuelChanged) {
      const ok = window.confirm(
        `Confirmer le changement de montant mensuel ?\n\n` +
        `Actuel : ${config.montantMensuel.toLocaleString('fr-FR')} €\n` +
        `Nouveau : ${montantMensuel.toLocaleString('fr-FR')} €\n\n` +
        `Idem : utilise 'Recalculer' pour regenerer le calendrier.`
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      await updateConfigMut({
        userEmail,
        prixTotal: prixChanged ? prixTotal : undefined,
        montantMensuel: mensuelChanged ? montantMensuel : undefined,
        nomCamion,
        dateDebut: dateDebutChanged ? new Date(dateDebut).getTime() : undefined,
        acheteurNom,
        vendeurNom,
        acheteurPhotoUrl,
        vendeurPhotoUrl,
        vendeurPhone,
        // Emails : on ne patche que si different (pour eviter un round-trip inutile)
        acheteurEmail: acheteurEmail !== config.acheteurEmail ? acheteurEmail : undefined,
        vendeurEmail: vendeurEmail !== config.vendeurEmail ? vendeurEmail : undefined,
      });
      setSavedAt(Date.now());
      onSaved();
    } catch (e) {
      alert('Erreur: ' + (e instanceof Error ? e.message : 'inconnue'));
    } finally {
      setSaving(false);
    }
  };

  // === ACCÈS REFUSÉ ===
  if (!isAcheteur) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acces refuse</h1>
          <p className="text-gray-600 mb-6">
            Seul l'acheteur (Freddy) peut modifier les parametres du contrat.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  // === RENDER ===
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-red-50">
      {/* === HEADER === */}
      <header className="bg-white border-b-2 border-orange-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-orange-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Parametres du contrat</h1>
              <p className="text-xs text-gray-500">Configuration globale de l'app</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Retour"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* === STATUT SAUVEGARDE === */}
        {savedAt && (
          <div className="bg-green-50 border-2 border-green-300 rounded-xl p-3 flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <Save className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm text-green-800">
              Modifications enregistrees a {new Date(savedAt).toLocaleTimeString('fr-FR')}.
            </p>
          </div>
        )}

        {/* === SECTION 1 : IDENTIFICATION === */}
        <section className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">1</span>
            Identification du camion
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom du camion pizza
            </label>
            <input
              type="text"
              value={nomCamion}
              onChange={(e) => setNomCamion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Le Petit Four"
            />
          </div>
        </section>

        {/* === SECTION 2 : PARTIES === */}
        <section className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">2</span>
            Parties (Acheteur & Vendeur)
          </h2>

          {/* ACHETEUR */}
          <div className="border-l-4 border-blue-500 pl-4 py-2 space-y-3">
            <p className="text-xs uppercase tracking-wider text-blue-800 font-bold">Acheteur</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nom</label>
                <input
                  type="text"
                  value={acheteurNom}
                  onChange={(e) => setAcheteurNom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Email <span className="text-gray-400">(whitelist, ne pas modifier)</span>
                </label>
                <input
                  type="email"
                  value={acheteurEmail}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed text-sm"
                />
              </div>
            </div>
            <PhotoField
              label="Photo de profil"
              value={acheteurPhotoUrl}
              onChange={setAcheteurPhotoUrl}
              loading={uploadingAcheteur}
              onUpload={(e) => handlePhotoUpload(e, setAcheteurPhotoUrl, setUploadingAcheteur)}
            />
          </div>

          {/* VENDEUR */}
          <div className="border-l-4 border-purple-500 pl-4 py-2 space-y-3">
            <p className="text-xs uppercase tracking-wider text-purple-800 font-bold">Vendeur</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nom</label>
                <input
                  type="text"
                  value={vendeurNom}
                  onChange={(e) => setVendeurNom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Email <span className="text-gray-400">(whitelist, ne pas modifier)</span>
                </label>
                <input
                  type="email"
                  value={vendeurEmail}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed text-sm"
                />
              </div>
            </div>
            <PhotoField
              label="Photo de profil"
              value={vendeurPhotoUrl}
              onChange={setVendeurPhotoUrl}
              loading={uploadingVendeur}
              onUpload={(e) => handlePhotoUpload(e, setVendeurPhotoUrl, setUploadingVendeur)}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                Numero WhatsApp du vendeur
              </label>
              <input
                type="tel"
                value={vendeurPhone}
                onChange={(e) => setVendeurPhone(e.target.value)}
                placeholder="+33612345678"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                Pour que le bouton "Envoyer sur WhatsApp" ouvre directement la conversation
                avec le bon numero.
              </p>
            </div>
          </div>
        </section>

        {/* === SECTION 3 : MONTANTS === */}
        <section className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">3</span>
            Montants & Calendrier
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix total (€)</label>
              <input
                type="number"
                value={prixTotal}
                onChange={(e) => setPrixTotal(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              />
              {prixChanged && (
                <p className="text-xs text-amber-600 mt-1">Modifie (cliquer Enregistrer)</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mensualite (€)</label>
              <input
                type="number"
                value={montantMensuel}
                onChange={(e) => setMontantMensuel(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              />
              {mensuelChanged && (
                <p className="text-xs text-amber-600 mt-1">Modifie (cliquer Enregistrer)</p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-orange-600" />
              Date du 1er versement
            </label>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            {dateDebutChanged && (
              <p className="text-xs text-amber-600 mt-1">Modifiee (cliquer Enregistrer)</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Apres modification de la date, du prix ou de la mensualite, utilise
              le bouton <strong>"Recalculer le calendrier"</strong> ci-dessous pour
              regenerer les echeances.
            </p>
          </div>
        </section>

        {/* === SECTION 4 : ACTIONS DANGEREUSES === */}
        <section className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Actions avancees
          </h2>
          <p className="text-sm text-amber-800">
            Ces actions modifient le calendrier de maniere destructive. Utilise avec precaution.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => {
                if (window.confirm('Recalculer le calendrier de versements ?\n\nLes paiements deja verses/signes sont preserves.')) {
                  onRecalculate();
                }
              }}
              className="px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Recalculer le calendrier
            </button>
            {onResetContract && (
              <button
                onClick={onResetContract}
                className="px-4 py-3 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                <FileSignature className="w-4 h-4" />
                Reset signatures contrat
              </button>
            )}
          </div>
        </section>

        {/* === SECTION 5 : MIGRATION === */}
        <section className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Migration Kuidi
          </h2>
          <p className="text-sm text-blue-800">
            Migre la transaction "camion" legacy (créée avant l'ajout des signatures)
            pour qu'elle bénéficie des nouvelles features (contrepartie Francky, lien
            de signature public, échéancier 500 €/mois sur 60 mois).
          </p>
          <p className="text-xs text-blue-700">
            Idempotent : ne fait rien si déjà migré.
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
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50"
          >
            <Wrench className="w-4 h-4" />
            {migrating ? 'Migration en cours...' : 'Migrer la transaction camion'}
          </button>
        </section>

        {/* === BOUTON ENREGISTRER (flottant) === */}
        <div className="sticky bottom-0 bg-gradient-to-t from-orange-50 to-transparent pt-4 pb-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-6 py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-bold text-lg shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
        </div>
      </main>
    </div>
  );
};

// === PHOTO FIELD (helper local) ===
const PhotoField: React.FC<{
  label: string;
  value: string;
  onChange: (url: string) => void;
  loading?: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ label, value, onChange, loading, onUpload }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-start gap-3">
        {value ? (
          <img
            src={value}
            alt={label}
            className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-gray-400" />
          </div>
        )}
        <div className="flex-1 space-y-1">
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
          />
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded inline-flex items-center gap-1 disabled:opacity-50"
            >
              <Upload className="w-3 h-3" />
              {loading ? 'Upload...' : 'Uploader'}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
              >
                <X className="w-3 h-3 inline mr-1" />
                Retirer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
