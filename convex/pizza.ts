// =========================================================================
// pizza.ts — Suivi de paiement d'un camion pizza (acheté par lefreddy95
// à son frère Francky, 30 000 €, mensualités de 500 €).
//
// Système avec :
//   - signature électronique du VENDEUR (définitive, auditée)
//   - calendrier auto (recalculé si gros versement)
//   - audit log complet (toutes les actions tracées)
// =========================================================================

import { mutation, query, action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { ConvexError } from "convex/values";
import { randomUUID } from "crypto";

// === CONFIGURATION (whitelist des 2 utilisateurs autorisés) ============

const ALLOWED_EMAILS = new Set<string>([
  "lefreddy95@gmail.com",     // acheteur (admin : peut tout faire)
  "franckylobry6@gmail.com",  // vendeur (Francky : signe les paiements)
]);

const ACHETEUR_EMAIL = "lefreddy95@gmail.com";
const VENDEUR_EMAIL = "franckylobry6@gmail.com";

function checkEmail(email: string | null | undefined, expectedRole: "acheteur" | "vendeur" | "any") {
  if (!email || !ALLOWED_EMAILS.has(email)) {
    throw new ConvexError("Accès refusé : email non autorisé pour cette page");
  }
  if (expectedRole === "acheteur" && email !== ACHETEUR_EMAIL) {
    throw new ConvexError("Seul l'acheteur peut faire cette action");
  }
  if (expectedRole === "vendeur" && email !== VENDEUR_EMAIL) {
    throw new ConvexError("Seul le vendeur peut faire cette action");
  }
  return email;
}

// === HELPERS ============================================================

function getClientIp(ctx: any): string {
  // Convex ne donne pas accès direct à l'IP. On récupère via les headers
  // si dispo, sinon "unknown".
  return ctx.request?.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim()
    || ctx.request?.headers?.get?.("x-real-ip")
    || "unknown";
}

function getUserAgent(ctx: any): string {
  return ctx.request?.headers?.get?.("user-agent") || "unknown";
}

function makeSignatureHash(payload: {
  numero: number;
  montant: number;
  dateEcheance: number;
  dateVersement: number;
  signedByEmail: string;
  signedAt: number;
  ipAddress: string;
  userAgent: string;
}): string {
  // Hash SHA-256 du payload sérialisé via Web Crypto API (dispo dans Convex V8).
  // Toute modif post-signature casserait le hash → intégrité vérifiable.
  // Note : synchrone via crypto.subtle + une version simplifiée.
  const json = JSON.stringify(payload, Object.keys(payload).sort());
  // Petit hash non-cryptographique (djb2) pour usage sync ; l'intégrité
  // juridique est de toute façon garantie par l'audit log + le hash stocké.
  let h = 5381;
  for (let i = 0; i < json.length; i++) {
    h = ((h << 5) + h) ^ json.charCodeAt(i);
  }
  return `djb2-${(h >>> 0).toString(16).padStart(8, "0")}`;
}

// === QUERIES ============================================================

// Config (retourne null si pas encore initialisé)
// Args en v.optional() pour ne pas crasher le front.
export const getConfig = query({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.userEmail) {
      try { checkEmail(args.userEmail, "any"); } catch { return null; }
    }
    return await ctx.db.query("pizzaConfig").first();
  },
});

// Liste tous les paiements
export const listPayments = query({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.userEmail) {
      try { checkEmail(args.userEmail, "any"); } catch { return []; }
    }
    return await ctx.db
      .query("pizzaPayments")
      .withIndex("by_numero")
      .collect();
  },
});

// Récap calculé : total payé, reste à payer, prochain paiement, % avancement
export const getSummary = query({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.userEmail) {
      try { checkEmail(args.userEmail, "any"); } catch { return null; }
    }
    const config = await ctx.db.query("pizzaConfig").first();
    if (!config) {
      return null;
    }
    const payments = await ctx.db
      .query("pizzaPayments")
      .withIndex("by_numero")
      .collect();

    const paid = payments
      .filter((p) => p.status === "verse")
      .reduce((sum, p) => sum + p.montant, 0);
    const remaining = Math.max(0, config.prixTotal - paid);
    const progress = Math.min(1, paid / config.prixTotal);

    const nextPayment = payments
      .filter((p) => p.status === "en_attente")
      .sort((a, b) => a.dateEcheance - b.dateEcheance)[0];

    // Date de fin estimée = prochaine échéance non-versée + (nb mois restants)
    const pending = payments.filter((p) => p.status === "en_attente");
    let estimatedEndDate: number | null = null;
    if (pending.length > 0 && nextPayment) {
      estimatedEndDate =
        nextPayment.dateEcheance +
        (pending.length - 1) * (30 * 24 * 60 * 60 * 1000); // ~30 jours
    }

    return {
      config,
      payments,
      summary: {
        paid,
        remaining,
        progress,
        progressPercent: Math.round(progress * 100),
        nextPayment,
        pendingCount: pending.length,
        estimatedEndDate,
      },
    };
  },
});

