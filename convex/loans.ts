// =========================================================================
// loans.ts — Kuidi : Tracker de prêts multi-catégorie (Phase 1, commit 1/4)
// =========================================================================
// Gère les personnes (people) et les transactions (prêts d'argent, objets,
// services, multi-directionnels).
//
// TODO MULTI-TENANT (à faire avant la monétisation) :
//   Remplacer le systeme de whitelist par email par l'auth Clerk JWT :
//   - Dans chaque handler : `const identity = await ctx.auth.getUserIdentity();`
//   - Filtrer toutes les queries par `identity.subject` au lieu de `userEmail`
//   - Le front continue de passer l'identité via ConvexProviderWithClerk
//   → Aujourd'hui : 2-3 users whitelistés
//   → Demain : N users (SaaS)
// =========================================================================

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

// === WHITELIST TEMPORAIRE (à migrer vers Clerk JWT) ===
// Pour l'instant, Freddy ET Francky peuvent utiliser l'app.
// À terme, l'identité Clerk = identifiant unique.
const ALLOWED_USERS = new Set<string>([
  "lefreddy95@gmail.com",     // Freddy (acheteur historique + owner principal)
  "franckylobry6@gmail.com",  // Francky
]);

function checkUser(email: string | null | undefined) {
  if (!email || !ALLOWED_USERS.has(email)) {
    throw new ConvexError("Acces refuse : utilisateur non autorise");
  }
  return email;
}

// Couleurs par défaut pour les nouvelles personnes (rotation)
const PERSON_COLORS = [
  "#3B82F6", // blue-500
  "#8B5CF6", // purple-500
  "#EC4899", // pink-500
  "#F59E0B", // amber-500
  "#10B981", // emerald-500
  "#EF4444", // red-500
  "#06B6D4", // cyan-500
  "#84CC16", // lime-500
];

function pickColor(existingCount: number): string {
  return PERSON_COLORS[existingCount % PERSON_COLORS.length];
}

// === PEOPLE (personnes) ===================================================

export const listPeople = query({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    checkUser(args.userEmail);
    const people = await ctx.db
      .query("people")
      .withIndex("by_owner", (q) => q.eq("ownerEmail", args.userEmail))
      .order("asc", q => q.field("name"))
      .collect();
    // Pour chaque personne, compter les transactions en cours et calculer le solde
    const enriched = await Promise.all(people.map(async (p) => {
      const txs = await ctx.db
        .query("transactions")
        .withIndex("by_person", (q) => q.eq("personId", p._id))
        .filter((q) => q.eq(q.field("status"), "en_cours"))
        .collect();
      const netBalance = txs.reduce((s, t) => {
        // money_lent, item_lent, service_done : on me doit (positif)
        // money_borrowed, item_borrowed, service_received : je dois (negatif)
        const sign =
          t.type === "money_lent" || t.type === "item_lent" || t.type === "service_done"
            ? 1 : -1;
        const amount = t.amount ?? 0;
        return s + sign * (amount - t.totalRepaid);
      }, 0);
      return { ...p, activeCount: txs.length, netBalance };
    }));
    return enriched;
  },
});

export const getPerson = query({
  args: { userEmail: v.string(), personId: v.id("people") },
  handler: async (ctx, args) => {
    checkUser(args.userEmail);
    const p = await ctx.db.get(args.personId);
    if (!p || p.ownerEmail !== args.userEmail) {
      throw new ConvexError("Personne introuvable ou acces refuse");
    }
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_person", (q) => q.eq("personId", p._id))
      .order("desc", q => q.field("startDate"))
      .collect();
    return { person: p, transactions };
  },
});

export const createPerson = mutation({
  args: {
    userEmail: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    checkUser(args.userEmail);
    const existing = await ctx.db
      .query("people")
      .withIndex("by_owner", (q) => q.eq("ownerEmail", args.userEmail))
      .collect();
    const now = Date.now();
    const id = await ctx.db.insert("people", {
      ownerEmail: args.userEmail,
      name: args.name,
      email: args.email,
      phone: args.phone,
      notes: args.notes,
      color: pickColor(existing.length),
      createdAt: now,
      updatedAt: now,
    });
    return { _id: id };
  },
});

export const updatePerson = mutation({
  args: {
    userEmail: v.string(),
    personId: v.id("people"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    checkUser(args.userEmail);
    const p = await ctx.db.get(args.personId);
    if (!p || p.ownerEmail !== args.userEmail) {
      throw new ConvexError("Personne introuvable ou acces refuse");
    }
    const patch: Record<string, any> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.email !== undefined) patch.email = args.email;
    if (args.phone !== undefined) patch.phone = args.phone;
    if (args.notes !== undefined) patch.notes = args.notes;
    if (args.color !== undefined) patch.color = args.color;
    await ctx.db.patch(args.personId, patch);
    return { success: true };
  },
});

