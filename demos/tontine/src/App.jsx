import React, { useState } from 'react';
import { Home, Users, HandCoins, CalendarDays, Menu, ChevronRight, Check, X, Clock, AlertTriangle, Gift, Crown, Megaphone, Phone, Repeat } from 'lucide-react';
import { load, save, reset, tourDate, currentTour, todayStr } from './data.js';
import { money, dateFr, dateLong, daysBetween } from '../../kit/format.js';
import { Sheet, Field, Segmented, ScreenHead, Avatar, Confirm, PhotoPicker, ImageView, useToast, ToastProvider } from '../../kit/ui.jsx';

const DEMO_PROOF = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="520"><rect width="360" height="520" fill="#fff"/><rect width="360" height="64" fill="#E40000"/><text x="180" y="42" font-family="sans-serif" font-size="22" font-weight="700" fill="#fff" text-anchor="middle">Airtel Money</text><circle cx="180" cy="140" r="40" fill="#22C55E"/><path d="M161 140l13 13 26-28" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round"/><text x="180" y="225" font-family="sans-serif" font-size="20" font-weight="700" fill="#111" text-anchor="middle">Transfert réussi</text><text x="180" y="272" font-family="sans-serif" font-size="30" font-weight="800" fill="#111" text-anchor="middle">Cotisation</text><text x="180" y="480" font-family="sans-serif" font-size="13" fill="#999" text-anchor="middle">Capture d’exemple (démo)</text></svg>');

function useDb() {
  const [db, setDb] = useState(load);
  const update = (fn) => setDb((d) => { const n = fn(structuredClone(d)); save(n); return n; });
  return [db, update];
}

// Statut d'un membre pour un tour
export function memberTourStatus(db, t, n, m, today = todayStr()) {
  if (t.members[n] === m) return { code: 'benef', label: 'Bénéficiaire' };
  const p = db.payments.find((x) => x.tid === t.id && x.tour === n && x.member === m && x.status !== 'rejete');
  if (p?.status === 'valide') return { code: 'paye', label: p.penalty ? `Payé + pénalité ${money(p.penalty)}` : 'Payé', p };
  if (p) return { code: 'attente', label: 'À valider', p };
  if (tourDate(t, n) < today) return { code: 'retard', label: `En retard · pénalité ${money(t.penalty)}` };
  return { code: 'apayer', label: 'À payer' };
}
function potOf(db, t, n) {
  const paid = db.payments.filter((x) => x.tid === t.id && x.tour === n && x.status === 'valide');
  return { got: paid.reduce((a, p) => a + p.amount, 0), pen: paid.reduce((a, p) => a + p.penalty, 0), expected: t.amount * (t.members.length - 1), nPaid: paid.length };
}
// Ce que je dois (tous tours passés et en cours)
function myDues(db, me) {
  const out = [];
  for (const t of db.tontines) {
    if (!t.members.includes(me)) continue;
    const cur = currentTour(t);
    for (let n = 0; n <= cur; n++) {
      const s = memberTourStatus(db, t, n, me);
      if (s.code === 'retard' || s.code === 'apayer') out.push({ t, n, s, amount: t.amount + (s.code === 'retard' ? t.penalty : 0) });
    }
  }
  return out;
}

export default function App() { return <ToastProvider><Main /></ToastProvider>; }