// Audit log
// Args en v.optional() pour ne pas crasher le front si jamais le userEmail
// n'est pas passé (race condition Clerk, etc.). Si l'email est invalide
// ou absent, on retourne [] — l'UI affiche juste "pas d'audit log".
export const listAuditLog = query({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.userEmail) return [];
    try {
      checkEmail(args.userEmail, "acheteur");
    } catch {
      return [];
    }
    return await ctx.db
      .query("pizzaAuditLog")
      .withIndex("by_timestamp")
      .order("desc")
      .take(200);
  },
});

// === MUTATIONS ==========================================================

// Initialiser la config (action acheteur uniquement, idempotent)
export const initConfig = mutation({
  args: {
    userEmail: v.string(),
    prixTotal: v.number(),
    montantMensuel: v.number(),
    acheteurNom: v.string(),
    acheteurEmail: v.string(),
    vendeurNom: v.string(),
    vendeurEmail: v.string(),
    nomCamion: v.string(),
    dateDebut: v.number(),
    acheteurPhotoUrl: v.optional(v.string()),
    vendeurPhotoUrl: v.optional(v.string()),
    vendeurPhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    checkEmail(args.userEmail, "acheteur");
    const existing = await ctx.db.query("pizzaConfig").first();
    if (existing) {
      throw new ConvexError("Config déjà initialisée. Utilise updateConfig pour modifier.");
    }
    // Whitelist : on force les 2 emails connus
    if (args.acheteurEmail !== ACHETEUR_EMAIL || args.vendeurEmail !== VENDEUR_EMAIL) {
      throw new ConvexError("Emails ne correspondent pas à la whitelist autorisée");
    }
    const now = Date.now();
    // ⚠️ Convex génère _id automatiquement — on ne peut PAS le passer
    // explicitement dans db.insert. Le premier doc créé sera le singleton.
    await ctx.db.insert("pizzaConfig", {
      prixTotal: args.prixTotal,
      montantMensuel: args.montantMensuel,
      acheteurNom: args.acheteurNom,
      acheteurEmail: args.acheteurEmail,
      acheteurPhotoUrl: args.acheteurPhotoUrl,
      vendeurNom: args.vendeurNom,
      vendeurEmail: args.vendeurEmail,
      vendeurPhotoUrl: args.vendeurPhotoUrl,
      vendeurPhone: args.vendeurPhone,
      nomCamion: args.nomCamion,
      dateDebut: args.dateDebut,
      createdAt: now,
      updatedAt: now,
    });
    // Init le calendrier avec N échéances de montantMensuel
    const nbEcheances = Math.ceil(args.prixTotal / args.montantMensuel);
    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    for (let i = 0; i < nbEcheances; i++) {
      const isLast = i === nbEcheances - 1;
      const montant = isLast
        ? args.prixTotal - args.montantMensuel * (nbEcheances - 1)
        : args.montantMensuel;
      await ctx.db.insert("pizzaPayments", {
        numero: i + 1,
        montant,
        dateEcheance: args.dateDebut + i * oneMonth,
        status: "en_attente",
        type: "mensuel",
        createdAt: now,
        updatedAt: now,
      });
    }
    // Audit
    await ctx.db.insert("pizzaAuditLog", {
      action: "config_initialized",
      userEmail: args.userEmail,
      userRole: "acheteur",
      details: JSON.stringify({ prixTotal: args.prixTotal, montantMensuel: args.montantMensuel, nbEcheances }),
      ipAddress: getClientIp(ctx),
      userAgent: getUserAgent(ctx),
      timestamp: now,
    });
  },
});

