import React from 'react';

interface ChessSVGProps {
  type: string; // 'p' | 'r' | 'n' | 'b' | 'q' | 'k'
  color: 'w' | 'b';
  className?: string;
}

export const ChessSVG: React.FC<ChessSVGProps> = ({ type, color, className = 'w-full h-full' }) => {
  const isWhite = color === 'w';

  // Crisp high-fidelity SVG paths for Staunton-style pieces
  switch (type.toLowerCase()) {
    case 'p':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <path
            d="M 22.5,9 A 4,4 0 1 1 22.5,17 A 4,4 0 1 1 22.5,9 Z M 22.5,17 C 27,21 27,28 22.5,31 C 18,28 18,21 22.5,17 Z M 16,35 L 29,35 L 29,38 L 16,38 Z"
            fill={isWhite ? '#ffffff' : '#2b2b2b'}
            stroke={isWhite ? '#2c2c2c' : '#141414'}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'r':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <path
            d="M 9,39 L 36,39 L 36,36 L 9,36 Z M 12,36 L 12,32 L 33,32 L 33,36 Z M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14 L 31,17 L 14,17 Z M 14,17 L 14,29 L 31,29 L 31,17 Z M 12,32 L 33,32"
            fill={isWhite ? '#ffffff' : '#2b2b2b'}
            stroke={isWhite ? '#2c2c2c' : '#141414'}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'n':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <path
            d="M 22,10 C 32.5,11 38.5,18 31,39 L 14,39 C 14,39 12,30 14,26 C 12,24 8,22 9,16 C 10,10 16.5,8 22,10 Z M 14,26 C 18,27 23,24 23,24"
            fill={isWhite ? '#ffffff' : '#2b2b2b'}
            stroke={isWhite ? '#2c2c2c' : '#141414'}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="15" cy="13" r="1.5" fill={isWhite ? '#2c2c2c' : '#ffffff'} />
        </svg>
      );
    case 'b':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={isWhite ? '#ffffff' : '#2b2b2b'} stroke={isWhite ? '#2c2c2c' : '#141414'} strokeWidth="1.5" strokeLinejoin="round">
            <circle cx="22.5" cy="10" r="2.5" fill={isWhite ? '#ffffff' : '#2b2b2b'} />
            <path d="M 9,36 L 36,36 L 36,39 L 9,39 Z M 14,32 L 31,32 L 31,36 L 14,36 Z M 16,25 C 13,20 16,14 22.5,14 C 29,14 32,20 29,25 C 27,28 26,32 26,32 L 19,32 C 19,32 18,28 16,25 Z" />
            <path d="M 18,17 A 1.5,1.5 0 0 1 27,17" />
          </g>
        </svg>
      );
    case 'q':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={isWhite ? '#ffffff' : '#2b2b2b'} stroke={isWhite ? '#2c2c2c' : '#141414'} strokeWidth="1.5" strokeLinejoin="round">
            <circle cx="6" cy="12" r="2" />
            <circle cx="14" cy="9" r="2" />
            <circle cx="22.5" cy="8" r="2" />
            <circle cx="31" cy="9" r="2" />
            <circle cx="39" cy="12" r="2" />
            <path d="M 9,26 L 36,26 L 38,14 L 31,21 L 22.5,11 L 14,21 L 7,14 Z M 9,26 L 9,32 L 36,32 L 36,26 Z M 9,36 L 36,36 L 36,39 L 9,39 Z" />
          </g>
        </svg>
      );
    case 'k':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={isWhite ? '#ffffff' : '#2b2b2b'} stroke={isWhite ? '#2c2c2c' : '#141414'} strokeWidth="1.5" strokeLinejoin="round">
            <path d="M 22.5,6 L 22.5,12 M 19.5,9 L 25.5,9" />
            <path d="M 11.5,37 L 33.5,37 L 33.5,34 L 11.5,34 Z M 14.5,34 L 14.5,30 L 30.5,30 L 30.5,34 Z M 13,27 C 11,20 16,14 22.5,14 C 29,14 34,20 32,27 C 30,30 29,30 29,30 L 16,30 C 16,30 15,30 13,27 Z" />
            <circle cx="22.5" cy="20" r="3" fill={isWhite ? '#2c2c2c' : '#ffffff'} />
          </g>
        </svg>
      );
    default:
      return null;
  }
};
