import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, X } from 'lucide-react';
import { useStore } from '../lib/store.js';
import { api, frError } from '../lib/api.js';
import { caisseBalance, WITHDRAW_CATS } from '../lib/logic.js';
import { money, dateFr, today, num } from '../lib/format.js';
import { ScreenHead, Avatar, Segmented, Sheet, Field, MoneyInput, PhotoPicker, RemoteImage, Confirm, Empty, useToast, Stripe } from '../components/ui.jsx';
import { FamilyArt } from '../components/Logo.jsx';

export default function Caisse({ back }) {
  const s = useStore();
  const toast = useToast();
  const [tab, setTab] = useState('tout');
  const [out, setOut] = useState(false);
  const [reject, setReject] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(null);
  const bal = caisseBalance(s.caisse, s.deposits, s.withdrawals);
  const pending = s.deposits.filter((d) => d.status === 'en_attente');
  const name = (id) => s.member(id)?.display_name || '?';
  const label = (d) => d.split_with ? `${name(d.member_id)} et ${name(d.split_with)}` : name(d.member_id);

  const moves = [
    ...s.deposits.filter((d) => d.status === 'valide').map((d) => ({ id: d.id, type: 'in', date: d.paid_at, amount: num(d.amount), title: label(d), sub: `Cotisation · ${d.operator || ''}`, d })),
    ...s.withdrawals.map((w) => ({ id: w.id, type: 'out', date: w.date, amount: num(w.amount), title: w.motif, sub: `${(WITHDRAW_CATS.find((c) => c[0] === w.category) || WITHDRAW_CATS[7])[1]}${w.beneficiary ? ` · ${w.beneficiary}` : ''}`, w })),
  ].filter((x) => tab === 'tout' || x.type === tab).sort((a, b) => b.date.localeCompare(a.date));

  const validate = async (d, ok) => {
    setBusy(d.id);
    try {
      await api.upsert('deposits', ok ? { id: d.id, status: 'valide' } : { id: d.id, status: 'rejete', reject_reason: reason || null });
      toast(ok ? `Dépôt de ${label(d)} validé ✓` : 'Dépôt refusé');
      setReject(null); setReason('');
      s.refresh();
    } catch (e) { toast(frError(e), 'err'); } finally { setBusy(null); }
  };

  return (
    <div className="screen">
      <ScreenHead title="La caisse" onBack={back} />
      <section className="hero static">
        <Stripe />
        <p>Montant en caisse</p>
        <h2>{money(bal.balance)}</h2>
        <div className="hero-row">
          <div><small>Au départ ({dateFr(s.caisse.initial_date)})</small><b>{money(s.caisse.initial_balance)}</b></div>
          <div><small>Entrées − sorties</small><b>{money(bal.inn - bal.out)}</b></div>
        </div>
      </section>

      {s.isTreasurer && (
        <section className="card">
          <h3 className="card-t">À valider ({pending.length})</h3>
          {pending.length === 0 ? <p className="muted">Rien à valider pour le moment.</p> : pending.map((d) => (
            <div className="validate" key={d.id}>
              <div className="row">
                <Avatar name={name(d.member_id)} />
                <div className="grow item-main"><b>{label(d)}</b><small>{dateFr(d.paid_at)} · {d.operator}{d.sender_phone ? ` · ${d.sender_phone}` : ''}{d.reference ? ` · réf. ${d.reference}` : ''}</small></div>
                <b className="amount">{money(d.amount)}</b>
              </div>
              {d.note && <p className="muted small">« {d.note} »</p>}
              <RemoteImage path={d.proof_path} alt={`Capture du dépôt de ${label(d)}`} className="proof" />
              <p className="muted small">Déclaré par {s.nameOfUser(d.submitted_by) || 'un membre'}. Vérifiez que l'argent est bien arrivé avant de valider.</p>
              <div className="row gap">
                <button className="btn ghost danger-t" disabled={busy === d.id} onClick={() => setReject(d)}><X size={18} /> Refuser</button>
                <button className="btn primary grow" disabled={busy === d.id} onClick={() => validate(d, true)}><Check size={18} /> Valider {money(d.amount)}</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <Segmented value={tab} onChange={setTab} options={[['tout', 'Tout'], ['in', 'Entrées'], ['out', 'Sorties']]} />
      {moves.length === 0 ? <Empty art={<FamilyArt width={200} />} title="Aucun mouvement" /> : (
        <div className="card list">
          {moves.map((x) => (
            <div className="item" key={x.type + x.id}>
              <span className={`mv-ic ${x.type}`}>{x.type === 'in' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span>
              <div className="grow item-main"><b>{x.title}</b><small>{dateFr(x.date)} · {x.sub}</small></div>
              <b className={x.type === 'in' ? 'pos' : 'neg'}>{x.type === 'in' ? '+' : '−'}{money(x.amount)}</b>
            </div>
          ))}
        </div>
      )}
      {s.isTreasurer && <button className="fab" onClick={() => setOut(true)} aria-label="Enregistrer une sortie">−</button>}
      {out && <SortieForm onClose={() => setOut(false)} />}
      {reject && (
        <Confirm text={`Refuser le dépôt de ${label(reject)} (${money(reject.amount)}) ?`} yes="Refuser" onNo={() => setReject(null)} onYes={() => validate(reject, false)}>
          <Field label="Motif (visible par le membre)"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. argent non reçu, capture illisible" /></Field>
        </Confirm>
      )}
    </div>
  );
}

function SortieForm({ onClose }) {
  const s = useStore();
  const toast = useToast();
  const [d, setD] = useState({ amount: '', date: today(), category: 'aide', motif: '', beneficiary: '' });
  const [img, setImg] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!num(d.amount) || !d.motif.trim()) return toast('Montant et motif obligatoires', 'err');
    setBusy(true);
    try {
      const proof_path = img ? await api.uploadImage(s.caisse.id, s.user.id, img) : null;
      await api.upsert('withdrawals', { caisse_id: s.caisse.id, amount: num(d.amount), date: d.date, category: d.category, motif: d.motif.trim(), beneficiary: d.beneficiary || null, proof_path });
      toast('Sortie enregistrée ✓');
      s.refresh();
      onClose();
    } catch (e) { toast(frError(e), 'err'); } finally { setBusy(false); }
  };
  return (
    <Sheet title="Sortie d'argent" onClose={onClose} footer={<button className="btn primary full" disabled={busy} onClick={save}>Enregistrer la sortie</button>}>
      <Field label="Montant"><MoneyInput value={d.amount} onChange={(v) => setD({ ...d, amount: v })} autoFocus /></Field>
      <Field label="Type">
        <div className="chips">{WITHDRAW_CATS.map(([k, l]) => <button type="button" key={k} className={`chip ${d.category === k ? 'on' : ''}`} onClick={() => setD({ ...d, category: k })}>{l}</button>)}</div>
      </Field>
      <Field label="Motif"><input value={d.motif} onChange={(e) => setD({ ...d, motif: e.target.value })} placeholder="Ex. Soutien deuil famille Obame" /></Field>
      <Field label="Bénéficiaire (facultatif)"><input value={d.beneficiary} onChange={(e) => setD({ ...d, beneficiary: e.target.value })} /></Field>
      <Field label="Date"><input type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} /></Field>
      <PhotoPicker label="Justificatif (facultatif)" value={img} onChange={setImg} />
      <p className="muted small">Tous les membres verront cette sortie.</p>
    </Sheet>
  );
}
