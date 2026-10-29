import React, { useEffect, useState } from 'react';
import { ChevronRight, LogOut, Share2, Copy, Trash2, Plus as PlusIc, Megaphone } from 'lucide-react';
import { Share } from '@capacitor/share';
import { useStore, LOCAL_MODE } from '../lib/store.js';
import { api, supabase, frError, resetDemo } from '../lib/api.js';
import { DEMO_MODE } from '../config.js';
import { settingsOf, CATEGORIES, amountFor } from '../lib/logic.js';
import { getPrefs, setPrefs, setPin, biometryAvailable, biometryAuth, isNative } from '../lib/security.js';
import { requestNotifPermission, refreshNotifications } from '../lib/notify.js';
import { money, num, monthLabel } from '../lib/format.js';
import { APP_VERSION } from '../config.js';
import { ScreenHead, Sheet, Field, MoneyInput, Segmented, Avatar, Confirm, useToast } from '../components/ui.jsx';
import { PinPad } from './Lock.jsx';
import { PubCard } from './Home.jsx';

export function usePrefs(userId) {
  const [p, setP] = useState(() => getPrefs(userId));
  useEffect(() => { const h = () => setP(getPrefs(userId)); window.addEventListener('fp-prefs', h); return () => window.removeEventListener('fp-prefs', h); }, [userId]);
  return p;
}

export default function PlusScreen({ go, onLogout }) {
  const s = useStore();
  const [sheet, setSheet] = useState(null);
  const prefs = usePrefs(s.user.id);
  const requests = s.members.filter((m) => m.pending_user_id);
  const Row = ({ icon, label, value, onClick, badge }) => (
    <button className="item" onClick={onClick}>
      <span className="emoji">{icon}</span>
      <div className="grow item-main"><b>{label}</b>{value && <small>{value}</small>}</div>
      {badge ? <span className="badge-n">{badge}</span> : null}
      <ChevronRight size={18} />
    </button>
  );
  return (
    <div className="screen">
      <ScreenHead title="Plus" />
      <div className="profile-card">
        <Avatar name={s.me?.display_name || '?'} size={52} />
        <div className="grow"><b>{s.me?.display_name}</b><small>{s.isTreasurer ? 'Trésorière' : 'Membre'} · {s.caisse.name}</small></div>
      </div>
      <div className="card list">
        <Row icon="📣" label="Annonces de la famille" value={`${s.announcements.length} annonce(s)`} onClick={() => go('annonces')} />
        <Row icon="💰" label="Mouvements de la caisse" onClick={() => go('caisse')} />
        <Row icon="🔗" label="Inviter un membre" value="Code de la famille et lien de l'application" onClick={() => setSheet('invite')} />
      </div>
      {s.isTreasurer && (
        <>
          <h3 className="sec-t">Trésorerie</h3>
          <div className="card list">
            <Row icon="✋" label="Demandes d'adhésion" value={requests.length ? `${requests.length} en attente` : 'Aucune demande'} badge={requests.length} onClick={() => setSheet('requests')} />
            <Row icon="⚙️" label="Paramètres de la caisse" value="Montants, numéro de dépôt, montant de départ" onClick={() => setSheet('caisse')} />
          </div>
        </>
      )}
      {DEMO_MODE && (
        <section className="card demo-box">
          <h3 className="card-t">Version de démonstration</h3>
          <p className="muted small">Montrez l'application des deux côtés : la trésorière qui valide, et le membre qui consulte et déclare ses dépôts.</p>
          <Segmented value={s.me?.role || 'tresoriere'} onChange={async (v) => { await api.upsert('members', { id: s.me.id, role: v }); s.refresh(); }} options={[['tresoriere', 'Vue trésorière'], ['membre', 'Vue membre']]} />
          <button className="btn ghost full" onClick={() => setSheet('reset')}>Remettre la démo à zéro</button>
        </section>
      )}
      <h3 className="sec-t">Mon compte</h3>
      <div className="card list">
        {!LOCAL_MODE && <Row icon="👤" label="Mon profil" value="Prénom et téléphone" onClick={() => setSheet('profil')} />}
        <Row icon="🔐" label="Code PIN et empreinte" value={prefs.pinOn ? 'Activé' : 'Désactivé'} onClick={() => setSheet('pin')} />
        <Row icon="🔔" label="Notifications" value={prefs.notif.rappels ? 'Rappels de cotisation activés' : 'Rappels désactivés'} onClick={() => setSheet('notif')} />
      </div>
      <PubCard />
      {!LOCAL_MODE && <button className="btn ghost danger-t full" onClick={() => setSheet('logout')}><LogOut size={18} /> Se déconnecter</button>}
      <p className="muted center small">Notre Caisse · version {APP_VERSION}</p>

      {sheet === 'invite' && <InviteSheet onClose={() => setSheet(null)} />}
      {sheet === 'requests' && <RequestsSheet onClose={() => setSheet(null)} />}
      {sheet === 'caisse' && <CaisseSettings onClose={() => setSheet(null)} />}
      {sheet === 'profil' && <ProfilSheet onClose={() => setSheet(null)} />}
      {sheet === 'pin' && <PinSheet onClose={() => setSheet(null)} />}
      {sheet === 'notif' && <NotifSheet onClose={() => setSheet(null)} />}
      {sheet === 'reset' && <Confirm text="Effacer vos essais et revenir aux données de démonstration ?" yes="Remettre à zéro" onNo={() => setSheet(null)} onYes={() => { resetDemo(); window.location.reload(); }} />}
      {sheet === 'logout' && <Confirm text="Se déconnecter ?" yes="Déconnexion" onNo={() => setSheet(null)} onYes={onLogout} />}
    </div>
  );
}

