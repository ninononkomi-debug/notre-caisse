// Notifications push (OneSignal) : reçues même application fermée
import { isNative } from './security.js';
import { ONESIGNAL_APP_ID } from '../config.js';

let os = null;
let started = false;

async function plugin() {
  if (!isNative || !ONESIGNAL_APP_ID) return null;
  if (!os) os = (await import('onesignal-cordova-plugin')).default;
  return os;
}

export async function initPush(userId, onOpen) {
  try {
    const OS = await plugin();
    if (!OS) return;
    if (!started) {
      OS.initialize(ONESIGNAL_APP_ID);
      OS.Notifications.addEventListener('click', () => onOpen && onOpen());
      OS.Notifications.addEventListener('foregroundWillDisplay', () => onOpen && onOpen());
      started = true;
    }
    OS.login(userId);
    await OS.Notifications.requestPermission(true);
  } catch (e) {
    console.warn('push', e);
  }
}

export async function logoutPush() {
  try { const OS = await plugin(); if (OS && started) OS.logout(); } catch (e) { /* */ }
}
