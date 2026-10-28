import { Capacitor } from '@capacitor/core';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';

export const isNative = Capacitor.isNativePlatform();

const DEFAULT_PREFS = {
  pinHash: null, pinSalt: null, bio: false, lockDelay: 60, pinOn: false, theme: 'auto', failed: 0,
  notif: { rappels: true, versements: true, annonces: true },
};

const key = (u) => `nc:prefs:${u}`;
export function getPrefs(userId) {
  try {
    const p = JSON.parse(localStorage.getItem(key(userId)) || '{}');
    return { ...DEFAULT_PREFS, ...p, notif: { ...DEFAULT_PREFS.notif, ...(p.notif || {}) } };
  } catch (e) {
    return { ...DEFAULT_PREFS };
  }
}
export function setPrefs(userId, patch) {
  const p = { ...getPrefs(userId), ...patch };
  try { localStorage.setItem(key(userId), JSON.stringify(p)); } catch (e) { /* */ }
  window.dispatchEvent(new Event('fp-prefs'));
  return p;
}

const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export async function hashPin(pin, saltHex) {
  const salt = saltHex || toHex(crypto.getRandomValues(new Uint8Array(16)));
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 120000 }, baseKey, 256);
  return { hash: toHex(bits), salt };
}
export async function setPin(userId, pin) {
  const { hash, salt } = await hashPin(pin);
  setPrefs(userId, { pinHash: hash, pinSalt: salt, failed: 0 });
}
export async function verifyPin(userId, pin) {
  const p = getPrefs(userId);
  if (!p.pinHash) return true;
  const { hash } = await hashPin(pin, p.pinSalt);
  const ok = hash === p.pinHash;
  setPrefs(userId, { failed: ok ? 0 : (p.failed || 0) + 1 });
  return ok;
}

export async function biometryAvailable() {
  if (!isNative) return false;
  try {
    const r = await BiometricAuth.checkBiometry();
    return !!r.isAvailable;
  } catch (e) {
    return false;
  }
}
export async function biometryAuth() {
  try {
    await BiometricAuth.authenticate({
      reason: 'Déverrouiller Notre Caisse',
      cancelTitle: 'Utiliser le code',
      allowDeviceCredential: false,
      androidTitle: 'Notre Caisse',
      androidSubtitle: 'Déverrouillez avec votre empreinte',
      androidConfirmationRequired: false,
    });
    return true;
  } catch (e) {
    return false;
  }
}
