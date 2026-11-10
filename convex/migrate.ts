// =========================================================================
// migrate.ts — Migration ONE-OFF : tables legacy pizza -> dette unique
// =========================================================================
// A executer une seule fois, puis ce fichier est supprime (commit suivant).
//
// Les tables legacy (pizzaConfig / pizzaPayments / pizzaAuditLog) decrivent
// EXACTEMENT la dette du camion pizza :
//   prixTotal 30 000 €, mensualite 500 €, acheteur Freddy, vendeur Francky,
//   1 versement "verse" de 5 000 € (septembre) + mensualites mensuelles
//   a partir de septembre 2026.
//
// Ce module les convertit en UNE transaction "money_borrowed" dans les
// tables people / transactions, en conservant :
//   - la signature deja donnee par Freddy sur le contrat d'origine,
//   - les 2 versements (5 000 € + 500 €),
//   - un echeancier de 49 mensualites de 500 € a partir du 7 novembre 2026.
// =========================================================================

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

const OWNER_EMAIL = "lefreddy95@gmail.com";

/** Whitelist temporaire (meme liste que loans.ts, cf. TODO multi-tenant). */
const ALLOWED_USERS = new Set<string>([
  "lefreddy95@gmail.com",
  "franckylobry6@gmail.com",
]);

function checkUser(email: string | null | undefined) {
  if (!email || !ALLOWED_USERS.has(email)) {
    throw new ConvexError("Acces refuse : utilisateur non autorise");
  }
  return email;
}

