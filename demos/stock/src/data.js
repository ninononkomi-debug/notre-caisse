// Données fictives — boutique de cosmétiques
const KEY = 'bs:db';
export const CATS = [
  ['visage', 'Soins visage', '#B5536A'],
  ['corps', 'Corps', '#C98A4B'],
  ['cheveux', 'Cheveux', '#6B4E9B'],
  ['maquillage', 'Maquillage', '#D9476B'],
  ['parfum', 'Parfums', '#3C7A89'],
];
export const USERS = [
  { id: 'u1', name: 'Mme Ella', role: 'patronne' },
  { id: 'u2', name: 'Grâce', role: 'vendeuse' },
  { id: 'u3', name: 'Laetitia', role: 'vendeuse' },
];
const P = (id, nom, marque, cat, achat, vente, stock, seuil) => ({ id, nom, marque, cat, achat, vente, stock, seuil });
const PRODUCTS = [
  P('p1', 'Crème éclaircissante 200 ml', 'Glow Nature', 'visage', 3500, 6000, 24, 6),
  P('p2', 'Sérum vitamine C', 'Glow Nature', 'visage', 5000, 9000, 4, 5),
  P('p3', 'Savon noir au karité', 'Karité d’Or', 'corps', 800, 1500, 60, 15),
  P('p4', 'Beurre de karité pur 250 g', 'Karité d’Or', 'corps', 2000, 3500, 18, 8),
  P('p5', 'Lait corporel cacao', 'Douceur d’Afrique', 'corps', 2500, 4500, 3, 6),
  P('p6', 'Huile de ricin 100 ml', 'Racines', 'cheveux', 1500, 3000, 30, 10),
  P('p7', 'Défrisant doux kit', 'Racines', 'cheveux', 3000, 5500, 12, 5),
  P('p8', 'Mèches bouclées 18"', 'Belle Mèche', 'cheveux', 6000, 10000, 9, 4),
  P('p9', 'Fond de teint ébène', 'Mbolo Beauty', 'maquillage', 4000, 7500, 7, 4),
  P('p10', 'Rouge à lèvres mat', 'Mbolo Beauty', 'maquillage', 1500, 3000, 26, 8),
  P('p11', 'Palette yeux 12 couleurs', 'Mbolo Beauty', 'maquillage', 3500, 6500, 2, 3),
  P('p12', 'Crayon sourcils', 'Mbolo Beauty', 'maquillage', 700, 1500, 40, 10),
  P('p13', 'Eau de parfum Oud 50 ml', 'Maison Akanda', 'parfum', 8000, 15000, 6, 3),
  P('p14', 'Brume corporelle vanille', 'Maison Akanda', 'parfum', 2500, 5000, 14, 5),
  P('p15', 'Gel douche coco', 'Douceur d’Afrique', 'corps', 1200, 2500, 22, 8),
  P('p16', 'Masque argile purifiant', 'Glow Nature', 'visage', 2200, 4000, 11, 4),
];

function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const iso = (d) => d.toISOString();

export function seed() {
  const r = rng(42);
  const products = PRODUCTS.map((p) => ({ ...p }));
  const sales = [];
  const now = new Date();
  for (let back = 29; back >= 0; back--) {
    const n = back === 0 ? 5 : 3 + Math.floor(r() * 6);
    for (let i = 0; i < n; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - back);
      d.setHours(9 + Math.floor(r() * 9), Math.floor(r() * 60), 0, 0);
      if (d > now) d.setTime(now.getTime() - (n - i) * 600000);
      const items = [];
      const k = 1 + Math.floor(r() * 3);
      for (let j = 0; j < k; j++) {
        const p = products[Math.floor(r() * products.length)];
        if (items.find((x) => x.pid === p.id)) continue;
        items.push({ pid: p.id, qty: 1 + Math.floor(r() * 2), prix: p.vente, cout: p.achat });
      }
      const total = items.reduce((s, x) => s + x.qty * x.prix, 0);
      const benef = items.reduce((s, x) => s + x.qty * (x.prix - x.cout), 0);
      sales.push({ id: `s${back}-${i}`, date: iso(d), user: ['u1', 'u2', 'u3', 'u2'][Math.floor(r() * 4)], items, pay: ['Espèces', 'Airtel Money', 'Moov Money'][Math.floor(r() * 3)], total, benef });
    }
  }
  const moves = [];
  const d0 = new Date(now); d0.setDate(d0.getDate() - 12);
  moves.push({ id: 'm1', date: iso(d0), type: 'entree', pid: 'p1', qty: 24, motif: 'Réception fournisseur', fournisseur: 'Grossiste Mont-Bouët', cout: 3500, user: 'u1' });
  const d1 = new Date(now); d1.setDate(d1.getDate() - 7);
  moves.push({ id: 'm2', date: iso(d1), type: 'entree', pid: 'p3', qty: 48, motif: 'Réception fournisseur', fournisseur: 'Karité d’Or Libreville', cout: 800, user: 'u1' });
  const d2 = new Date(now); d2.setDate(d2.getDate() - 3);
  moves.push({ id: 'm3', date: iso(d2), type: 'ajust', pid: 'p10', qty: -2, motif: 'Produit abîmé', user: 'u1' });
  return { products, sales, moves, me: 'u1' };
}

export function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s?.products) return s; } catch (e) { /* */ }
  const s = seed(); save(s); return s;
}
export function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* */ } }
export function reset() { try { localStorage.removeItem(KEY); } catch (e) { /* */ } }