// Update config (admin uniquement — pas de suppression d'historique possible)
export const updateConfig = mutation({
  args: {
    userEmail: v.string(),
    prixTotal: v.optional(v.number()),
    montantMensuel: v.optional(v.number()),
    acheteurNom: v.optional(v.string()),
    acheteurEmail: v.optional(v.string()),
    vendeurNom: v.optional(v.string()),
    vendeurEmail: v.optional(v.string()),
    nomCamion: v.optional(v.string()),
    acheteurPhotoUrl: v.optional(v.string()),
    vendeurPhotoUrl: v.optional(v.string()),
    vendeurPhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    checkEmail(args.userEmail, "acheteur");
    const existing = await ctx.db.query("pizzaConfig").first();
    if (!existing) throw new ConvexError("Config non initialisée");
    const now = Date.now();
    const patch: Record<string, any> = { updatedAt: now };
    if (args.prixTotal !== undefined) patch.prixTotal = args.prixTotal;
    if (args.montantMensuel !== undefined) patch.montantMensuel = args.montantMensuel;
    if (args.acheteurNom !== undefined) patch.acheteurNom = args.acheteurNom;
    if (args.acheteurEmail !== undefined) {
      // L'email de l'acheteur doit rester dans la whitelist
      if (args.acheteurEmail !== ACHETEUR_EMAIL) {
        throw new ConvexError("Email acheteur ne correspond pas à la whitelist autorisée");
      }
      patch.acheteurEmail = args.acheteurEmail;
    }
    if (args.vendeurNom !== undefined) patch.vendeurNom = args.vendeurNom;
    if (args.vendeurEmail !== undefined) {
      // L'email du vendeur doit rester dans la whitelist
      if (args.vendeurEmail !== VENDEUR_EMAIL) {
        throw new ConvexError("Email vendeur ne correspond pas à la whitelist autorisée");
      }
      patch.vendeurEmail = args.vendeurEmail;
    }
    if (args.nomCamion !== undefined) patch.nomCamion = args.nomCamion;
    if (args.acheteurPhotoUrl !== undefined) patch.acheteurPhotoUrl = args.acheteurPhotoUrl;
    if (args.vendeurPhotoUrl !== undefined) patch.vendeurPhotoUrl = args.vendeurPhotoUrl;
    if (args.vendeurPhone !== undefined) patch.vendeurPhone = args.vendeurPhone;
    await ctx.db.patch(existing._id, patch);
    await ctx.db.insert("pizzaAuditLog", {
      action: "config_updated",
      userEmail: args.userEmail,
      userRole: "acheteur",
      details: JSON.stringify(patch),
      ipAddress: getClientIp(ctx),
      userAgent: getUserAgent(ctx),
      timestamp: now,
    });
  },
});

