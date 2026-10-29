// Données fictives — tontines tournantes
const KEY = 'tf:db';
const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => ymd(new Date());

// Date du tour n (0 = premier tour)
export function tourDate(t, n) {
  const d = new Date(t.start + 'T12:00:00');
  if (t.freq === 'hebdo') d.setDate(d.getDate() + 7 * n);
  else d.setMonth(d.getMonth() + n);
  return ymd(d);
}
export function currentTour(t, today = todayStr()) {
  for (let n = 0; n < t.members.length; n++) if (tourDate(t, n) >= today) return n;
  return t.members.length - 1;
}

function makeTontines() {
  const now = new Date();
  // mensuelle : tour le 5 ; 3 tours déjà passés
  const m = new Date(now.getFullYear(), now.getMonth() - (now.getDate() > 5 ? 2 : 3), 5, 12);
  // hebdo : tour le vendredi ; 2 tours passés
  const f = new Date(now); f.setHours(12); while (f.getDay() !== 5) f.setDate(f.getDate() + 1); f.setDate(f.getDate() - 14);
  const fam = new Date(now.getFullYear(), now.getMonth() - (now.getDate() > 15 ? 5 : 6), 15, 12);
  return [
    { id: 't1', name: 'Tontine des Mamans', freq: 'mensuel', amount: 50000, penalty: 2000, start: ymd(m), presidente: 'Rachel', color: '#0F766E',
      members: ['Pauline', 'Rachel', 'Sylvie', 'Clarisse', 'Georgette', 'Mireille', 'Nadège', 'Bernadette'] },
    { id: 't2', name: 'Collègues du bureau', freq: 'hebdo', amount: 10000, penalty: 500, start: ymd(f), presidente: 'Arsène', color: '#C2410C',
      members: ['Arsène', 'Sylvie', 'Junior', 'Rachel', 'Fabrice', 'Larissa'] },
    { id: 't3', name: 'Famille Ndong', freq: 'mensuel', amount: 25000, penalty: 1000, start: ymd(fam), presidente: 'Tonton Paul', color: '#7C3AED',
      members: ['Tonton Paul', 'Rachel', 'Ginette', 'Hervé', 'Sandrine', 'Kevin', 'Mama Rose', 'Prisca', 'Jules', 'Carine'] },
  ];
}

export function seed() {
  const tontines = makeTontines();
  const payments = [];
  const handed = {};
  const today = todayStr();
  let id = 1;
  const ops = ['Airtel Money', 'Moov Money', 'Espèces'];
  for (const t of tontines) {
    const cur = currentTour(t, today);
    handed[t.id] = [];
    for (let n = 0; n <= cur; n++) {
      const date = tourDate(t, n);
      if (n < cur) handed[t.id].push(n);
      t.members.forEach((mb, i) => {
        if (mb === t.members[n]) return; // le bénéficiaire ne cotise pas pour lui-même
        let status = 'valide';
        let late = false;
        if (n === cur) {
          if (i % 3 === 0) return; // pas encore payé
          if (i % 3 === 1 && t.id !== 't3') status = 'en_attente';
        }
        if (t.id === 't3' && n === cur - 1 && mb === 'Rachel') { handed[t.id] = handed[t.id].filter((x) => x !== n); return; } // Rachel en retard → pénalité
        if (t.id === 't2' && n === cur - 1 && mb === 'Junior') { handed[t.id] = handed[t.id].filter((x) => x !== n); return; } // retard
        if (n < cur && (i + n) % 5 === 0) late = true;
        const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() - (late ? -2 : 1 + ((i + n) % 3)));
        let paid = ymd(d); if (paid > today) paid = today;
        payments.push({ id: 'p' + id++, tid: t.id, tour: n, member: mb, amount: t.amount, penalty: late ? t.penalty : 0, status, date: paid, op: ops[(i + n) % 3], proof: 'demo' });
      });
    }
  }
  return { tontines, payments, handed, me: 'Rachel' };
}

export function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s?.tontines) return s; } catch (e) { /* */ }
  const s = seed(); save(s); return s;
}
export function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* */ } }
export function reset() { try { localStorage.removeItem(KEY); } catch (e) { /* */ } }
