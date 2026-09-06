import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ====================================================================
// === 🍕 SUIVI-DETTE — App dédiée au suivi de paiement du camion pizza ===
// ====================================================================
// Achat du camion pizza par Freddy (acheteur) à son frère Francky
// (vendeur), 30 000 € au total, versé en mensualités de 500 € (modifiable).
//
// Cette app est extraite de lobry-sms-brocante (commits c6d2e20, 838463e,
// f646863, 5dbece1) pour avoir une UI dédiée, légère, sans le reste de
// l'app SMS brocante. Projet Convex DEDIE a suivi-dette (different-opossum-825)
// ; seule l'instance Clerk est partagée avec lobry-sms-brocante.

export default defineSchema({
  // Configuration globale (singleton)
  pizzaConfig: defineTable({
    _id: v.string(),                            // toujours "pizza-config"
    prixTotal: v.number(),                      // ex: 30000
    montantMensuel: v.number(),                // ex: 500
    acheteurNom: v.string(),                   // "Freddy"
    acheteurEmail: v.string(),                 // "lefreddy95@gmail.com"
    acheteurPhotoUrl: v.optional(v.string()),
    vendeurNom: v.string(),                    // "Francky"
    vendeurEmail: v.string(),                  // "franckylobry6@gmail.com"
    vendeurPhotoUrl: v.optional(v.string()),
    vendeurPhone: v.optional(v.string()),      // ex: "+33612345678" (pour WhatsApp auto)
    nomCamion: v.string(),                     // ex: "Le Petit Four"
    dateDebut: v.number(),                     // epoch ms — début du contrat
    // Signatures du CONTRAT (acheteur + vendeur) — un seul clic, indépendant
    // des signatures de chaque paiement. Une fois signé par les 2 parties,
    // le contrat est réputé conclu.
    contractSignedByAcheteurAt: v.optional(v.number()),   // epoch ms
    contractSignedByVendeurAt: v.optional(v.number()),    // epoch ms
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // Paiements individuels (60 échéances max par défaut, recalculé si gros versement)
  pizzaPayments: defineTable({
    numero: v.number(),                         // 1, 2, 3, ... (numéro d'échéance, compteur unique)
    montant: v.number(),                        // montant en €
    dateEcheance: v.number(),                   // date prévue du versement
    dateVersement: v.optional(v.number()),      // date réelle du paiement (null si pas encore versé)
    status: v.string(),                         // "en_attente" | "verse" | "annule"
    // Distingue les paiements du calendrier mensuel de ceux créés à la volée
    // (avance, prime, rattrapage…). Vide/undefined = calendrier mensuel historique.
    type: v.optional(v.union(v.literal("mensuel"), v.literal("ponctuel"))),
    // (2026-09-05) Plus utilisé pour la numérotation (on a un compteur unique `numero`),
    // mais on garde le champ pour ne pas casser les paiements existants migrés.
    ponctuelOrdre: v.optional(v.number()),
    // Signature du VENDEUR (Francky). Une seule fois, définitive.
    signature: v.optional(v.object({
      signedByEmail: v.string(),                // forcé = vendeurEmail (vérif côté mutation)
      signedByNom: v.string(),
      signedAt: v.number(),                     // epoch ms
      ipAddress: v.string(),                    // IP au moment de la signature
      userAgent: v.string(),                    // navigateur
      signatureHash: v.string(),                // SHA-256 du payload (intégrité)
    })),
    note: v.optional(v.string()),              // note libre (ex: "avance de 2000€")
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_numero", ["numero"])
    .index("by_status", ["status"])
    .index("by_type", ["type"])
    .index("by_dateEcheance", ["dateEcheance"]),

  // Audit log (traçabilité juridique de TOUTES les actions)
  pizzaAuditLog: defineTable({
    action: v.string(),                         // "config_updated" | "payment_created" | "payment_signed" | "payment_cancelled"
    userEmail: v.string(),
    userRole: v.string(),                       // "acheteur" | "vendeur"
    paymentId: v.optional(v.id("pizzaPayments")),
    details: v.optional(v.string()),            // JSON sérialisé libre
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_payment", ["paymentId"]),

  // ====================================================================
  // === SUIVI-DETTE — Tracker de prêts multi-catégorie (Phase 1, commit 1/4) ===
  // ====================================================================
  // Multi-tenant par ownerEmail (= Clerk user.email OU email whitelisté).
  // Pour un vrai SaaS : migrer vers ctx.auth.getUserIdentity().subject.
  // Voir TODO commentaire dans convex/loans.ts.

  // Personnes (les contacts du user)
  people: defineTable({
    ownerEmail: v.string(),       // FK vers user (multi-tenant par email)
    name: v.string(),              // "Freddy", "Maman", "Paul"
    email: v.optional(v.string()), // pour envois futurs
    phone: v.optional(v.string()), // pour SMS / WhatsApp
    avatarUrl: v.optional(v.string()),
    notes: v.optional(v.string()), // "ami d'enfance", "voisin"
    color: v.string(),             // code couleur pour identifier (ex: "#3B82F6")
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerEmail"]),

  // Transactions (le cœur du produit — unifié pour tous les types)
  transactions: defineTable({
    ownerEmail: v.string(),
    personId: v.id("people"),
    // === Type de transaction ===
    type: v.union(
      v.literal("money_lent"),      // 💸 je prête de l'argent
      v.literal("money_borrowed"), // 💰 j'emprunte de l'argent
      v.literal("item_lent"),       // 📦 je prête un objet
      v.literal("item_borrowed"),   // 📥 j'emprunte un objet
      v.literal("service_done"),    // 🔧 je rends un service
      v.literal("service_received") // 🙋 je reçois un service
    ),
    // === Description ===
    title: v.string(),             // "Prêt dentiste", "Tondeuse", "Garage samedi"
    // === Pour les transactions en argent ===
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    // === Pour les items (prêt de matériel) ===
    itemPhotoUrl: v.optional(v.string()),
    itemDescription: v.optional(v.string()),
    // === Pour les services ===
    serviceDate: v.optional(v.number()),
    hoursLogged: v.optional(v.number()),
    // === Dates ===
    startDate: v.number(),
    dueDate: v.optional(v.number()),     // retour prévu
    reminderDate: v.optional(v.number()), // rappel avant échéance
    // === Statut ===
    status: v.union(
      v.literal("en_cours"),
      v.literal("termine"),
      v.literal("annule")
    ),
    // === Remboursements partiels (pour l'argent) ===
    totalRepaid: v.number(),
    repayments: v.array(v.object({
      amount: v.number(),
      date: v.number(),
      note: v.optional(v.string()),
    })),
    // === Échéancier de remboursement (pour money_lent / money_borrowed) ===
    // Si defini, l'app calcule les N prochaines échéances et les affiche dans
    // la fiche personne + dashboard. Aucun job cron : on génère à la volée.
    installmentAmount: v.optional(v.number()),  // montant par échéance
    installmentFrequency: v.optional(v.union(
      v.literal("weekly"),      // chaque semaine
      v.literal("biweekly"),    // toutes les 2 semaines
      v.literal("monthly"),     // chaque mois
      v.literal("quarterly")    // chaque trimestre
    )),
    installmentStartDate: v.optional(v.number()),  // epoch ms — 1ère échéance
    installmentCount: v.optional(v.number()),  // nb total d'échéances (optionnel = infini)
    // === Audit ===
    note: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerEmail"])
    .index("by_person", ["personId"])
    .index("by_owner_status", ["ownerEmail", "status"])
    .index("by_owner_type", ["ownerEmail", "type"])
    .index("by_owner_dueDate", ["ownerEmail", "dueDate"]),

  // Rappels (notifications à venir)
  reminders: defineTable({
    ownerEmail: v.string(),
    personId: v.optional(v.id("people")),
    transactionId: v.optional(v.id("transactions")),
    type: v.union(
      v.literal("due_soon"),      // prêt arrive à échéance
      v.literal("overdue"),       // prêt en retard
      v.literal("service_due"),   // service à rendre
      v.literal("follow_up")      // relance manuelle
    ),
    dueDate: v.number(),
    done: v.boolean(),
    notifiedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_owner_done", ["ownerEmail", "done"])
    .index("by_owner_dueDate", ["ownerEmail", "dueDate"]),
});