export const deletePerson = mutation({
  args: { userEmail: v.string(), personId: v.id("people") },
  handler: async (ctx, args) => {
    checkUser(args.userEmail);
    const p = await ctx.db.get(args.personId);
    if (!p || p.ownerEmail !== args.userEmail) {
      throw new ConvexError("Personne introuvable ou acces refuse");
    }
    // Supprimer en cascade les transactions liees
    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_person", (q) => q.eq("personId", args.personId))
      .collect();
    for (const t of txs) await ctx.db.delete(t._id);
    // Supprimer les reminders lies
    const reminders = await ctx.db
      .query("reminders")
      .withIndex("by_owner_done", (q) => q.eq("ownerEmail", args.userEmail))
      .filter((q) => q.eq(q.field("personId"), args.personId))
      .collect();
    for (const r of reminders) await ctx.db.delete(r._id);
    // Supprimer la personne
    await ctx.db.delete(args.personId);
    return { success: true, deletedTransactions: txs.length };
  },
});

// === TRANSACTIONS ==========================================================

export const listTransactions = query({
  args: {
    userEmail: v.string(),
    status: v.optional(v.union(
      v.literal("en_cours"), v.literal("termine"), v.literal("annule")
    )),
    type: v.optional(v.union(
      v.literal("money_lent"), v.literal("money_borrowed"),
      v.literal("item_lent"), v.literal("item_borrowed"),
      v.literal("service_done"), v.literal("service_received")
    )),
    personId: v.optional(v.id("people")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    checkUser(args.userEmail);
    let q = ctx.db
      .query("transactions")
      .withIndex("by_owner", (qb) => qb.eq("ownerEmail", args.userEmail));
    if (args.status) {
      q = q.filter((qb) => qb.eq(qb.field("status"), args.status));
    }
    if (args.type) {
      q = q.filter((qb) => qb.eq(qb.field("type"), args.type));
    }
    if (args.personId) {
      q = q.filter((qb) => qb.eq(qb.field("personId"), args.personId));
    }
    let txs = await q.order("desc", (qb) => qb.field("startDate")).collect();
    if (args.limit) txs = txs.slice(0, args.limit);
    return txs;
  },
});

export const getTransaction = query({
  args: { userEmail: v.string(), transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
    checkUser(args.userEmail);
    const t = await ctx.db.get(args.transactionId);
    if (!t || t.ownerEmail !== args.userEmail) {
      throw new ConvexError("Transaction introuvable ou acces refuse");
    }
    return t;
  },
});

export const createTransaction = mutation({
  args: {
    userEmail: v.string(),
    personId: v.id("people"),
    type: v.union(
      v.literal("money_lent"), v.literal("money_borrowed"),
      v.literal("item_lent"), v.literal("item_borrowed"),
      v.literal("service_done"), v.literal("service_received")
    ),
    title: v.string(),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    itemPhotoUrl: v.optional(v.string()),
    itemDescription: v.optional(v.string()),
    serviceDate: v.optional(v.number()),
    hoursLogged: v.optional(v.number()),
    startDate: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    reminderDate: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    checkUser(args.userEmail);
    // Verifier que la personne appartient bien au user
    const p = await ctx.db.get(args.personId);
    if (!p || p.ownerEmail !== args.userEmail) {
      throw new ConvexError("Personne invalide");
    }
    const now = Date.now();
    const id = await ctx.db.insert("transactions", {
      ownerEmail: args.userEmail,
      personId: args.personId,
      type: args.type,
      title: args.title,
      amount: args.amount,
      currency: args.currency || "EUR",
      itemPhotoUrl: args.itemPhotoUrl,
      itemDescription: args.itemDescription,
      serviceDate: args.serviceDate,
      hoursLogged: args.hoursLogged,
      startDate: args.startDate ?? now,
      dueDate: args.dueDate,
      reminderDate: args.reminderDate,
      status: "en_cours",
      totalRepaid: 0,
      repayments: [],
      note: args.note,
      createdAt: now,
      updatedAt: now,
    });
    return { _id: id };
  },
});

export const updateTransaction = mutation({
  args: {
    userEmail: v.string(),
    transactionId: v.id("transactions"),
    title: v.optional(v.string()),
    amount: v.optional(v.number()),
    itemPhotoUrl: v.optional(v.string()),
    itemDescription: v.optional(v.string()),
    dueDate: v.optional(v.union(v.number(), v.null())),
    reminderDate: v.optional(v.union(v.number(), v.null())),
    status: v.optional(v.union(
      v.literal("en_cours"), v.literal("termine"), v.literal("annule")
    )),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    checkUser(args.userEmail);
    const t = await ctx.db.get(args.transactionId);
    if (!t || t.ownerEmail !== args.userEmail) {
      throw new ConvexError("Transaction introuvable ou acces refuse");
    }
    const patch: Record<string, any> = { updatedAt: Date.now() };
    if (args.title !== undefined) patch.title = args.title;
    if (args.amount !== undefined) patch.amount = args.amount;
    if (args.itemPhotoUrl !== undefined) patch.itemPhotoUrl = args.itemPhotoUrl;
    if (args.itemDescription !== undefined) patch.itemDescription = args.itemDescription;
    if (args.dueDate !== undefined) patch.dueDate = args.dueDate ?? undefined;
    if (args.reminderDate !== undefined) patch.reminderDate = args.reminderDate ?? undefined;
    if (args.status !== undefined) patch.status = args.status;
    if (args.note !== undefined) patch.note = args.note;
    await ctx.db.patch(args.transactionId, patch);
    return { success: true };
  },
});

export const deleteTransaction = mutation({
  args: { userEmail: v.string(), transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
    checkUser(args.userEmail);
    const t = await ctx.db.get(args.transactionId);
    if (!t || t.ownerEmail !== args.userEmail) {
      throw new ConvexError("Transaction introuvable ou acces refuse");
    }
    await ctx.db.delete(args.transactionId);
    return { success: true };
  },
});

// Ajouter un remboursement partiel (pour l'argent)
export const addRepayment = mutation({
  args: {
    userEmail: v.string(),
    transactionId: v.id("transactions"),
    amount: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    checkUser(args.userEmail);
    const t = await ctx.db.get(args.transactionId);
    if (!t || t.ownerEmail !== args.userEmail) {
      throw new ConvexError("Transaction introuvable ou acces refuse");
    }
    if (t.status !== "en_cours") {
      throw new ConvexError("Impossible d'ajouter un remboursement a une transaction terminee ou annulee");
    }
    if (t.amount === undefined) {
      throw new ConvexError("Cette transaction n'a pas de montant (pas un pret d'argent)");
    }
    const newRepayment = {
      amount: args.amount,
      date: Date.now(),
      note: args.note,
    };
    const newTotal = t.totalRepaid + args.amount;
    const now = Date.now();
    const patch: Record<string, any> = {
      repayments: [...t.repayments, newRepayment],
      totalRepaid: newTotal,
      updatedAt: now,
    };
    // Si le montant total est rembourse, marquer la transaction comme terminee
    if (newTotal >= t.amount) {
      patch.status = "termine";
    }
    await ctx.db.patch(args.transactionId, patch);
    return { success: true, newTotal, isComplete: newTotal >= t.amount };
  },
});

// === DASHBOARD (resume global pour la home) ================================

export const getDashboard = query({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    checkUser(args.userEmail);
    // Toutes les transactions en cours
    const activeTxs = await ctx.db
      .query("transactions")
      .withIndex("by_owner_status", (q) =>
        q.eq("ownerEmail", args.userEmail).eq("status", "en_cours"))
      .collect();

    let owedToMe = 0;        // argent qu'on me doit
    let iOwe = 0;            // argent que je dois
    let itemsLent = 0;       // nb d'objets pretes en attente
    let servicesTodo = 0;    // nb de services a rendre ou a recevoir
    const upcoming: any[] = []; // prochaines echances (dueDate < 30j)

    const now = Date.now();
    const in30Days = now + 30 * 24 * 60 * 60 * 1000;

    for (const t of activeTxs) {
      const isLentType = t.type === "money_lent" || t.type === "item_lent" || t.type === "service_done";
      const amount = t.amount ?? 0;
      const remaining = amount - t.totalRepaid;

      // Compteurs financiers
      if (t.type === "money_lent") owedToMe += remaining;
      if (t.type === "money_borrowed") iOwe += remaining;

      // Compteurs items
      if (t.type === "item_lent") itemsLent++;
      if (t.type === "item_borrowed") servicesTodo++; // items empruntés = à rendre

      // Compteurs services
      if (t.type === "service_done") servicesTodo++;
      if (t.type === "service_received") servicesTodo++;

      // Prochaines echances
      if (t.dueDate && t.dueDate <= in30Days) {
        upcoming.push({
          _id: t._id,
          title: t.title,
          type: t.type,
          personId: t.personId,
          dueDate: t.dueDate,
          amount: t.amount,
          totalRepaid: t.totalRepaid,
        });
      }
    }

    // Trier upcoming par date
    upcoming.sort((a, b) => a.dueDate - b.dueDate);

    // Activite recente (10 dernieres transactions, tous status)
    const recent = await ctx.db
      .query("transactions")
      .withIndex("by_owner", (q) => q.eq("ownerEmail", args.userEmail))
      .order("desc", (q) => q.field("createdAt"))
      .take(10);

    // Compter les personnes
    const peopleCount = (await ctx.db
      .query("people")
      .withIndex("by_owner", (q) => q.eq("ownerEmail", args.userEmail))
      .collect()).length;

    return {
      summary: {
        owedToMe,
        iOwe,
        itemsLent,
        servicesTodo,
        peopleCount,
        activeCount: activeTxs.length,
      },
      upcoming: upcoming.slice(0, 10),
      recent,
    };
  },
});
