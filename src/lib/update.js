import { GH_REPO, APP_VERSION, DEMO_MODE } from '../config.js';
import { isNative } from './security.js';

const cmp = (a, b) => {
  const x = String(a).replace(/^v/, '').split('.').map(Number);
  const y = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
};

export const apkUrl = () => `https://github.com/${GH_REPO}/releases/latest/download/${DEMO_MODE ? 'Caisse-Demo' : 'Notre-Caisse'}.apk`;

export async function checkUpdate(force = false) {
  if (!GH_REPO || !isNative) return null;
  try {
    const last = Number(localStorage.getItem('nc:updcheck') || 0);
    if (!force && Date.now() - last < 6 * 3600e3) {
      const cached = localStorage.getItem('nc:updver') || '';
      return cached && cmp(cached, APP_VERSION) > 0 ? cached : null;
    }
    const r = await fetch(`https://api.github.com/repos/${GH_REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return null;
    const j = await r.json();
    localStorage.setItem('nc:updcheck', String(Date.now()));
    const v = cmp(j.tag_name, APP_VERSION) > 0 ? j.tag_name : null;
    localStorage.setItem('nc:updver', v || '');
    return v;
  } catch (e) {
    return null;
  }
}
