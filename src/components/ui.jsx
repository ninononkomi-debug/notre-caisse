import React, { useEffect, useRef, useState, createContext, useContext } from 'react';
import { X, ChevronLeft, Camera, Image as ImageIcon, Trash2, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { money, num } from '../lib/format.js';
import { api } from '../lib/api.js';

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const t = useRef();
  const show = (m, kind = 'ok') => { setMsg({ m, kind }); clearTimeout(t.current); t.current = setTimeout(() => setMsg(null), 2800); };
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className={`toast toast-${msg.kind}`} role="status">{msg.m}</div>}
    </ToastCtx.Provider>
  );
}

export function Sheet({ title, onClose, children, footer }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    const prev = window.__sheetClose;
    window.__sheetClose = onClose;
    return () => { window.removeEventListener('keydown', h); window.__sheetClose = prev || null; };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer"><X size={22} /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ text, onYes, onNo, yes = 'Confirmer', danger = true, children }) {
  return (
    <div className="sheet-backdrop center" onClick={onNo}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <p>{text}</p>
        {children}
        <div className="row gap end">
          <button className="btn ghost" onClick={onNo}>Annuler</button>
          <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onYes}>{yes}</button>
        </div>
      </div>
    </div>
  );
}

export const Money = ({ v, className = '' }) => <span className={`money ${className}`}>{money(v)}</span>;

export function Field({ label, children, help }) {
  return (
    <label className="field">
      <span className="field-l">{label}</span>
      {children}
      {help && <small className="help">{help}</small>}
    </label>
  );
}

export function MoneyInput({ value, onChange, autoFocus }) {
  const fmt = (v) => (v === '' || v === undefined || v === null ? '' : new Intl.NumberFormat('fr-FR').format(num(v)).replace(/ | /g, ' '));
  return (
    <div className="money-input">
      <input inputMode="numeric" autoFocus={autoFocus} placeholder="0" value={fmt(value)}
        onChange={(e) => { const raw = e.target.value.replace(/[^\d]/g, ''); onChange(raw === '' ? '' : Number(raw)); }} />
      <span>FCFA</span>
    </div>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented" role="tablist">
      {options.map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

const AV_COLORS = ['#009E60', '#3A75C4', '#C99A00', '#0F766E', '#7C3AED', '#DB2777', '#EA580C', '#1D4ED8'];
export function Avatar({ name = '?', size = 42 }) {
  const i = [...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AV_COLORS.length;
  const ini = name.split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  return <span className="avatar" style={{ width: size, height: size, background: AV_COLORS[i], fontSize: size * 0.38 }} aria-hidden="true">{ini}</span>;
}

export function StatusChip({ s }) {
  const map = { ajour: ['ok', <CheckCircle2 size={14} key="i" />], apayer: ['warn', <Clock size={14} key="i" />], retard: ['bad', <AlertTriangle size={14} key="i" />] };
  const [cls, icon] = map[s.code] || map.apayer;
  return <span className={`chip-st ${cls}`}>{icon}{s.label}</span>;
}

export function ScreenHead({ title, onBack, right, sub }) {
  return (
    <header className="screen-head">
      {onBack && <button className="icon-btn" onClick={onBack} aria-label="Retour"><ChevronLeft size={24} /></button>}
      <div className="grow"><h1>{title}</h1>{sub && <p className="sub">{sub}</p>}</div>
      {right}
    </header>
  );
}

export const Empty = ({ art, title, text, action }) => (
  <div className="empty">
    {art}
    <h3>{title}</h3>
    {text && <p>{text}</p>}
    {action}
  </div>
);

export function RemoteImage({ path, alt, className }) {
  const [url, setUrl] = useState(null);
  const [big, setBig] = useState(false);
  useEffect(() => { let ok = true; if (path) api.imageUrl(path).then((u) => ok && setUrl(u)); return () => { ok = false; }; }, [path]);
  if (!path) return null;
  if (!url) return <div className={`img-ph ${className || ''}`}>Chargement de l'image…</div>;
  return (
    <>
      <img src={url} alt={alt} className={className} onClick={() => setBig(true)} />
      {big && <div className="lightbox" onClick={() => setBig(false)}><img src={url} alt={alt} /><button className="icon-btn" aria-label="Fermer"><X size={26} /></button></div>}
    </>
  );
}

export function PhotoPicker({ value, onChange, label = 'Capture d’écran du dépôt', required }) {
  const cam = useRef();
  const gal = useRef();
  const pick = async (e) => { const f = e.target.files?.[0]; if (f) onChange(await compressImage(f)); e.target.value = ''; };
  return (
    <Field label={`${label}${required ? ' (obligatoire)' : ''}`}>
      {value ? (
        <div className="photo">
          <img src={value} alt="Aperçu" />
          <button type="button" className="icon-btn danger" onClick={() => onChange(null)} aria-label="Retirer"><Trash2 size={18} /></button>
        </div>
      ) : (
        <div className="row gap">
          <button type="button" className="btn ghost grow" onClick={() => gal.current.click()}><ImageIcon size={18} /> Galerie</button>
          <button type="button" className="btn ghost grow" onClick={() => cam.current.click()}><Camera size={18} /> Photo</button>
        </div>
      )}
      <input ref={gal} type="file" accept="image/*" hidden onChange={pick} />
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
    </Field>
  );
}

export function compressImage(file, max = 1400, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const fr = new FileReader();
    fr.onload = () => { img.src = fr.result; };
    fr.onerror = reject;
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    fr.readAsDataURL(file);
  });
}

export const Stripe = () => <div className="gabon-stripe" aria-hidden="true"><i /><i /><i /></div>;