/** Token URL-safe (24 caracteres) pour les liens publics. */
function genToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let token = "";
  for (let i = 0; i < 24; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export const migrateLegacyPizzaToSingleDebt = mutation({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    checkUser(args.userEmail);

    const config = await ctx.db.query("pizzaConfig").first();
    if (!config) {
      return { migrated: false, message: "Aucune config legacy trouvee" };
    }

    // --- Idempotence : si la dette existe deja, on ne fait rien -----------
    const existing = await ctx.db
      .query("transactions")
      .withIndex("by_owner", (q) => q.eq("ownerEmail", OWNER_EMAIL))
      .collect();
    const already = existing.find((t) => t.isPrimaryDebt);
    if (already) {
      return {
        migrated: false,
        message: "Dette deja migree",
        transactionId: already._id,
      };
    }

    const now = Date.now();

    // --- 1. La personne (Francky, vendeur) --------------------------------
    const people = await ctx.db
      .query("people")
      .withIndex("by_owner", (q) => q.eq("ownerEmail", OWNER_EMAIL))
      .collect();
    let person =
      people.find(
        (p) =>
          (p.email ?? "").toLowerCase() === config.vendeurEmail.toLowerCase()
      ) ??
      people.find((p) => p.name.toLowerCase().includes("francky")) ??
      null;

    if (!person) {
      const id = await ctx.db.insert("people", {
        ownerEmail: OWNER_EMAIL,
        name: config.vendeurNom || "Francky",
        email: config.vendeurEmail,
        phone: config.vendeurPhone || undefined,
        notes: "Vendeur du camion pizza",
        color: "#3B82F6",
        createdAt: now,
        updatedAt: now,
      });
      person = (await ctx.db.get(id))!;
    } else {
      const patch: Record<string, any> = { updatedAt: now };
      if (!person.email) patch.email = config.vendeurEmail;
      if (!person.phone && config.vendeurPhone) patch.phone = config.vendeurPhone;
      await ctx.db.patch(person._id, patch);
    }

    // --- 2. Les versements deja faits -------------------------------------
    const legacyPayments = await ctx.db
      .query("pizzaPayments")
      .withIndex("by_numero")
      .collect();

    // 2a. Les paiements deja "verse" (le 5 000 € de septembre)
    const alreadyPaid = legacyPayments.filter((p) => p.status === "verse");

    // 2b. La mensualite d'octobre 2026 (l'utilisateur a verse 500 € en
    //     octobre : elle est encore "en_attente" dans les tables legacy)
    const octoberStart = Date.UTC(2026, 9, 1);
    const novemberStart = Date.UTC(2026, 10, 1);
    const octoberPayment = legacyPayments.find(
      (p) =>
        p.type === "mensuel" &&
        p.dateEcheance >= octoberStart &&
        p.dateEcheance < novemberStart
    );

    const repayments: Array<{
      amount: number;
      date: number;
      note: string;
      signToken: string;
    }> = [];
    let totalRepaid = 0;

    for (const p of alreadyPaid) {
      const date = p.dateVersement ?? p.dateEcheance ?? p.createdAt;
      repayments.push({
        amount: p.montant,
        date,
        note: p.note || "Versement de septembre",
        signToken: genToken(),
      });
      totalRepaid += p.montant;
    }

    if (octoberPayment) {
      repayments.push({
        amount: octoberPayment.montant,
        date: octoberPayment.dateEcheance,
        note: "Mensualité d'octobre",
        signToken: genToken(),
      });
      totalRepaid += octoberPayment.montant;
    }

    // --- 3. L'echeancier restant -----------------------------------------
    const total = config.prixTotal;
    const monthly = config.montantMensuel || 500;
    const remaining = Math.max(0, total - totalRepaid);
    const count = Math.ceil(remaining / monthly);

    // 1re echeance : le mois suivant la mensualite d'octobre, meme jour
    const lastPaymentDate = octoberPayment
      ? octoberPayment.dateEcheance
      : Date.UTC(2026, 9, 7);
    const start = new Date(lastPaymentDate);
    start.setMonth(start.getMonth() + 1);
    const installmentStartDate = start.getTime();

    const end = new Date(installmentStartDate);
    end.setMonth(end.getMonth() + count - 1);
    const dueDate = end.getTime();

    // --- 4. Les evenements (timeline) -------------------------------------
    const events: Array<{
      type: string;
      date: number;
      actor: string;
      details?: string;
      signerName?: string;
      signerRole?: "owner" | "counterparty";
    }> = [];

    // Signature du contrat d'origine (donnee par Freddy le 5 sept. 2026)
    const signatures: Array<{
      signerName: string;
      signerEmail: string;
      signerRole: "owner" | "counterparty";
      signedAt: number;
      signaturePng: string;
      signatureHash: string;
    }> = [];

    if (config.contractSignedByAcheteurAt) {
      signatures.push({
        signerName: config.acheteurNom || "Freddy",
        signerEmail: OWNER_EMAIL,
        signerRole: "owner",
        signedAt: config.contractSignedByAcheteurAt,
        signaturePng: "",
        signatureHash: "legacy-pizza-contract",
      });
      events.push({
        type: "contract_signed",
        date: config.contractSignedByAcheteurAt,
        actor: OWNER_EMAIL,
        signerName: config.acheteurNom || "Freddy",
        signerRole: "owner",
        details: "Contrat d'origine signé (camion pizza)",
      });
    }

    for (const r of repayments) {
      events.push({
        type: "repayment_added",
        date: r.date,
        actor: OWNER_EMAIL,
        details: `Versement de ${r.amount} €${r.note ? ` (${r.note})` : ""}`,
      });
    }

    // --- 5. La dette unique ------------------------------------------------
    const firstPaymentDate = repayments.length
      ? Math.min(...repayments.map((r) => r.date))
      : config.dateDebut;

    const transactionId = await ctx.db.insert("transactions", {
      ownerEmail: OWNER_EMAIL,
      personId: person._id,
      type: "money_borrowed",
      title: `${config.nomCamion || "Camion pizza"} - achat à crédit`,
      amount: total,
      currency: "EUR",
      startDate: firstPaymentDate,
      dueDate,
      status: "en_cours",
      totalRepaid,
      repayments,
      installmentAmount: monthly,
      installmentFrequency: "monthly",
      installmentStartDate,
      installmentCount: count,
      counterpartyEmail: config.vendeurEmail,
      counterpartyName: config.vendeurNom || "Francky",
      counterpartyPhone: config.vendeurPhone || undefined,
      publicToken: genToken(),
      signatures,
      events,
      note:
        `Achat à crédit du ${config.nomCamion || "camion pizza"}. ` +
        `Déjà versé : 5 000 € (septembre) + 500 € (octobre). ` +
        `Reste ${remaining} € en ${count} mensualités de ${monthly} €.`,
      isPrimaryDebt: true,
      createdAt: now,
      updatedAt: now,
    });

    return {
      migrated: true,
      transactionId,
      total,
      totalRepaid,
      remaining,
      installments: count,
      firstInstallment: installmentStartDate,
      lastInstallment: dueDate,
      message: `Dette unique migratee : ${total} €, deja verse ${totalRepaid} €, reste ${remaining} € en ${count} mensualites de ${monthly} €`,
    };
  },
});
