// =========================================================================
// debt.ts — Suivi-dette : le suivi de LA dette unique (camion pizza)
// =========================================================================
// L'app ne suit plus qu'une seule dette : le camion pizza acheté à crédit
// par Freddy à Francky.
//
//   Montant total        : 30 000 €
//   Déjà versé           : 5 000 € (septembre) + 500 € (octobre)
//   Reste à payer        : 24 500 €  ->  49 mensualités de 500 €
//   1re échéance restante: 7 novembre 2026
//
// Ce module ne fait QUE de la lecture / agrégation. Les écritures passent
// par loans.ts (addRepayment, updateTransaction, signPublicTransaction…).
// =========================================================================

import { query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

/** Le createur de la dette (= Freddy, super admin de l'app). */
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

export type ScheduleStatus = "payee" | "partielle" | "en_retard" | "a_payer";

export type ScheduleEntry = {
  num: number;
  date: number;
  amount: number;
  paid: number;
  status: ScheduleStatus;
  paymentDate?: number;
};

/** Decale une date de N periodes (semaine / 2 semaines / mois / trimestre). */
function shiftDate(start: number, frequency: string, index: number): number {
  const d = new Date(start);
  if (frequency === "weekly") d.setDate(d.getDate() + index * 7);
  else if (frequency === "biweekly") d.setDate(d.getDate() + index * 14);
  else if (frequency === "quarterly") d.setMonth(d.getMonth() + index * 3);
  else d.setMonth(d.getMonth() + index);
  return d.getTime();
}

/**
 * Construit l'echeancier de la dette et l'etat de chaque echeance.
 *
 * Regle : un versement paye AVANT la 1re echeance est un acompte (il ne
 * consomme pas d'echeance). Les versements suivants consomment les
 * echeances dans l'ordre chronologique.
 */
function buildSchedule(tx: {
  amount?: number;
  installmentAmount?: number;
  installmentFrequency?: string;
  installmentStartDate?: number;
  installmentCount?: number;
  totalRepaid?: number;
  repayments: Array<{ amount: number; date: number }>;
}): ScheduleEntry[] {
  const monthly = tx.installmentAmount ?? 0;
  const start = tx.installmentStartDate;
  if (!monthly || !start) return [];

  const count =
    tx.installmentCount ??
    (monthly > 0 ? Math.ceil((tx.amount ?? 0) / monthly) : 0);
  const freq = tx.installmentFrequency ?? "monthly";

  const schedule: ScheduleEntry[] = [];
  for (let i = 0; i < count; i++) {
    schedule.push({
      num: i + 1,
      date: shiftDate(start, freq, i),
      amount: monthly,
      paid: 0,
      status: "a_payer",
    });
  }

  // Consommation des echeances par les versements (hors acomptes).
  const payments = [...tx.repayments].sort((a, b) => a.date - b.date);
  let idx = 0;
  for (const pay of payments) {
    if (pay.date < start) continue; // acompte : hors echeancier
    let left = pay.amount;
    while (left > 0.001 && idx < schedule.length) {
      const slot = schedule[idx];
      const due = slot.amount - slot.paid;
      const take = Math.min(due, left);
      slot.paid += take;
      slot.paymentDate = pay.date;
      left -= take;
      if (slot.paid >= slot.amount - 0.001) idx++;
    }
  }

  const now = Date.now();
  for (const slot of schedule) {
    if (slot.paid >= slot.amount - 0.001) slot.status = "payee";
    else if (slot.paid > 0) slot.status = "partielle";
    else if (slot.date < now) slot.status = "en_retard";
    else slot.status = "a_payer";
  }
  return schedule;
}

/**
 * getDebtOverview — Vue complete de la dette unique.
 *
 * Accessible par les 2 parties (Freddy le debiteur, Francky le creancier) :
 * la perspective est calculee cote serveur (`isOwner`).
 */
export const getDebtOverview = query({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    checkUser(args.userEmail);

    // 1. La dette (unique)
    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_owner", (q) => q.eq("ownerEmail", OWNER_EMAIL))
      .collect();
    const tx = txs.find((t) => t.isPrimaryDebt) ?? txs[0] ?? null;
    if (!tx) return null;

    const person = await ctx.db.get(tx.personId);

    const total = tx.amount ?? 0;
    const paid = tx.totalRepaid ?? 0;
    const remaining = Math.max(0, total - paid);
    const schedule = buildSchedule(tx);
    const next = schedule.find((s) => s.paid < s.amount - 0.001) ?? null;
    const endDate = schedule.length ? schedule[schedule.length - 1].date : null;
    const now = Date.now();

    // 2. Historique des versements (du plus recent au plus ancien)
    const payments = [...tx.repayments]
      .sort((a, b) => b.date - a.date)
      .map((r) => ({
        amount: r.amount,
        date: r.date,
        note: r.note,
        signToken: r.signToken,
        signed: !!r.counterpartySignature,
        signedBy: r.counterpartySignature?.signerName,
        signedAt: r.counterpartySignature?.signedAt,
        // Un versement anterieur a la 1re echeance est un acompte
        offSchedule: tx.installmentStartDate ? r.date < tx.installmentStartDate : false,
      }));

    const isOwner = args.userEmail === tx.ownerEmail;

    return {
      debt: {
        _id: tx._id,
        title: tx.title,
        type: tx.type,
        amount: total,
        currency: tx.currency ?? "EUR",
        status: tx.status,
        startDate: tx.startDate,
        dueDate: tx.dueDate,
        note: tx.note,
        publicToken: tx.publicToken,
        installmentAmount: tx.installmentAmount,
        installmentFrequency: tx.installmentFrequency,
        installmentStartDate: tx.installmentStartDate,
        installmentCount: tx.installmentCount,
        counterpartyName: tx.counterpartyName,
        counterpartyEmail: tx.counterpartyEmail,
        counterpartyPhone: tx.counterpartyPhone,
        ownerEmail: tx.ownerEmail,
        ownerName: "Freddy",
        signatures: tx.signatures ?? [],
        events: tx.events ?? [],
      },
      person: person
        ? {
            _id: person._id,
            name: person.name,
            email: person.email,
            phone: person.phone,
          }
        : null,
      summary: {
        total,
        paid,
        remaining,
        percent: total > 0 ? Math.round((paid / total) * 100) : 0,
        monthly: tx.installmentAmount ?? 0,
        installmentsTotal: schedule.length,
        installmentsPaid: schedule.filter((s) => s.status === "payee").length,
        endDate,
        next,
        overdue: !!(next && next.date < now),
      },
      schedule,
      payments,
      isOwner,
      perspective: isOwner ? "debiteur" : "creancier",
    };
  },
});
