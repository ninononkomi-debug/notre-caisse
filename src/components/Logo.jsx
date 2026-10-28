import React from 'react';

// Logo : une caisse (tirelire) aux couleurs du Gabon, avec une pièce
export function Logo({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" role="img" aria-label="Notre Caisse">
      <rect width="96" height="96" rx="26" fill="#009E60" />
      <rect y="62" width="96" height="11" fill="#FCD116" />
      <path d="M0 73h96v-0 0 0v9a14 14 0 0 1-14 14H14A14 14 0 0 1 0 82z" fill="#3A75C4" />
      <ellipse cx="48" cy="44" rx="25" ry="19" fill="#FFFFFF" />
      <rect x="40" y="27" width="16" height="4" rx="2" fill="#009E60" />
      <circle cx="61" cy="40" r="2.6" fill="#009E60" />
      <path d="M26 46c-4 0-6-3-6-6" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" fill="none" />
      <circle cx="48" cy="15" r="8" fill="#FCD116" stroke="#FFFFFF" strokeWidth="2.5" />
    </svg>
  );
}

// Illustration : famille réunie autour de la caisse
export function FamilyArt({ width = 260 }) {
  const people = [
    [40, '#3A75C4'], [80, '#FCD116'], [180, '#FCD116'], [220, '#3A75C4'],
  ];
  return (
    <svg width={width} viewBox="0 0 260 150" role="img" aria-label="La famille réunie autour de la caisse">
      <ellipse cx="130" cy="138" rx="120" ry="10" fill="currentColor" opacity="0.08" />
      {people.map(([x, c], i) => (
        <g key={i}>
          <circle cx={x} cy={i % 3 === 0 ? 52 : 44} r="15" fill={c} />
          <path d={`M${x - 20} 135v-38a20 20 0 0 1 40 0v38z`} transform={`translate(0 ${i % 3 === 0 ? 8 : 0})`} fill={c} />
        </g>
      ))}
      <path d="M58 100 Q 130 130 202 100" stroke="#009E60" strokeWidth="6" strokeLinecap="round" fill="none" />
      <ellipse cx="130" cy="104" rx="34" ry="26" fill="#009E60" />
      <rect x="120" y="80" width="20" height="5" rx="2.5" fill="#FFFFFF" />
      <circle cx="148" cy="98" r="3" fill="#FFFFFF" />
      <circle cx="130" cy="58" r="11" fill="#FCD116" stroke="#009E60" strokeWidth="3" />
      <text x="130" y="62.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="#009E60">F</text>
    </svg>
  );
}