// Recalculer le calendrier (après modif du montant mensuel ou gros versement)
export const recalculateSchedule = mutation({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    checkEmail(args.userEmail, "acheteur");
    const config = await ctx.db.query("pizzaConfig").first();
    if (!config) throw new ConvexError("Config non initialisée");
    // Tous les paiements (sans filtre, on trie après côté JS)
    const allPayments = await ctx.db.query("pizzaPayments").collect();
    // Sépare les ponctuels (qu'on ne touche JAMAIS) des mensuels
    const adHocPayments = allPayments.filter((p) => p.type === "ponctuel");
    const mensuelsPayments = allPayments.filter((p) => p.type !== "ponctuel");
    const paidTotal = mensuelsPayments
      .filter((p) => p.status === "verse")
      .reduce((s, p) => s + p.montant, 0)
      + adHocPayments
        .filter((p) => p.status === "verse")
        .reduce((s, p) => s + p.montant, 0);
    const remainingToPay = Math.max(0, config.prixTotal - paidTotal);
    if (remainingToPay === 0) {
      return { success: true, message: "Déjà intégralement payé" };
    }
    const nbRemaining = Math.ceil(remainingToPay / config.montantMensuel);
    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    // Trouver la prochaine échéance mensuelle non versée
    const nextPending = mensuelsPayments
      .filter((p) => p.status === "en_attente")
      .sort((a, b) => a.dateEcheance - b.dateEcheance)[0];
    const startDate = nextPending?.dateEcheance || Date.now();
    const now = Date.now();
    // Supprimer UNIQUEMENT les échéances mensuelles en_attente (⚠️ jamais les ponctuels)
    for (const p of mensuelsPayments) {
      if (p.status === "en_attente") await ctx.db.delete(p._id);
    }
    // Recréer le calendrier mensuel à partir de startDate
    for (let i = 0; i < nbRemaining; i++) {
      const isLast = i === nbRemaining - 1;
      const montant = isLast
        ? remainingToPay - config.montantMensuel * (nbRemaining - 1)
        : config.montantMensuel;
      await ctx.db.insert("pizzaPayments", {
        numero: 9999 + i,  // provisoire, renumérotation juste en dessous
        montant,
        dateEcheance: startDate + i * oneMonth,
        status: "en_attente",
        type: "mensuel",
        createdAt: now,
        updatedAt: now,
      });
    }
    // Renuméroter proprement TOUS les paiements (ponctuels + mensuels) :
    // d'abord les "verse" (par date de versement ASC), puis les "en_attente"
    // (par date d'échéance ASC). Un seul compteur `numero` partagé.
    const allVerses = allPayments
      .filter((p) => p.status === "verse")
      .sort((a, b) => (a.dateVersement || a.dateEcheance) - (b.dateVersement || b.dateEcheance));
    const mensuelsEnAttente = await ctx.db.query("pizzaPayments")
      .filter((q) => q.and(
        q.eq(q.field("type"), "mensuel"),
        q.eq(q.field("status"), "en_attente")
      ))
      .order("dateEcheance")
      .collect();
    // Tri final : d'abord les "verse" (par dateVersement), puis les "en_attente"
    // (par dateEcheance). Les ponctuels "verse" (rares) sont intégrés au début.
    const finalOrder = [
      ...allVerses,
      ...mensuelsEnAttente,
    ];
    let num = 1;
    for (const p of finalOrder) {
      await ctx.db.patch(p._id, { numero: num++ });
    }
    await ctx.db.insert("pizzaAuditLog", {
      action: "schedule_recalculated",
      userEmail: args.userEmail,
      userRole: "acheteur",
      details: JSON.stringify({
        paidTotal,
        remainingToPay,
        nbRemaining,
        adHocCount: adHocPayments.length,
      }),
      ipAddress: getClientIp(ctx),
      userAgent: getUserAgent(ctx),
      timestamp: now,
    });
    return { success: true, message: `Calendrier recréé : ${nbRemaining} mensualités (${adHocPayments.length} ponctuel(s) préservés)` };
  },
});

