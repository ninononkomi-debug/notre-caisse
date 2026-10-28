import React, { useState } from 'react';
import { Users, Crown, Clock } from 'lucide-react';
import { useStore } from '../lib/store.js';
import { api, frError } from '../lib/api.js';
import { DEFAULTS } from '../config.js';
import { Field, useToast } from '../components/ui.jsx';
import { FamilyArt, Logo } from '../components/Logo.jsx';

export default function Onboarding({ onLogout }) {
  const s = useStore();
  const toast = useToast();
  const [mode, setMode] = useState(null);
  const [code, setCode] = useState('');
  const [names, setNames] = useState(null);
  const [pick, setPick] = useState('');
  const [newName, setNewName] = useState(s.user.user_metadata?.display_name || '');
  const [busy, setBusy] = useState(false);
  const run = async (fn) => { setBusy(true); try { await fn(); } catch (e) { toast(frError(e), 'err'); } finally { setBusy(false); } };

  if (s.pending) {
    return (
      <div className="onb">
        <Logo size={72} />
        <Clock size={40} className="warn-t" />
        <h1>Demande envoyée</h1>
        <p>Vous avez demandé à rejoindre <b>{s.caisse?.name || 'la caisse'}</b> en tant que <b>{s.pending.display_name}</b>. Une trésorière doit accepter votre demande.</p>
        <button className="btn primary full" disabled={s.loading} onClick={() => s.refresh()}>{s.loading ? 'Vérification…' : 'Vérifier maintenant'}</button>
        <button className="link" onClick={onLogout}>Se déconnecter</button>
      </div>
    );
  }

  const createCaisse = () => run(async () => {
    const me = DEFAULTS.members.find((m) => m.me);
    const c = await api.createCaisse(DEFAULTS.caisseName, newName || me.display_name, DEFAULTS.startMonth);
    await api.updateCaisse(c.id, { settings: { amounts: DEFAULTS.amounts, dueDay: DEFAULTS.dueDay, depositNumbers: DEFAULTS.depositNumbers, pub: DEFAULTS.pub } });
    const mine = (await api.myMemberships(s.user.id)).find((m) => m.caisse_id === c.id);
    const others = DEFAULTS.members.filter((m) => !m.me).map((m) => ({ caisse_id: c.id, display_name: m.display_name, category: m.category, role: m.role || 'membre' }));
    const created = [...(await api.insertMany('members', others)), mine];
    const byName = Object.fromEntries(created.map((m) => [m.display_name, m]));
    byName[me.display_name] = mine;
    for (const def of DEFAULTS.members) {
      if (!def.couple) continue;
      const a = byName[def.display_name]; const b = byName[def.couple];
      if (a && b) await api.upsert('members', { id: a.id, couple_with: b.id, category: 'couple' });
    }
    toast('Caisse créée ✓');
    await s.refresh();
  });

  return (
    <div className="onb">
      <FamilyArt width={240} />
      <h1>Bienvenue dans Notre Caisse</h1>
      <p className="muted">La caisse de la famille, transparente et à jour, dans votre téléphone.</p>
      {!mode && (
        <>
          <button className="choice" onClick={() => setMode('join')}><Users size={26} /><span><b>Rejoindre ma famille</b><small>J'ai reçu un code dans le groupe</small></span></button>
          <button className="choice" onClick={() => setMode('create')}><Crown size={26} /><span><b>Créer la caisse</b><small>Réservé à la trésorière, une seule fois</small></span></button>
          <button className="link" onClick={onLogout}>Se déconnecter</button>
        </>
      )}
      {mode === 'join' && !names && (
        <div className="auth-card">
          <Field label="Code de la famille"><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex. 5E2853" autoCapitalize="characters" /></Field>
          <button className="btn primary full" disabled={busy || code.length < 4} onClick={() => run(async () => {
            const r = await api.preview(code);
            if (!r.length) throw new Error('Code invalide');
            setNames(r);
          })}>Continuer</button>
          <button className="link" onClick={() => setMode(null)}>← Retour</button>
        </div>
      )}
      {mode === 'join' && names && (
        <div className="auth-card">
          <h2>{names[0].caisse_name}</h2>
          <p className="muted">Qui êtes-vous ?</p>
          <div className="chips">
            {names.filter((n) => n.member_id).map((n) => <button type="button" key={n.member_id} className={`chip big ${pick === n.member_id ? 'on' : ''}`} onClick={() => setPick(n.member_id)}>{n.member_name}</button>)}
            <button type="button" className={`chip big ${pick === 'new' ? 'on' : ''}`} onClick={() => setPick('new')}>Mon nom n'est pas dans la liste</button>
          </div>
          {pick === 'new' && <Field label="Votre prénom"><input value={newName} onChange={(e) => setNewName(e.target.value)} /></Field>}
          <button className="btn primary full" disabled={busy || !pick} onClick={() => run(async () => {
            await api.join(code, pick === 'new' ? null : pick, pick === 'new' ? newName : null);
            toast('Demande envoyée ✓');
            await s.refresh();
          })}>Envoyer ma demande</button>
        </div>
      )}
      {mode === 'create' && (
        <div className="auth-card">
          <p>La caisse « <b>{DEFAULTS.caisseName}</b> » sera créée avec la liste de la famille, les montants et le numéro de dépôt. Tout reste modifiable ensuite.</p>
          <Field label="Votre prénom"><input value={newName} onChange={(e) => setNewName(e.target.value)} /></Field>
          <button className="btn primary full" disabled={busy} onClick={createCaisse}>{busy ? 'Création…' : 'Créer la caisse'}</button>
          <button className="link" onClick={() => setMode(null)}>← Retour</button>
        </div>
      )}
    </div>
  );
}
