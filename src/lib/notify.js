import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative, getPrefs } from './security.js';
import { memberStatus, amountFor, settingsOf, campaignMonth, credited, monthsBetween } from './logic.js';
import { money, monthLabel, addMonths, num, today } from './format.js';

let channelDone = false;
let timer = null;
const BASE = { channelId: 'caisse', smallIcon: 'ic_stat_caisse', iconColor: '#009E60' };

export async function requestNotifPermission() {
  if (!isNative) return false;
  try { return (await LocalNotifications.requestPermissions()).display === 'granted'; } catch (e) { return false; }
}

export function refreshNotifications(store) {
  clearTimeout(timer);
  timer = setTimeout(() => run(store).catch((e) => console.warn('notif', e)), 1200);
}

async function ensure() {
  if (!isNative) return false;
  const p = await LocalNotifications.checkPermissions();
  if (p.display !== 'granted') return false;
  if (!channelDone) { try { await LocalNotifications.createChannel({ id: 'caisse', name: 'Rappels Notre Caisse', importance: 4 }); } catch (e) { /* */ } channelDone = true; }
  return true;
}

const seenKey = (u) => `nc:seen:${u}`;
function seen(u) { try { return JSON.parse(localStorage.getItem(seenKey(u)) || '{}'); } catch (e) { return {}; } }

async function run(s) {
  if (!s.user || !s.caisse || !s.me) return;
  if (!(await ensure())) return;
  const prefs = getPrefs(s.user.id);
  const set = settingsOf(s.caisse);
  const dep = set.depositNumbers[0];

  // 1. Rappels programmés (ids 100+) : dernier jour du mois précédent 18 h, le 5 et le 9 à 10 h
  const pending = await LocalNotifications.getPending();
  const old = pending.notifications.filter((n) => n.id >= 100 && n.id < 1000);
  if (old.length) await LocalNotifications.cancel({ notifications: old.map((n) => ({ id: n.id })) });
  const list = [];
  if (prefs.notif.rappels) {
    const me = s.me;
    const couple = me.couple_with ? s.member(me.couple_with) : null;
    const amt = amountFor(me, s.caisse);
    const start = me.start_month || s.caisse.start_month;
    const paid = credited(me, s.deposits) + credited(me, s.deposits, 'en_attente');
    const now = new Date();
    let id = 100;
    for (let k = 0; k < 3; k++) {
      const M = addMonths(campaignMonth(), k);
      if (M < start) continue;
      const covered = paid >= num(me.opening_due) + amt * monthsBetween(start, M);
      if (covered) continue;
      const [y, m] = M.split('-').map(Number);
      const due = couple ? amt + amountFor(couple, s.caisse) : amt;
      const mois = monthLabel(M).split(' ')[0];
      const where = dep ? ` sur le ${dep.number} (${dep.operator})` : '';
      const dates = [
        [new Date(y, m - 1, 0, 18, 0), `Cotisation de ${mois} 💚`, `C'est le moment de verser ${money(due)}${where}. Date limite : le ${set.dueDay}.`],
        [new Date(y, m - 1, 5, 10, 0), `Rappel : cotisation de ${mois}`, `Pensez à verser ${money(due)} avant le ${set.dueDay}${where}.`],
        [new Date(y, m - 1, 9, 10, 0), `Attention, demain c'est le ${set.dueDay} ⏰`, `Dernier rappel pour la cotisation de ${mois} : ${money(due)}. Déjà payé ? Envoyez votre capture dans l'appli.`],
      ];
      for (const [at, title, body] of dates) if (at > now) list.push({ id: id++, title, body, schedule: { at, allowWhileIdle: true }, ...BASE });
    }
  }

  // 2. Événements vus à l'ouverture (dépôt validé, à valider, annonce)
  const sn = seen(s.user.id);
  const first = !sn.init;
  const imm = [];
  let nid = 1000 + Math.floor(Math.random() * 1000);
  for (const d of s.deposits) {
    const key = `${d.id}:${d.status}`;
    if (sn[key]) continue;
    sn[key] = 1;
    if (first || !prefs.notif.versements) continue;
    if (d.submitted_by === s.user.id && d.status === 'valide') imm.push(['Dépôt validé ✓', `Votre dépôt de ${money(d.amount)} a été validé. Merci !`]);
    if (d.submitted_by === s.user.id && d.status === 'rejete') imm.push(['Dépôt refusé', `Votre dépôt de ${money(d.amount)} a été refusé${d.reject_reason ? ` : ${d.reject_reason}` : ''}.`]);
    if (s.isTreasurer && d.status === 'en_attente' && d.submitted_by !== s.user.id) imm.push(['Nouveau dépôt à valider', `${s.member(d.member_id)?.display_name || 'Un membre'} a déclaré ${money(d.amount)}.`]);
  }
  for (const a of s.announcements) {
    if (sn['a:' + a.id]) continue;
    sn['a:' + a.id] = 1;
    if (!first && prefs.notif.annonces && a.author !== s.user.id) imm.push([`Annonce : ${a.title}`, a.body || 'Nouvelle annonce de la famille']);
  }
  sn.init = 1;
  try { localStorage.setItem(seenKey(s.user.id), JSON.stringify(sn)); } catch (e) { /* */ }
  for (const [title, body] of imm.slice(0, 5)) list.push({ id: nid++, title, body, schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true }, ...BASE });

  if (list.length) await LocalNotifications.schedule({ notifications: list });
}
export { today, memberStatus };
