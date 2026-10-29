export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hlgbwayuvoobwsmkwjww.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_dgvl8vEauMH1EiYn23IJHg_f6qPxsM0';
export const DEMO_MODE = import.meta.env.VITE_DEMO === '1';
export const LOCAL_MODE = DEMO_MODE || import.meta.env.VITE_LOCAL === '1' || !SUPABASE_URL || !SUPABASE_ANON_KEY;
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0';
export const GH_REPO = import.meta.env.VITE_GH_REPO || 'ninononkomi-debug/notre-caisse';

// Valeurs de départ (modifiables ensuite par les trésorières dans Réglages)
export const DEFAULTS = {
  caisseName: 'Ma famille à moi',
  startMonth: '2026-12',
  amounts: { travailleur: 2600, sans_emploi: 1600, couple: 5150 },
  dueDay: 10,
  depositNumbers: [{ operator: 'Airtel Money', number: '076 24 69 49', name: 'ONKOMI MPIGA Nelle' }],
  pub: { author: 'Orly MACKITA', phone: '076 37 08 81' },
  members: [
    { display_name: 'Dane', category: 'couple', couple: 'Orly' },
    { display_name: 'Orly', category: 'couple', couple: 'Dane', me: true },
    { display_name: 'Nelle', category: 'travailleur', role: 'tresoriere' },
    { display_name: 'Diana', category: 'travailleur' },
    { display_name: 'Paul', category: 'couple', couple: 'Léa' },
    { display_name: 'Léa', category: 'couple', couple: 'Paul' },
    { display_name: 'Capricia', category: 'travailleur' },
    { display_name: 'Maman Albertine', category: 'travailleur' },
  ],
};
// Identifiant public de l'application OneSignal (notifications push)
export const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || '';
