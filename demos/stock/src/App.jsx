import React, { useMemo, useState } from 'react';
import { Home, Package, ShoppingBag, ArrowLeftRight, Menu, Search, AlertTriangle, Plus, Minus, Trash2, TrendingUp, Sparkles, Droplets, Wind, Palette, Flower2, PackagePlus, Phone, Megaphone } from 'lucide-react';
import { load, save, reset, CATS, USERS } from './data.js';
import { money, dateFr } from '../../kit/format.js';
import { Sheet, Field, MoneyInput, Segmented, ScreenHead, Avatar, Confirm, useToast, ToastProvider } from '../../kit/ui.jsx';

const CAT_ICON = { visage: Sparkles, corps: Droplets, cheveux: Wind, maquillage: Palette, parfum: Flower2 };
const catOf = (k) => CATS.find((c) => c[0] === k) || CATS[0];
const sameDay = (a, b) => a.slice(0, 10) === b.slice(0, 10);
const todayIso = () => new Date().toISOString();

function useDb() {
  const [db, setDb] = useState(load);
  const update = (fn) => setDb((d) => { const n = fn(structuredClone(d)); save(n); return n; });
  return [db, update];
}

export default function App() {
  return <ToastProvider><Main /></ToastProvider>;
}

function Main() {
  const [db, update] = useDb();
  const [tab, setTab] = useState('home');
  const [sell, setSell] = useState(false);
  const me = USERS.find((u) => u.id === db.me);
  const boss = me.role === 'patronne';
  const ctx = { db, update, me, boss, setTab };
  let screen;
  if (tab === 'home') screen = <Dashboard {...ctx} />;
  else if (tab === 'produits') screen = <Products {...ctx} />;
  else if (tab === 'mouv') screen = <Moves {...ctx} />;
  else screen = <More {...ctx} />;
  const T = ({ k, icon, label }) => <button className={tab === k ? 'on' : ''} onClick={() => setTab(k)} aria-label={label}><span className="tab-ic">{icon}</span><span>{label}</span></button>;
  return (
    <div className="app">
      <main className="content">{screen}</main>
      <nav className="tabbar">
        <T k="home" icon={<Home size={22} />} label="Accueil" />
        <T k="produits" icon={<Package size={22} />} label="Produits" />
        <button className="add" onClick={() => setSell(true)} aria-label="Nouvelle vente"><ShoppingBag size={26} /><span>Vendre</span></button>
        <T k="mouv" icon={<ArrowLeftRight size={22} />} label={boss ? 'Mouvements' : 'Mes ventes'} />
        <T k="plus" icon={<Menu size={22} />} label="Plus" />
      </nav>
      {sell && <SellSheet {...ctx} onClose={() => setSell(false)} />}
    </div>
  );
}

function ProductTile({ p, size = 44 }) {
  const [, , color] = catOf(p.cat);
  const I = CAT_ICON[p.cat] || Sparkles;
  return <span className="ptile" style={{ width: size, height: size, background: color }} aria-hidden="true"><I size={size * 0.48} /></span>;
}

function Header({ me }) {
  return (
    <header className="home-head">
      <div className="row gap-s">
        <span className="brand-badge"><Sparkles size={24} /></span>
        <div><h1>Beauté Stock</h1><p className="hello">Boutique Éclat · {me.name}</p></div>
      </div>
      <span className={`role-chip ${me.role}`}>{me.role === 'patronne' ? 'Patronne' : 'Vendeuse'}</span>
    </header>
  );
}