function InviteSheet({ onClose }) {
  const s = useStore();
  const toast = useToast();
  const apk = `https://github.com/${(import.meta.env.VITE_GH_REPO || 'ninononkomi-debug/notre-caisse')}/releases/latest/download/Notre-Caisse.apk`;
  const text = `Rejoins la caisse « ${s.caisse.name} » sur l'application Notre Caisse 💚💛💙\n\n1. Télécharge l'appli : ${apk}\n2. Crée ton compte\n3. Code de la famille : ${s.caisse.invite_code}\n4. Choisis ton prénom dans la liste`;
  return (
    <Sheet title="Inviter un membre" onClose={onClose}>
      <p>Envoyez ce message dans le groupe WhatsApp. Chacun installe l'application, crée son compte, saisit le code puis choisit son prénom. Une trésorière valide ensuite.</p>
      <div className="invite-code">{s.caisse.invite_code}</div>
      <div className="row gap">
        <button className="btn ghost grow" onClick={() => { navigator.clipboard?.writeText(text); toast('Message copié ✓'); }}><Copy size={16} /> Copier</button>
        <button className="btn primary grow" onClick={() => (isNative ? Share.share({ text }) : navigator.share ? navigator.share({ text }) : navigator.clipboard?.writeText(text))}><Share2 size={16} /> Partager</button>
      </div>
      {s.isTreasurer && <button className="btn ghost full" onClick={async () => { try { await api.renewCode(s.caisse.id); await s.refresh(); toast('Nouveau code créé ✓'); } catch (e) { toast(frError(e), 'err'); } }}>Changer le code</button>}
    </Sheet>
  );
}

function RequestsSheet({ onClose }) {
  const s = useStore();
  const toast = useToast();
  const req = s.members.filter((m) => m.pending_user_id);
  const act = async (m, ok) => { try { await api.approve(m.id, ok); toast(ok ? `${m.display_name} a rejoint la caisse ✓` : 'Demande refusée'); s.refresh(); } catch (e) { toast(frError(e), 'err'); } };
  return (
    <Sheet title="Demandes d'adhésion" onClose={onClose}>
      {req.length === 0 ? <p className="muted">Aucune demande en attente.</p> : req.map((m) => (
        <div className="card" key={m.id}>
          <div className="row"><Avatar name={m.display_name} /><div className="grow"><b>{m.display_name}</b><small className="muted">{s.profiles[m.pending_user_id]?.display_name ? `Compte : ${s.profiles[m.pending_user_id].display_name}` : 'Nouveau compte'}</small></div></div>
          <div className="row gap"><button className="btn ghost grow" onClick={() => act(m, false)}>Refuser</button><button className="btn primary grow" onClick={() => act(m, true)}>Accepter</button></div>
        </div>
      ))}
    </Sheet>
  );
}

