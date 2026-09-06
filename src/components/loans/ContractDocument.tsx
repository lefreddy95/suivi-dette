import React from 'react';
import { FileText, Calendar, User, Hash } from 'lucide-react';

interface ContractDocumentProps {
  transaction: any;
  ownerName: string;
  personName: string;
}

/**
 * ContractDocument — Génère un texte de contrat à partir d'une transaction.
 *
 * Le contrat est affiché dans la page publique ET dans la fiche personne.
 * Le contenu est généré côté front (à partir des données de la transaction)
 * et stocké en DB au moment de la signature pour preuve.
 *
 * C'est un contrat SIMPLIFIÉ entre particuliers — pas un acte juridique
 * notarié. Il sert de preuve d'engagement mutuel (article 1366 du Code
 * civil : "L'écrit électronique a la même force probante que l'écrit
 * papier").
 */
const ContractDocument: React.FC<ContractDocumentProps> = ({
  transaction: tx, ownerName, personName,
}) => {
  const generatedAt = new Date(tx._creationTime || Date.now()).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const startDate = new Date(tx.startDate).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const isMoney = tx.type === 'money_lent' || tx.type === 'money_borrowed';
  const isItem = tx.type === 'item_lent' || tx.type === 'item_borrowed';
  const isService = tx.type === 'service_done' || tx.type === 'service_received';

  // Sens du prêt (qui doit quoi à qui)
  let sense = '';
  if (tx.type === 'money_lent') sense = `${ownerName} prête de l'argent à ${tx.counterpartyName || personName}`;
  else if (tx.type === 'money_borrowed') sense = `${ownerName} emprunte de l'argent à ${tx.counterpartyName || personName}`;
  else if (tx.type === 'item_lent') sense = `${ownerName} prête un objet à ${tx.counterpartyName || personName}`;
  else if (tx.type === 'item_borrowed') sense = `${ownerName} emprunte un objet à ${tx.counterpartyName || personName}`;
  else if (tx.type === 'service_done') sense = `${ownerName} rend un service à ${tx.counterpartyName || personName}`;
  else if (tx.type === 'service_received') sense = `${ownerName} reçoit un service de ${tx.counterpartyName || personName}`;

  const formatAmount = (n: number) =>
    n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatDate = (ts: number) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  };
  const frequencyLabel = tx.installmentFrequency === 'weekly' ? 'hebdomadaire'
    : tx.installmentFrequency === 'biweekly' ? 'bi-mensuelle (toutes les 2 semaines)'
    : tx.installmentFrequency === 'monthly' ? 'mensuelle'
    : tx.installmentFrequency === 'quarterly' ? 'trimestrielle'
    : '—';

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 space-y-5 max-w-2xl mx-auto">
      {/* === EN-TÊTE === */}
      <div className="text-center border-b border-gray-200 pb-4">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-100 rounded-full mb-2">
          <FileText className="w-6 h-6 text-orange-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Contrat d'engagement</h2>
        <p className="text-sm text-gray-500 mt-1">
          Document généré le {generatedAt} · Réf. {tx._id.slice(-8).toUpperCase()}
        </p>
      </div>

      {/* === ARTICLE 1 : LES PARTIES === */}
      <section>
        <h3 className="font-bold text-gray-900 mb-2">Article 1 — Les parties</h3>
        <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
          <p>
            <span className="font-semibold">Partie A (créancier/prêteur) :</span>{' '}
            {ownerName} <span className="text-gray-500">&lt;{tx.ownerEmail}&gt;</span>
          </p>
          <p>
            <span className="font-semibold">Partie B (débiteur/emprunteur) :</span>{' '}
            {tx.counterpartyName || personName}
            {tx.counterpartyEmail && (
              <span className="text-gray-500"> &lt;{tx.counterpartyEmail}&gt;</span>
            )}
          </p>
        </div>
      </section>

      {/* === ARTICLE 2 : L'OBJET === */}
      <section>
        <h3 className="font-bold text-gray-900 mb-2">Article 2 — L'objet du contrat</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          Par le présent contrat, <strong>{sense}</strong>.
        </p>
        <div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
          <p className="font-semibold text-gray-900">{tx.title}</p>
          {isMoney && tx.amount && (
            <p className="text-gray-700 mt-1">
              Montant total : <span className="font-bold text-orange-700">
                {formatAmount(tx.amount)} {tx.currency || 'EUR'}
              </span>
            </p>
          )}
          {isItem && tx.itemDescription && (
            <p className="text-gray-700 mt-1">
              <span className="font-semibold">Description de l'objet :</span> {tx.itemDescription}
            </p>
          )}
          {isService && tx.hoursLogged && (
            <p className="text-gray-700 mt-1">
              <span className="font-semibold">Heures prestées :</span> {tx.hoursLogged} h
            </p>
          )}
          {tx.note && (
            <p className="text-gray-600 mt-2 italic text-xs">« {tx.note} »</p>
          )}
        </div>
      </section>

      {/* === ARTICLE 3 : MODALITÉS DE REMBOURSEMENT === */}
      {isMoney && tx.installmentAmount && (
        <section>
          <h3 className="font-bold text-gray-900 mb-2">Article 3 — Modalités de remboursement</h3>
          <p className="text-sm text-gray-700 leading-relaxed">
            La Partie B s'engage à rembourser la Partie A selon l'échéancier suivant :
          </p>
          <ul className="mt-2 space-y-1 text-sm text-gray-700">
            <li>
              • <span className="font-semibold">Montant par échéance :</span>{' '}
              {formatAmount(tx.installmentAmount)} {tx.currency || 'EUR'}
            </li>
            <li>
              • <span className="font-semibold">Fréquence :</span> {frequencyLabel}
            </li>
            <li>
              • <span className="font-semibold">Première échéance :</span>{' '}
              {formatDate(tx.installmentStartDate)}
            </li>
            {tx.installmentCount && (
              <li>
                • <span className="font-semibold">Nombre d'échéances :</span>{' '}
                {tx.installmentCount}
              </li>
            )}
            {tx.dueDate && (
              <li>
                • <span className="font-semibold">Remboursement intégral attendu avant le :</span>{' '}
                {formatDate(tx.dueDate)}
              </li>
            )}
          </ul>
        </section>
      )}

      {/* === ARTICLE 4 : ENGAGEMENTS === */}
      <section>
        <h3 className="font-bold text-gray-900 mb-2">Article 4 — Engagements des parties</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          La Partie B s'engage à respecter l'échéancier ci-dessus et à informer la Partie A
          en cas de difficulté. La Partie A s'engage à fournir un reçu pour chaque paiement
          reçu. Tout remboursement sera confirmé par la signature numérique de la Partie A
          via la page publique de cette transaction.
        </p>
      </section>

      {/* === ARTICLE 5 : DATE D'EFFET === */}
      <section>
        <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-1.5">
          <Calendar className="w-4 h-4" />
          Article 5 — Entrée en vigueur
        </h3>
        <p className="text-sm text-gray-700">
          Le présent contrat entre en vigueur le <strong>{startDate}</strong>, date de sa
          signature numérique par les deux parties. Il prend fin au remboursement intégral
          de la somme due, ou à la restitution de l'objet/service selon le cas.
        </p>
      </section>

      {/* === SIGNATURES === */}
      <section className="border-t border-gray-200 pt-4">
        <h3 className="font-bold text-gray-900 mb-3">Signatures numériques</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SignatureSlot
            label={`Partie A — ${ownerName}`}
            signature={tx.signatures?.find((s: any) => s.signerRole === 'owner')}
          />
          <SignatureSlot
            label={`Partie B — ${tx.counterpartyName || personName}`}
            signature={tx.signatures?.find((s: any) => s.signerRole === 'counterparty')}
          />
        </div>
      </section>

      {/* === MENTION LÉGALE === */}
      <p className="text-[10px] text-gray-400 text-center italic pt-2">
        Document généré par Suivi-dette — Preuve d'engagement mutuel au sens de l'article 1366 du Code civil.
        Les signatures numériques apposées ont la même force probante qu'un écrit papier.
      </p>
    </div>
  );
};

