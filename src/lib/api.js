// Accès aux données : Supabase en vrai, ou base locale (mode test sans serveur)
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, LOCAL_MODE } from '../config.js';
import { uid } from './format.js';

export const supabase = LOCAL_MODE ? null : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'notrecaisse-auth' },
});

export function frError(e) {
  const m = (e && (e.message || e.error_description || String(e))) || 'Erreur inconnue';
  const map = [
    [/Invalid login credentials/i, 'E-mail ou mot de passe incorrect.'],
    [/Email not confirmed/i, "E-mail pas encore confirmé : ouvrez le lien reçu par e-mail."],
    [/User already registered/i, 'Un compte existe déjà avec cet e-mail.'],
    [/Password should be at least/i, 'Le mot de passe doit contenir au moins 8 caractères.'],
    [/rate limit/i, 'Trop de tentatives, patientez quelques minutes.'],
    [/Failed to fetch|NetworkError|network/i, 'Pas de connexion internet.'],
    [/Code invalide/i, 'Code de la famille invalide.'],
    [/déjà pris/i, 'Ce nom est déjà demandé par quelqu’un d’autre.'],
    [/Déjà membre/i, 'Vous êtes déjà membre de cette caisse.'],
    [/Caisse existe déjà/i, 'La caisse de la famille existe déjà : choisissez « Rejoindre ma famille » avec le code.'],
    [/row-level security|Accès refusé|permission/i, "Action réservée aux trésorières."],
  ];
  for (const [r, t] of map) if (r.test(m)) return t;
  return m;
}