function Dashboard({ db, me, boss, setTab }) {
  const now = todayIso();
  const month = now.slice(0, 7);
  const mySales = boss ? db.sales : db.sales.filter((s) => s.user === me.id);
  const today = mySales.filter((s) => sameDay(s.date, now));
  const monthS = mySales.filter((s) => s.date.slice(0, 7) === month);
  const sum = (l, k) => l.reduce((a, s) => a + s[k], 0);
  const low = db.products.filter((p) => p.stock <= p.seuil).sort((a, b) => a.stock - b.stock);
  const stockValue = db.products.reduce((a, p) => a + p.stock * p.achat, 0);
  const top = useMemo(() => {
    const m = {};
    for (const s of monthS) for (const it of s.items) m[it.pid] = (m[it.pid] || 0) + it.qty;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([pid, q]) => ({ p: db.products.find((x) => x.id === pid), q }));
  }, [db]);
  const byUser = USERS.map((u) => ({ u, v: db.sales.filter((s) => s.user === u.id && s.date.slice(0, 7) === month).reduce((a, s) => a + s.total, 0) }));
  const maxU = Math.max(1, ...byUser.map((x) => x.v));
  return (
    <div className="screen">
      <Header me={me} />
      <div className="demo-banner">Démonstration · boutique et chiffres fictifs</div>
      <section className="hero static">
        <span className="gabon-stripe" />
        <p>{boss ? 'Ventes du jour' : 'Mes ventes du jour'}</p>
        <h2>{money(sum(today, 'total'))}</h2>
        <div className="hero-row">
          <div><small>{boss ? 'Bénéfice du jour' : 'Nombre de ventes'}</small><b>{boss ? money(sum(today, 'benef')) : today.length}</b></div>
          <div><small>{boss ? 'Ventes du mois' : 'Mes ventes du mois'}</small><b>{money(sum(monthS, 'total'))}</b></div>
        </div>
      </section>
      {boss && (
        <div className="mini-stats">
          <div><small>Bénéfice du mois</small><b className="pos">{money(sum(monthS, 'benef'))}</b></div>
          <div><small>Valeur du stock</small><b>{money(stockValue)}</b></div>
          <div><small>Produits</small><b>{db.products.length}</b></div>
        </div>
      )}
      {low.length > 0 && (
        <section className="card">
          <h3 className="card-t"><AlertTriangle size={18} className="neg" /> Stock bas ({low.length})</h3>
          {low.map((p) => (
            <button key={p.id} className="alert-row danger" onClick={() => setTab('produits')}>
              <ProductTile p={p} size={34} />
              <span className="grow"><b>{p.nom}</b><br /><small>Seuil d'alerte : {p.seuil}</small></span>
              <b>{p.stock} restant{p.stock > 1 ? 's' : ''}</b>
            </button>
          ))}
        </section>
      )}
      <section className="card">
        <h3 className="card-t"><TrendingUp size={18} /> Meilleures ventes du mois</h3>
        {top.map(({ p, q }, i) => (
          <div className="item" key={p.id}>
            <span className="rank">{i + 1}</span><ProductTile p={p} size={36} />
            <div className="grow item-main"><b>{p.nom}</b><small>{p.marque}</small></div>
            <b>{q} vendus</b>
          </div>
        ))}
      </section>
      {boss && (
        <section className="card">
          <h3 className="card-t">Ventes par vendeuse ce mois</h3>
          {byUser.map(({ u, v }) => (
            <div key={u.id} className="budget-line">
              <div className="row"><Avatar name={u.name} size={30} /><span className="grow">{u.name}</span><b>{money(v)}</b></div>
              <div className="progress"><div style={{ width: `${(v / maxU) * 100}%`, background: 'var(--violet)' }} /></div>
            </div>
          ))}
        </section>
      )}
      <Pub />
    </div>
  );
}

