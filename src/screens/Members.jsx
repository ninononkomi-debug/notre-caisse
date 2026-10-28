import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle, Pencil, Plus } from 'lucide-react';
import { useStore } from '../lib/store.js';
import { memberStatus, monthGrid, amountFor, CATEGORIES } from '../lib/logic.js';
import { money, MONTHS_S, dateFr, monthLabel } from '../lib/format.js';
import { ScreenHead, Avatar, StatusChip, Segmented, Sheet, Empty } from '../components/ui.jsx';
import { FamilyArt } from '../components/Logo.jsx';
import { waLink } from './Home.jsx';
import { MemberForm } from './Admin.jsx';

export default function Members({ openDeposit }) {
  const s = useStore();
  const [f, setF] = useState('tous');
  const [sel, setSel] = useState(null);
  const [edit, setEdit] = useState(null);
  const rows = s.members.filter((m) => m.active && (m.user_id || !m.pending_user_id)).map((m) => ({ m, st: memberStatus(m, s.caisse, s.deposits) }));
  const cnt = (c) => rows.filter((r) => r.st.code === c).length;
  const list = rows.filter((r) => f === 'tous' || r.st.code === f).sort((a, b) => ({ retard: 0, apayer: 1, ajour: 2 }[a.st.code] - { retard: 0, apayer: 1, ajour: 2 }[b.st.code]) || a.m.display_name.localeCompare(b.m.display_name));
  return (
    <div className="screen">
      <ScreenHead title="Membres" sub={`${rows.length} membres · ${cnt('ajour')} à jour`} right={s.isTreasurer ? <button className="icon-btn" aria-label="Ajouter un membre" onClick={() => setEdit('new')}><Plus size={22} /></button> : null} />
      <div className="mini-stats">
        <button className={f === 'ajour' ? 'on' : ''} onClick={() => setF(f === 'ajour' ? 'tous' : 'ajour')}><small>À jour</small><b className="pos">{cnt('ajour')}</b></button>
        <button className={f === 'apayer' ? 'on' : ''} onClick={() => setF(f === 'apayer' ? 'tous' : 'apayer')}><small>À payer</small><b className="warn-t">{cnt('apayer')}</b></button>
        <button className={f === 'retard' ? 'on' : ''} onClick={() => setF(f === 'retard' ? 'tous' : 'retard')}><small>En retard</small><b className="neg">{cnt('retard')}</b></button>
      </div>
      <Segmented value={f} onChange={setF} options={[['tous', 'Tous'], ['ajour', 'À jour'], ['apayer', 'À payer'], ['retard', 'En retard']]} />
      {list.length === 0 ? <Empty art={<FamilyArt width={200} />} title="Personne ici" /> : (
        <div className="card list">
          {list.map(({ m, st }) => (
            <button className="item" key={m.id} onClick={() => setSel(m)}>
              <Avatar name={m.display_name} />
              <div className="grow item-main">
                <b>{m.display_name}{m.role === 'tresoriere' ? <span className="tag">Trésorière</span> : null}</b>
                <small>{money(amountFor(m, s.caisse))}/mois{m.couple_with ? ` · couple avec ${s.member(m.couple_with)?.display_name || ''}` : ''}{!m.user_id ? ' · pas encore inscrit' : ''}</small>
              </div>
              <StatusChip s={st} />
            </button>
          ))}
        </div>
      )}
      {sel && <MemberSheet m={sel} onClose={() => setSel(null)} onEdit={() => { setEdit(sel); setSel(null); }} openDeposit={openDeposit} />}
      {edit && <MemberForm m={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function MemberSheet({ m, onClose, onEdit, openDeposit }) {
  const s = useStore();
  const [year, setYear] = useState(Number(s.caisse.start_month.slice(0, 4)) > new Date().getFullYear() ? Number(s.caisse.start_month.slice(0, 4)) : new Date().getFullYear());
  const st = memberStatus(m, s.caisse, s.deposits);
  const grid = monthGrid(m, s.caisse, s.deposits, year);
  const deps = s.deposits.filter((d) => d.member_id === m.id || d.split_with === m.id);
  const cat = (CATEGORIES.find((c) => c[0] === m.category) || CATEGORIES[0])[1];
  const msg = `Bonjour ${m.display_name}, petit rappel de la caisse « ${s.caisse.name} » : ${st.code === 'retard' ? `${st.months} mois de retard, ` : ''}${money(st.toBeUpToDate)} à verser. Merci 🙏`;
  return (
    <Sheet title={m.display_name} onClose={onClose}
      footer={<div className="row gap">
        {s.isTreasurer && <button className="btn ghost" onClick={onEdit}><Pencil size={16} /> Modifier</button>}
        <button className="btn primary grow" onClick={() => { onClose(); openDeposit(m); }}>Déclarer un dépôt pour {m.display_name}</button>
      </div>}>
      <div className="row"><Avatar name={m.display_name} size={56} /><div className="grow"><StatusChip s={st} /><p className="muted small">{cat} · {money(st.amount)} par mois · depuis {monthLabel(st.start)}</p></div></div>
      <div className="kv"><span>Total validé</span><b>{money(st.paid)}</b></div>
      {st.code !== 'ajour' && <div className="kv"><span>Reste pour être à jour</span><b className="neg">{money(st.toBeUpToDate)}</b></div>}
      {st.pending > 0 && <div className="kv"><span>En attente de validation</span><b className="warn-t">{money(st.pending)}</b></div>}
      <div className="year-nav">
        <button className="icon-btn" onClick={() => setYear(year - 1)} aria-label="Année précédente"><ChevronLeft size={20} /></button>
        <b>{year}</b>
        <button className="icon-btn" onClick={() => setYear(year + 1)} aria-label="Année suivante"><ChevronRight size={20} /></button>
      </div>
      <div className="months">
        {grid.map((g, i) => <div key={g.M} className={`mcell ${g.state}`}><span>{MONTHS_S[i]}</span></div>)}
      </div>
      <div className="legend-inline"><span><i className="dot paye" />Payé</span><span><i className="dot partiel" />Partiel</span><span><i className="dot du" />Dû</span><span><i className="dot futur" />À venir</span></div>
      {s.isTreasurer && m.phone && st.code !== 'ajour' && (
        <a className="btn wa full" href={waLink(m.phone, msg)} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Rappeler par WhatsApp</a>
      )}
      <h3 className="sec-t">Historique</h3>
      {deps.length === 0 ? <p className="muted">Aucun dépôt enregistré.</p> : (
        <div className="list">
          {deps.map((d) => (
            <div className="item" key={d.id}>
              <div className="grow item-main"><b>{money(d.split_with ? d.amount / 2 : d.amount)}{d.split_with ? <small className="muted"> (part du couple)</small> : null}</b><small>{dateFr(d.paid_at)} · {d.operator}</small></div>
              <span className={`chip-st ${d.status === 'valide' ? 'ok' : d.status === 'rejete' ? 'bad' : 'warn'}`}>{d.status === 'valide' ? 'Validé' : d.status === 'rejete' ? 'Refusé' : 'En attente'}</span>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
