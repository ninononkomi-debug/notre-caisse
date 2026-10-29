import React, { useEffect, useRef, useState } from 'react';
import { Home as HomeIc, Users, Wallet, Menu, Plus } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';
import { supabase, LOCAL_USER } from './lib/api.js';
import { store, useStore } from './lib/store.js';
import { getPrefs } from './lib/security.js';
import { refreshNotifications } from './lib/notify.js';
import { initPush, logoutPush } from './lib/push.js';
import { LOCAL_MODE } from './config.js';
import { ToastProvider } from './components/ui.jsx';
import { Logo } from './components/Logo.jsx';
import Home from './screens/Home.jsx';
import Members from './screens/Members.jsx';
import Caisse from './screens/Caisse.jsx';
import Annonces from './screens/Annonces.jsx';
import DepositForm from './screens/Deposit.jsx';
import PlusScreen from './screens/Admin.jsx';
import Onboarding from './screens/Onboarding.jsx';
import { AuthScreen, NewPasswordScreen } from './screens/Auth.jsx';
import { LockScreen } from './screens/Lock.jsx';

export default function App() {
  const [user, setUser] = useState(LOCAL_MODE ? LOCAL_USER : undefined);
  const [recovery, setRecovery] = useState(false);
  const [locked, setLocked] = useState(false);
  const hiddenAt = useRef(null);

  useEffect(() => {
    if (LOCAL_MODE) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null));
    const { data: sub } = supabase.auth.onAuthStateChange((evt, sess) => {
      if (evt === 'PASSWORD_RECOVERY') setRecovery(true);
      setUser((u) => { const n = sess?.user || null; return u?.id === n?.id ? (u || n) : n; });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    store.init(user);
    if (!LOCAL_MODE) initPush(user.id, () => store.refresh());
    const p = getPrefs(user.id);
    setLocked(!!(p.pinOn && p.pinHash));
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const onHide = () => { hiddenAt.current = Date.now(); };
    const onShow = () => {
      const p = getPrefs(user.id);
      if (p.pinOn && p.pinHash && hiddenAt.current && Date.now() - hiddenAt.current >= p.lockDelay * 1000) setLocked(true);
      hiddenAt.current = null;
      store.refresh();
    };
    const vis = () => (document.hidden ? onHide() : onShow());
    document.addEventListener('visibilitychange', vis);
    let l1, l2;
    CapApp.addListener('appStateChange', ({ isActive }) => (isActive ? onShow() : onHide())).then((h) => { l1 = h; }).catch(() => {});
    CapApp.addListener('backButton', () => {
      if (window.__sheetClose) return window.__sheetClose();
      if (window.__appBack && window.__appBack()) return;
      CapApp.minimizeApp();
    }).then((h) => { l2 = h; }).catch(() => {});
    const iv = setInterval(() => store.refresh(), 90000);
    const unsub = store.subscribe(() => refreshNotifications(store));
    window.addEventListener('online', onShow);
    return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('online', onShow); clearInterval(iv); unsub(); l1?.remove(); l2?.remove(); };
  }, [user?.id]);

  const logout = async () => {
    store.reset(); store.emit();
    logoutPush();
    if (!LOCAL_MODE) await supabase.auth.signOut();
    setLocked(false);
  };

  return (
    <ToastProvider>
      <Root user={user} recovery={recovery} setRecovery={setRecovery} locked={locked} setLocked={setLocked} logout={logout} />
    </ToastProvider>
  );
}

const Splash = () => <div className="lock"><Logo size={88} /><p className="muted">Chargement…</p></div>;

function Root({ user, recovery, setRecovery, locked, setLocked, logout }) {
  const s = useStore();
  if (user === undefined) return <Splash />;
  if (recovery) return <NewPasswordScreen onDone={() => setRecovery(false)} />;
  if (!user) return <AuthScreen />;
  if (locked) return <LockScreen user={user} onUnlock={() => setLocked(false)} onLogout={logout} />;
  if (!s.ready) return <Splash />;
  if (!s.me || !s.caisse) {
    if (s.error && !s.pending) return <div className="lock"><Logo size={72} /><p>{s.offline ? 'Pas de connexion internet.' : s.error}</p><button className="btn primary" onClick={() => s.refresh()}>Réessayer</button></div>;
    return <Onboarding onLogout={logout} />;
  }
  return <Main onLogout={logout} />;
}

function Main({ onLogout }) {
  const [tab, setTab] = useState('home');
  const [sub, setSub] = useState(null);
  const [dep, setDep] = useState(null);
  const ref = useRef();
  const s = useStore();
  const go = (k) => {
    if (['home', 'membres', 'caisse', 'plus'].includes(k)) { setTab(k); setSub(null); } else setSub(k);
    ref.current?.scrollTo(0, 0);
  };
  window.__appBack = () => { if (sub) { setSub(null); return true; } if (tab !== 'home') { setTab('home'); return true; } return false; };
  const openDeposit = (m) => setDep({ m: m || null });
  const pendingCount = s.isTreasurer ? s.deposits.filter((d) => d.status === 'en_attente').length : 0;

  let screen;
  if (sub === 'annonces') screen = <Annonces back={() => setSub(null)} />;
  else if (tab === 'home') screen = <Home go={go} openDeposit={openDeposit} />;
  else if (tab === 'membres') screen = <Members openDeposit={openDeposit} />;
  else if (tab === 'caisse') screen = <Caisse />;
  else screen = <PlusScreen go={go} onLogout={onLogout} />;

  const T = ({ k, icon, label, badge }) => (
    <button className={tab === k && !sub ? 'on' : ''} onClick={() => go(k)} aria-label={label}>
      <span className="tab-ic">{icon}{badge ? <i className="tab-badge">{badge}</i> : null}</span><span>{label}</span>
    </button>
  );
  return (
    <div className="app">
      <main className="content" ref={ref}>{screen}</main>
      <nav className="tabbar">
        <T k="home" icon={<HomeIc size={22} />} label="Accueil" />
        <T k="membres" icon={<Users size={22} />} label="Membres" />
        <button className="add" onClick={() => openDeposit()} aria-label="Déclarer un dépôt"><Plus size={28} /><span>Verser</span></button>
        <T k="caisse" icon={<Wallet size={22} />} label="Caisse" badge={pendingCount} />
        <T k="plus" icon={<Menu size={22} />} label="Plus" />
      </nav>
      {dep && <DepositForm forMember={dep.m} onClose={() => setDep(null)} />}
    </div>
  );
}
