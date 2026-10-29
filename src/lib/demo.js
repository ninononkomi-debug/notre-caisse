// Données fictives de la version démo (présentation aux clients)
import { uid, today, addMonths, pad } from './format.js';
import { campaignMonth } from './logic.js';

export const DEMO = import.meta.env.VITE_DEMO === '1';
export const DEMO_KEY = 'nc:localdb';
export const DEMO_USER_ID = 'local-user';

const dayOf = (mk, d) => `${mk}-${pad(d)}`;

export function buildDemoDb() {
  const now = new Date().toISOString();
  const camp = campaignMonth();
  const start = addMonths(camp, -5);
  const t = today();
  const day = Number(t.slice(8, 10));
  const cid = uid();
  const caisse = {
    id: cid, name: 'Famille Moussavou (démo)', invite_code: 'DEMO24', initial_balance: 350000, initial_date: dayOf(start, 1),
    start_month: start, created_by: DEMO_USER_ID, created_at: now,
    settings: {
      amounts: { travailleur: 2600, sans_emploi: 1600, couple: 5150 }, dueDay: 10,
      depositNumbers: [{ operator: 'Airtel Money', number: '07X XX XX XX', name: 'Trésorière de la famille' }, { operator: 'Moov Money', number: '06X XX XX XX', name: 'Trésorière adjointe' }],
      pub: { author: 'Orly MACKITA', phone: '076 37 08 81' },
    },
  };
  // [prénom, catégorie, conjoint, rôle, mois couverts, compte relié]
  const spec = [
    ['Sandrine', 'couple', 'Hervé', 'tresoriere', 6, true],
    ['Hervé', 'couple', 'Sandrine', 'membre', 6, false],
    ['Marie-Claire', 'travailleur', null, 'tresoriere', 7, false],
    ['Jean-Pierre', 'travailleur', null, 'membre', 6, false],
    ['Prisca', 'travailleur', null, 'membre', 6, false],
    ['Rodrigue', 'couple', 'Annick', 'membre', 4, false],
    ['Annick', 'couple', 'Rodrigue', 'membre', 4, false],
    ['Ghislain', 'sans_emploi', null, 'membre', 5, false],
    ['Maman Pauline', 'travailleur', null, 'membre', 6, false],
    ['Kevin', 'sans_emploi', null, 'membre', 6, false],
  ];
  const members = spec.map(([name, category, , role, , linked]) => ({
    id: uid(), caisse_id: cid, display_name: name, user_id: linked ? DEMO_USER_ID : name === 'Maman Pauline' ? null : `demo-${name}`, pending_user_id: null, role, category,
    custom_amount: null, couple_with: null, start_month: null, opening_due: 0, active: true, phone: '07X XX XX XX', created_at: now,
  }));
  const byName = Object.fromEntries(members.map((m) => [m.display_name, m]));
  spec.forEach(([name, , partner]) => { if (partner) byName[name].couple_with = byName[partner].id; });
  // une demande d'adhésion en attente
  members.push({ id: uid(), caisse_id: cid, display_name: 'Brice', user_id: null, pending_user_id: 'demo-brice', role: 'membre', category: 'travailleur', custom_amount: null, couple_with: null, start_month: camp, opening_due: 0, active: true, phone: null, created_at: now });

  const amount = { travailleur: 2600, sans_emploi: 1600, couple: 5150 };
  const ops = ['Airtel Money', 'Moov Money'];
  const deposits = [];
  const done = new Set();
  spec.forEach(([name, category, partner, , months], i) => {
    if (done.has(name)) return;
    const m = byName[name];
    const p = partner ? byName[partner] : null;
    if (p) done.add(partner);
    done.add(name);
    for (let k = 0; k < months; k++) {
      const mk = addMonths(start, k);
      const paidDay = Math.min(9, 2 + ((i + k) % 7));
      let date = mk > camp ? dayOf(camp, Math.min(day, 8)) : dayOf(mk, paidDay);
      if (mk === camp && date > t) date = t;
      // le mois en cours de Prisca reste « en attente » pour montrer la validation
      const pending = name === 'Prisca' && mk === camp;
      deposits.push({
        id: uid(), caisse_id: cid, member_id: m.id, split_with: p ? p.id : null, amount: amount[category], operator: ops[(i + k) % 2],
        sender_phone: null, reference: null, note: null, proof_path: 'demo-proof', status: pending ? 'en_attente' : 'valide', reject_reason: null,
        submitted_by: m.user_id || `demo-${name}`, validated_by: pending ? null : DEMO_USER_ID, validated_at: pending ? null : now, paid_at: date, created_at: `${date}T09:00:00Z`,
      });
    }
  });
  // un dépôt de Jean-Pierre en attente, un dépôt refusé de Ghislain
  deposits.push({ id: uid(), caisse_id: cid, member_id: byName['Jean-Pierre'].id, split_with: null, amount: 2600, operator: 'Airtel Money', sender_phone: '07X XX XX XX', reference: 'TX48213', note: 'Cotisation du mois', proof_path: 'demo-proof', status: 'en_attente', reject_reason: null, submitted_by: 'demo-jp', validated_by: null, validated_at: null, paid_at: t, created_at: now });
  deposits.push({ id: uid(), caisse_id: cid, member_id: byName['Ghislain'].id, split_with: null, amount: 1600, operator: 'Moov Money', sender_phone: null, reference: null, note: null, proof_path: 'demo-proof', status: 'rejete', reject_reason: 'Capture illisible, merci de renvoyer', submitted_by: 'demo-gh', validated_by: DEMO_USER_ID, validated_at: now, paid_at: dayOf(addMonths(camp, -1), 6), created_at: `${dayOf(addMonths(camp, -1), 6)}T10:00:00Z` });

  const withdrawals = [
    { id: uid(), caisse_id: cid, amount: 50000, date: dayOf(addMonths(start, 1), 18), category: 'deuil', motif: 'Soutien deuil — oncle Martin', beneficiary: 'Famille de Jean-Pierre', proof_path: null, created_by: DEMO_USER_ID, created_at: now },
    { id: uid(), caisse_id: cid, amount: 25000, date: dayOf(addMonths(start, 3), 12), category: 'naissance', motif: 'Naissance du bébé de Prisca', beneficiary: 'Prisca', proof_path: null, created_by: DEMO_USER_ID, created_at: now },
    { id: uid(), caisse_id: cid, amount: 30000, date: dayOf(addMonths(camp, -1), 21), category: 'maladie', motif: 'Frais d’hôpital Maman Pauline', beneficiary: 'Maman Pauline', proof_path: null, created_by: DEMO_USER_ID, created_at: now },
  ];
  const ann = (title, body, kind, mk, d, pinned = false) => ({ id: uid(), caisse_id: cid, author: DEMO_USER_ID, kind, title, body, image_path: null, pinned, created_at: `${dayOf(mk, d)}T08:00:00Z` });
  const announcements = [
    ann('Réunion de famille dimanche à 15 h', 'Chez Maman Pauline. Ordre du jour : bilan de la caisse et projet de fin d’année.', 'reunion', camp, Math.max(1, Math.min(day, 5)), true),
    ann('Bienvenue au bébé de Prisca !', 'La caisse a remis 25 000 F à la jeune maman. Félicitations !', 'naissance', addMonths(start, 3), 12),
    ann('Décision : cotisation maintenue à 2 600 F', 'Les 100 F couvrent les frais de retrait Mobile Money.', 'decision', addMonths(start, 1), 25),
  ];
  return {
    caisses: [caisse], members, deposits, withdrawals, announcements,
    profiles: [{ id: DEMO_USER_ID, display_name: 'Sandrine' }], images: {},
  };
}

