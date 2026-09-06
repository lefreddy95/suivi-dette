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
});
