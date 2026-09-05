import React, { useState, useEffect, useRef } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import './pizza-animations.css';
import PizzaTruckAnimation from './PizzaTruckAnimation';
import {
  Pizza, CheckCircle, Clock, AlertCircle, Copy,
  RefreshCw, Settings, User, Calendar, Wrench,
  X, Save, MessageCircle, MessageSquare, ShieldCheck,
  ExternalLink, FileSignature, LogOut, Eye, Camera, ArrowLeft,
  Trash2,
} from 'lucide-react';
import { SignIn } from '@clerk/clerk-react';

const ALLOWED_EMAILS = new Set([
  'lefreddy95@gmail.com',
  'franckylobry6@gmail.com',
]);

const ACHETEUR_EMAIL = 'lefreddy95@gmail.com';
const VENDEUR_EMAIL = 'franckylobry6@gmail.com';

/**
 * PizzaTruckPage — page dédiée pour suivre le paiement du camion pizza.
 *
 * Whitelist : seuls les 2 emails (acheteur + vendeur) y ont accès.
 * Les autres emails voient une page "Accès refusé".
 */
const PizzaTruckPage: React.FC = () => {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  // ⚠️ MODE TEST À SUPPRIMER — bypass Clerk avec le code "1234"
  // Convex vérifie uniquement userEmail (pas l'auth Clerk), donc on peut
  // shunter Clerk côté front en injectant un userEmail factice. À retirer
  // avant la vraie prod (sinon n'importe qui avec le code accède à l'app).
  const [bypassUser, setBypassUser] = useState<{ email: string } | null>(null);
  const [testCode, setTestCode] = useState('');
  // En mode bypass, on force le user effectif avec bypassUser.email
  const clerkUserEmail = user?.emailAddresses?.[0]?.emailAddress || null;
  const userEmail = bypassUser?.email || clerkUserEmail;
  // isLoaded : si on est en bypass, on n'attend plus Clerk
  const isLoadedEffective = bypassUser !== null ? true : isLoaded;
  // isSignedIn : true si on a un userEmail (bypass ou Clerk)
  const isSignedInEffective = !!userEmail;
  const isAllowed = userEmail && ALLOWED_EMAILS.has(userEmail);
  const isAcheteur = userEmail === ACHETEUR_EMAIL;
  const isVendeur = userEmail === VENDEUR_EMAIL;
  // ⚠️ MODE TEST À SUPPRIMER — signOut qui gère aussi le bypass
  const handleSignOut = () => {
    if (bypassUser !== null) {
      setBypassUser(null);
    } else {
      signOut({ redirectUrl: window.location.origin });
    }
  };
  // Mode preview : permet à l'admin de basculer sur la vue du vendeur
  // (pour comprendre ce que Francky voit avant de lui envoyer le lien
  // WhatsApp). Le vendeur ne peut PAS preview la vue acheteur (il n'a
  // pas le droit de faire des actions admin).
  // null = vue réelle. 'vendeur' (admin only) = forcer la vue vendeur.
  // ⚠️ Les mutations Convex utilisent TOUJOURS isAcheteur (le vrai rôle
  // de l'user connecté). Le preview est purement visuel.
  const [previewAs, setPreviewAs] = useState<'acheteur' | 'vendeur' | null>(null);
  // Rôle effectif affiché
  const displayAsVendeur = isVendeur || (isAcheteur && previewAs === 'vendeur');
  // Actions admin affichées seulement si acheteur ET pas en preview vendeur
  const showAdminActions = isAcheteur && !displayAsVendeur;

  // ===== ÉTATS LOCAUX =====
  const [showConfettis, setShowConfettis] = useState(false);
  const [editConfig, setEditConfig] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState<string | null>(null);
  const [whatsappModal, setWhatsappModal] = useState<{ phone: string; message: string } | null>(null);
  const [showAdHocModal, setShowAdHocModal] = useState(false);
  // Numéro WhatsApp du vendeur pour ouvrir la conversation pré-remplie.
  // Par défaut on met une valeur vide — on remplira depuis cfg.vendeurPhone
  // dès que la config arrive (voir useEffect plus bas).
  const [vendeurPhone, setVendeurPhone] = useState('');

  // ===== QUERIES =====
  const summary = useQuery(api.pizza.getSummary, userEmail ? { userEmail } : 'skip');
  const auditLog = useQuery(
    api.pizza.listAuditLog,
    userEmail && isAcheteur ? { userEmail } : 'skip'
  );

  // Synchronise le numéro WhatsApp du vendeur avec la config DB dès qu'elle
  // arrive. Ce useEffect est placé ICI (avant les early returns) pour
  // respecter la règle "hooks called in the same order on every render".
  // On lit la config depuis `summary` directement (pas la version destructurée
  // `cfg` qui n'existe qu'après les early returns).
  useEffect(() => {
    const cfgPhone = summary?.config?.vendeurPhone;
    if (cfgPhone && !vendeurPhone) {
      setVendeurPhone(cfgPhone);
    }
  }, [summary?.config?.vendeurPhone]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== MUTATIONS =====
  const initConfigMut = useMutation(api.pizza.initConfig);
  const updateConfigMut = useMutation(api.pizza.updateConfig);
  const markAsPaidMut = useMutation(api.pizza.markAsPaid);
  const initiateSignatureMut = useMutation(api.pizza.initiateSignature);
  const cancelPaymentMut = useMutation(api.pizza.cancelPayment);
  const deletePaymentMut = useMutation(api.pizza.deletePayment);
  const recalculateScheduleMut = useMutation(api.pizza.recalculateSchedule);
  const createAdHocPaymentMut = useMutation(api.pizza.createAdHocPayment);
  const migratePaymentLabelsMut = useMutation(api.pizza.migratePaymentLabels);
  const sendSmsToVendorAct = useAction(api.pizza.sendSmsToVendor);

  // ===== CHARGEMENT =====
  if (!isLoadedEffective) {
    return <CenterLoader label="Chargement de l'utilisateur..." />;
  }
  if (!isSignedInEffective) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Pizza className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Camion pizza — Suivi paiement</h1>
            <p className="text-sm text-gray-600 mt-1">
              Connecte-toi avec Google pour suivre le paiement du camion pizza.
            </p>
          </div>

          {/* Clerk SignIn embarqué — bouton Google */}
          <SignIn
            routing="hash"
            signUpUrl={undefined}
            fallbackRedirectUrl="/pizza-truck"
            appearance={{
              elements: {
                card: 'shadow-none p-0 w-full',
                cardBox: 'shadow-none w-full',
                rootBox: 'w-full',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                header: 'hidden',
                main: 'gap-3',
                socialButtons: 'flex flex-col gap-2',
                socialButtonsIconButton: 'hidden',
                socialButtonsProviderIcon: 'h-5 w-5',
                button: 'h-11 normal-case font-medium rounded-lg transition-all',
                formButtonPrimary:
                  'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-md hover:shadow-lg',
                formFieldInput:
                  'h-11 rounded-lg border-gray-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-500',
                formFieldLabel: 'text-sm font-medium text-gray-700',
                dividerLine: 'bg-gray-200',
                dividerText: 'text-xs text-gray-500 uppercase',
                footer: 'hidden',
                formFieldAction: 'text-orange-600 hover:text-orange-700 text-sm',
                identityPreviewEditButton: 'text-orange-600',
              },
              layout: {
                socialButtonsPlacement: 'top',
                showOptionalFields: false,
              },
              variables: {
                colorPrimary: '#f97316',
                colorText: '#111827',
                colorBackground: '#ffffff',
                colorInputBackground: '#ffffff',
                colorInputText: '#111827',
                borderRadius: '0.5rem',
                fontFamily: 'inherit',
                fontSize: '0.95rem',
              },
            }}
          />

          <div className="mt-4 text-center text-xs text-gray-500">
            🔒 Authentification sécurisée via Clerk
          </div>

          {/* === ⚠️ MODE TEST À SUPPRIMER (commit baa5fa6+N) ===
              Bypass Clerk en entrant le code "1234". N'EST PAS SÉCURISÉ :
              le backend Convex accepte n'importe quel userEmail whitelisté
              sans vérifier l'auth Clerk. À retirer avant la vraie prod. */}
          <div className="mt-4 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
            <p className="text-xs font-bold text-yellow-800 mb-2">
              ⚠️ MODE TEST (à supprimer avant prod)
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Code test"
                className="flex-1 px-2 py-1.5 border border-yellow-300 rounded text-sm bg-white"
                value={testCode}
                onChange={(e) => setTestCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && testCode === '1234') {
                    setBypassUser({ email: 'lefreddy95@gmail.com' });
                    setTestCode('');
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (testCode === '1234') {
                    setBypassUser({ email: 'lefreddy95@gmail.com' });
                    setTestCode('');
                  }
                }}
                className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-sm font-medium"
              >
                Connexion test
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!isAllowed) {
    return (
      <CenterMessage
        icon={<ShieldCheck />}
        title="Accès non autorisé"
        message={`L'email ${userEmail} n'est pas autorisé à accéder à cette page. Seules les 2 personnes impliquées dans le contrat peuvent y accéder.`}
        color="red"
      />
    );
  }
  if (summary === undefined) {
    return <CenterLoader label="Chargement des paiements..." />;
  }
  if (summary === null) {
    return <InitConfigForm onInit={initConfigMut} userEmail={userEmail!} isAcheteur={isAcheteur} />;
  }

  // ===== DONNÉES DÉRIVÉES =====
  const { config: cfg, payments, summary: sum } = summary;
  const progressPercent = sum.progressPercent;

  // ===== HANDLERS =====
  const handleSign = async (paymentId: string) => {
    if (!userEmail) return;
    try {
      await initiateSignatureMut({ userEmail, paymentId });
      setShowSignatureModal(null);
      setShowConfettis(true);
      setTimeout(() => setShowConfettis(false), 4000);
    } catch (e) {
      alert('Erreur: ' + (e instanceof Error ? e.message : 'inconnue'));
    }
  };

  const handleMarkPaid = async (paymentId: string) => {
    if (!userEmail) return;
    if (!window.confirm('Confirmer que ce versement a été effectué ? (Action tracée dans l\'audit log)')) return;
    try {
      await markAsPaidMut({ userEmail, paymentId });
    } catch (e) {
      alert('Erreur: ' + (e instanceof Error ? e.message : 'inconnue'));
    }
  };

  const handleCancel = async (paymentId: string) => {
    if (!userEmail) return;
    const raison = window.prompt('Raison de l\'annulation ?');
    if (!raison) return;
    try {
      await cancelPaymentMut({ userEmail, paymentId, raison });
    } catch (e) {
      alert('Erreur: ' + (e instanceof Error ? e.message : 'inconnue'));
    }
  };
  const handleDelete = async (paymentId: string) => {
    if (!userEmail) return;
    const ok = window.confirm(
      'Supprimer DÉFINITIVEMENT cette échéance ?\n\n' +
      '⚠️ Cette action est IRRÉVERSIBLE :\n' +
      '• La ligne disparaît de la base de données\n' +
      '• Les autres paiements sont renumérotés (n°1, 2, 3...)\n' +
      '• Une trace reste dans l\'audit log (mais le paiement n\'existe plus)\n\n' +
      'Si tu veux juste la marquer comme annulée, utilise le bouton ✕ à la place.\n\n' +
      'Continuer ?'
    );
    if (!ok) return;
    try {
      const res = await deletePaymentMut({ userEmail, paymentId });
      alert(`Échéance n°${res.deletedNumero} supprimée. ${res.renumbered} paiement(s) renuméroté(s).`);
    } catch (e) {
      alert('Erreur: ' + (e instanceof Error ? e.message : 'inconnue'));
    }
  };

  const handleRecalculate = async () => {
    if (!userEmail) return;
    if (!window.confirm('Recalculer le calendrier de versements ? (Les paiements déjà versés/signés sont préservés)')) return;
    try {
      await recalculateScheduleMut({ userEmail });
    } catch (e) {
      alert('Erreur: ' + (e instanceof Error ? e.message : 'inconnue'));
    }
  };

  // Répare la numérotation : assigne ponctuelOrdre=1,2,3... aux ponctuels
  // existants, et renumérote les mensuels proprement (1, 2, 3, ... par date).
  // À utiliser UNE SEULE FOIS après le déploiement du fix (c6d2e20).
  // Idempotente : peut être ré-appelée sans risque.
  const handleMigrate = async () => {
    if (!userEmail) return;
    if (!window.confirm(
      'Réparer la numérotation des paiements ?\n\n' +
      '• Les paiements ponctuels existants deviendront P1, P2, P3...\n' +
      '• Les mensualités seront renumérotées 1, 2, 3... par date d\'échéance\n\n' +
      'Action sûre et idempotente (peut être répétée sans risque).'
    )) return;
    try {
      const res = await migratePaymentLabelsMut({ userEmail });
      alert(
        `Migration terminée :\n` +
        `• ${res.renumbered} paiement(s) renuméroté(s)\n` +
        `• ${res.skipped} paiement(s) déjà OK\n` +
        `• ${res.oldMensuelCount} anciennes mensualités supprimées\n` +
        `• ${res.newMensualCount} nouvelles mensualités créées\n` +
        `• Total payé : ${res.paidTotal} €\n` +
        `• Reste à payer : ${res.remainingToPay} €\n\n` +
        `La page va se recharger pour appliquer les changements.`
      );
      // Force un reload pour garantir que useQuery(api.pizza.listPayments)
      // re-fetcher les paiements. Convex est normalement réactif mais un
      // hard reload est plus fiable ici (on supprime + recrée des paiements,
      // ce qui peut désynchroniser le cache de la query).
      setTimeout(() => window.location.reload(), 500);
    } catch (e) {
      alert('Erreur: ' + (e instanceof Error ? e.message : 'inconnue'));
    }
  };

  const handleUpdateConfig = async (patch: Record<string, any>) => {
    if (!userEmail) return;
    // Confirmation si le prix total ou le montant mensuel change
    if (patch.prixTotal !== undefined && patch.prixTotal !== cfg.prixTotal) {
      const ok = window.confirm(
        `⚠️ Confirmer le changement de prix total ?\n\n` +
        `Actuel : ${cfg.prixTotal.toLocaleString('fr-FR')} €\n` +
        `Nouveau : ${patch.prixTotal.toLocaleString('fr-FR')} €\n\n` +
        `Le calendrier de versements ne sera PAS recalculé automatiquement.\n` +
        `Utilise le bouton "Recalculer" si tu veux réajuster les échéances.`
      );
      if (!ok) return;
    }
    if (patch.montantMensuel !== undefined && patch.montantMensuel !== cfg.montantMensuel) {
      const ok = window.confirm(
        `⚠️ Confirmer le changement de montant mensuel ?\n\n` +
        `Actuel : ${cfg.montantMensuel.toLocaleString('fr-FR')} €\n` +
        `Nouveau : ${patch.montantMensuel.toLocaleString('fr-FR')} €\n\n` +
        `Le calendrier de versements ne sera PAS recalculé automatiquement.\n` +
        `Utilise le bouton "Recalculer" si tu veux réajuster les échéances.`
      );
      if (!ok) return;
    }
    try {
      await updateConfigMut({ userEmail, ...patch });
      setEditConfig(false);
    } catch (e) {
      alert('Erreur: ' + (e instanceof Error ? e.message : 'inconnue'));
    }
  };

  const openWhatsapp = (payment: typeof payments[number]) => {
    const message = `🍕 *${cfg.nomCamion}* — Versement n°${payment.numero}\n\n` +
      `💰 Montant : *${payment.montant} €*\n` +
      `📅 Échéance : ${new Date(payment.dateEcheance).toLocaleDateString('fr-FR')}\n\n` +
      `👉 Connecte-toi ici pour signer ce versement :\n${window.location.origin}/pizza-truck?sign=${payment._id}`;
    setWhatsappModal({ phone: vendeurPhone, message });
  };

  // Envoi du SMS au vendeur via le worker Pushbullet (qui relaie vers MacroDroid).
  // Le message est identique au format WhatsApp, mais envoyé en vrai SMS
  // (pas via wa.me). Utile quand Francky n'a pas WhatsApp ou préfère les SMS.
  const handleSendSms = async (paymentId: string) => {
    if (!userEmail) return;
    if (!confirm(`Envoyer un SMS à ${cfg.vendeurPhone || 'Francky'} avec le lien de signature ?`)) return;
    try {
      await sendSmsToVendorAct({ userEmail, paymentId: paymentId as any });
      alert('✅ SMS envoyé à ' + (cfg.vendeurPhone || 'Francky') + ' !');
    } catch (e) {
      alert('Erreur: ' + (e instanceof Error ? e.message : 'inconnue'));
    }
  };

  /**
   * Construit un objet payment-compatible à partir des données d'un paiement
   * fraîchement créé (sans attendre le re-fetch Convex). Utilisé pour ouvrir
   * le WhatsApp modal juste après `createAdHocPayment`.
   */
  const buildAdHocPaymentForWhatsapp = (params: {
    paymentId: string;
    numero: number;
    montant: number;
    note?: string;
  }) => {
    const now = Date.now();
    return {
      _id: params.paymentId as any,
      _creationTime: now,
      numero: params.numero,
      type: 'ponctuel' as const,
      montant: params.montant,
      dateEcheance: now,
      status: 'verse' as const,
      note: params.note,
      createdAt: now,
      updatedAt: now,
    };
  };

  // ===== RENDER =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-red-50">
      {/* CONFETTIS */}
      {showConfettis && <Confetti />}

      {/* HEADER */}
      <header className="bg-white/90 backdrop-blur border-b border-orange-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
          {/* Ligne 1 : Retour + Icône + Titre (toujours visible) + Actions à droite (sm+) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="/"
              onClick={(e) => {
                // Utiliser history.back() si on a un historique de navigation,
                // sinon fallback sur href="/"
                e.preventDefault();
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  window.location.href = '/';
                }
              }}
              className="px-2 sm:px-3 py-1.5 sm:py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg flex-shrink-0 inline-flex items-center gap-1"
              title="Retour à l'accueil"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Retour</span>
            </a>
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
              <Pizza className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="whitespace-nowrap">{cfg.nomCamion}</span>
                <span className="px-1.5 sm:px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] sm:text-xs font-semibold rounded-full whitespace-nowrap">
                  🍕 Pizza Truck
                </span>
              </h1>
              <p className="text-[11px] sm:text-xs text-gray-500 truncate">
                {isAcheteur ? '👑 Vue acheteur' : '✍️ Vue vendeur (signature)'}
                {previewAs === 'vendeur' && (
                  <span className="ml-1 sm:ml-2 px-1.5 py-0.5 bg-purple-600 text-white rounded text-[10px] font-bold">
                    PREVIEW
                  </span>
                )}
              </p>
            </div>
            {/* Actions à droite — visibles uniquement sur sm+ (desktop) */}
            <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
              {isAcheteur && (
                <button
                  onClick={() => setPreviewAs(previewAs === 'vendeur' ? null : 'vendeur')}
                  className={`text-xs px-2 py-1.5 rounded-lg font-medium inline-flex items-center gap-1 ${
                    previewAs === 'vendeur'
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-100 hover:bg-purple-200 text-purple-800'
                  }`}
                  title={previewAs === 'vendeur' ? "Quitter le mode preview (revient à ta vue admin)" : "Voir ce que Francky voit quand il signe"}
                >
                  <Eye className="w-3.5 h-3.5" />
                  {previewAs === 'vendeur' ? 'Quitter preview' : '👁️ Vue Francky'}
                </button>
              )}
              {showAdminActions && (
                <button
                  onClick={() => setEditConfig(true)}
                  className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                  title="Paramètres"
                >
                  <Settings className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => {
                  if (window.confirm('Se déconnecter ?')) {
                    handleSignOut();
                  }
                }}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                title="Se déconnecter"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
          {/* Ligne 2 (mobile uniquement) : boutons d'action */}
          <div className="sm:hidden mt-2 flex items-center gap-2 flex-wrap">
            {isAcheteur && (
              <button
                onClick={() => setPreviewAs(previewAs === 'vendeur' ? null : 'vendeur')}
                className={`text-[11px] px-2 py-1 rounded-md font-medium inline-flex items-center gap-1 ${
                  previewAs === 'vendeur'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-100 hover:bg-purple-200 text-purple-800'
                }`}
              >
                <Eye className="w-3 h-3" />
                {previewAs === 'vendeur' ? 'Quitter preview' : '👁️ Vue Francky'}
              </button>
            )}
            {showAdminActions && (
              <button
                onClick={() => setEditConfig(true)}
                className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                title="Paramètres"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => {
                if (window.confirm('Se déconnecter ?')) {
                  handleSignOut();
                }
              }}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* ===== SECTION 1 : AVANCEMENT (camion pizza animé) ===== */}
        <section className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-orange-200">
          {/* Bandeau avec les 2 parties */}
          <div className="grid grid-cols-2 gap-0 border-b border-orange-200">
            <div className="p-4 flex items-center gap-3 bg-gradient-to-br from-blue-50 to-blue-100">
              <Avatar
                name={cfg.acheteurNom}
                photoUrl={cfg.acheteurPhotoUrl}
                role="acheteur"
                size="md"
              />
              <div className="min-w-0">
                <div className="text-xs text-blue-700 font-semibold uppercase tracking-wide">Acheteur</div>
                <div className="font-bold text-gray-900 truncate">{cfg.acheteurNom}</div>
                <div className="text-xs text-gray-500 truncate">{cfg.acheteurEmail}</div>
              </div>
            </div>
            <div className="p-4 flex items-center gap-3 bg-gradient-to-br from-purple-50 to-purple-100">
              <Avatar
                name={cfg.vendeurNom}
                photoUrl={cfg.vendeurPhotoUrl}
                role="vendeur"
                size="md"
              />
              <div className="min-w-0">
                <div className="text-xs text-purple-700 font-semibold uppercase tracking-wide">Vendeur</div>
                <div className="font-bold text-gray-900 truncate">{cfg.vendeurNom}</div>
                <div className="text-xs text-gray-500 truncate">{cfg.vendeurEmail}</div>
              </div>
            </div>
          </div>

          {/* Barre de progression avec camion animé (Framer Motion) */}
          <div className="p-6 sm:p-8 bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50">
            <div className="flex items-center justify-between mb-4 text-sm">
              <span className="font-bold text-gray-700">Avancement du paiement</span>
              <span className="font-bold text-2xl text-orange-600">
                {progressPercent}<span className="text-base">%</span>
              </span>
            </div>

            {/* 🎬 Camion pizza animé (Framer Motion) */}
            <PizzaTruckAnimation progressPercent={progressPercent} />

            {/* Chiffres clés */}
            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3 text-center">
              <div className="p-2 sm:p-3 bg-green-50 border-2 border-green-200 rounded-xl">
                <div className="text-[10px] sm:text-xs text-green-700 font-semibold uppercase leading-tight">Déjà payé</div>
                <div className="text-base sm:text-2xl font-bold text-green-800 mt-1 whitespace-nowrap">
                  {sum.paid.toLocaleString('fr-FR')} €
                </div>
              </div>
              <div className="p-2 sm:p-3 bg-orange-50 border-2 border-orange-200 rounded-xl">
                <div className="text-[10px] sm:text-xs text-orange-700 font-semibold uppercase leading-tight">Reste</div>
                <div className="text-base sm:text-2xl font-bold text-orange-800 mt-1 whitespace-nowrap">
                  {sum.remaining.toLocaleString('fr-FR')} €
                </div>
              </div>
              <div className="p-2 sm:p-3 bg-blue-50 border-2 border-blue-200 rounded-xl">
                <div className="text-[10px] sm:text-xs text-blue-700 font-semibold uppercase leading-tight">Échéances</div>
                <div className="text-base sm:text-2xl font-bold text-blue-800 mt-1 whitespace-nowrap">
                  {payments.filter((p) => p.status === 'verse').length}/{payments.length}
                </div>
              </div>
            </div>

            {sum.estimatedEndDate && sum.remaining > 0 && (
              <p className="mt-4 text-sm text-gray-600 text-center">
                📅 Fin estimée du paiement :{' '}
                <strong>{new Date(sum.estimatedEndDate).toLocaleDateString('fr-FR')}</strong>
                {' '}({sum.pendingCount} échéances restantes)
              </p>
            )}
            {sum.remaining === 0 && (
              <p className="mt-4 text-sm text-green-700 text-center font-bold">
                🎉 Camion pizza intégralement payé ! Bravo à vous deux.
              </p>
            )}
          </div>
        </section>

        {/* ===== BANNIÈRE PREVIEW VENDEUR ===== */}
        {previewAs === 'vendeur' && (
          <section className="bg-purple-100 border-2 border-purple-300 rounded-2xl p-4 flex items-start gap-3">
            <Eye className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-purple-900">
              <div className="font-bold">Mode preview activé</div>
              <p className="mt-1">
                Tu vois actuellement ce que <strong>Francky voit</strong> quand il se connecte
                pour signer. Tes actions admin sont désactivées tant que tu restes en preview.
                Pour revenir à ta vue admin, clique <strong>"Quitter preview"</strong> en haut à droite.
              </p>
            </div>
          </section>
        )}

        {/* ===== SECTION 2 : PROCHAIN PAIEMENT ===== */}
        {/* Affiché si on est en vue vendeur (réelle ou preview).
            On prend le prochain paiement "verse" ET non signé (en attente de signature). */}
        {sum.nextPayment && displayAsVendeur && sum.nextPayment.status === 'verse' && !sum.nextPayment.signature && (
          <NextPaymentBanner
            payment={sum.nextPayment}
            onSign={() => setShowSignatureModal(sum.nextPayment!._id)}
          />
        )}

        {/* ===== SECTION 3a : PAIEMENTS PONCTUELS (EN PREMIER) ===== */}
        {/* Affichés en HAUT de la liste pour qu'un nouveau versement exceptionnel
            (genre grosse avance) soit immédiatement visible. Tri par date de
            création DESC : le plus récent en haut. */}
        {(() => {
          const adHocPayments = [...payments]
            .filter((p) => p.type === 'ponctuel')
            .sort((a, b) => b.createdAt - a.createdAt);
          if (adHocPayments.length === 0) return null;
          const signedCount = adHocPayments.filter((p) => p.signature).length;
          return (
            <section>
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <FileSignature className="w-5 h-5 text-red-600" />
                  Paiements ponctuels
                  <span className="text-xs font-normal text-gray-500">
                    ({adHocPayments.length} au total — {signedCount} signé{signedCount > 1 ? 's' : ''} par Francky)
                  </span>
                </h2>
              </div>

              <div className="bg-white rounded-2xl shadow border border-red-200 overflow-hidden">
                <ul className="divide-y divide-gray-100">
                  {adHocPayments.map((p) => (
                    <PaymentRow
                      key={p._id}
                      payment={p}
                      isAcheteur={isAcheteur}
                      viewAsVendeur={displayAsVendeur}
                      onMarkPaid={() => handleMarkPaid(p._id)}
                      onSign={() => setShowSignatureModal(p._id)}
                      onCancel={() => handleCancel(p._id)}
                      onDelete={() => handleDelete(p._id)}
                      onWhatsapp={() => openWhatsapp(p)}
                      onSms={() => handleSendSms(p._id)}
                    />
                  ))}
                </ul>
              </div>
            </section>
          );
        })()}

        {/* ===== SECTION 3b : CALENDRIER DE PAIEMENTS (mensuels) ===== */}
        <section>
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-600" />
              Calendrier de paiement
              <span className="text-xs font-normal text-gray-500">
                ({payments.filter((p) => p.type !== 'ponctuel').length} mensualités)
              </span>
            </h2>
            {showAdminActions && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setShowAdHocModal(true)}
                  className="text-sm px-3 py-1.5 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white rounded-lg font-bold inline-flex items-center gap-1.5 shadow"
                  title="Enregistrer un paiement ponctuel (montant libre, hors calendrier mensuel) à faire signer par le vendeur"
                >
                  <Pizza className="w-3.5 h-3.5" />
                  + Paiement ponctuel
                </button>
                <button
                  onClick={handleRecalculate}
                  className="text-sm px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-lg font-medium inline-flex items-center gap-1.5"
                  title="Recalcule le calendrier en fonction du montant mensuel actuel (les paiements versés/signés sont préservés)"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Recalculer
                </button>
                <button
                  onClick={handleMigrate}
                  className="text-sm px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg font-medium inline-flex items-center gap-1.5"
                  title="Répare la numérotation : les ponctuels existants deviennent P1, P2, P3... et les mensuels sont renumérotés 1, 2, 3... par date. À utiliser UNE SEULE FOIS après le déploiement du fix (c6d2e20). Idempotent."
                >
                  <Wrench className="w-3.5 h-3.5" />
                  Réparer
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow border border-gray-200 overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {/* Tri CHRONOLOGIQUE ASC : n°1 en haut, n°60 en bas.
                  AVANT : DESC (les plus récents en premier) → "versements
                  inversés" selon le user. L'ordre naturel de lecture est
                  1 → 2 → 3 → ... → N. */}
              {[...payments]
                .filter((p) => p.type !== 'ponctuel')
                .sort((a, b) => {
                  // En priorité : par numero ASC (1, 2, 3, ...) — l'ordre
                  // "humain" le plus naturel. Si numero égal (rare), départage
                  // par date d'échéance ASC.
                  if (a.numero !== b.numero) return a.numero - b.numero;
                  return a.dateEcheance - b.dateEcheance;
                })
                .map((p) => (
                <PaymentRow
                  key={p._id}
                  payment={p}
                  isAcheteur={isAcheteur}
                  viewAsVendeur={displayAsVendeur}
                  onMarkPaid={() => handleMarkPaid(p._id)}
                  onSign={() => setShowSignatureModal(p._id)}
                  onCancel={() => handleCancel(p._id)}
                  onDelete={() => handleDelete(p._id)}
                  onWhatsapp={() => openWhatsapp(p)}
                  onSms={() => handleSendSms(p._id)}
                />
              ))}
              {payments.filter((p) => p.type !== 'ponctuel').length === 0 && (
                <li className="p-6 text-center text-sm text-gray-500 italic">
                  Aucun paiement mensuel pour l'instant.
                </li>
              )}
            </ul>
          </div>
        </section>

        {/* ===== SECTION 4 : AUDIT LOG (admin seulement) ===== */}
        {showAdminActions && auditLog && auditLog.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-gray-600" />
              Audit log (traçabilité)
              <span className="text-xs font-normal text-gray-500">({auditLog.length} dernières actions)</span>
            </h2>
            <div className="bg-white rounded-2xl shadow border border-gray-200 overflow-hidden">
              <ul className="divide-y divide-gray-100 text-sm">
                {auditLog.slice().reverse().slice(0, 30).map((log) => (
                  <li key={log._id} className="p-3 flex items-start gap-3">
                    <div className="text-xs text-gray-500 whitespace-nowrap font-mono">
                      {new Date(log.timestamp).toLocaleString('fr-FR')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900">{log.action}</div>
                      <div className="text-xs text-gray-600">
                        {log.userEmail} ({log.userRole}){log.ipAddress ? ` · IP: ${log.ipAddress}` : ''}
                      </div>
                      {log.details && (
                        <div className="text-xs text-gray-500 font-mono mt-1 break-all">{log.details}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </main>

      {/* ===== MODAL : MODIFIER LA CONFIG (admin) ===== */}
      {editConfig && cfg && (
        <EditConfigModal
          config={cfg}
          onClose={() => setEditConfig(false)}
          onSave={handleUpdateConfig}
        />
      )}

      {/* ===== MODAL : SIGNATURE (vendeur) ===== */}
      {showSignatureModal && (() => {
        const p = payments.find((x) => x._id === showSignatureModal);
        return p ? (
          <SignatureModal
            payment={p}
            config={cfg}
            onClose={() => setShowSignatureModal(null)}
            onSign={() => handleSign(p._id)}
          />
        ) : null;
      })()}

      {/* ===== MODAL : WHATSAPP (admin) ===== */}
      {whatsappModal && (
        <WhatsappModal
          phone={whatsappModal.phone}
          message={whatsappModal.message}
          onPhoneChange={setVendeurPhone}
          onClose={() => setWhatsappModal(null)}
        />
      )}

      {/* ===== MODAL : PAIEMENT PONCTUEL (admin) ===== */}
      {showAdHocModal && (
        <AdHocPaymentModal
          onClose={() => setShowAdHocModal(false)}
          onCreate={async ({ montant, note, marqueCommeVerse }) => {
            if (!userEmail) return { numero: 0, paymentId: '' };
            const res = await createAdHocPaymentMut({
              userEmail,
              montant,
              note,
              marqueCommeVerse,
            });
            // 🎯 Recalcule automatiquement le calendrier de mensualités
            // pour que le nouveau total payé réduise le nombre d'échéances
            // restantes (un gros paiement ponctuel = moins de 500€/mois à
            // venir). Les paiements déjà versés/signés sont préservés.
            try {
              await recalculateScheduleMut({ userEmail });
            } catch (e) {
              console.warn('Recalcul auto après paiement ponctuel échoué:', e);
            }
            return { numero: res.numero, paymentId: res.paymentId };
          }}
          onSendWhatsApp={({ paymentId, numero, montant, note }) => {
            const newPayment = buildAdHocPaymentForWhatsapp({ paymentId, numero, montant, note });
            openWhatsapp(newPayment);
          }}
        />
      )}
    </div>
  );
};

// =========================================================================
// Sous-composants
// =========================================================================

const CenterLoader: React.FC<{ label: string }> = ({ label }) => (
  <div className="min-h-screen bg-gradient-to-br from-orange-100 via-yellow-100 to-red-100 flex items-center justify-center">
    <div className="text-center">
      <div className="pizza-spinner text-5xl">🍕</div>
      <p className="mt-4 text-base font-medium text-gray-800">{label}</p>
    </div>
  </div>
);

const CenterMessage: React.FC<{
  icon: React.ReactNode;
  title: string;
  message: string;
  color?: string;
}> = ({ icon, title, message, color = 'gray' }) => (
  <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-red-50 flex items-center justify-center p-4">
    <div className={`max-w-md w-full bg-white rounded-2xl shadow-xl p-6 text-center border-2 border-${color}-200`}>
      <div className={`w-16 h-16 mx-auto bg-${color}-100 rounded-full flex items-center justify-center text-${color}-600`}>
        {icon}
      </div>
      <h1 className="mt-4 text-xl font-bold text-gray-900">{title}</h1>
      <p className="mt-2 text-sm text-gray-600">{message}</p>
    </div>
  </div>
);

const Avatar: React.FC<{
  name: string;
  photoUrl?: string;
  role: 'acheteur' | 'vendeur';
  size?: 'sm' | 'md' | 'lg';
}> = ({ name, photoUrl, role, size = 'md' }) => {
  const sizeClasses = { sm: 'w-8 h-8 text-sm', md: 'w-12 h-12 text-base', lg: 'w-20 h-20 text-2xl' };
  const colorClasses = role === 'acheteur' ? 'bg-blue-500' : 'bg-purple-500';
  return (
    <div className={`${sizeClasses[size]} ${colorClasses} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden ring-2 ring-white shadow`}>
      {photoUrl ? (
        <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
};

const PaymentRow: React.FC<{
  payment: any;
  isAcheteur: boolean;
  // Vue effective (override par le mode preview) — permet d'afficher
  // les actions du vendeur à l'admin qui preview, et inversement.
  viewAsVendeur: boolean;
  onMarkPaid: () => void;
  onSign: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onWhatsapp: () => void;
  onSms: () => void;
}> = ({ payment, isAcheteur, viewAsVendeur, onMarkPaid, onSign, onCancel, onDelete, onWhatsapp, onSms }) => {
  // Actions effectives (basées sur la vue effective)
  const canMarkPaid = !viewAsVendeur && isAcheteur;
  // En clair : on peut signer si on est en vue vendeur (réelle ou preview)
  const canShowSignButton = viewAsVendeur;
  const canCancel = !viewAsVendeur && isAcheteur;
  // Suppression réservée à l'acheteur, ET seulement si pas signé ni versé
  // (les paiements versés/signés ont une valeur juridique/comptable)
  const canDelete = !viewAsVendeur && isAcheteur && !isPaid;
  const canWhatsapp = !viewAsVendeur && isAcheteur;
  const canSms = !viewAsVendeur && isAcheteur;
  const isPaid = payment.status === 'verse' || payment.signature;
  const isSigned = !!payment.signature;
  const isCancelled = payment.status === 'annule';
  const isOverdue = !isPaid && !isCancelled && payment.dateEcheance < Date.now();

  let bgClass = 'bg-white';
  let icon = <Clock className="w-5 h-5 text-gray-400" />;
  let label = 'En attente';
  let labelClass = 'text-gray-500 bg-gray-100';
  if (isCancelled) {
    bgClass = 'bg-red-50/50';
    icon = <X className="w-5 h-5 text-red-500" />;
    label = 'Annulé';
    labelClass = 'text-red-700 bg-red-100';
  } else if (isSigned) {
    bgClass = 'bg-green-50';
    icon = <FileSignature className="w-5 h-5 text-green-600" />;
    label = 'Signé';
    labelClass = 'text-green-700 bg-green-200';
  } else if (isPaid) {
    bgClass = 'bg-blue-50';
    icon = <CheckCircle className="w-5 h-5 text-blue-600" />;
    label = 'Versé (à signer)';
    labelClass = 'text-blue-700 bg-blue-100';
  } else if (isOverdue) {
    labelClass = 'text-red-700 bg-red-100';
    label = 'En retard';
  }

  // Détection des paiements ponctuels : on s'appuie sur le champ `type` (fiable,
  // indépendant de la note). Le fallback `note.includes('ponctuel')` reste en
  // place pour les paiements pré-migration (avant l'ajout du champ `type`).
  const isAdHoc = payment.type === 'ponctuel'
    || (payment.note || '').toLowerCase().includes('ponctuel');

  // Label affiché : un seul compteur "n°{numero}" pour tous les paiements
  // (ponctuels + mensuels). Avant le fix, les ponctuels étaient "n°61" ;
  // après migration, le ponctuel 5000€ devient "n°1" et les 60 mensuels
  // sont renumérotés 2..61 par date d'échéance.

  return (
    <li className={`p-3 sm:p-4 flex items-start gap-3 ${bgClass} ${!isCancelled && !isSigned && isOverdue ? 'pulse-attention' : ''}`}>
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-gray-900" title={`Versement n°${payment.numero}`}>n°{payment.numero}</span>
          <span className="font-bold text-lg text-gray-900 whitespace-nowrap">{payment.montant.toLocaleString('fr-FR')} €</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${labelClass}`}>{label}</span>
          {isAdHoc && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-700 inline-flex items-center gap-1">
              <Pizza className="w-3 h-3" />
              Ponctuel
            </span>
          )}
          {isSigned && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-600 text-white inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Validé par Francky
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          Échéance : {new Date(payment.dateEcheance).toLocaleDateString('fr-FR')}
          {payment.dateVersement && ` · Versé le ${new Date(payment.dateVersement).toLocaleDateString('fr-FR')}`}
        </div>
        {payment.note && (
          <div className="text-xs text-gray-600 mt-1 italic">📝 {payment.note}</div>
        )}
        {payment.signature && (
          <div className="mt-2 p-3 bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-400 rounded-lg">
            <div className="text-sm font-bold text-green-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              ✅ VERSEMENT CONFIRMÉ PAR FRANCKY
            </div>
            <div className="text-xs text-green-800 mt-1">
              Signé par <strong>{payment.signature.signedByNom}</strong> ({payment.signature.signedByEmail})
              le {new Date(payment.signature.signedAt).toLocaleString('fr-FR')}
            </div>
            {payment.signature.ipAddress && payment.signature.ipAddress !== 'unknown' && (
              <div className="text-xs text-green-800 mt-0.5">
                📍 IP : <span className="font-mono">{payment.signature.ipAddress}</span>
              </div>
            )}
            <div className="text-[10px] text-green-700 font-mono mt-1 break-all opacity-75">
              Hash d'intégrité : {payment.signature.signatureHash}
            </div>
            {payment.signature.userAgent && (
              <details className="mt-1">
                <summary className="text-[10px] text-green-700 cursor-pointer hover:underline">Navigateur utilisé</summary>
                <div className="text-[10px] text-green-700 font-mono mt-1 break-all opacity-75">
                  {payment.signature.userAgent}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
        {!isCancelled && !isPaid && canMarkPaid && (
          <button
            onClick={onMarkPaid}
            className="text-xs px-2 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md font-medium"
            title="Marquer comme versé"
          >
            <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
            Versé
          </button>
        )}
        {!isCancelled && !isSigned && isPaid && canShowSignButton && (
          <button
            onClick={onSign}
            className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md font-bold pulse-attention"
            title="Signer ce versement (action définitive)"
          >
            <FileSignature className="w-3.5 h-3.5 inline mr-1" />
            Signer
          </button>
        )}
        {/* Bouton "Envoyer à signer" / "Renvoyer" — dispo pour TOUS les paiements non signés
            (verse ou en_attente) : sert à transmettre/retransmettre le lien de signature
            à Francky sur WhatsApp. */}
        {!isCancelled && !isSigned && canWhatsapp && (
          <button
            onClick={onWhatsapp}
            className={`text-xs px-2 py-1.5 rounded-md font-medium inline-flex items-center gap-1 ${
              isPaid
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm'
                : 'bg-green-100 hover:bg-green-200 text-green-800'
            }`}
            title={
              isPaid
                ? "Envoyer (ou renvoyer) le lien de signature à Francky sur WhatsApp"
                : "Envoyer ce versement à signer sur WhatsApp"
            }
          >
            <MessageCircle className="w-3.5 h-3.5" />
            {isPaid ? 'Envoyer à signer' : 'WhatsApp'}
          </button>
        )}
        {/* Bouton "Envoyer par SMS" — alternative au WhatsApp. Envoie un vrai SMS
            via le worker Pushbullet (qui relaie vers MacroDroid sur le téléphone
            Android). Utile si Francky n'a pas WhatsApp ou préfère les SMS. */}
        {!isCancelled && !isSigned && canSms && (
          <button
            onClick={onSms}
            className="text-xs px-2 py-1.5 rounded-md font-medium inline-flex items-center gap-1 bg-purple-100 hover:bg-purple-200 text-purple-800"
            title={
              isPaid
                ? "Envoyer (ou renvoyer) le lien de signature à Francky par SMS via MacroDroid"
                : "Envoyer ce versement à signer par SMS via MacroDroid"
            }
          >
            <MessageSquare className="w-3.5 h-3.5" />
            SMS
          </button>
        )}
        {canCancel && !isSigned && !isCancelled && (
          <button
            onClick={onCancel}
            className="text-xs px-2 py-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md"
            title="Annuler ce versement"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {canDelete && (
          <button
            onClick={onDelete}
            className="text-xs px-2 py-1 text-red-700 hover:text-red-900 hover:bg-red-100 rounded-md"
            title="Supprimer DÉFINITIVEMENT cette échéance (action irréversible)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </li>
  );
};

const NextPaymentBanner: React.FC<{
  payment: any;
  onSign: () => void;
}> = ({ payment, onSign }) => (
  <section className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 rounded-2xl shadow-lg p-5 text-white">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
        <AlertCircle className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide">Prochain versement à signer</h2>
        <p className="text-xs opacity-90">Tu es le vendeur, c'est à toi de signer pour valider la réception du paiement.</p>
      </div>
    </div>
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <div className="text-3xl font-bold">{payment.montant.toLocaleString('fr-FR')} €</div>
        <div className="text-sm opacity-90">Versement n°{payment.numero} · Échéance {new Date(payment.dateEcheance).toLocaleDateString('fr-FR')}</div>
      </div>
      <button
        onClick={onSign}
        className="px-6 py-3 bg-white text-orange-600 hover:bg-orange-50 rounded-xl font-bold text-lg shadow-lg flex items-center gap-2 active:scale-95 transition-transform"
      >
        <FileSignature className="w-5 h-5" />
        Signer maintenant
      </button>
    </div>
  </section>
);

const PhotoField: React.FC<{
  label: string;
  value: string;
  onChange: (url: string) => void;
  loading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ label, value, onChange, loading, onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDataUrl = value.startsWith('data:');
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-2 mb-2">
        {value ? (
          <img
            src={value}
            alt={label}
            className="w-14 h-14 rounded-full object-cover ring-2 ring-gray-200"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-gray-400">
            <User className="w-6 h-6" />
          </div>
        )}
        <div className="flex-1 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="text-xs px-2 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md font-medium inline-flex items-center gap-1 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                Upload...
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5" />
                {value ? 'Changer' : 'Uploader une photo'}
              </>
            )}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded-md font-medium"
            >
              <X className="w-3 h-3 inline mr-1" />
              Retirer
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onUpload}
          className="hidden"
        />
      </div>
      <input
        type="url"
        value={isDataUrl ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ou colle une URL https://..."
        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-gray-600"
      />
    </div>
  );
};

const EditConfigModal: React.FC<{
  config: any;
  onClose: () => void;
  onSave: (patch: Record<string, any>) => void;
}> = ({ config, onClose, onSave }) => {
  const [prixTotal, setPrixTotal] = useState(config.prixTotal);
  const [montantMensuel, setMontantMensuel] = useState(config.montantMensuel);
  const [nomCamion, setNomCamion] = useState(config.nomCamion);
  const [acheteurPhotoUrl, setAcheteurPhotoUrl] = useState(config.acheteurPhotoUrl || '');
  const [vendeurPhotoUrl, setVendeurPhotoUrl] = useState(config.vendeurPhotoUrl || '');
  const [vendeurPhone, setVendeurPhone] = useState(config.vendeurPhone || '');
  // Détection d'un email obsolète dans la DB (config encore avec l'ancien hotmail)
  // → on pré-remplit l'input avec le nouvel email whitelisté
  const isOldVendeurEmail = config.vendeurEmail && config.vendeurEmail !== VENDEUR_EMAIL;
  const [acheteurEmail, setAcheteurEmail] = useState(config.acheteurEmail || ACHETEUR_EMAIL);
  const [vendeurEmail, setVendeurEmail] = useState(
    isOldVendeurEmail ? VENDEUR_EMAIL : (config.vendeurEmail || VENDEUR_EMAIL)
  );
  // Upload en cours (spinner) pour les 2 inputs file
  const [uploadingAcheteur, setUploadingAcheteur] = useState(false);
  const [uploadingVendeur, setUploadingVendeur] = useState(false);

  // Convertit un fichier image en data URL (base64) et l'écrit dans le state
  const handlePhotoUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string) => void,
    onUploaded?: (dataUrl: string) => void,
    setLoading?: (loading: boolean) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Le fichier doit être une image (JPG, PNG, WebP…)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Image trop grosse (> 2 Mo). Compresse-la avant de l\'uploader.');
      return;
    }
    if (setLoading) setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setter(dataUrl);
      if (onUploaded) onUploaded(dataUrl);
      if (setLoading) setLoading(false);
    };
    reader.onerror = () => {
      alert('Erreur de lecture du fichier');
      if (setLoading) setLoading(false);
    };
    reader.readAsDataURL(file);
  };
  useEffect(() => {
    if (config.vendeurPhone && vendeurPhone === '+33600000000') {
      setVendeurPhone(config.vendeurPhone);
    }
  }, [config.vendeurPhone]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Settings className="w-5 h-5 text-orange-600" />
          Paramètres
        </h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom du camion</label>
          <input
            type="text"
            value={nomCamion}
            onChange={(e) => setNomCamion(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        {/* Emails acheteur + vendeur (whitelistés, modifiables si migration) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email acheteur</label>
            <input
              type="email"
              value={acheteurEmail}
              onChange={(e) => setAcheteurEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email vendeur</label>
            <input
              type="email"
              value={vendeurEmail}
              onChange={(e) => setVendeurEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            {isOldVendeurEmail && (
              <p className="mt-1 text-[10px] text-amber-700">
                ⚠️ DB contient encore l'ancien email. Sauve pour migrer vers le nouveau.
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prix total (€)</label>
            <input
              type="number"
              value={prixTotal}
              onChange={(e) => setPrixTotal(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensuel (€)</label>
            <input
              type="number"
              value={montantMensuel}
              onChange={(e) => setMontantMensuel(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
        {/* Photos acheteur + vendeur (avec upload ou URL) */}
        <div className="grid grid-cols-2 gap-3">
          <PhotoField
            label="Photo acheteur"
            value={acheteurPhotoUrl}
            onChange={setAcheteurPhotoUrl}
            loading={uploadingAcheteur}
            onUpload={(e) => handlePhotoUpload(e, setAcheteurPhotoUrl, undefined, setUploadingAcheteur)}
          />
          <PhotoField
            label="Photo vendeur"
            value={vendeurPhotoUrl}
            onChange={setVendeurPhotoUrl}
            loading={uploadingVendeur}
            onUpload={(e) => handlePhotoUpload(e, setVendeurPhotoUrl, undefined, setUploadingVendeur)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <MessageCircle className="w-3.5 h-3.5 text-green-600" />
            Numéro WhatsApp du vendeur
          </label>
          <input
            type="tel"
            value={vendeurPhone}
            onChange={(e) => setVendeurPhone(e.target.value)}
            placeholder="+33612345678"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
          />
          <p className="text-xs text-gray-500 mt-1">
            Pour que le bouton "Envoyer sur WhatsApp" ouvre directement la conversation
            avec le bon numéro, sans avoir à le retaper.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
          >
            Annuler
          </button>
          <button
            onClick={() => onSave({ prixTotal, montantMensuel, nomCamion, acheteurPhotoUrl, vendeurPhotoUrl, vendeurPhone, acheteurEmail, vendeurEmail })}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold"
          >
            <Save className="w-4 h-4 inline mr-1" />
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

const SignatureModal: React.FC<{
  payment: any;
  config: any;
  onClose: () => void;
  onSign: () => void;
}> = ({ payment, config, onClose, onSign }) => {
  // Le vendeur doit cocher cette case AVANT de pouvoir signer : c'est sa
  // déclaration explicite que Freddy lui a bien remis la somme.
  const [certified, setCertified] = useState(false);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
            <FileSignature className="w-8 h-8 text-white" />
          </div>
          <h2 className="mt-3 text-xl font-bold text-gray-900">Signer le versement</h2>
          <p className="text-sm text-gray-600 mt-1">
            Tu confirmes avoir reçu <strong>{payment.montant.toLocaleString('fr-FR')} €</strong> pour
            le versement n°{payment.numero} du camion <strong>{config.nomCamion}</strong>.
          </p>
        </div>

        <div className="mt-5 p-4 bg-amber-50 border-2 border-amber-200 rounded-xl">
          <div className="flex items-start gap-2 text-amber-900">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <strong>Action irréversible.</strong> Cette signature sera enregistrée avec
              ton IP, ta date/heure et un hash d'intégrité. Tu ne pourras plus la modifier.
            </div>
          </div>
        </div>

        {/* Case de certification vendeur : la signature = preuve que Freddy
            a bien donné la somme. Le vendeur coche lui-même pour acter. */}
        <label
          className={`mt-4 flex items-start gap-2 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
            certified
              ? 'bg-green-50 border-green-400'
              : 'bg-gray-50 border-gray-200 hover:border-green-300'
          }`}
        >
          <input
            type="checkbox"
            checked={certified}
            onChange={(e) => setCertified(e.target.checked)}
            className="mt-0.5 w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500 flex-shrink-0"
          />
          <span className="text-sm text-gray-800 leading-snug">
            Je certifie que <strong>{config.acheteurNom || 'Freddy'}</strong> m'a bien remis la somme de{' '}
            <strong>{payment.montant.toLocaleString('fr-FR')} €</strong>{' '}
            en espèces / virement. En signant, j'apporte la preuve que cette somme
            m'a été versée.
          </span>
        </label>

        <div className="mt-4 text-xs text-gray-500 space-y-1">
          <div>📧 Signé par : <strong>{VENDEUR_EMAIL}</strong></div>
          <div>💰 Montant : <strong>{payment.montant.toLocaleString('fr-FR')} €</strong></div>
          <div>📅 Date : <strong>{new Date().toLocaleString('fr-FR')}</strong></div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
          >
            Annuler
          </button>
          <button
            onClick={onSign}
            disabled={!certified}
            className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-green-600 disabled:hover:to-emerald-600"
            title={!certified ? 'Coche la case de certification pour pouvoir signer' : 'Signer définitivement'}
          >
            <FileSignature className="w-4 h-4" />
            Je signe
          </button>
        </div>
      </div>
    </div>
  );
};

const AdHocPaymentModal: React.FC<{
  onClose: () => void;
  onCreate: (params: { montant: number; note?: string; marqueCommeVerse: boolean }) => Promise<{ numero: number; paymentId: string }>;
  onSendWhatsApp: (params: { paymentId: string; numero: number; montant: number; note?: string }) => void;
}> = ({ onClose, onCreate, onSendWhatsApp }) => {
  const [montant, setMontant] = useState<number>(1000);
  const [note, setNote] = useState<string>('');
  const [marqueCommeVerse, setMarqueCommeVerse] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // État de succès : paiement créé, on propose l'envoi WhatsApp (si versé)
  const [created, setCreated] = useState<{ numero: number; paymentId: string } | null>(null);

  const handleSubmit = async () => {
    if (montant <= 0) {
      setError('Le montant doit être positif');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await onCreate({ montant, note: note.trim() || undefined, marqueCommeVerse });
      // On passe en mode "succès" — l'utilisateur peut envoyer sur WhatsApp ou fermer
      setCreated({ numero: res.numero, paymentId: res.paymentId });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendWhatsApp = () => {
    if (!created) return;
    onSendWhatsApp({
      paymentId: created.paymentId,
      numero: created.numero,
      montant,
      note: note.trim() || undefined,
    });
    onClose();
  };

  // ===== ÉCRAN DE SUCCÈS — propose l'envoi WhatsApp =====
  if (created) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="mt-3 text-xl font-bold text-gray-900">Paiement ponctuel créé !</h2>
            <p className="text-sm text-gray-600 mt-1">
              Versement <strong className="text-red-600">n°{created.numero}</strong> de{' '}
              <strong className="text-orange-600">{montant.toLocaleString('fr-FR')} €</strong>
              {marqueCommeVerse ? ' marqué comme versé.' : ' créé (en attente de versement).'}
            </p>
          </div>

          {marqueCommeVerse && (
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl">
              <div className="flex items-start gap-2 text-sm text-green-900">
                <MessageCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-600" />
                <div>
                  <div className="font-bold">Envoyer à Francky pour signature ?</div>
                  <p className="mt-1 text-xs text-green-800">
                    Un message WhatsApp pré-rempli s'ouvrira avec le lien de signature.
                    Francky pourra se connecter avec Google et signer en 1 clic.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg font-medium border border-gray-200"
            >
              Fermer
            </button>
            {marqueCommeVerse && (
              <button
                onClick={handleSendWhatsApp}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Envoyer sur WhatsApp
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===== ÉCRAN DE CRÉATION — formulaire initial =====
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
            <Pizza className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Paiement ponctuel</h2>
            <p className="text-xs text-gray-500">Hors calendrier mensuel (avance, prime, rattrapage…)</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Montant (€)</label>
          <input
            type="number"
            value={montant}
            onChange={(e) => setMontant(Number(e.target.value))}
            min={1}
            step={50}
            className="w-full px-3 py-3 border border-gray-300 rounded-lg text-2xl font-bold text-center"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Note (optionnel)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex: avance suite à un imprévu"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        <label className="flex items-start gap-2 cursor-pointer p-3 bg-green-50 border border-green-200 rounded-lg">
          <input
            type="checkbox"
            checked={marqueCommeVerse}
            onChange={(e) => setMarqueCommeVerse(e.target.checked)}
            className="w-4 h-4 mt-0.5 text-green-600"
          />
          <div className="text-sm">
            <div className="font-semibold text-green-900">Marquer immédiatement comme "versé"</div>
            <div className="text-xs text-green-700 mt-0.5">
              Recommandé : le paiement est créé avec le statut "versé" et Francky reçoit une bannière
              pour le signer tout de suite.
            </div>
          </div>
        </label>

        {error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || montant <= 0}
            className="px-4 py-2 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center gap-1.5"
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Création...
              </>
            ) : (
              <>
                <FileSignature className="w-4 h-4" />
                Créer & proposer à signer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const WhatsappModal: React.FC<{
  phone: string;
  message: string;
  onPhoneChange: (p: string) => void;
  onClose: () => void;
}> = ({ phone, message, onPhoneChange, onClose }) => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      alert('Message copié !');
    } catch {
      // fallback
    }
  };

  const handleOpenWa = () => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-lg font-bold">Envoyer sur WhatsApp</h2>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <MessageCircle className="w-3.5 h-3.5 text-green-600" />
            Numéro du vendeur
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
            placeholder="+33612345678"
          />
          {!phone && (
            <p className="mt-1 text-xs text-amber-700">
              ⚠️ Aucun numéro configuré. Renseigne-le dans ⚙️ Paramètres &gt; "Numéro WhatsApp du vendeur"
              pour ne pas avoir à le retaper à chaque envoi.
            </p>
          )}
        </div>

        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            value={message}
            readOnly
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono bg-gray-50"
          />
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
          >
            Fermer
          </button>
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium"
          >
            <Copy className="w-4 h-4 inline mr-1" />
            Copier
          </button>
          <button
            onClick={handleOpenWa}
            disabled={!phone.replace(/[^0-9]/g, '')}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ExternalLink className="w-4 h-4 inline mr-1" />
            Ouvrir WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};

const InitConfigForm: React.FC<{
  onInit: any;
  userEmail: string;
  isAcheteur: boolean;
}> = ({ onInit, userEmail, isAcheteur }) => {
  const [nomCamion, setNomCamion] = useState('Le Petit Four');
  const [prixTotal, setPrixTotal] = useState(30000);
  const [montantMensuel, setMontantMensuel] = useState(500);
  const [dateDebut, setDateDebut] = useState(() => new Date().toISOString().slice(0, 10));

  if (!isAcheteur) {
    return (
      <CenterMessage
        icon={<Settings />}
        title="Configuration en attente"
        message="L'acheteur doit d'abord initialiser la configuration (prix total, montant mensuel, etc.)."
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-red-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="text-center">
          <div className="text-5xl">🍕</div>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Initialiser le contrat</h1>
          <p className="text-sm text-gray-600 mt-1">
            Configure le contrat d'achat du camion pizza.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom du camion</label>
          <input type="text" value={nomCamion} onChange={(e) => setNomCamion(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prix total (€)</label>
            <input type="number" value={prixTotal} onChange={(e) => setPrixTotal(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensuel (€)</label>
            <input type="number" value={montantMensuel} onChange={(e) => setMontantMensuel(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date de début du 1er versement</label>
          <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <p className="text-xs text-gray-500 text-center">
          Acheteur : <strong>{ACHETEUR_EMAIL}</strong><br />
          Vendeur : <strong>{VENDEUR_EMAIL}</strong>
        </p>
        <button
          onClick={async () => {
            try {
              await onInit({
                userEmail,
                prixTotal,
                montantMensuel,
                nomCamion,
                dateDebut: new Date(dateDebut).getTime(),
                acheteurNom: 'Freddy',
                acheteurEmail: ACHETEUR_EMAIL,
                vendeurNom: 'Francky',
                vendeurEmail: VENDEUR_EMAIL,
              });
            } catch (e) {
              alert('Erreur: ' + (e instanceof Error ? e.message : 'inconnue'));
            }
          }}
          className="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-lg font-bold text-lg shadow-lg"
        >
          Initialiser le contrat
        </button>
      </div>
    </div>
  );
};

const Confetti: React.FC = () => {
  // Génère 50 confettis avec positions et délais aléatoires
  const confettis = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 2,
    color: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'][i % 6],
    rotation: Math.random() * 360,
  }));
  return (
    <>
      {confettis.map((c) => (
        <div
          key={c.id}
          className="confetti-piece"
          style={{
            left: `${c.left}%`,
            backgroundColor: c.color,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`,
            transform: `rotate(${c.rotation}deg)`,
          }}
        />
      ))}
    </>
  );
};

export default PizzaTruckPage;