function Products({ db, update, boss }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('tous');
  const [sel, setSel] = useState(null);
  const [recv, setRecv] = useState(null);
  const list = db.products.filter((p) => (cat === 'tous' || p.cat === cat) && `${p.nom} ${p.marque}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="screen">
      <ScreenHead title="Produits" sub={`${db.products.length} produits · ${db.products.reduce((a, p) => a + p.stock, 0)} articles en stock`} right={boss ? <button className="icon-btn" aria-label="Réception de stock" onClick={() => setRecv({})}><PackagePlus size={22} /></button> : null} />
      <div className="search"><Search size={18} /><input placeholder="Rechercher un produit…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="chips scroll">
        <button className={`chip ${cat === 'tous' ? 'on' : ''}`} onClick={() => setCat('tous')}>Tous</button>
        {CATS.map(([k, l]) => <button key={k} className={`chip ${cat === k ? 'on' : ''}`} onClick={() => setCat(k)}>{l}</button>)}
      </div>
      <div className="card list">
        {list.map((p) => (
          <button className="item" key={p.id} onClick={() => setSel(p)}>
            <ProductTile p={p} />
            <div className="grow item-main"><b>{p.nom}</b><small>{p.marque} · {money(p.vente)}</small></div>
            <span className={`stock-badge ${p.stock <= p.seuil ? 'low' : ''}`}>{p.stock}</span>
          </button>
        ))}
      </div>
      {sel && (
        <Sheet title={sel.nom} onClose={() => setSel(null)} footer={boss ? <button className="btn primary full" onClick={() => { setRecv({ pid: sel.id }); setSel(null); }}><PackagePlus size={18} /> Réception de stock</button> : null}>
          <div className="row"><ProductTile p={sel} size={64} /><div className="grow"><b>{sel.marque}</b><p className="muted small">{catOf(sel.cat)[1]}</p></div></div>
          <div className="kv"><span>En stock</span><b className={sel.stock <= sel.seuil ? 'neg' : ''}>{sel.stock} (alerte à {sel.seuil})</b></div>
          <div className="kv"><span>Prix de vente</span><b>{money(sel.vente)}</b></div>
          {boss && <div className="kv"><span>Prix d'achat</span><b>{money(sel.achat)}</b></div>}
          {boss && <div className="kv"><span>Marge par article</span><b className="pos">{money(sel.vente - sel.achat)} ({Math.round(((sel.vente - sel.achat) / sel.vente) * 100)} %)</b></div>}
          {boss && <button className="btn ghost full" onClick={() => {
            update((d) => { const p = d.products.find((x) => x.id === sel.id); p.stock = Math.max(0, p.stock - 1); d.moves.unshift({ id: 'm' + Date.now(), date: todayIso(), type: 'ajust', pid: sel.id, qty: -1, motif: 'Produit abîmé', user: d.me }); return d; });
            toast('Ajustement enregistré : −1'); setSel(null);
          }}>Retirer 1 article abîmé</button>}
        </Sheet>
      )}
      {recv && <ReceiveSheet db={db} update={update} init={recv} onClose={() => setRecv(null)} />}
    </div>
  );
}

function ReceiveSheet({ db, update, init, onClose }) {
  const toast = useToast();
  const [pid, setPid] = useState(init.pid || db.products[0].id);
  const [qty, setQty] = useState(12);
  const [four, setFour] = useState('Grossiste Mont-Bouët');
  const p = db.products.find((x) => x.id === pid);
  const [cout, setCout] = useState(p.achat);
  return (
    <Sheet title="Réception de stock" onClose={onClose} footer={<button className="btn primary full" onClick={() => {
      update((d) => { const x = d.products.find((y) => y.id === pid); x.stock += Number(qty) || 0; x.achat = Number(cout) || x.achat; d.moves.unshift({ id: 'm' + Date.now(), date: todayIso(), type: 'entree', pid, qty: Number(qty), motif: 'Réception fournisseur', fournisseur: four, cout: Number(cout), user: d.me }); return d; });
      toast(`+${qty} ${p.nom} ✓`); onClose();
    }}>Enregistrer l'entrée</button>}>
      <Field label="Produit"><select value={pid} onChange={(e) => { setPid(e.target.value); setCout(db.products.find((x) => x.id === e.target.value).achat); }}>{db.products.map((x) => <option key={x.id} value={x.id}>{x.nom} (stock {x.stock})</option>)}</select></Field>
      <Field label="Quantité reçue"><input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
      <Field label="Coût d'achat unitaire"><MoneyInput value={cout} onChange={setCout} /></Field>
      <Field label="Fournisseur"><input value={four} onChange={(e) => setFour(e.target.value)} /></Field>
      <p className="info-box">Valeur de la livraison : <b>{money((Number(qty) || 0) * (Number(cout) || 0))}</b></p>
    </Sheet>
  );
}

function SellSheet({ db, update, me, onClose }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [cart, setCart] = useState({});
  const [pay, setPay] = useState('Espèces');
  const add = (p, k) => setCart((c) => { const n = Math.max(0, Math.min(p.stock, (c[p.id] || 0) + k)); const x = { ...c, [p.id]: n }; if (!n) delete x[p.id]; return x; });
  const items = Object.entries(cart).map(([pid, qty]) => ({ p: db.products.find((x) => x.id === pid), qty }));
  const total = items.reduce((a, { p, qty }) => a + p.vente * qty, 0);
  const list = db.products.filter((p) => `${p.nom} ${p.marque}`.toLowerCase().includes(q.toLowerCase()));
  const valider = () => {
    if (!items.length) return toast('Ajoutez au moins un produit', 'err');
    update((d) => {
      for (const { p, qty } of items) d.products.find((x) => x.id === p.id).stock -= qty;
      d.sales.push({ id: 's' + Date.now(), date: todayIso(), user: me.id, pay, items: items.map(({ p, qty }) => ({ pid: p.id, qty, prix: p.vente, cout: p.achat })), total, benef: items.reduce((a, { p, qty }) => a + (p.vente - p.achat) * qty, 0) });
      return d;
    });
    toast(`Vente de ${money(total)} enregistrée ✓`);
    onClose();
  };
  return (
    <Sheet title="Nouvelle vente" onClose={onClose} footer={<button className="btn primary full" onClick={valider}>Valider la vente · {money(total)}</button>}>
      <div className="search"><Search size={18} /><input placeholder="Chercher un produit…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="sell-list">
        {list.map((p) => (
          <div className={`sell-item ${cart[p.id] ? 'on' : ''}`} key={p.id}>
            <ProductTile p={p} size={38} />
            <div className="grow item-main"><b>{p.nom}</b><small>{money(p.vente)} · {p.stock} en stock</small></div>
            {cart[p.id] ? (
              <div className="stepper"><button aria-label="Moins" onClick={() => add(p, -1)}>{cart[p.id] === 1 ? <Trash2 size={16} /> : <Minus size={16} />}</button><b>{cart[p.id]}</b><button aria-label="Plus" onClick={() => add(p, 1)}><Plus size={16} /></button></div>
            ) : <button className="btn soft sm" disabled={!p.stock} onClick={() => add(p, 1)}>{p.stock ? 'Ajouter' : 'Épuisé'}</button>}
          </div>
        ))}
      </div>
      {items.length > 0 && (
        <div className="cart">
          {items.map(({ p, qty }) => <div className="kv" key={p.id}><span>{qty} × {p.nom}</span><b>{money(qty * p.vente)}</b></div>)}
          <div className="kv total"><span>Total</span><b>{money(total)}</b></div>
        </div>
      )}
      <Field label="Paiement"><div className="chips">{['Espèces', 'Airtel Money', 'Moov Money'].map((o) => <button type="button" key={o} className={`chip ${pay === o ? 'on' : ''}`} onClick={() => setPay(o)}>{o}</button>)}</div></Field>
    </Sheet>
  );
}

function Moves({ db, me, boss }) {
  const [f, setF] = useState('tout');
  const name = (id) => USERS.find((u) => u.id === id)?.name || '';
  const prod = (id) => db.products.find((p) => p.id === id);
  const sales = (boss ? db.sales : db.sales.filter((s) => s.user === me.id)).map((s) => ({ kind: 'vente', date: s.date, s }));
  const mv = boss ? db.moves.map((m) => ({ kind: m.type, date: m.date, m })) : [];
  const all = [...sales, ...mv].filter((x) => f === 'tout' || (f === 'ventes' ? x.kind === 'vente' : x.kind !== 'vente')).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60);
  return (
    <div className="screen">
      <ScreenHead title={boss ? 'Mouvements de stock' : 'Mes ventes'} />
      {boss && <Segmented value={f} onChange={setF} options={[['tout', 'Tout'], ['ventes', 'Ventes (sorties)'], ['entrees', 'Entrées et ajustements']]} />}
      <div className="card list">
        {all.map((x, i) => x.kind === 'vente' ? (
          <div className="item" key={'s' + x.s.id}>
            <span className="mv-ic out"><ShoppingBag size={18} /></span>
            <div className="grow item-main"><b>{x.s.items.map((it) => `${it.qty}× ${prod(it.pid)?.nom}`).join(', ')}</b><small>{dateFr(x.date.slice(0, 10))} {x.date.slice(11, 16)} · {name(x.s.user)} · {x.s.pay}</small></div>
            <b className="pos">{money(x.s.total)}</b>
          </div>
        ) : (
          <div className="item" key={'m' + x.m.id}>
            <span className={`mv-ic ${x.m.qty > 0 ? 'in' : 'out'}`}>{x.m.qty > 0 ? <PackagePlus size={18} /> : <Minus size={18} />}</span>
            <div className="grow item-main"><b>{x.m.qty > 0 ? '+' : ''}{x.m.qty} {prod(x.m.pid)?.nom}</b><small>{dateFr(x.date.slice(0, 10))} · {x.m.motif}{x.m.fournisseur ? ` · ${x.m.fournisseur}` : ''}</small></div>
            {x.m.cout ? <b>{money(x.m.cout * x.m.qty)}</b> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function More({ db, update, me }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="screen">
      <ScreenHead title="Plus" />
      <section className="card demo-box">
        <h3 className="card-t">Version de démonstration</h3>
        <p className="muted small">Changez de compte pour montrer ce que voit la patronne et ce que voit une vendeuse (pas de prix d'achat ni de bénéfices).</p>
        <div className="chips">{USERS.map((u) => <button key={u.id} className={`chip big ${me.id === u.id ? 'on' : ''}`} onClick={() => update((d) => { d.me = u.id; return d; })}>{u.name} · {u.role}</button>)}</div>
        <button className="btn ghost full" onClick={() => setConfirm(true)}>Remettre la démo à zéro</button>
      </section>
      <section className="card">
        <h3 className="card-t">Ce que fait Beauté Stock</h3>
        <ul className="feat">
          <li>Stock en temps réel, alerte quand un produit va manquer</li>
          <li>Ventes en 3 appuis, paiement espèces ou Mobile Money</li>
          <li>Bénéfice du jour et du mois, valeur du stock</li>
          <li>Réceptions fournisseur, produits abîmés</li>
          <li>Plusieurs vendeuses, la patronne voit tout</li>
        </ul>
      </section>
      <Pub />
      {confirm && <Confirm text="Revenir aux données de démonstration ?" yes="Remettre à zéro" onNo={() => setConfirm(false)} onYes={() => { reset(); window.location.reload(); }} />}
    </div>
  );
}

export function Pub() {
  return (
    <section className="pub">
      <Megaphone size={22} />
      <div className="grow">
        <p>Application créée par <b>OrlyDigital</b>.</p>
        <p>Votre application sur mesure : boutique, caisse, tontine…</p>
        <a className="btn wa" href="https://wa.me/24176370881?text=Bonjour%20OrlyDigital%2C%20je%20veux%20une%20application" target="_blank" rel="noreferrer"><Phone size={16} /> WhatsApp 076 37 08 81</a>
      </div>
    </section>
  );
}