export function MemberForm({ m, onClose }) {
  const s = useStore();
  const toast = useToast();
  const amt = (d) => amountFor(d, s.caisse) || 1;
  const [d, setD] = useState(() => ({ display_name: '', category: 'travailleur', role: 'membre', couple_with: '', custom_amount: '', start_month: '', phone: '', active: true, ...(m || {}), lateMonths: m ? Math.round(num(m.opening_due) / (amountFor(m, s.caisse) || 1)) : 0 }));
  const [del, setDel] = useState(false);
  const up = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!d.display_name.trim()) return toast('Indiquez le prénom', 'err');
    const row = {
      ...(m ? { id: m.id } : { caisse_id: s.caisse.id }),
      display_name: d.display_name.trim(), category: d.category, role: d.role, couple_with: d.category === 'couple' && d.couple_with ? d.couple_with : null,
      custom_amount: d.category === 'autre' && num(d.custom_amount) ? num(d.custom_amount) : null,
      start_month: d.start_month || null, phone: d.phone || null, active: d.active, opening_due: num(d.lateMonths) * amt(d),
    };
    try {
      const saved = await api.upsert('members', row);
      if (row.couple_with) { const p = s.member(row.couple_with); if (p && p.couple_with !== saved.id) await api.upsert('members', { id: p.id, couple_with: saved.id, category: 'couple' }); }
      toast('Membre enregistré ✓');
      s.refresh();
      onClose();
    } catch (e) { toast(frError(e), 'err'); }
  };
  return (
    <Sheet title={m ? `Modifier ${m.display_name}` : 'Nouveau membre'} onClose={onClose}
      footer={<div className="row gap">{m && !m.user_id && <button className="btn ghost danger-t" aria-label="Supprimer" onClick={() => setDel(true)}><Trash2 size={18} /></button>}<button className="btn primary grow" onClick={save}>Enregistrer</button></div>}>
      <Field label="Prénom"><input value={d.display_name} onChange={(e) => up('display_name', e.target.value)} /></Field>
      <Field label="Situation">
        <div className="chips">{CATEGORIES.map(([k, l]) => <button type="button" key={k} className={`chip ${d.category === k ? 'on' : ''}`} onClick={() => up('category', k)}>{l}</button>)}</div>
      </Field>
      {d.category === 'couple' && (
        <Field label="Conjoint(e)">
          <select value={d.couple_with || ''} onChange={(e) => up('couple_with', e.target.value)}>
            <option value="">Choisir…</option>
            {s.members.filter((x) => x.id !== m?.id).map((x) => <option key={x.id} value={x.id}>{x.display_name}</option>)}
          </select>
        </Field>
      )}
      {d.category === 'autre' && <Field label="Montant mensuel"><MoneyInput value={d.custom_amount} onChange={(v) => up('custom_amount', v)} /></Field>}
      <p className="info-box">Cotisation : <b>{money(amt(d))}</b> par mois{d.category === 'couple' ? ' (moitié du montant couple)' : ''}.</p>
      <Field label="Mois de retard au départ" help={`Mois déjà dus avant ${monthLabel(d.start_month || s.caisse.start_month)}`}><input type="number" min="0" value={d.lateMonths} onChange={(e) => up('lateMonths', e.target.value)} /></Field>
      <Field label="Premier mois à payer dans l'application" help="Laissez vide pour le même que la caisse"><input type="month" value={d.start_month || ''} onChange={(e) => up('start_month', e.target.value)} /></Field>
      <Field label="Téléphone WhatsApp (pour les rappels)"><input inputMode="tel" value={d.phone || ''} onChange={(e) => up('phone', e.target.value)} /></Field>
      <Field label="Rôle"><Segmented value={d.role} onChange={(v) => up('role', v)} options={[['membre', 'Membre'], ['tresoriere', 'Trésorière']]} /></Field>
      <label className="toggle-row"><span>Membre actif<small>Désactivé : ne cotise plus, n'apparaît plus</small></span><input type="checkbox" className="switch" checked={d.active !== false} onChange={(e) => up('active', e.target.checked)} /></label>
      {del && <Confirm text={`Supprimer ${m.display_name} et son historique ?`} yes="Supprimer" onNo={() => setDel(false)} onYes={async () => { try { await api.remove('members', m.id); toast('Supprimé'); s.refresh(); onClose(); } catch (e) { toast(frError(e), 'err'); } }} />}
    </Sheet>
  );
}