// ======================= Supabase =======================
const remote = {
  async myMemberships(userId) {
    const { data, error } = await supabase.from('members').select('*').or(`user_id.eq.${userId},pending_user_id.eq.${userId}`);
    if (error) throw error;
    return data;
  },
  async loadCaisse(caisseId) {
    const q = (t, order = 'created_at') => supabase.from(t).select('*').eq('caisse_id', caisseId).order(order, { ascending: false });
    const [c, m, d, w, a, p] = await Promise.all([
      supabase.from('caisses').select('*').eq('id', caisseId).single(),
      supabase.from('members').select('*').eq('caisse_id', caisseId).order('display_name'),
      q('deposits'), q('withdrawals', 'date'), q('announcements'),
      supabase.from('profiles').select('*'),
    ]);
    for (const r of [c, m, d, w, a, p]) if (r.error) throw r.error;
    return { caisse: c.data, members: m.data, deposits: d.data, withdrawals: w.data, announcements: a.data, profiles: p.data };
  },
  async createCaisse(name, memberName, startMonth) {
    const { data, error } = await supabase.rpc('create_caisse', { p_name: name, p_member_name: memberName, p_start_month: startMonth });
    if (error) throw error;
    return data;
  },
  async caisseExists() {
    const { data, error } = await supabase.rpc('caisse_exists');
    if (error) return false;
    return !!data;
  },
  async preview(code) {
    const { data, error } = await supabase.rpc('caisse_preview', { p_code: code });
    if (error) throw error;
    return data;
  },
  async join(code, memberId, name) {
    const { error } = await supabase.rpc('join_caisse', { p_code: code, p_member_id: memberId, p_name: name });
    if (error) throw error;
  },
  async approve(memberId, accept) {
    const { error } = await supabase.rpc('approve_member', { p_member_id: memberId, p_accept: accept });
    if (error) throw error;
  },
  async renewCode(caisseId) {
    const { data, error } = await supabase.rpc('renew_code', { p_caisse: caisseId });
    if (error) throw error;
    return data;
  },
  async updateCaisse(id, patch) {
    const { error } = await supabase.from('caisses').update(patch).eq('id', id);
    if (error) throw error;
  },
  async upsert(table, row) {
    const { data, error } = row.id
      ? await supabase.from(table).update(row).eq('id', row.id).select().single()
      : await supabase.from(table).insert(row).select().single();
    if (error) throw error;
    return data;
  },
  async insertMany(table, rows) {
    const { data, error } = await supabase.from(table).insert(rows).select();
    if (error) throw error;
    return data;
  },
  async remove(table, id) {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
  },
  async uploadImage(caisseId, userId, dataUrl) {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${caisseId}/${userId}/${uid()}.jpg`;
    const { error } = await supabase.storage.from('preuves').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw error;
    return path;
  },
  async imageUrl(path) {
    const { data } = await supabase.storage.from('preuves').createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  },
  async updateProfile(userId, patch) {
    const { error } = await supabase.from('profiles').upsert({ id: userId, ...patch });
    if (error) throw error;
  },
  subscribe(caisseId, cb) {
    const ch = supabase.channel('caisse-' + caisseId);
    for (const t of ['deposits', 'members', 'announcements', 'withdrawals', 'caisses']) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, (p) => cb(t, p));
    }
    ch.subscribe();
    return () => supabase.removeChannel(ch);
  },
};

// ======================= Mode test local =======================
const KEY = 'nc:localdb';
const ldb = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { caisses: [], members: [], deposits: [], withdrawals: [], announcements: [], profiles: [], images: {} }; } catch (e) { return { caisses: [], members: [], deposits: [], withdrawals: [], announcements: [], profiles: [], images: {} }; } };
const save = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* */ } };
const now = () => new Date().toISOString();
export const LOCAL_USER = { id: 'local-user', email: 'test@local', user_metadata: { display_name: 'Orly' }, local: true };

const local = {
  async myMemberships(userId) { return ldb().members.filter((m) => m.user_id === userId || m.pending_user_id === userId); },
  async loadCaisse(id) {
    const d = ldb();
    const by = (t) => d[t].filter((r) => r.caisse_id === id).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return { caisse: d.caisses.find((c) => c.id === id), members: by('members').sort((a, b) => a.display_name.localeCompare(b.display_name)), deposits: by('deposits'), withdrawals: by('withdrawals'), announcements: by('announcements'), profiles: d.profiles };
  },
  async createCaisse(name, memberName, startMonth) {
    const d = ldb();
    const c = { id: uid(), name, invite_code: 'A1B2C3', initial_balance: 0, initial_date: now().slice(0, 10), start_month: startMonth, settings: {}, created_by: LOCAL_USER.id, created_at: now() };
    d.caisses.push(c);
    d.members.push({ id: uid(), caisse_id: c.id, display_name: memberName, user_id: LOCAL_USER.id, role: 'tresoriere', category: 'travailleur', opening_due: 0, active: true, created_at: now() });
    save(d);
    return c;
  },
  async caisseExists() { return ldb().caisses.length > 0; },
  async preview() { return []; },
  async join() { throw new Error('Indisponible en mode test'); },
  async approve(id, accept) { const d = ldb(); const m = d.members.find((x) => x.id === id); if (accept) { m.user_id = m.pending_user_id; } m.pending_user_id = null; save(d); },
  async renewCode(id) { const d = ldb(); const c = d.caisses.find((x) => x.id === id); c.invite_code = Math.random().toString(36).slice(2, 8).toUpperCase(); save(d); return c.invite_code; },
  async updateCaisse(id, patch) { const d = ldb(); Object.assign(d.caisses.find((x) => x.id === id), patch); save(d); },
  async upsert(table, row) {
    const d = ldb();
    if (row.id) { const r = d[table].find((x) => x.id === row.id); Object.assign(r, row); if (table === 'deposits' && row.status && row.status !== 'en_attente') { r.validated_by = LOCAL_USER.id; r.validated_at = now(); } save(d); return r; }
    const r = { id: uid(), created_at: now(), ...row };
    if (table === 'deposits') { r.status = 'en_attente'; r.submitted_by = LOCAL_USER.id; r.paid_at = r.paid_at || now().slice(0, 10); }
    if (table === 'announcements') r.author = LOCAL_USER.id;
    if (table === 'withdrawals') r.created_by = LOCAL_USER.id;
    if (table === 'members') { r.opening_due = r.opening_due || 0; r.active = r.active !== false; r.role = r.role || 'membre'; }
    d[table].push(r); save(d); return r;
  },
  async insertMany(table, rows) { const out = []; for (const r of rows) out.push(await local.upsert(table, r)); return out; },
  async remove(table, id) { const d = ldb(); d[table] = d[table].filter((x) => x.id !== id); save(d); },
  async uploadImage(caisseId, userId, dataUrl) { const d = ldb(); const k = uid(); d.images[k] = dataUrl; save(d); return k; },
  async imageUrl(path) { return ldb().images[path] || null; },
  async updateProfile(userId, patch) { const d = ldb(); const p = d.profiles.find((x) => x.id === userId); if (p) Object.assign(p, patch); else d.profiles.push({ id: userId, ...patch }); save(d); },
  subscribe() { return () => {}; },
};

export const api = LOCAL_MODE ? local : remote;
