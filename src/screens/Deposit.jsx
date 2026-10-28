import React, { useMemo, useState } from 'react';
import { useStore } from '../lib/store.js';
import { api, frError } from '../lib/api.js';
import { memberStatus, settingsOf, amountFor } from '../lib/logic.js';
import { money, today, num } from '../lib/format.js';
import { Sheet, Field, MoneyInput, Segmented, PhotoPicker, useToast } from '../components/ui.jsx';

export default function DepositForm({ onClose, forMember }) {
  const s = useStore();
  const toast = useToast();
  const set = settingsOf(s.caisse);
  const couple = s.me?.couple_with ? s.member(s.me.couple_with) : null;
  const [who, setWho] = useState(forMember ? 'autre' : couple ? 'couple' : 'moi');
  const [other, setOther] = useState(forMember?.id || '');
  const [amount, setAmount] = useState('');
  const [op, setOp] = useState(set.depositNumbers[0]?.operator || 'Airtel Money');
  const [phone, setPhone] = useState(s.me?.phone || '');
  const [ref, setRef] = useState('');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [img, setImg] = useState(null);
  const [busy, setBusy] = useState(false);

  const target = who === 'autre' ? s.member(other) : s.me;
  const split = who === 'couple' && couple ? couple : null;
  const st = target ? memberStatus(target, s.caisse, s.deposits) : null;
  const st2 = split ? memberStatus(split, s.caisse, s.deposits) : null;
  const unit = target ? amountFor(target, s.caisse) + (split ? amountFor(split, s.caisse) : 0) : 0;
  const due = st ? st.toBeUpToDate + (st2 ? st2.toBeUpToDate : 0) : 0;
  const quick = useMemo(() => {
    const q = [[unit, `1 mois · ${money(unit)}`], [unit * 2, `2 mois · ${money(unit * 2)}`]];
    if (due > unit * 2 || (due > 0 && due !== unit && due !== unit * 2)) q.unshift([due, `Tout mon retard · ${money(due)}`]);
    return q;
  }, [unit, due]);

  const send = async () => {
    if (!target) return toast('Choisissez le membre', 'err');
    if (!num(amount)) return toast('Indiquez le montant versé', 'err');
    if (!img) return toast('La capture d’écran est obligatoire', 'err');
    setBusy(true);
    try {
      const proof_path = await api.uploadImage(s.caisse.id, s.user.id, img);
      await api.upsert('deposits', {
        caisse_id: s.caisse.id, member_id: target.id, split_with: split?.id || null, amount: num(amount),
        operator: op, sender_phone: phone || null, reference: ref || null, note: note || null, proof_path, paid_at: date,
      });
      toast('Dépôt envoyé ✓ En attente de validation');
      s.refresh();
      onClose();
    } catch (e) { toast(frError(e), 'err'); } finally { setBusy(false); }
  };

  const others = s.members.filter((m) => m.active && m.id !== s.me?.id);
  return (
    <Sheet title="J'ai fait mon dépôt" onClose={onClose} footer={<button className="btn primary full" disabled={busy} onClick={send}>{busy ? 'Envoi…' : 'Envoyer pour validation'}</button>}>
      <Field label="Ce dépôt est pour">
        <Segmented value={who} onChange={setWho} options={[['moi', 'Moi'], ...(couple ? [['couple', `Moi + ${couple.display_name}`]] : []), ['autre', 'Un autre membre']]} />
      </Field>
      {who === 'autre' && (
        <Field label="Membre">
          <select value={other} onChange={(e) => setOther(e.target.value)}>
            <option value="">Choisir…</option>
            {others.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </select>
        </Field>
      )}
      {st && (
        <div className="info-box">
          {split ? `Couple : ${money(unit)} par mois.` : `${target.display_name} : ${money(unit)} par mois.`}{' '}
          {due > 0 ? <>Pour être à jour : <b>{money(due)}</b>.</> : <>Déjà à jour, ce dépôt comptera comme avance.</>}
        </div>
      )}
      <Field label="Montant envoyé">
        <MoneyInput value={amount} onChange={setAmount} />
        <div className="chips">{quick.map(([v, l]) => <button type="button" key={l} className={`chip ${num(amount) === v ? 'on' : ''}`} onClick={() => setAmount(v)}>{l}</button>)}</div>
      </Field>
      <Field label="Envoyé par">
        <div className="chips">
          {[...new Set([...set.depositNumbers.map((n) => n.operator), 'Airtel Money', 'Moov Money', 'Espèces'])].map((o) => (
            <button type="button" key={o} className={`chip ${op === o ? 'on' : ''}`} onClick={() => setOp(o)}>{o}</button>
          ))}
        </div>
      </Field>
      <Field label="Date du dépôt"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Numéro qui a envoyé (facultatif)"><input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07X XX XX XX" /></Field>
      <Field label="Référence de la transaction (facultatif)"><input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
      <PhotoPicker value={img} onChange={setImg} required label={op === 'Espèces' ? 'Photo du reçu' : 'Capture d’écran du dépôt'} />
      <Field label="Message (facultatif)"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. cotisations novembre et décembre" /></Field>
    </Sheet>
  );
}
