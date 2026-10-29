import React, { useEffect, useState } from 'react';
import { checkUpdate, apkUrl } from '../lib/update.js';
import { DEMO_MODE } from '../config.js';
import { Copy, RefreshCw, CloudOff, ChevronRight, Megaphone, ShieldCheck, Phone, Clock, XCircle, CheckCircle2 } from 'lucide-react';
import { useStore } from '../lib/store.js';
import { memberStatus, caisseBalance, monthSummary, settingsOf, displayMonth } from '../lib/logic.js';
import { money, monthLabel, addMonths, dateFr, today } from '../lib/format.js';
import { Logo } from '../components/Logo.jsx';
import { Avatar, StatusChip, useToast, Stripe } from '../components/ui.jsx';
import { annIcon } from './Annonces.jsx';

export function waLink(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '').replace(/^0/, '');
  return `https://wa.me/241${digits}?text=${encodeURIComponent(text || '')}`;
}

export default function Home({ go, openDeposit }) {
  const s = useStore();
  const toast = useToast();
  const [hide] = useState(false);
  const [upd, setUpd] = useState(null);
  useEffect(() => { checkUpdate().then(setUpd); }, []);
  const { caisse, me } = s;
  const set = settingsOf(caisse);
  const bal = caisseBalance(caisse, s.deposits, s.withdrawals);
  const camp = displayMonth(caisse);
  const sum = monthSummary(caisse, s.members.filter((m) => m.active && (m.user_id || !m.pending_user_id)), s.deposits);
  const myS = me ? memberStatus(me, caisse, s.deposits) : null;
  const couple = me?.couple_with ? s.member(me.couple_with) : null;
  const toValidate = s.deposits.filter((d) => d.status === 'en_attente');
  const myDeps = s.deposits.filter((d) => d.submitted_by === s.user.id).slice(0, 3);
  const prevM = addMonths(camp, -1);
  const lastDayPrev = new Date(Number(camp.slice(0, 4)), Number(camp.slice(5, 7)) - 1, 0).getDate();

  return (
    <div className="screen">
      <header className="home-head">
        <div className="row gap-s">
          <Logo size={44} />
          <div><h1>Notre Caisse</h1><p className="hello">{caisse.name}</p></div>
        </div>
        <button className={`sync ${s.loading ? 'spin' : ''} ${s.offline ? 'off' : ''}`} onClick={() => s.refresh()} aria-label="Actualiser">
          {s.offline ? <CloudOff size={20} /> : <RefreshCw size={20} />}
        </button>
      </header>
      {DEMO_MODE && <div className="demo-banner">Démonstration · famille et chiffres fictifs · <button className="link" onClick={() => go('plus')}>Changer de vue</button></div>}
      {upd && <button className="alert-row info" onClick={() => window.open(apkUrl(), '_blank')}><RefreshCw size={18} /><span className="grow">Nouvelle version {upd} disponible : appuyez pour l'installer</span></button>}
      {s.offline && <div className="alert warn">Pas de connexion : affichage des dernières données connues.</div>}

      <button className="hero" onClick={() => go('caisse')}>
        <Stripe />
        <p>Montant en caisse</p>
        <h2>{hide ? '••••••' : money(bal.balance)}</h2>
        <div className="hero-row">
          <div><small>Entrées validées</small><b>{money(bal.inn)}</b></div>
          <div><small>Sorties</small><b>{money(bal.out)}</b></div>
        </div>
        <span className="hero-more">Voir tous les mouvements <ChevronRight size={16} /></span>
      </button>

      {s.isTreasurer && toValidate.length > 0 && (
        <button className="alert-row warn" onClick={() => go('caisse')}>
          <ShieldCheck size={20} />
          <span className="grow"><b>{toValidate.length} versement{toValidate.length > 1 ? 's' : ''} à valider</b><br /><small>Vérifiez la capture et l'argent reçu</small></span>
          <ChevronRight size={18} />
        </button>
      )}

      {myS && (
        <section className="card me-card">
          <div className="row">
            <Avatar name={me.display_name} size={48} />
            <div className="grow"><b className="big-name">{me.display_name}</b><StatusChip s={myS} /></div>
          </div>
          {myS.code !== 'ajour' && (
            <p className="due-line">À verser pour être à jour : <b>{money(myS.toBeUpToDate)}</b>{couple ? <small> (votre part ; couple : {money(myS.toBeUpToDate * 2)})</small> : null}</p>
          )}
          {myS.pending > 0 && <p className="muted small"><Clock size={14} /> {money(myS.pending)} en attente de validation</p>}
          <button className="btn primary full" onClick={() => openDeposit()}>J'ai fait mon dépôt</button>
        </section>
      )}

      <section className="card">
        <div className="card-h"><h3 className="card-t">Cotisation de {monthLabel(camp)}</h3></div>
        <p className="muted small">À verser entre le {lastDayPrev} {monthLabel(prevM).split(' ')[0]} et le {set.dueDay} {monthLabel(camp).split(' ')[0]}</p>
        <div className="progress big"><div style={{ width: `${sum.total ? (sum.ok / sum.total) * 100 : 0}%` }} /></div>
        <p><b>{sum.ok} sur {sum.total}</b> membres sont à jour</p>
        <div className="avatars">
          {sum.list.map(({ m, s: st }) => (
            <span key={m.id} className={`av-wrap ${st.code}`} title={`${m.display_name} : ${st.label}`}><Avatar name={m.display_name} size={36} /></span>
          ))}
        </div>
        <button className="link" onClick={() => go('membres')}>Voir qui a cotisé <ChevronRight size={14} /></button>
      </section>

      <section className="card deposit-card">
        <h3 className="card-t">Numéro de dépôt</h3>
        {set.depositNumbers.map((n, i) => (
          <div className="dep-num" key={i}>
            <div className={`op-badge ${/moov/i.test(n.operator) ? 'moov' : 'airtel'}`}>{/moov/i.test(n.operator) ? 'Moov' : 'Airtel'}</div>
            <div className="grow">
              <b className="num">{n.number}</b>
              <small>{n.operator} · au nom de {n.name}</small>
            </div>
            <button className="icon-btn" aria-label="Copier le numéro" onClick={() => { navigator.clipboard?.writeText(n.number.replace(/\s/g, '')); toast('Numéro copié ✓'); }}><Copy size={20} /></button>
          </div>
        ))}
        <p className="muted small">Après votre dépôt, appuyez sur « J'ai fait mon dépôt » et joignez la capture d'écran. Sans capture, le dépôt n'est pas validé.</p>
      </section>

      {myDeps.length > 0 && (
        <section className="card">
          <h3 className="card-t">Mes derniers dépôts</h3>
          {myDeps.map((d) => (
            <div className="mini-dep" key={d.id}>
              {d.status === 'valide' ? <CheckCircle2 size={18} className="pos" /> : d.status === 'rejete' ? <XCircle size={18} className="neg" /> : <Clock size={18} className="warn-t" />}
              <span className="grow">{money(d.amount)} · {dateFr(d.paid_at)}</span>
              <small className={d.status === 'valide' ? 'pos' : d.status === 'rejete' ? 'neg' : 'warn-t'}>{d.status === 'valide' ? 'Validé' : d.status === 'rejete' ? `Refusé${d.reject_reason ? ` : ${d.reject_reason}` : ''}` : 'En attente'}</small>
            </div>
          ))}
        </section>
      )}

      {s.announcements.length > 0 && (
        <section className="card">
          <div className="card-h"><h3 className="card-t">Annonces de la famille</h3><button className="link" onClick={() => go('annonces')}>Tout voir</button></div>
          {s.announcements.slice(0, 2).map((a) => (
            <button key={a.id} className="ann-mini" onClick={() => go('annonces')}>
              <span className={`ann-ic k-${a.kind}`}>{annIcon(a.kind, 18)}</span>
              <span className="grow"><b>{a.title}</b><small>{dateFr(a.created_at.slice(0, 10))}</small></span>
            </button>
          ))}
        </section>
      )}

      <PubCard />
    </div>
  );
}

export function PubCard() {
  const s = useStore();
  const pub = settingsOf(s.caisse).pub;
  return (
    <section className="pub">
      <Megaphone size={22} />
      <div className="grow">
        <p>Application créée par <b>{pub.author}</b>.</p>
        <p>Vous voulez votre propre application ?</p>
        <a className="btn wa" href={waLink(pub.phone, 'Bonjour, j’ai vu l’application Notre Caisse et je voudrais ma propre application.')} target="_blank" rel="noreferrer"><Phone size={16} /> WhatsApp {pub.phone}</a>
      </div>
    </section>
  );
}