function CaisseSettings({ onClose }) {
  const s = useStore();
  const toast = useToast();
  const set = settingsOf(s.caisse);
  const [d, setD] = useState({ name: s.caisse.name, initial_balance: s.caisse.initial_balance, initial_date: s.caisse.initial_date, start_month: s.caisse.start_month, amounts: { ...set.amounts }, dueDay: set.dueDay, depositNumbers: set.depositNumbers.map((x) => ({ ...x })), pub: { ...set.pub } });
  const save = async () => {
    try {
      await api.updateCaisse(s.caisse.id, {
        name: d.name, initial_balance: num(d.initial_balance), initial_date: d.initial_date, start_month: d.start_month,
        settings: { ...(s.caisse.settings || {}), amounts: { travailleur: num(d.amounts.travailleur), sans_emploi: num(d.amounts.sans_emploi), couple: num(d.amounts.couple) }, dueDay: Math.min(28, Math.max(1, num(d.dueDay))), depositNumbers: d.depositNumbers.filter((n) => n.number), pub: d.pub },
      });
      toast('Paramètres enregistrés ✓');
      s.refresh();
      onClose();
    } catch (e) { toast(frError(e), 'err'); }
  };
  const upN = (i, k, v) => setD((x) => ({ ...x, depositNumbers: x.depositNumbers.map((n, j) => (j === i ? { ...n, [k]: v } : n)) }));
  return (
    <Sheet title="Paramètres de la caisse" onClose={onClose} footer={<button className="btn primary full" onClick={save}>Enregistrer</button>}>
      <Field label="Nom du groupe"><input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
      <h3 className="sec-t">Montant en caisse au départ</h3>
      <Field label="Montant"><MoneyInput value={d.initial_balance} onChange={(v) => setD({ ...d, initial_balance: v })} /></Field>
      <Field label="À la date du"><input type="date" value={d.initial_date || ''} onChange={(e) => setD({ ...d, initial_date: e.target.value })} /></Field>
      <Field label="Premier mois suivi dans l'application"><input type="month" value={d.start_month} onChange={(e) => setD({ ...d, start_month: e.target.value })} /></Field>
      <h3 className="sec-t">Cotisations mensuelles (frais de retrait inclus)</h3>
      <Field label="Personne qui travaille"><MoneyInput value={d.amounts.travailleur} onChange={(v) => setD({ ...d, amounts: { ...d.amounts, travailleur: v } })} /></Field>
      <Field label="Personne qui ne travaille pas"><MoneyInput value={d.amounts.sans_emploi} onChange={(v) => setD({ ...d, amounts: { ...d.amounts, sans_emploi: v } })} /></Field>
      <Field label="Couple (pour les deux)"><MoneyInput value={d.amounts.couple} onChange={(v) => setD({ ...d, amounts: { ...d.amounts, couple: v } })} /></Field>
      <Field label="Date limite chaque mois (jour)"><input type="number" min="1" max="28" value={d.dueDay} onChange={(e) => setD({ ...d, dueDay: e.target.value })} /></Field>
      <h3 className="sec-t">Numéros de dépôt</h3>
      {d.depositNumbers.map((n, i) => (
        <div className="card" key={i}>
          <div className="chips">{['Airtel Money', 'Moov Money'].map((o) => <button type="button" key={o} className={`chip ${n.operator === o ? 'on' : ''}`} onClick={() => upN(i, 'operator', o)}>{o}</button>)}</div>
          <Field label="Numéro"><input inputMode="tel" value={n.number} onChange={(e) => upN(i, 'number', e.target.value)} /></Field>
          <Field label="Au nom de"><input value={n.name} onChange={(e) => upN(i, 'name', e.target.value)} /></Field>
          {d.depositNumbers.length > 1 && <button className="btn ghost danger-t" onClick={() => setD({ ...d, depositNumbers: d.depositNumbers.filter((_, j) => j !== i) })}>Retirer ce numéro</button>}
        </div>
      ))}
      <button className="btn ghost full" onClick={() => setD({ ...d, depositNumbers: [...d.depositNumbers, { operator: 'Moov Money', number: '', name: '' }] })}><PlusIc size={16} /> Ajouter un numéro</button>
      <h3 className="sec-t">Message « créée par »</h3>
      <Field label="Nom"><input value={d.pub.author} onChange={(e) => setD({ ...d, pub: { ...d.pub, author: e.target.value } })} /></Field>
      <Field label="Numéro WhatsApp"><input value={d.pub.phone} onChange={(e) => setD({ ...d, pub: { ...d.pub, phone: e.target.value } })} /></Field>
    </Sheet>
  );
}