function Main() {
  const [db, update] = useDb();
  const [tab, setTab] = useState('home');
  const [open, setOpen] = useState(null);
  const [pay, setPay] = useState(null);
  const ctx = { db, update, me: db.me, openT: (id) => setOpen(id), payFor: (x) => setPay(x || {}) };
  let screen;
  if (open) screen = <TontineScreen {...ctx} t={db.tontines.find((x) => x.id === open)} back={() => setOpen(null)} />;
  else if (tab === 'home') screen = <HomeScreen {...ctx} />;
  else if (tab === 'tontines') screen = <List {...ctx} />;
  else if (tab === 'cal') screen = <Calendar {...ctx} />;
  else screen = <More {...ctx} />;
  const T = ({ k, icon, label }) => <button className={tab === k && !open ? 'on' : ''} onClick={() => { setTab(k); setOpen(null); }} aria-label={label}><span className="tab-ic">{icon}</span><span>{label}</span></button>;
  return (
    <div className="app">
      <main className="content">{screen}</main>
      <nav className="tabbar">
        <T k="home" icon={<Home size={22} />} label="Accueil" />
        <T k="tontines" icon={<Users size={22} />} label="Tontines" />
        <button className="add" onClick={() => setPay({})} aria-label="Cotiser"><HandCoins size={26} /><span>Cotiser</span></button>
        <T k="cal" icon={<CalendarDays size={22} />} label="Tours" />
        <T k="plus" icon={<Menu size={22} />} label="Plus" />
      </nav>
      {pay && <PaySheet {...ctx} init={pay} onClose={() => setPay(null)} />}
    </div>
  );
}

function HomeScreen({ db, me, openT, payFor }) {
  const dues = myDues(db, me);
  const mine = db.tontines.filter((t) => t.members.includes(me));
  const myTurns = mine.map((t) => ({ t, n: t.members.indexOf(me) })).filter(({ t, n }) => tourDate(t, n) >= todayStr()).sort((a, b) => tourDate(a.t, a.n).localeCompare(tourDate(b.t, b.n)));
  const next = myTurns[0];
  const toValidate = db.payments.filter((p) => p.status === 'en_attente' && db.tontines.find((t) => t.id === p.tid)?.presidente === me).length;
  return (
    <div className="screen">
      <header className="home-head">
        <div className="row gap-s"><span className="brand-badge"><Repeat size={24} /></span><div><h1>Tontine Facile</h1><p className="hello">Bonjour {me}</p></div></div>
      </header>
      <div className="demo-banner">Démonstration · tontines et montants fictifs</div>
      {next && (
        <section className="hero static">
          <span className="gabon-stripe" />
          <p>Mon prochain tour · {next.t.name}</p>
          <h2>{money(next.t.amount * (next.t.members.length - 1))}</h2>
          <div className="hero-row">
            <div><small>Date</small><b>{dateLong(tourDate(next.t, next.n))}</b></div>
            <div><small>Dans</small><b>{daysBetween(todayStr(), tourDate(next.t, next.n))} jours</b></div>
          </div>
        </section>
      )}
      {toValidate > 0 && <button className="alert-row warn" onClick={() => openT('t1')}><Crown size={20} /><span className="grow"><b>{toValidate} cotisation{toValidate > 1 ? 's' : ''} à valider</b><br /><small>Vous êtes présidente de la Tontine des Mamans</small></span><ChevronRight size={18} /></button>}
      <section className="card">
        <h3 className="card-t">Mes cotisations à faire</h3>
        {dues.length === 0 ? <p className="muted">Tout est payé, bravo !</p> : dues.map(({ t, n, s, amount }) => (
          <button key={t.id + n} className={`alert-row ${s.code === 'retard' ? 'danger' : 'info'}`} onClick={() => payFor({ tid: t.id, tour: n })}>
            {s.code === 'retard' ? <AlertTriangle size={18} /> : <Clock size={18} />}
            <span className="grow"><b>{t.name}</b><br /><small>Tour {n + 1} · {s.code === 'retard' ? `en retard depuis le ${dateFr(tourDate(t, n))}` : `avant le ${dateFr(tourDate(t, n))}`}</small></span>
            <b>{money(amount)}</b>
          </button>
        ))}
      </section>
      <h3 className="sec-t">Mes tontines</h3>
      {mine.map((t) => <TontineCard key={t.id} db={db} t={t} me={me} onClick={() => openT(t.id)} />)}
      <Pub />
    </div>
  );
}