// Capture fictive affichée pour les dépôts de la démo
export const DEMO_PROOF = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="560" viewBox="0 0 360 560">' +
  '<rect width="360" height="560" fill="#fff"/><rect width="360" height="70" fill="#E40000"/>' +
  '<text x="180" y="45" font-family="sans-serif" font-size="24" font-weight="700" fill="#fff" text-anchor="middle">Airtel Money</text>' +
  '<circle cx="180" cy="150" r="42" fill="#22C55E"/><path d="M160 150l14 14 28-30" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<text x="180" y="240" font-family="sans-serif" font-size="22" font-weight="700" fill="#111" text-anchor="middle">Transfert réussi</text>' +
  '<text x="180" y="290" font-family="sans-serif" font-size="34" font-weight="800" fill="#111" text-anchor="middle">2 600 FCFA</text>' +
  '<text x="180" y="340" font-family="sans-serif" font-size="16" fill="#555" text-anchor="middle">Vers : 07X XX XX XX</text>' +
  '<text x="180" y="370" font-family="sans-serif" font-size="16" fill="#555" text-anchor="middle">Réf. : TX48213</text>' +
  '<text x="180" y="520" font-family="sans-serif" font-size="14" fill="#999" text-anchor="middle">Capture d’exemple (démo)</text></svg>');