function ProfilSheet({ onClose }) {
  const s = useStore();
  const toast = useToast();
  const [name, setName] = useState(s.profiles[s.user.id]?.display_name || s.me?.display_name || '');
  const [phone, setPhone] = useState(s.profiles[s.user.id]?.phone || '');
  return (
    <Sheet title="Mon profil" onClose={onClose} footer={<button className="btn primary full" onClick={async () => {
      try { await api.updateProfile(s.user.id, { display_name: name.trim(), phone: phone || null }); toast('Profil enregistré ✓'); s.refresh(); onClose(); } catch (e) { toast(frError(e), 'err'); }
    }}>Enregistrer</button>}>
      <Field label="Prénom"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Téléphone"><input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      <Field label="E-mail"><input value={s.user.email} disabled /></Field>
      <button className="btn ghost full" onClick={async () => { const { error } = await supabase.auth.resetPasswordForEmail(s.user.email, { redirectTo: import.meta.env.VITE_WEB_URL || window.location.href }); toast(error ? frError(error) : 'E-mail de changement de mot de passe envoyé', error ? 'err' : 'ok'); }}>Changer mon mot de passe</button>
    </Sheet>
  );
}

function PinSheet({ onClose }) {
  const s = useStore();
  const toast = useToast();
  const prefs = usePrefs(s.user.id);
  const [step, setStep] = useState(null);
  const [first, setFirst] = useState(null);
  const [bioOk, setBioOk] = useState(false);
  useEffect(() => { biometryAvailable().then(setBioOk); }, []);
  if (step === 'pin') {
    return (
      <Sheet title="Code PIN" onClose={() => setStep(null)}>
        <PinPad title={first ? 'Confirmez le code' : 'Choisissez 4 chiffres'} onDone={async (p) => {
          if (!first) return setFirst(p);
          if (p !== first) { toast('Les codes ne correspondent pas', 'err'); setFirst(null); return; }
          await setPin(s.user.id, p); setPrefs(s.user.id, { pinOn: true }); toast('Code PIN activé ✓'); setStep(null); setFirst(null);
        }} />
      </Sheet>
    );
  }
  return (
    <Sheet title="Code PIN et empreinte" onClose={onClose}>
      <p className="muted">Protégez l'accès à l'application si quelqu'un d'autre utilise votre téléphone.</p>
      <label className="toggle-row"><span>Code PIN à l'ouverture</span><input type="checkbox" className="switch" checked={prefs.pinOn} onChange={(e) => (e.target.checked ? setStep('pin') : setPrefs(s.user.id, { pinOn: false, bio: false }))} /></label>
      {prefs.pinOn && <button className="btn ghost full" onClick={() => setStep('pin')}>Changer le code</button>}
      <label className="toggle-row"><span>Empreinte digitale<small>{bioOk ? 'Disponible' : 'Non disponible sur ce téléphone'}</small></span><input type="checkbox" className="switch" disabled={!bioOk || !prefs.pinOn} checked={prefs.bio} onChange={async (e) => { if (e.target.checked) { if (await biometryAuth()) setPrefs(s.user.id, { bio: true }); } else setPrefs(s.user.id, { bio: false }); }} /></label>
    </Sheet>
  );
}

function NotifSheet({ onClose }) {
  const s = useStore();
  const toast = useToast();
  const prefs = usePrefs(s.user.id);
  const setN = (k, v) => { setPrefs(s.user.id, { notif: { ...prefs.notif, [k]: v } }); refreshNotifications(s); };
  return (
    <Sheet title="Notifications" onClose={onClose}>
      {isNative && <button className="btn ghost full" onClick={async () => { const ok = await requestNotifPermission(); toast(ok ? 'Notifications autorisées ✓' : 'Autorisez-les dans les réglages du téléphone', ok ? 'ok' : 'err'); refreshNotifications(s); }}>Autoriser les notifications</button>}
      <label className="toggle-row"><span>Rappels de cotisation<small>Le dernier jour du mois, le 5 et le 9, seulement si vous n'avez pas encore payé</small></span><input type="checkbox" className="switch" checked={!!prefs.notif.rappels} onChange={(e) => setN('rappels', e.target.checked)} /></label>
      <label className="toggle-row"><span>Mes dépôts<small>Quand un dépôt est validé ou refusé{s.isTreasurer ? ', et les nouveaux dépôts à valider' : ''}</small></span><input type="checkbox" className="switch" checked={!!prefs.notif.versements} onChange={(e) => setN('versements', e.target.checked)} /></label>
      <label className="toggle-row"><span>Annonces de la famille</span><input type="checkbox" className="switch" checked={!!prefs.notif.annonces} onChange={(e) => setN('annonces', e.target.checked)} /></label>
    </Sheet>
  );
}