// Slot de signature (affiché dans le contrat)
const SignatureSlot: React.FC<{ label: string; signature?: any }> = ({ label, signature }) => {
  if (!signature) {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          {label}
        </p>
        <div className="h-20 flex items-center justify-center">
          <p className="text-xs text-gray-400 italic">En attente de signature</p>
        </div>
      </div>
    );
  }
  return (
    <div className="border-2 border-green-300 bg-green-50 rounded-lg p-3 text-center">
      <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">
        {label}
      </p>
      <img
        src={signature.signaturePng}
        alt={`Signature de ${signature.signerName}`}
        className="h-20 mx-auto bg-white rounded"
      />
      <p className="text-[10px] text-gray-500 mt-1">
        {signature.signerName} · {new Date(signature.signedAt).toLocaleDateString('fr-FR')}
      </p>
    </div>
  );
};

export default ContractDocument;

// Helper : génère le texte brut du contrat (utilisé au moment de la signature)
export function generateContractText(
  tx: any, ownerName: string, personName: string,
): string {
  // Version simplifiée pour stockage DB
  const lines: string[] = [];
  lines.push(`CONTRAT D'ENGAGEMENT — Suivi-dette`);
  lines.push(`Référence : ${tx._id?.slice(-8).toUpperCase() || 'N/A'}`);
  lines.push(`Date : ${new Date(tx.startDate).toLocaleDateString('fr-FR')}`);
  lines.push('');
  lines.push(`Partie A (créancier) : ${ownerName} <${tx.ownerEmail}>`);
  lines.push(`Partie B (débiteur) : ${tx.counterpartyName || personName} <${tx.counterpartyEmail || 'email non renseigné'}>`);
  lines.push('');
  lines.push(`Objet : ${tx.title}`);
  if (tx.amount) lines.push(`Montant : ${tx.amount} ${tx.currency || 'EUR'}`);
  if (tx.itemDescription) lines.push(`Objet : ${tx.itemDescription}`);
  if (tx.installmentAmount) {
    lines.push(`Échéancier : ${tx.installmentAmount} ${tx.currency || 'EUR'} par ${tx.installmentFrequency}`);
    lines.push(`Première échéance : ${new Date(tx.installmentStartDate).toLocaleDateString('fr-FR')}`);
    if (tx.installmentCount) lines.push(`Nombre d'échéances : ${tx.installmentCount}`);
  }
  if (tx.note) lines.push(`Note : ${tx.note}`);
  return lines.join('\n');
}
