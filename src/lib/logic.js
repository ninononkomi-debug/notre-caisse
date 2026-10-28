// Règles de cotisation de la caisse
import { DEFAULTS } from '../config.js';
import { monthKey, today, addMonths, num, pad } from './format.js';

export function settingsOf(caisse) {
  const s = caisse?.settings || {};
  return {
    amounts: { ...DEFAULTS.amounts, ...(s.amounts || {}) },
    dueDay: s.dueDay || DEFAULTS.dueDay,
    depositNumbers: s.depositNumbers?.length ? s.depositNumbers : DEFAULTS.depositNumbers,
    pub: { ...DEFAULTS.pub, ...(s.pub || {}) },
  };
}

export const CATEGORIES = [
  ['travailleur', 'Travaille'],
  ['sans_emploi', 'Ne travaille pas'],
  ['couple', 'En couple'],
  ['autre', 'Montant particulier'],
];

export function amountFor(m, caisse) {
  if (m.custom_amount) return num(m.custom_amount);
  const a = settingsOf(caisse).amounts;
  if (m.category === 'couple') return Math.round(num(a.couple) / 2);
  return num(a[m.category] ?? a.travailleur);
}

const lastDay = (y, m) => new Date(y, m, 0).getDate();
// Le mois dont la cotisation est « en cours » : le dernier jour du mois, on passe au mois suivant
export function campaignMonth(d = today()) {
  const [y, m, j] = d.split('-').map(Number);
  return j === lastDay(y, m) ? addMonths(`${y}-${pad(m)}`, 1) : `${y}-${pad(m)}`;
}
export function displayMonth(caisse, d = today()) {
  const c = campaignMonth(d);
  return caisse?.start_month && caisse.start_month > c ? caisse.start_month : c;
}
export function monthsBetween(a, b) {
  if (!a || !b || b < a) return 0;
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma) + 1;
}

// Montants crédités (validés) ou en attente pour un membre ; un versement « couple » est partagé en 2
export function credited(m, deposits, status = 'valide') {
  let s = 0;
  for (const d of deposits) {
    if (d.status !== status) continue;
    if (d.member_id === m.id) s += d.split_with ? num(d.amount) / 2 : num(d.amount);
    else if (d.split_with === m.id) s += num(d.amount) / 2;
  }
  return s;
}

export function memberStatus(m, caisse, deposits, d = today()) {
  const amt = amountFor(m, caisse) || 1;
  const start = m.start_month || caisse.start_month;
  const camp = campaignMonth(d);
  const dueDay = settingsOf(caisse).dueDay;
  const day = Number(d.slice(8, 10));
  const inCurrentMonth = monthKey(d) === camp;
  const dueThrough = (M) => num(m.opening_due) + amt * monthsBetween(start, M);
  const paid = credited(m, deposits);
  const pending = credited(m, deposits, 'en_attente');
  const refLate = inCurrentMonth && day > dueDay ? camp : addMonths(camp, -1);
  const toBeUpToDate = Math.max(0, dueThrough(camp) - paid);
  const owedLate = dueThrough(refLate) - paid;
  const base = { amount: amt, paid, pending, start, camp, toBeUpToDate };
  if (start > camp && num(m.opening_due) <= paid) {
    const advance = Math.floor((paid - num(m.opening_due)) / amt);
    return { ...base, code: 'ajour', advance, label: advance > 0 ? `À jour · ${advance} mois d’avance` : 'À jour' };
  }
  if (paid >= dueThrough(camp)) {
    const advance = Math.floor((paid - dueThrough(camp)) / amt);
    return { ...base, code: 'ajour', advance, label: advance > 0 ? `À jour · ${advance} mois d’avance` : 'À jour' };
  }
  if (owedLate > 0) {
    const months = Math.ceil(owedLate / amt);
    return { ...base, code: 'retard', months, owed: owedLate, label: `${months} mois de retard` };
  }
  return { ...base, code: 'apayer', label: `À payer avant le ${dueDay}` };
}

// Grille des mois d'une année : payé / partiel / dû / à venir
export function monthGrid(m, caisse, deposits, year, d = today()) {
  const amt = amountFor(m, caisse) || 1;
  const start = m.start_month || caisse.start_month;
  const paid = credited(m, deposits) - num(m.opening_due);
  const camp = campaignMonth(d);
  const out = [];
  for (let i = 1; i <= 12; i++) {
    const M = `${year}-${pad(i)}`;
    if (M < start) { out.push({ M, state: 'avant' }); continue; }
    const n = monthsBetween(start, M);
    const cover = paid - amt * (n - 1);
    const state = cover >= amt ? 'paye' : cover > 0 ? 'partiel' : M > camp ? 'futur' : 'du';
    out.push({ M, state });
  }
  return out;
}

export function caisseBalance(caisse, deposits, withdrawals) {
  const inn = deposits.filter((d) => d.status === 'valide').reduce((s, d) => s + num(d.amount), 0);
  const out = withdrawals.reduce((s, w) => s + num(w.amount), 0);
  return { balance: num(caisse.initial_balance) + inn - out, inn, out };
}

export function monthSummary(caisse, members, deposits, d = today()) {
  const act = members.filter((m) => m.active && (m.user_id || !m.pending_user_id || true));
  const st = act.map((m) => ({ m, s: memberStatus(m, caisse, deposits, d) }));
  const ok = st.filter((x) => x.s.code === 'ajour');
  return { total: st.length, ok: ok.length, list: st };
}

export const WITHDRAW_CATS = [
  ['deuil', 'Deuil'],
  ['maladie', 'Maladie'],
  ['naissance', 'Naissance'],
  ['mariage', 'Mariage'],
  ['aide', 'Aide à un membre'],
  ['evenement', 'Événement familial'],
  ['frais', 'Frais'],
  ['autre', 'Autre'],
];
export const ANN_KINDS = [
  ['info', 'Information'],
  ['reunion', 'Réunion'],
  ['naissance', 'Naissance'],
  ['deuil', 'Deuil'],
  ['decision', 'Décision'],
  ['fete', 'Fête'],
];
