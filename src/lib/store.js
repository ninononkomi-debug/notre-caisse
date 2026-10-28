import { useSyncExternalStore } from 'react';
import { api } from './api.js';
import { LOCAL_MODE } from '../config.js';

class Store {
  constructor() { this.listeners = new Set(); this.reset(); }
  reset() {
    this.user = null; this.caisse = null; this.me = null; this.pending = null;
    this.members = []; this.deposits = []; this.withdrawals = []; this.announcements = []; this.profiles = {};
    this.ready = false; this.loading = false; this.error = null; this.offline = false; this.version = 0;
    if (this._unsub) { this._unsub(); this._unsub = null; }
  }
  subscribe = (fn) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getVersion = () => this.version;
  emit() { this.version++; this.listeners.forEach((f) => f()); }

  cacheKey() { return `nc:cache:${this.user.id}`; }
  async init(user) {
    this.reset();
    this.user = user;
    try {
      const c = JSON.parse(localStorage.getItem(this.cacheKey()) || 'null');
      if (c) { Object.assign(this, c); this.ready = true; this.emit(); }
    } catch (e) { /* */ }
    await this.refresh();
  }
  get isTreasurer() { return this.me?.role === 'tresoriere'; }
  nameOfUser(uid) {
    const m = this.members.find((x) => x.user_id === uid);
    return m?.display_name || this.profiles[uid]?.display_name || '';
  }
  member(id) { return this.members.find((m) => m.id === id); }

  async refresh() {
    if (!this.user || this.loading) return;
    this.loading = true; this.emit();
    try {
      const mine = await api.myMemberships(this.user.id);
      const active = mine.find((m) => m.user_id === this.user.id && m.active);
      const pend = mine.find((m) => m.pending_user_id === this.user.id);
      if (active) {
        const all = await api.loadCaisse(active.caisse_id);
        Object.assign(this, all);
        this.profiles = Object.fromEntries((all.profiles || []).map((p) => [p.id, p]));
        this.me = all.members.find((m) => m.user_id === this.user.id) || active;
        this.pending = null;
        if (!this._unsub) this._unsub = api.subscribe(active.caisse_id, () => { clearTimeout(this._rt); this._rt = setTimeout(() => this.refresh(), 500); });
      } else {
        this.caisse = null; this.me = null; this.members = []; this.deposits = []; this.withdrawals = []; this.announcements = [];
        this.pending = pend || null;
        if (pend) { try { const all = await api.loadCaisse(pend.caisse_id); this.caisse = all.caisse; } catch (e) { /* */ } }
      }
      this.error = null; this.offline = false;
      try {
        localStorage.setItem(this.cacheKey(), JSON.stringify({ caisse: this.caisse, me: this.me, pending: this.pending, members: this.members, deposits: this.deposits, withdrawals: this.withdrawals, announcements: this.announcements, profiles: this.profiles }));
      } catch (e) { /* */ }
    } catch (e) {
      this.error = e?.message || String(e);
      this.offline = /fetch|network/i.test(this.error);
    } finally {
      this.loading = false; this.ready = true; this.emit();
    }
  }
}

export const store = new Store();
export function useStore() {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store;
}
export { LOCAL_MODE };