function TontineCard({ db, t, me, onClick }) {
  const cur = currentTour(t);
  const pot = potOf(db, t, cur);
  return (
    <button className="card tcard" onClick={onClick} style={{ '--tc': t.color }}>
      <div className="row">
        <span className="tc-ic"><Users size={20} /></span>
        <div className="grow item-main"><b>{t.name}</b><small>{money(t.amount)} · {t.freq === 'hebdo' ? 'chaque semaine' : 'chaque mois'} · {t.members.length} membres{t.presidente === me ? ' · vous êtes présidente' : ''}</small></div>
        <ChevronRight size={18} />
      </div>
      <div className="kv"><span>Tour {cur + 1}/{t.members.length} · {dateFr(tourDate(t, cur))}</span><b>{t.members[cur]} reçoit</b></div>
      <div className="progress"><div style={{ width: `${(pot.got / pot.expected) * 100}%`, background: t.color }} /></div>
      <small className="muted">{money(pot.got)} collectés sur {money(pot.expected)} · {pot.nPaid}/{t.members.length - 1} ont payé</small>
    </button>
  );
}

function List({ db, me, openT }) {
  return (
    <div className="screen">
      <ScreenHead title="Mes tontines" sub={`${db.tontines.length} groupes`} />
      {db.tontines.map((t) => <TontineCard key={t.id} db={db} t={t} me={me} onClick={() => openT(t.id)} />)}
    </div>
  );
}

