import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  FileSignature, Check, X, RefreshCw, AlertCircle, Calendar,
} from 'lucide-react';

interface ContractPageProps {
  userEmail: string;
  isAcheteur: boolean;
  isVendeur: boolean;
}

/**
 * ContractPage — Page dediee au contrat de cession du camion pizza.
 *
 * Affiche un visuel de contrat officiel (papier, en-tete, articles, signatures)
 * avec :
 *   - Parties (acheteur + vendeur) et leurs coordonnees
 *   - Objet du contrat (vente du camion pizza)
 *   - Prix total et modalites de paiement
 *   - 2 zones de signature (acheteur + vendeur) avec cachet CSS diagonal
 *   - Boutons "Signer ce contrat" (par partie) et "Annuler ma signature"
 *
 * Les signatures sont gerees cote Convex via les mutations :
 *   - signContract({userEmail}) : signe pour la partie correspondante
 *   - unsignContract({userEmail}) : annule la signature de la partie
 *   - resetContract({userEmail}) : reset les 2 signatures (admin only)
 */
const ContractPage: React.FC<ContractPageProps> = ({ userEmail, isAcheteur, isVendeur }) => {
  const summary = useQuery(api.pizza.getSummary, { userEmail });
  const signMut = useMutation(api.pizza.signContract);
  const unsignMut = useMutation(api.pizza.unsignContract);
  const resetMut = useMutation(api.pizza.resetContract);
  const [busy, setBusy] = useState<'sign' | 'unsign' | 'reset' | null>(null);

  if (summary === undefined) {
    return (
      <div className="text-center py-12 text-gray-500">
        Chargement du contrat...
      </div>
    );
  }
  if (summary === null) {
    return (
      <div className="text-center py-12 text-gray-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-orange-500" />
        Le contrat n'est pas encore initialise. Va d'abord sur l'onglet Calendrier pour creer la configuration.
      </div>
    );
  }

  const { config: cfg, payments, summary: sum } = summary;
  const acheteurSigned = !!cfg.contractSignedByAcheteurAt;
  const vendeurSigned = !!cfg.contractSignedByVendeurAt;
  const bothSigned = acheteurSigned && vendeurSigned;
  const myRole: 'acheteur' | 'vendeur' | null = isAcheteur ? 'acheteur' : isVendeur ? 'vendeur' : null;
  const mySigned = myRole === 'acheteur' ? acheteurSigned : myRole === 'vendeur' ? vendeurSigned : false;
  const mySignedAt = myRole === 'acheteur'
    ? cfg.contractSignedByAcheteurAt
    : myRole === 'vendeur'
      ? cfg.contractSignedByVendeurAt
      : null;

  // Pour l'affichage : montant total, nombre d'echeances prevues (mensuelles)
  const nbEcheancesRestantes = sum.pendingCount;
  const nbEcheancesTotal = payments.filter((p: any) => p.type !== 'ponctuel').length;
  const dateFin = sum.estimatedEndDate ? new Date(sum.estimatedEndDate) : null;

  const handleSign = async () => {
    if (!myRole) return;
    const ok = window.confirm(
      `Signer le contrat en tant que ${myRole === 'acheteur' ? 'ACHETEUR' : 'VENDEUR'} ?\n\n` +
      `Cette action sera tracee dans l'audit log avec ton email, IP et user-agent.`
    );
    if (!ok) return;
    setBusy('sign');
    try {
      await signMut({ userEmail });
    } catch (e) {
      alert('Erreur: ' + (e instanceof Error ? e.message : 'inconnue'));
    } finally {
      setBusy(null);
    }
  };
  const handleUnsign = async () => {
    if (!myRole) return;
    const ok = window.confirm(
      `Annuler ta signature de ${myRole === 'acheteur' ? 'acheteur' : 'vendeur'} ?\n\n` +
      `Possible seulement si l'autre partie n'a pas encore signe.`
    );
    if (!ok) return;
    setBusy('unsign');
    try {
      await unsignMut({ userEmail });
    } catch (e) {
      alert('Erreur: ' + (e instanceof Error ? e.message : 'inconnue'));
    } finally {
      setBusy(null);
    }
  };
  const handleReset = async () => {
    if (!isAcheteur) return;
    const ok = window.confirm(
      'RESET des 2 signatures du contrat ?\n\n' +
      '⚠️ Action admin : les 2 signatures seront supprimees. ' +
      'A utiliser seulement en cas d\'accord des 2 parties pour revoquer le contrat.'
    );
    if (!ok) return;
    setBusy('reset');
    try {
      await resetMut({ userEmail });
    } catch (e) {
      alert('Erreur: ' + (e instanceof Error ? e.message : 'inconnue'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* === STATUT GLOBAL === */}
      {bothSigned ? (
        <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
            <Check className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-green-900">Contrat signe par les 2 parties</h3>
            <p className="text-sm text-green-700">
              Le contrat est repute conclu depuis le{' '}
              {new Date(Math.max(
                cfg.contractSignedByAcheteurAt || 0,
                cfg.contractSignedByVendeurAt || 0
              )).toLocaleDateString('fr-FR')}.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
            <FileSignature className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-amber-900">Contrat en attente de signatures</h3>
            <p className="text-sm text-amber-700">
              {acheteurSigned ? '✓ Acheteur a signe' : '✗ Acheteur pas encore signe'} ·{' '}
              {vendeurSigned ? '✓ Vendeur a signe' : '✗ Vendeur pas encore signe'}
            </p>
          </div>
        </div>
      )}

      {/* === LE CONTRAT (visuel papier officiel) === */}
      <article className="bg-amber-50/40 shadow-2xl rounded-sm p-6 sm:p-10 border border-amber-200/60 relative">
        {/* Texture papier ancien (lignes très subtiles) */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 28px, #000 28px, #000 29px)'
        }} />

        {/* === EN-TETE === */}
        <header className="text-center mb-8 pb-6 border-b-2 border-double border-amber-900/30">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-900/70 mb-2">Contrat de cession</p>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-amber-950">
            {cfg.nomCamion}
          </h1>
          <p className="text-sm text-amber-900/60 mt-2">Camion pizza</p>
        </header>

        {/* === PREAMBULE === */}
        <section className="mb-6 font-serif text-amber-950">
          <p className="italic text-sm leading-relaxed">
            Conclu entre les soussignes, designes ci-apres, relativement a la cession
            du vehicule decrit dans le present contrat, dans le cadre d'un paiement
            echelonne consenti a l'amiable entre les parties.
          </p>
        </section>

        {/* === PARTIES === */}
        <section className="mb-6 grid sm:grid-cols-2 gap-4">
          <div className="border-l-4 border-blue-600 pl-4 py-2">
            <p className="text-xs uppercase tracking-wider text-blue-800 font-bold mb-1">L'Acquereur</p>
            <p className="font-serif text-lg font-bold text-amber-950">{cfg.acheteurNom}</p>
            <p className="text-sm text-amber-900/70">{cfg.acheteurEmail}</p>
            <p className="text-xs text-amber-900/50 mt-1">Ci-apres denomme « l'Acquereur »</p>
          </div>
          <div className="border-l-4 border-purple-600 pl-4 py-2">
            <p className="text-xs uppercase tracking-wider text-purple-800 font-bold mb-1">Le Vendeur</p>
            <p className="font-serif text-lg font-bold text-amber-950">{cfg.vendeurNom}</p>
            <p className="text-sm text-amber-900/70">{cfg.vendeurEmail}</p>
            <p className="text-xs text-amber-900/50 mt-1">Ci-apres denomme « le Vendeur »</p>
          </div>
        </section>

        {/* === ARTICLES === */}
        <section className="space-y-4 font-serif text-amber-950 text-[15px] leading-relaxed">
          <div>
            <h3 className="font-bold text-base mb-1">Article 1 — Objet</h3>
            <p>
              Le Vendeur cede a l'Acquereur, qui accepte, le vehicule de type camion pizza
              designe « {cfg.nomCamion} », en contrepartie du prix ci-apres defini.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-base mb-1">Article 2 — Prix</h3>
            <p>
              La cession est consentie moyennant le prix global et forfaitaire de{' '}
              <strong className="text-lg">{cfg.prixTotal.toLocaleString('fr-FR')} €</strong>{' '}
              ({(cfg.prixTotal).toLocaleString('fr-FR')} euros), payable selon les modalites
              de l'article suivant.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-base mb-1">Article 3 — Modalites de paiement</h3>
            <p>
              Le prix sera verse par mensualites de{' '}
              <strong>{cfg.montantMensuel.toLocaleString('fr-FR')} €</strong>{' '}
              ({(cfg.montantMensuel).toLocaleString('fr-FR')} euros), a compter du{' '}
              <strong>{new Date(cfg.dateDebut).toLocaleDateString('fr-FR')}</strong>.
              Le nombre total de mensualites est de <strong>{nbEcheancesTotal}</strong>,
              soit un terme prevu au <strong>{dateFin ? dateFin.toLocaleDateString('fr-FR') : 'N/A'}</strong>.
              L'Acquereur pourra proceder a des versements anticipes (ponctuels) sans
              penalite ; le calendrier des mensualites sera alors recalcule.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-base mb-1">Article 4 — Livraison</h3>
            <p>
              Le vehicule est livre dans l'etat ou il se trouve au jour de la signature des
              presentes, l'Acquereur le declarant bien connaitre pour l'avoir examine.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-base mb-1">Article 5 — Election de domicile</h3>
            <p>
              Pour l'execution des presentes, les parties font election de domicile a leurs
              adresses respectives sus-indiquees. Toute modification du present contrat devra
              faire l'objet d'un avenant ecrit signe par les deux parties.
            </p>
          </div>
        </section>

        {/* === SIGNATURES (avec cachet CSS diagonal) === */}
        <section className="mt-10 pt-6 border-t-2 border-amber-900/30 grid sm:grid-cols-2 gap-8">
          {/* Signature acheteur */}
          <div className="relative">
            <p className="text-xs uppercase tracking-wider text-blue-800 font-bold mb-3">
              Signature Acquereur
            </p>
            <div className="h-28 border-b-2 border-amber-900/30 relative flex items-end pb-2">
              {acheteurSigned && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="border-4 border-red-600/70 rounded-full w-24 h-24 flex items-center justify-center transform -rotate-12 bg-red-50/30">
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-red-700 uppercase">Signe</p>
                      <p className="text-[9px] text-red-600">
                        {cfg.contractSignedByAcheteurAt
                          ? new Date(cfg.contractSignedByAcheteurAt).toLocaleDateString('fr-FR')
                          : ''}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm text-amber-950 font-serif mt-1">{cfg.acheteurNom}</p>
            {acheteurSigned && cfg.contractSignedByAcheteurAt && (
              <p className="text-xs text-amber-900/50 mt-1">
                Signe le {new Date(cfg.contractSignedByAcheteurAt).toLocaleString('fr-FR')}
              </p>
            )}
          </div>

          {/* Signature vendeur */}
          <div className="relative">
            <p className="text-xs uppercase tracking-wider text-purple-800 font-bold mb-3">
              Signature Vendeur
            </p>
            <div className="h-28 border-b-2 border-amber-900/30 relative flex items-end pb-2">
              {vendeurSigned && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="border-4 border-red-600/70 rounded-full w-24 h-24 flex items-center justify-center transform -rotate-12 bg-red-50/30">
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-red-700 uppercase">Signe</p>
                      <p className="text-[9px] text-red-600">
                        {cfg.contractSignedByVendeurAt
                          ? new Date(cfg.contractSignedByVendeurAt).toLocaleDateString('fr-FR')
                          : ''}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm text-amber-950 font-serif mt-1">{cfg.vendeurNom}</p>
            {vendeurSigned && cfg.contractSignedByVendeurAt && (
              <p className="text-xs text-amber-900/50 mt-1">
                Signe le {new Date(cfg.contractSignedByVendeurAt).toLocaleString('fr-FR')}
              </p>
            )}
          </div>
        </section>

        {/* === Mention finale === */}
        <p className="text-center text-[10px] text-amber-900/40 mt-8 italic font-serif">
          Fait en deux exemplaires, un pour chaque partie, le{' '}
          {new Date(cfg.dateDebut).toLocaleDateString('fr-FR')}.
        </p>
      </article>

      {/* === BOUTONS D'ACTION === */}
      <div className="flex flex-wrap gap-2 justify-center">
        {myRole && !mySigned && (
          <button
            onClick={handleSign}
            disabled={busy !== null}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-bold shadow-lg flex items-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
          >
            <FileSignature className="w-5 h-5" />
            {busy === 'sign' ? 'Signature...' : 'Signer le contrat'}
          </button>
        )}
        {myRole && mySigned && !bothSigned && (
          <button
            onClick={handleUnsign}
            disabled={busy !== null}
            className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            {busy === 'unsign' ? 'Annulation...' : 'Annuler ma signature'}
          </button>
        )}
        {isAcheteur && bothSigned && (
          <button
            onClick={handleReset}
            disabled={busy !== null}
            className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            {busy === 'reset' ? 'Reset...' : 'Reset signatures (admin)'}
          </button>
        )}
      </div>

      {/* === INFO METADATA === */}
      <div className="text-center text-xs text-gray-500">
        <p>
          Document signe electroniquement. Chaque signature est tracee dans l'audit log avec
          email, IP, user-agent et timestamp.
        </p>
        {mySignedAt && (
          <p className="mt-1">
            <Calendar className="w-3 h-3 inline mr-1" />
            Tu as signe le {new Date(mySignedAt).toLocaleString('fr-FR')}
          </p>
        )}
      </div>
    </div>
  );
};

export default ContractPage;
