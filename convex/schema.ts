import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ====================================================================
// === 🚚 SUIVI-DETTE — App dédiée au suivi de la dette du camion pizza ===
// ====================================================================
// Une seule dette est suivie : le camion pizza acheté à crédit par Freddy
// (débiteur) à son frère Francky (créancier).
//
//   Montant total        : 30 000 €
//   Déjà versé           : 5 000 € (septembre) + 500 € (octobre)
//   Reste à payer        : 24 500 €  ->  49 mensualités de 500 €
//
// Le modèle de données reste générique (personnes + transactions) pour
// pouvoir rouvrir l'app à d'autres dettes un jour, mais l'UI, elle, ne
// montre qu'une seule dette (celle marquée isPrimaryDebt).
//
// Projet Convex DEDIE a suivi-dette (different-opossum-825) ; seule
// l'instance Clerk est partagée avec lobry-sms-brocante.

export default defineSchema({
  // ====================================================================
  // === DETTE UNIQUE (camion pizza) ===
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
      // Token unique pour que la contrepartie signe ce remboursement via /repayment/:token
      signToken: v.optional(v.string()),
      // Signature de la contrepartie qui confirme le remboursement
      counterpartySignature: v.optional(v.object({
        signerName: v.string(),
        signerEmail: v.string(),
        signedAt: v.number(),
        signaturePng: v.string(),    // base64 du canvas
        signatureHash: v.string(),   // SHA-256 du PNG + métadonnées
      })),
    })),
    // === Échéancier de remboursement (pour money_lent / money_borrowed) ===
    installmentAmount: v.optional(v.number()),
    installmentFrequency: v.optional(v.union(
      v.literal("weekly"),
      v.literal("biweekly"),
      v.literal("monthly"),
      v.literal("quarterly")
    )),
    installmentStartDate: v.optional(v.number()),
    installmentCount: v.optional(v.number()),
    // === Contrepartie (l'autre personne impliquée) ===
    counterpartyEmail: v.optional(v.string()),  // email de l'autre personne
    counterpartyName: v.optional(v.string()),   // nom affiché sur la page publique
    counterpartyPhone: v.optional(v.string()),  // téléphone (pour SMS / WhatsApp)
    // === Token public (URL partageable /transaction/:token) ===
    publicToken: v.optional(v.string()),
    // === Timeline d'événements (preuve d'engagement, audit log light) ===
    // Chaque événement : {type, date, actor, details}
    // - contract_sign_requested  : lien envoyé à la contrepartie
    // - contract_signed          : une partie a signé le contrat
    // - repayment_added          : un remboursement a été ajouté
    // - repayment_signed         : la contrepartie a confirmé un remboursement
    // - item_returned            : un objet a été marqué rendu
    // - service_done             : un service a été marqué effectué
    events: v.optional(v.array(v.object({
      type: v.string(),                        // type d'événement (cf. liste ci-dessus)
      date: v.number(),                        // epoch ms
      actor: v.string(),                      // email ou "system"
      details: v.optional(v.string()),        // JSON ou texte libre
      // Pour les événements de signature : qui a fait quoi
      signerName: v.optional(v.string()),
      signerRole: v.optional(v.union(
        v.literal("owner"), v.literal("counterparty")
      )),
    }))),
    // === Signatures au niveau du contrat (par les 2 parties) ===
    // Optionnel pour la compatibilite avec les transactions creees avant
    // l'ajout du systeme de signatures. Le code utilise `?? []` partout.
    signatures: v.optional(v.array(v.object({
      signerName: v.string(),
      signerEmail: v.string(),
      signerRole: v.union(
        v.literal("owner"),        // le créateur de la transaction
        v.literal("counterparty")  // l'autre personne
      ),
      signedAt: v.number(),
      signaturePng: v.string(),    // base64 du canvas
      signatureHash: v.string(),   // SHA-256 du PNG + métadonnées
      ipAddress: v.optional(v.string()),
      userAgent: v.optional(v.string()),
    }))),
    // === Métadonnées du contrat généré ===
    contractText: v.optional(v.string()),  // snapshot du contrat au moment de la signature
    // === Dette principale ===
    // L'app ne suit qu'UNE dette (le camion pizza). Ce flag permet de la
    // retrouver sans ambiguite (et de la distinguer d'un simple test).
    isPrimaryDebt: v.optional(v.boolean()),
    // === Audit ===
    note: v.optional(v.string()),
    notePhotoUrl: v.optional(v.string()),  // photo jointe (base64, < 2 Mo)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerEmail"])
    .index("by_person", ["personId"])
    .index("by_owner_status", ["ownerEmail", "status"])
    .index("by_owner_type", ["ownerEmail", "type"])
    .index("by_owner_dueDate", ["ownerEmail", "dueDate"])
    .index("by_publicToken", ["publicToken"])
    .index("by_counterpartyEmail", ["counterpartyEmail"]),

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