function TontineScreen({ db, update, me, t, back, payFor }) {
  const toast = useToast();
  const [tab, setTab] = useState('tour');
  const [reject, setReject] = useState(null);
  const [hand, setHand] = useState(null);
  const cur = currentTour(t);
  const isPres = t.presidente === me;
  const pot = potOf(db, t, cur);
  const pending = db.payments.filter((p) => p.tid === t.id && p.status === 'en_attente');
  const prevLate = cur > 0 ? t.members.filter((m) => memberTourStatus(db, t, cur - 1, m).code === 'retard') : [];
  const setStatus = (p, status) => { update((d) => { d.payments.find((x) => x.id === p.id).status = status; return d; }); toast(status === 'valide' ? `Cotisation de ${p.member} validée ✓` : 'Cotisation refusée'); };
  return (
    <div className="screen">
      <ScreenHead title={t.name} sub={`${money(t.amount)} ${t.freq === 'hebdo' ? 'par semaine' : 'par mois'} · pénalité de retard ${money(t.penalty)}`} onBack={back} />
      <section className="hero static" style={{ background: t.color }}>
        <span className="gabon-stripe" />
        <p>Tour {cur + 1} sur {t.members.length} · {dateLong(tourDate(t, cur))}</p>
        <h2>{t.members[cur]}</h2>
        <div className="hero-row"><div><small>Pot collecté</small><b>{money(pot.got)}</b></div><div><small>Attendu</small><b>{money(pot.expected)}</b></div></div>
      </section>
      <Segmented value={tab} onChange={setTab} options={[['tour', 'Tour en cours'], ['cal', 'Calendrier'], ...(isPres ? [['valid', `À valider (${pending.length})`]] : [])]} />
      {tab === 'tour' && (
        <>
          {prevLate.length > 0 && <div className="alert danger">Tour {cur} : {prevLate.join(', ')} n'a pas encore payé. Pénalité : {money(t.penalty)}.</div>}
          <div className="card list">
            {t.members.map((m) => { const s = memberTourStatus(db, t, cur, m); return (
              <div className="item" key={m}>
                <Avatar name={m} />
                <div className="grow item-main"><b>{m}{m === me ? ' (moi)' : ''}{m === t.presidente ? <span className="tag">Présidente</span> : null}</b><small>{s.p ? `${dateFr(s.p.date)} · ${s.p.op}` : ''}</small></div>
                <span className={`chip-st ${s.code === 'paye' ? 'ok' : s.code === 'benef' ? 'gift' : s.code === 'retard' ? 'bad' : 'warn'}`}>{s.code === 'benef' ? <Gift size={13} /> : s.code === 'paye' ? <Check size={13} /> : <Clock size={13} />}{s.label}</span>
              </div>
            ); })}
          </div>
          {t.members.includes(me) && memberTourStatus(db, t, cur, me).code === 'apayer' && <button className="btn primary full" onClick={() => payFor({ tid: t.id, tour: cur })}>Cotiser {money(t.amount)}</button>}
        </>
      )}
      {tab === 'cal' && (
        <div className="card list">
          {t.members.map((m, n) => {
            const st = n < cur ? (db.handed[t.id]?.includes(n) ? 'remis' : 'incomplet') : n === cur ? 'encours' : 'avenir';
            return (
              <div className={`item tour ${st}`} key={n}>
                <span className="tour-n">{n + 1}</span>
                <div className="grow item-main"><b>{m}{m === me ? ' (moi)' : ''}</b><small>{dateLong(tourDate(t, n))}</small></div>
                {st === 'remis' && <span className="chip-st ok"><Check size={13} />Remis</span>}
                {st === 'incomplet' && <span className="chip-st bad"><AlertTriangle size={13} />Incomplet</span>}
                {st === 'encours' && <span className="chip-st warn"><Clock size={13} />En cours</span>}
                {st === 'avenir' && <span className="muted small">{money(t.amount * (t.members.length - 1))}</span>}
                {isPres && st === 'incomplet' && <button className="btn soft sm" onClick={() => setHand(n)}>Remettre</button>}
              </div>
            );
          })}
        </div>
      )}
      {tab === 'valid' && (pending.length === 0 ? <p className="muted">Aucune cotisation à valider.</p> : pending.map((p) => (
        <div className="validate card" key={p.id}>
          <div className="row"><Avatar name={p.member} /><div className="grow item-main"><b>{p.member}</b><small>Tour {p.tour + 1} · {dateFr(p.date)} · {p.op}</small></div><b className="amount">{money(p.amount + p.penalty)}</b></div>
          <ImageView src={p.proof === 'demo' ? DEMO_PROOF : p.proof} alt={`Capture de ${p.member}`} className="proof" />
          <div className="row gap"><button className="btn ghost danger-t" onClick={() => setReject(p)}><X size={18} /> Refuser</button><button className="btn primary grow" onClick={() => setStatus(p, 'valide')}><Check size={18} /> Valider</button></div>
        </div>
      )))}
      {reject && <Confirm text={`Refuser la cotisation de ${reject.member} ?`} yes="Refuser" onNo={() => setReject(null)} onYes={() => { setStatus(reject, 'rejete'); setReject(null); }} />}
      {hand !== null && <Confirm danger={false} text={`Marquer le pot du tour ${hand + 1} comme remis à ${t.members[hand]} ?`} yes="Pot remis" onNo={() => setHand(null)} onYes={() => { update((d) => { d.handed[t.id].push(hand); return d; }); toast('Pot remis ✓'); setHand(null); }} />}
    </div>
  );
}

function Calendar({ db, me }) {
  const items = [];
  for (const t of db.tontines) for (let n = currentTour(t); n < t.members.length && items.length < 40; n++) items.push({ t, n, date: tourDate(t, n) });
  items.sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="screen">
      <ScreenHead title="Prochains tours" sub="Toutes mes tontines" />
      <div className="card list">
        {items.slice(0, 20).map(({ t, n, date }) => (
          <div className={`item ${t.members[n] === me ? 'mine' : ''}`} key={t.id + n}>
            <span className="date-box" style={{ background: t.color }}><b>{date.slice(8, 10)}</b><small>{dateLong(date).split(' ')[1]}</small></span>
            <div className="grow item-main"><b>{t.members[n] === me ? 'Mon tour 🎉' : `${t.members[n]} reçoit`}</b><small>{t.name} · tour {n + 1}</small></div>
            <b>{money(t.amount * (t.members.length - 1))}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaySheet({ db, update, me, init, onClose }) {
  const toast = useToast();
  const options = myDues(db, me);
  const [sel, setSel] = useState(() => { const i = options.findIndex((o) => o.t.id === init.tid && o.n === init.tour); return i >= 0 ? i : 0; });
  const [op, setOp] = useState('Airtel Money');
  const [img, setImg] = useState(null);
  const o = options[sel];
  if (!o) return <Sheet title="Cotiser" onClose={onClose}><p>Toutes vos cotisations sont à jour. Bravo !</p></Sheet>;
  const send = () => {
    if (!img) return toast('La capture d’écran est obligatoire', 'err');
    update((d) => { d.payments.push({ id: 'p' + Date.now(), tid: o.t.id, tour: o.n, member: me, amount: o.t.amount, penalty: o.s.code === 'retard' ? o.t.penalty : 0, status: 'en_attente', date: todayStr(), op, proof: img }); return d; });
    toast('Cotisation envoyée ✓ En attente de validation');
    onClose();
  };
  return (
    <Sheet title="Cotiser" onClose={onClose} footer={<button className="btn primary full" onClick={send}>Envoyer · {money(o.amount)}</button>}>
      <Field label="Pour">
        <div className="chips">{options.map((x, i) => <button type="button" key={i} className={`chip ${sel === i ? 'on' : ''}`} onClick={() => setSel(i)}>{x.t.name} · tour {x.n + 1}</button>)}</div>
      </Field>
      <div className={`info-box ${o.s.code === 'retard' ? 'late' : ''}`}>Cotisation {money(o.t.amount)}{o.s.code === 'retard' ? <> + pénalité de retard <b>{money(o.t.penalty)}</b></> : null} = <b>{money(o.amount)}</b></div>
      <Field label="Payé par"><div className="chips">{['Airtel Money', 'Moov Money', 'Espèces'].map((x) => <button type="button" key={x} className={`chip ${op === x ? 'on' : ''}`} onClick={() => setOp(x)}>{x}</button>)}</div></Field>
      <PhotoPicker value={img} onChange={setImg} required />
      <p className="muted small">La présidente vérifie la capture puis valide votre cotisation.</p>
    </Sheet>
  );
}

function More({ db, update, me }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="screen">
      <ScreenHead title="Plus" />
      <section className="card demo-box">
        <h3 className="card-t">Version de démonstration</h3>
        <p className="muted small">Rachel est présidente de la Tontine des Mamans : elle valide les cotisations. Sylvie est simple membre.</p>
        <div className="chips">{['Rachel', 'Sylvie'].map((n) => <button key={n} className={`chip big ${me === n ? 'on' : ''}`} onClick={() => update((d) => { d.me = n; return d; })}>{n} · {n === 'Rachel' ? 'présidente' : 'membre'}</button>)}</div>
        <button className="btn ghost full" onClick={() => setConfirm(true)}>Remettre la démo à zéro</button>
      </section>
      <section className="card">
        <h3 className="card-t">Ce que fait Tontine Facile</h3>
        <ul className="feat">
          <li>Plusieurs tontines dans une seule application</li>
          <li>Calendrier des tours : qui reçoit, quand, combien</li>
          <li>Cotisation avec capture d'écran, validée par la présidente</li>
          <li>Pénalités de retard calculées automatiquement</li>
          <li>Rappels avant chaque date limite</li>
        </ul>
      </section>
      <Pub />
      {confirm && <Confirm text="Revenir aux données de démonstration ?" yes="Remettre à zéro" onNo={() => setConfirm(false)} onYes={() => { reset(); window.location.reload(); }} />}
    </div>
  );
}

function Pub() {
  return (
    <section className="pub">
      <Megaphone size={22} />
      <div className="grow">
        <p>Application créée par <b>OrlyDigital</b>.</p>
        <p>Votre application sur mesure : tontine, caisse, boutique…</p>
        <a className="btn wa" href="https://wa.me/24176370881?text=Bonjour%20OrlyDigital%2C%20je%20veux%20une%20application" target="_blank" rel="noreferrer"><Phone size={16} /> WhatsApp 076 37 08 81</a>
      </div>
    </section>
  );
}