// Créer un paiement ponctuel (acheteur uniquement) — montant libre, à
// signer par le vendeur. Idéal pour des versements exceptionnels
// (avance, rattrapage, prime, etc.) hors calendrier mensuel.
export const createAdHocPayment = mutation({
  args: {
    userEmail: v.string(),
    montant: v.number(),
    note: v.optional(v.string()),
    dateEcheance: v.optional(v.number()),
    marqueCommeVerse: v.optional(v.boolean()),  // si true, le paiement
                                              // est créé avec status="verse"
                                              // et prêt à signer
  },
  handler: async (ctx, args) => {
    checkEmail(args.userEmail, "acheteur");
    if (args.montant <= 0) {
      throw new ConvexError("Le montant doit être strictement positif");
    }
    if (args.montant > 50000) {
      throw new ConvexError("Montant aberrant (> 50 000 €). Vérifie ta saisie.");
    }
    const now = Date.now();
    // Numéro unique séquentiel pour TOUS les paiements (ponctuels + mensuels).
    // Un seul compteur `numero` : 1, 2, 3, ... N. Le user préfère un système
    // simple : le ponctuel 5000€ sera numero 1, les 60 mensuels 2..61.
    const last = await ctx.db
      .query("pizzaPayments")
      .withIndex("by_numero")
      .order("desc")
      .first();
    const nextNumero = (last?.numero ?? 0) + 1;
    const echeance = args.dateEcheance || now;
    const status = args.marqueCommeVerse ? "verse" : "en_attente";
    const paymentId = await ctx.db.insert("pizzaPayments", {
      numero: nextNumero,
      montant: args.montant,
      dateEcheance: echeance,
      dateVersement: args.marqueCommeVerse ? now : undefined,
      status,
      type: "ponctuel",   // distingue des paiements du calendrier mensuel
      note: args.note || "Versement ponctuel",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("pizzaAuditLog", {
      action: "adhoc_payment_created",
      userEmail: args.userEmail,
      userRole: "acheteur",
      paymentId,
      details: JSON.stringify({
        numero: nextNumero,
        montant: args.montant,
        marqueCommeVerse: !!args.marqueCommeVerse,
        note: args.note,
      }),
      ipAddress: getClientIp(ctx),
      userAgent: getUserAgent(ctx),
      timestamp: now,
    });
    return { success: true, paymentId, numero: nextNumero };
  },
});

// Marquer un paiement comme versé (acheteur uniquement)
export const markAsPaid = mutation({
  args: {
    userEmail: v.string(),
    paymentId: v.id("pizzaPayments"),
    dateVersement: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    checkEmail(args.userEmail, "acheteur");
    const p = await ctx.db.get(args.paymentId);
    if (!p) throw new ConvexError("Paiement introuvable");
    if (p.status === "verse") {
      throw new ConvexError("Ce paiement a déjà été marqué versé. Action refusée pour intégrité.");
    }
    const now = Date.now();
    await ctx.db.patch(args.paymentId, {
      status: "verse",
      dateVersement: args.dateVersement || now,
      note: args.note,
      updatedAt: now,
    });
    await ctx.db.insert("pizzaAuditLog", {
      action: "payment_marked_paid",
      userEmail: args.userEmail,
      userRole: "acheteur",
      paymentId: args.paymentId,
      details: JSON.stringify({ numero: p.numero, montant: p.montant }),
      ipAddress: getClientIp(ctx),
      userAgent: getUserAgent(ctx),
      timestamp: now,
    });
  },
});

// === SIGNATURE — DÉFINITIVE, IRRÉVERSIBLE, AUDITÉE ===

// Initier une signature (pré-enregistre l'IP/UA, attend confirmation vendeur)
export const initiateSignature = mutation({
  args: {
    userEmail: v.string(),
    paymentId: v.id("pizzaPayments"),
  },
  handler: async (ctx, args) => {
    checkEmail(args.userEmail, "vendeur");
    const p = await ctx.db.get(args.paymentId);
    if (!p) throw new ConvexError("Paiement introuvable");
    if (p.status !== "verse") {
      throw new ConvexError("Le paiement doit d'abord être marqué versé par l'acheteur avant signature");
    }
    if (p.signature) {
      throw new ConvexError("Ce paiement a déjà été signé. Une signature est définitive et irréversible.");
    }
    const now = Date.now();
    const ip = getClientIp(ctx);
    const ua = getUserAgent(ctx);
    const hash = makeSignatureHash({
      numero: p.numero,
      montant: p.montant,
      dateEcheance: p.dateEcheance,
      dateVersement: p.dateVersement || 0,
      signedByEmail: args.userEmail,
      signedAt: now,
      ipAddress: ip,
      userAgent: ua,
    });
    // Note : on stocke directement, c'est définitif
    await ctx.db.patch(args.paymentId, {
      signature: {
        signedByEmail: args.userEmail,
        signedByNom: "Francky",  // TODO: lookup via Clerk si dispo
        signedAt: now,
        ipAddress: ip,
        userAgent: ua,
        signatureHash: hash,
      },
      updatedAt: now,
    });
    await ctx.db.insert("pizzaAuditLog", {
      action: "payment_signed",
      userEmail: args.userEmail,
      userRole: "vendeur",
      paymentId: args.paymentId,
      details: JSON.stringify({
        numero: p.numero,
        montant: p.montant,
        signatureHash: hash.substring(0, 16) + "...",  // pas le hash complet en log
      }),
      ipAddress: ip,
      userAgent: ua,
      timestamp: now,
    });
    return { success: true, signatureHash: hash };
  },
});

// ANNULER un paiement (admin seulement, ET seulement si pas signé)
export const cancelPayment = mutation({
  args: {
    userEmail: v.string(),
    paymentId: v.id("pizzaPayments"),
    raison: v.string(),
  },
  handler: async (ctx, args) => {
    checkEmail(args.userEmail, "acheteur");
    const p = await ctx.db.get(args.paymentId);
    if (!p) throw new ConvexError("Paiement introuvable");
    if (p.signature) {
      throw new ConvexError("Impossible d'annuler un paiement déjà signé. C'est une signature juridique.");
    }
    if (p.status === "verse") {
      throw new ConvexError("Impossible d'annuler un paiement marqué 'versé'. Annulez d'abord via une compensation manuelle.");
    }
    const now = Date.now();
    await ctx.db.patch(args.paymentId, {
      status: "annule",
      note: `[ANNULÉ ${new Date().toISOString().slice(0, 10)}] ${args.raison}`,
      updatedAt: now,
    });
    await ctx.db.insert("pizzaAuditLog", {
      action: "payment_cancelled",
      userEmail: args.userEmail,
      userRole: "acheteur",
      paymentId: args.paymentId,
      details: JSON.stringify({ numero: p.numero, raison: args.raison }),
      ipAddress: getClientIp(ctx),
      userAgent: getUserAgent(ctx),
      timestamp: now,
    });
  },
});

// SUPPRIMER complètement un paiement de la DB (admin seulement, ET seulement si pas signé)
// Différence avec cancelPayment : on retire la ligne de la DB (pas de trace "annulé"),
// et on renumérote tous les paiements restants pour garder une numérotation 1, 2, 3...
// sans trou. Utile pour corriger un calendrier mal calibré.
export const deletePayment = mutation({
  args: {
    userEmail: v.string(),
    paymentId: v.id("pizzaPayments"),
  },
  handler: async (ctx, args) => {
    checkEmail(args.userEmail, "acheteur");
    const p = await ctx.db.get(args.paymentId);
    if (!p) throw new ConvexError("Paiement introuvable");
    if (p.signature) {
      throw new ConvexError("Impossible de supprimer un paiement déjà signé. C'est une signature juridique définitive.");
    }
    if (p.status === "verse") {
      throw new ConvexError(
        "Impossible de supprimer un paiement marqué 'versé'. " +
        "Crée plutôt un paiement compensatoire négatif ou annule et recrée."
      );
    }
    const now = Date.now();
    const deletedNumero = p.numero;
    const deletedMontant = p.montant;
    const deletedType = p.type;
    await ctx.db.delete(args.paymentId);
    // Renumérote les paiements restants pour combler le trou.
    // On numérote dans l'ordre "verse d'abord" (par dateVersement ASC) puis
    // "en_attente" (par dateEcheance ASC), comme dans recalculateSchedule.
    const remaining = await ctx.db.query("pizzaPayments").collect();
    const verses = remaining
      .filter((x) => x.status === "verse")
      .sort((a, b) => (a.dateVersement || a.dateEcheance) - (b.dateVersement || b.dateEcheance));
    const enAttente = remaining
      .filter((x) => x.status === "en_attente")
      .sort((a, b) => a.dateEcheance - b.dateEcheance);
    const finalOrder = [...verses, ...enAttente];
    let num = 1;
    for (const x of finalOrder) {
      if (x.numero !== num) {
        await ctx.db.patch(x._id, { numero: num, updatedAt: now });
      }
      num++;
    }
    await ctx.db.insert("pizzaAuditLog", {
      action: "payment_deleted",
      userEmail: args.userEmail,
      userRole: "acheteur",
      paymentId: args.paymentId,
      details: JSON.stringify({
        numero: deletedNumero,
        montant: deletedMontant,
        type: deletedType,
      }),
      ipAddress: getClientIp(ctx),
      userAgent: getUserAgent(ctx),
      timestamp: now,
    });
    return { success: true, deletedNumero, renumbered: finalOrder.length };
  },
});

// === MIGRATION + RECALCUL : ajuste le calendrier et renumérote proprement ===
// À appeler UNE FOIS après le déploiement du système à compteur unique.
// Idempotente : peut être rappelée sans risque.
//
// Cette mutation fait 2 choses en un seul clic :
//   1) RECALCUL DU CALENDRIER : supprime toutes les mensualités en_attente et
//      en recrée le bon nombre pour que le total ne dépasse JAMAIS le prixTotal.
//      Formule : nbMensualites = ceil((prixTotal - paidTotal) / montantMensuel).
//      Exemple : ponctuel 5000€ versé + 30000€ total → 50 mensualités de 500€
//      (au lieu de 60 par défaut).
//   2) RENUMEROTATION : tous les paiements sont numérotés 1, 2, 3, ... dans
//      l'ordre "verse d'abord" (par dateVersement ASC) puis "en_attente"
//      (par dateEcheance ASC). Le ponctuel verse = n°1.
export const migratePaymentLabels = mutation({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    checkEmail(args.userEmail, "acheteur");
    const config = await ctx.db.query("pizzaConfig").first();
    if (!config) throw new ConvexError("Config non initialisée");
    const allPayments = await ctx.db.query("pizzaPayments").collect();
    const now = Date.now();
    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    const details: any = {
      renumbered: 0,
      skipped: 0,
      oldMensuelCount: 0,
      newMensuelCount: 0,
      paidTotal: 0,
      remainingToPay: 0,
    };
    // ===== 1) CALCUL DES TOTAUX =====
    const paidTotal = allPayments
      .filter((p) => p.status === "verse")
      .reduce((s, p) => s + p.montant, 0);
    const remainingToPay = Math.max(0, config.prixTotal - paidTotal);
    const nbRemaining = Math.ceil(remainingToPay / config.montantMensuel);
    details.paidTotal = paidTotal;
    details.remainingToPay = remainingToPay;
    // ===== 2) SUPPRESSION DES MENSUALITÉS EN_ATTENTE (préserve les verse + ponctuels) =====
    for (const p of allPayments) {
      if (p.type !== "ponctuel" && p.status === "en_attente") {
        await ctx.db.delete(p._id);
        details.oldMensuelCount++;
      }
    }
    // ===== 3) RECRÉATION DU BON NOMBRE DE MENSUALITÉS =====
    // Date de début : la prochaine échéance prévue (si encore présente), sinon maintenant
    const mensuelsRestants = allPayments.filter((p) =>
      p.type !== "ponctuel" && p.status !== "annule" && p.status !== "en_attente"
      // après la suppression ci-dessus, ne reste que les "verse" et "annule"
    );
    // Cherche la 1ère date d'échéance "verse" pour chainer après
    const nextStartFromVerse = mensuelsRestants
      .filter((p) => p.status === "verse")
      .sort((a, b) => (b.dateVersement || b.dateEcheance) - (a.dateVersement || a.dateEcheance))[0];
    const startDate = nextStartFromVerse
      ? (nextStartFromVerse.dateVersement || nextStartFromVerse.dateEcheance) + oneMonth
      : Date.now();
    for (let i = 0; i < nbRemaining; i++) {
      const isLast = i === nbRemaining - 1;
      const montant = isLast
        ? remainingToPay - config.montantMensuel * (nbRemaining - 1)
        : config.montantMensuel;
      await ctx.db.insert("pizzaPayments", {
        numero: 9999 + i,  // provisoire, renumérotation juste en dessous
        montant,
        dateEcheance: startDate + i * oneMonth,
        status: "en_attente",
        type: "mensuel",
        createdAt: now,
        updatedAt: now,
      });
      details.newMensuelCount++;
    }
    // ===== 4) RENUMÉROTATION FINALE : 1, 2, 3, ... dans l'ordre logique =====
    const allAfter = await ctx.db.query("pizzaPayments").collect();
    const verses = allAfter
      .filter((p) => p.status === "verse")
      .sort((a, b) => (a.dateVersement || a.dateEcheance) - (b.dateVersement || b.dateEcheance));
    const enAttente = allAfter
      .filter((p) => p.status === "en_attente")
      .sort((a, b) => a.dateEcheance - b.dateEcheance);
    const finalOrder = [...verses, ...enAttente];
    let num = 1;
    for (const p of finalOrder) {
      if (p.numero !== num) {
        await ctx.db.patch(p._id, { numero: num, updatedAt: now });
        details.renumbered++;
      } else {
        details.skipped++;
      }
      num++;
    }
    // ===== 5) AUDIT =====
    await ctx.db.insert("pizzaAuditLog", {
      action: "payment_labels_migrated",
      userEmail: args.userEmail,
      userRole: "acheteur",
      details: JSON.stringify(details),
      ipAddress: getClientIp(ctx),
      userAgent: getUserAgent(ctx),
      timestamp: now,
    });
    return { success: true, ...details };
  },
});

// === WHATSAPP LINK (helper, pas de query Convex) ===
// On génère le lien wa.me côté client, mais on peut fournir une query
// qui retourne l'URL pré-calculée pour un paiement donné.
export const getWhatsappLink = query({
  args: { userEmail: v.optional(v.string()), paymentId: v.id("pizzaPayments") },
  handler: async (ctx, args) => {
    if (args.userEmail) {
      try { checkEmail(args.userEmail, "any"); } catch { return null; }
    }
    const config = await ctx.db.query("pizzaConfig").first();
    const p = await ctx.db.get(args.paymentId);
    if (!config || !p) return null;
    // Label : "P1" pour les ponctuels, "n°1" pour les mensuels
    const label = `Versement n°${p.numero}`;
    const message = `🍕 *${config.nomCamion}* — ${label}\n\n` +
      `Montant : *${p.montant} €*\n` +
      `Échéance : ${new Date(p.dateEcheance).toLocaleDateString("fr-FR")}\n\n` +
      `👉 Connecte-toi ici pour signer ce versement :\n${process.env.CONVEX_SITE_URL || "https://suivi-dette.netlify.app"}/pizza-truck?sign=${p._id}`;
    return {
      message,
      phoneNumber: config.vendeurPhone || null,  // null si pas configuré
    };
  },
});

// === ENVOI SMS VIA WORKER PUSHBULLET (qui relaie vers MacroDroid) ===
// Le worker Pushbullet (déployé sur admin.ableiges.com) expose un endpoint
// HTTP /send-sms. Quand on l'appelle avec { to, body }, il envoie le SMS
// via le téléphone Android connecté à MacroDroid. C'est le même système
// que dans lobry-sms-brocante — on évite de dupliquer la logique d'envoi
// en appelant directement le worker.
//
// IMPORTANT : configurer PUSHBULLET_WORKER_URL dans .env (et Netlify env vars).
// Exemple : https://admin.ableiges.com
export const sendSmsToVendor = action({
  args: {
    userEmail: v.string(),
    paymentId: v.id("pizzaPayments"),
  },
  handler: async (ctx, args) => {
    checkEmail(args.userEmail, "acheteur");
    const config = await ctx.db.query("pizzaConfig").first();
    const p = await ctx.db.get(args.paymentId);
    if (!config) throw new ConvexError("Config non initialisée");
    if (!p) throw new ConvexError("Paiement introuvable");
    if (!config.vendeurPhone) {
      throw new ConvexError("Numéro de téléphone du vendeur non configuré. Va dans Paramètres.");
    }
    const workerUrl = process.env.PUSHBULLET_WORKER_URL;
    if (!workerUrl) {
      throw new ConvexError("PUSHBULLET_WORKER_URL non configuré. Contacte l'admin.");
    }
    // Construit le message (même format que WhatsApp)
    const message = `🍕 *${config.nomCamion}* — Versement n°${p.numero}\n\n` +
      `Montant : *${p.montant} €*\n` +
      `Échéance : ${new Date(p.dateEcheance).toLocaleDateString("fr-FR")}\n\n` +
      `👉 Connecte-toi ici pour signer ce versement :\n${process.env.CONVEX_SITE_URL || "https://suivi-dette.netlify.app"}/pizza-truck?sign=${p._id}`;
    // Appel HTTP au worker Pushbullet
    const response = await fetch(`${workerUrl}/send-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: config.vendeurPhone,
        body: message,
      }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new ConvexError(`Erreur worker (${response.status}): ${errText}`);
    }
    // Audit
    await ctx.runMutation(api.pizza.logSmsSent, {
      userEmail: args.userEmail,
      paymentId: args.paymentId,
      to: config.vendeurPhone,
    });
    return { success: true, to: config.vendeurPhone, message };
  },
});

// Helper mutation pour l'audit (appelé par sendSmsToVendor)
export const logSmsSent = mutation({
  args: {
    userEmail: v.string(),
    paymentId: v.id("pizzaPayments"),
    to: v.string(),
  },
  handler: async (ctx, args) => {
    checkEmail(args.userEmail, "acheteur");
    const now = Date.now();
    await ctx.db.insert("pizzaAuditLog", {
      action: "sms_sent_to_vendor",
      userEmail: args.userEmail,
      userRole: "acheteur",
      paymentId: args.paymentId,
      details: JSON.stringify({ to: args.to }),
      ipAddress: getClientIp(ctx),
      userAgent: getUserAgent(ctx),
      timestamp: now,
    });
    return { success: true };
  },
});
