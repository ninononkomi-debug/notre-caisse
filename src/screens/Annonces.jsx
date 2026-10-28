import React, { useState } from 'react';
import { Info, Users, Baby, Flower2, Gavel, PartyPopper, Trash2, Pin } from 'lucide-react';
import { useStore } from '../lib/store.js';
import { api, frError } from '../lib/api.js';
import { ANN_KINDS } from '../lib/logic.js';
import { dateFr } from '../lib/format.js';
import { ScreenHead, Sheet, Field, PhotoPicker, RemoteImage, Empty, Confirm, useToast } from '../components/ui.jsx';
import { FamilyArt } from '../components/Logo.jsx';

export function annIcon(kind, size = 20) {
  const I = { info: Info, reunion: Users, naissance: Baby, deuil: Flower2, decision: Gavel, fete: PartyPopper }[kind] || Info;
  return <I size={size} aria-hidden="true" />;
}

export default function Annonces({ back }) {
  const s = useStore();
  const toast = useToast();
  const [form, setForm] = useState(false);
  const [del, setDel] = useState(null);
  const list = [...s.announcements].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.created_at.localeCompare(a.created_at));
  return (
    <div className="screen">
      <ScreenHead title="Annonces" sub="Les nouvelles de la famille" onBack={back} />
      {list.length === 0 ? <Empty art={<FamilyArt width={220} />} title="Aucune annonce" text="Réunions, naissances, deuils, décisions : partagez les nouvelles de la famille." /> : list.map((a) => (
        <article key={a.id} className="card ann">
          <div className="row">
            <span className={`ann-ic k-${a.kind}`}>{annIcon(a.kind)}</span>
            <div className="grow">
              <b>{a.title}</b>
              <small className="muted">{(ANN_KINDS.find((k) => k[0] === a.kind) || ANN_KINDS[0])[1]} · {s.nameOfUser(a.author) || 'Membre'} · {dateFr(a.created_at.slice(0, 10))}</small>
            </div>
            {a.pinned && <Pin size={16} aria-label="Épinglée" />}
            {(a.author === s.user.id || s.isTreasurer) && <button className="icon-btn" aria-label="Supprimer l'annonce" onClick={() => setDel(a)}><Trash2 size={18} /></button>}
          </div>
          {a.body && <p className="ann-body">{a.body}</p>}
          {a.image_path && <RemoteImage path={a.image_path} alt={a.title} className="ann-img" />}
        </article>
      ))}
      <button className="fab" onClick={() => setForm(true)} aria-label="Publier une annonce">+</button>
      {form && <AnnForm onClose={() => setForm(false)} />}
      {del && <Confirm text="Supprimer cette annonce ?" yes="Supprimer" onNo={() => setDel(null)} onYes={async () => {
        try { await api.remove('announcements', del.id); toast('Annonce supprimée'); s.refresh(); } catch (e) { toast(frError(e), 'err'); }
        setDel(null);
      }} />}
    </div>
  );
}

function AnnForm({ onClose }) {
  const s = useStore();
  const toast = useToast();
  const [d, setD] = useState({ kind: 'info', title: '', body: '', pinned: false });
  const [img, setImg] = useState(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!d.title.trim()) return toast('Indiquez un titre', 'err');
    setBusy(true);
    try {
      const image_path = img ? await api.uploadImage(s.caisse.id, s.user.id, img) : null;
      await api.upsert('announcements', { caisse_id: s.caisse.id, author: s.user.id, kind: d.kind, title: d.title.trim(), body: d.body.trim() || null, image_path, pinned: s.isTreasurer && d.pinned });
      toast('Annonce publiée ✓');
      s.refresh();
      onClose();
    } catch (e) { toast(frError(e), 'err'); } finally { setBusy(false); }
  };
  return (
    <Sheet title="Nouvelle annonce" onClose={onClose} footer={<button className="btn primary full" disabled={busy} onClick={send}>{busy ? 'Envoi…' : 'Publier'}</button>}>
      <Field label="Type">
        <div className="chips">
          {ANN_KINDS.map(([k, l]) => <button type="button" key={k} className={`chip ${d.kind === k ? 'on' : ''}`} onClick={() => setD({ ...d, kind: k })}>{annIcon(k, 16)} {l}</button>)}
        </div>
      </Field>
      <Field label="Titre"><input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Ex. Réunion de famille dimanche 15 h" /></Field>
      <Field label="Message"><textarea rows={4} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} /></Field>
      <PhotoPicker label="Image (facultatif)" value={img} onChange={setImg} />
      {s.isTreasurer && <label className="toggle-row"><span>Épingler en haut</span><input type="checkbox" className="switch" checked={d.pinned} onChange={(e) => setD({ ...d, pinned: e.target.checked })} /></label>}
    </Sheet>
  );
}
