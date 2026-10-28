import React from 'react';

// Mains solidaires qui portent un cœur — bordeaux et or
const HEART = 'M48 58 C 30 46, 30 28, 41 28 C 45 28, 47 31, 48 33 C 49 31, 51 28, 55 28 C 66 28, 66 46, 48 58 Z';
const HAND = 'M10 60 C 14 54, 20 52, 26 54 L 40 59 C 44 60.5, 45 64.5, 41.5 66 L 31 64 C 33 67, 38 70, 46 71 L 46 80 C 32 80, 22 75, 16 70 L 10 70 Z';

function Glyph({ heart = '#FFF4E2', hands = '#E0A526' }) {
  return (
    <>
      <path d={HEART} fill={heart} />
      <g fill={hands}>
        <path d={HAND} />
        <g transform="translate(96 0) scale(-1 1)"><path d={HAND} /></g>
      </g>
    </>
  );
}

export function Logo({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" role="img" aria-label="Notre Caisse">
      <rect width="96" height="96" rx="26" fill="#7A1E3A" />
      <Glyph />
    </svg>
  );
}

// Grande illustration : mains solidaires, cœur et pièces
export function FamilyArt({ width = 240 }) {
  return (
    <svg width={width} viewBox="0 0 240 170" role="img" aria-label="Des mains solidaires qui portent un cœur">
      <circle cx="120" cy="88" r="78" fill="#F6E7D3" />
      <circle cx="120" cy="88" r="58" fill="#EFD5B5" opacity="0.7" />
      <g transform="translate(48 18) scale(1.5)">
        <Glyph heart="#7A1E3A" hands="#E0A526" />
      </g>
      <g fill="#E0A526" stroke="#B9831A" strokeWidth="2">
        <circle cx="40" cy="44" r="10" />
        <circle cx="205" cy="58" r="8" />
        <circle cx="196" cy="128" r="6" />
      </g>
      <g fill="#7A1E3A" opacity="0.85">
        <circle cx="28" cy="118" r="5" />
        <circle cx="214" cy="96" r="4" />
      </g>
    </svg>
  );
}
