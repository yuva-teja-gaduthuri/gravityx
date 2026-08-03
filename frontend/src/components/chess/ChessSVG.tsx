import React from 'react';

interface ChessSVGProps {
  type: string; // 'p' | 'r' | 'n' | 'b' | 'q' | 'k'
  color: 'w' | 'b';
  className?: string;
  pieceSet?: 'staunton' | 'wizard';
}

export const ChessSVG: React.FC<ChessSVGProps> = ({ type, color, className = 'w-full h-full', pieceSet = 'staunton' }) => {
  const isWhite = color === 'w';

  // Standard Staunton Colors
  const fillColor = isWhite ? '#ffffff' : '#000000';
  const strokeColor = isWhite ? '#111111' : '#ffffff';
  const strokeWidth = '1.8';

  // Harry Potter Wizard Chess Stone Colors
  const wizardFill = isWhite ? '#e2e8f0' : '#1e1b2e';
  const wizardStroke = isWhite ? '#334155' : '#c084fc';
  const wizardGlow = isWhite
    ? 'drop-shadow(0px 0px 4px rgba(255,255,255,0.9)) drop-shadow(0px 2px 5px rgba(0,0,0,0.7))'
    : 'drop-shadow(0px 0px 6px rgba(192,132,252,0.8)) drop-shadow(0px 2px 6px rgba(0,0,0,0.9))';

  const filterStyle = pieceSet === 'wizard' 
    ? wizardGlow
    : isWhite
    ? 'drop-shadow(0px 2px 3px rgba(0,0,0,0.6))'
    : 'drop-shadow(0px 0px 3px rgba(255,255,255,0.7)) drop-shadow(0px 2px 4px rgba(0,0,0,0.8))';

  // HARRY POTTER WIZARD CHESS MOVIE STYLE PIECES
  if (pieceSet === 'wizard') {
    switch (type.toLowerCase()) {
      case 'p': // Enchanted Stone Dagger Soldier
        return (
          <svg viewBox="0 0 45 45" className={className} style={{ filter: filterStyle }}>
            <g fill={wizardFill} stroke={wizardStroke} strokeWidth="1.5" strokeLinejoin="round">
              {/* Helmet & Plume */}
              <path d="M 22.5,7 C 20,7 18,9 18,12 L 27,12 C 27,9 25,7 22.5,7 Z" />
              <circle cx="22.5" cy="5" r="1.5" fill={wizardStroke} />
              {/* Armored Chestplate */}
              <path d="M 17,13 L 28,13 L 30,22 L 15,22 Z" />
              {/* Crossed Daggers */}
              <path d="M 14,15 L 31,24 M 31,15 L 14,24" stroke={wizardStroke} strokeWidth="1.8" />
              {/* Stone Pedestal */}
              <path d="M 15,23 L 30,23 L 32,34 L 13,34 Z" />
              <path d="M 10,35 L 35,35 L 37,39 L 8,39 Z" />
            </g>
          </svg>
        );
      case 'r': // Sentinel Stone Fortress Tower
        return (
          <svg viewBox="0 0 45 45" className={className} style={{ filter: filterStyle }}>
            <g fill={wizardFill} stroke={wizardStroke} strokeWidth="1.5" strokeLinejoin="round">
              {/* Gothic Battlements */}
              <path d="M 10,7 L 14,7 L 14,10 L 19,10 L 19,7 L 26,7 L 26,10 L 31,10 L 31,7 L 35,7 L 35,13 L 10,13 Z" />
              {/* Tower Body with Arrow Slits */}
              <path d="M 12,13 L 33,13 L 31,32 L 14,32 Z" />
              <line x1="22.5" y1="16" x2="22.5" y2="22" stroke={wizardStroke} strokeWidth="2" />
              <line x1="17" y1="24" x2="17" y2="28" stroke={wizardStroke} strokeWidth="1.5" />
              <line x1="28" y1="24" x2="28" y2="28" stroke={wizardStroke} strokeWidth="1.5" />
              {/* Iron Shield Emblem */}
              <path d="M 22.5,20 L 26,23 L 26,27 L 22.5,29 L 19,27 L 19,23 Z" fill={wizardStroke} />
              {/* Heavy Stone Base */}
              <path d="M 11,33 L 34,33 L 36,39 L 9,39 Z" />
            </g>
          </svg>
        );
      case 'n': // Armored Warhorse Cavalry
        return (
          <svg viewBox="0 0 45 45" className={className} style={{ filter: filterStyle }}>
            <g fill={wizardFill} stroke={wizardStroke} strokeWidth="1.5" strokeLinejoin="round">
              {/* Battle Horse Head & Armor Visor */}
              <path d="M 22,6 C 33,7 39,15 32,34 L 14,34 C 13,29 11,21 14,17 C 12,15 8,14 9,9 C 10,6 16,5 22,6 Z" />
              {/* Armored Plate Mane */}
              <path d="M 26,8 L 32,13 L 30,19 M 28,14 L 34,19" stroke={wizardStroke} strokeWidth="1.8" />
              {/* Jousting Spear */}
              <line x1="7" y1="32" x2="38" y2="10" stroke={wizardStroke} strokeWidth="2" />
              <polygon points="38,10 42,7 39,13" fill={wizardStroke} />
              {/* Stone Base */}
              <path d="M 10,35 L 35,35 L 37,39 L 8,39 Z" />
            </g>
          </svg>
        );
      case 'b': // Hooded Archmage Sorcerer
        return (
          <svg viewBox="0 0 45 45" className={className} style={{ filter: filterStyle }}>
            <g fill={wizardFill} stroke={wizardStroke} strokeWidth="1.5" strokeLinejoin="round">
              {/* Hooded Wizard Cowl */}
              <path d="M 22.5,5 C 16,5 15,11 15,14 L 30,14 C 30,11 29,5 22.5,5 Z" />
              {/* Glowing Rune Orb */}
              <circle cx="22.5" cy="10" r="2.5" fill={wizardStroke} />
              {/* Robed Body & Battle Axe Staff */}
              <path d="M 15,14 L 30,14 C 32,22 30,33 27,34 L 18,34 C 15,33 13,22 15,14 Z" />
              <line x1="31" y1="8" x2="31" y2="36" stroke={wizardStroke} strokeWidth="2" />
              <path d="M 31,10 C 37,8 37,16 31,18 Z" fill={wizardStroke} />
              {/* Plinth */}
              <path d="M 11,35 L 34,35 L 36,39 L 9,39 Z" />
            </g>
          </svg>
        );
      case 'q': // Wizard Sovereign Queen
        return (
          <svg viewBox="0 0 45 45" className={className} style={{ filter: filterStyle }}>
            <g fill={wizardFill} stroke={wizardStroke} strokeWidth="1.5" strokeLinejoin="round">
              {/* Gothic Sorceress Crown Spikes */}
              <path d="M 9,13 L 13,6 L 18,11 L 22.5,4 L 27,11 L 32,6 L 36,13 Z" />
              <circle cx="22.5" cy="4" r="1.5" fill={wizardStroke} />
              <circle cx="13" cy="6" r="1.5" fill={wizardStroke} />
              <circle cx="32" cy="6" r="1.5" fill={wizardStroke} />
              {/* Flowing Stone Robe Body */}
              <path d="M 12,14 L 33,14 L 35,28 L 10,28 Z" />
              {/* Levitating Orb Sceptre */}
              <line x1="22.5" y1="16" x2="22.5" y2="34" stroke={wizardStroke} strokeWidth="2" />
              <circle cx="22.5" cy="20" r="3" fill={wizardStroke} />
              {/* Heavy Royal Plinth */}
              <path d="M 10,29 L 35,29 L 35,34 L 10,34 Z" />
              <path d="M 8,35 L 37,35 L 39,39 L 6,39 Z" />
            </g>
          </svg>
        );
      case 'k': // Ancient Greatsword King
        return (
          <svg viewBox="0 0 45 45" className={className} style={{ filter: filterStyle }}>
            <g fill={wizardFill} stroke={wizardStroke} strokeWidth="1.5" strokeLinejoin="round">
              {/* High Gothic King Crown & Cross */}
              <path d="M 22.5,3 L 22.5,8 M 20,5.5 L 25,5.5" stroke={wizardStroke} strokeWidth="2" />
              <path d="M 13,12 L 18,8 L 22.5,12 L 27,8 L 32,12 L 34,16 L 11,16 Z" />
              {/* Armored Shoulders & Greatsword */}
              <path d="M 11,16 L 34,16 L 36,33 L 9,33 Z" />
              {/* Central Greatsword Blade */}
              <line x1="22.5" y1="12" x2="22.5" y2="35" stroke={wizardStroke} strokeWidth="2.5" />
              <path d="M 18,20 L 27,20" stroke={wizardStroke} strokeWidth="2" />
              {/* Massive Stone Pedestal */}
              <path d="M 10,34 L 35,34 L 35,36 L 10,36 Z" />
              <path d="M 7,36 L 38,36 L 40,40 L 5,40 Z" />
            </g>
          </svg>
        );
      default:
        return null;
    }
  }

  // Crisp Staunton-style pieces with high contrast outlines
  switch (type.toLowerCase()) {
    case 'p':
      return (
        <svg viewBox="0 0 45 45" className={className} style={{ filter: filterStyle }}>
          <path
            d="M 22.5,9 A 4,4 0 1 1 22.5,17 A 4,4 0 1 1 22.5,9 Z M 22.5,17 C 27,21 27,28 22.5,31 C 18,28 18,21 22.5,17 Z M 16,35 L 29,35 L 29,38 L 16,38 Z"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'r':
      return (
        <svg viewBox="0 0 45 45" className={className} style={{ filter: filterStyle }}>
          <path
            d="M 9,39 L 36,39 L 36,36 L 9,36 Z M 12,36 L 12,32 L 33,32 L 33,36 Z M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14 L 31,17 L 14,17 Z M 14,17 L 14,29 L 31,29 L 31,17 Z M 12,32 L 33,32"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'n':
      return (
        <svg viewBox="0 0 45 45" className={className} style={{ filter: filterStyle }}>
          <path
            d="M 22,10 C 32.5,11 38.5,18 31,39 L 14,39 C 14,39 12,30 14,26 C 12,24 8,22 9,16 C 10,10 16.5,8 22,10 Z M 14,26 C 18,27 23,24 23,24"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
          <circle cx="15" cy="13" r="1.5" fill={isWhite ? '#111111' : '#ffffff'} />
        </svg>
      );
    case 'b':
      return (
        <svg viewBox="0 0 45 45" className={className} style={{ filter: filterStyle }}>
          <g fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round">
            <circle cx="22.5" cy="10" r="2.5" fill={fillColor} />
            <path d="M 9,36 L 36,36 L 36,39 L 9,39 Z M 14,32 L 31,32 L 31,36 L 14,36 Z M 16,25 C 13,20 16,14 22.5,14 C 29,14 32,20 29,25 C 27,28 26,32 26,32 L 19,32 C 19,32 18,28 16,25 Z" />
            <path d="M 18,17 A 1.5,1.5 0 0 1 27,17" />
          </g>
        </svg>
      );
    case 'q':
      return (
        <svg viewBox="0 0 45 45" className={className} style={{ filter: filterStyle }}>
          <g fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round">
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
        <svg viewBox="0 0 45 45" className={className} style={{ filter: filterStyle }}>
          <g fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round">
            <path d="M 22.5,6 L 22.5,12 M 19.5,9 L 25.5,9" />
            <path d="M 11.5,37 L 33.5,37 L 33.5,34 L 11.5,34 Z M 14.5,34 L 14.5,30 L 30.5,30 L 30.5,34 Z M 13,27 C 11,20 16,14 22.5,14 C 29,14 34,20 32,27 C 30,30 29,30 29,30 L 16,30 C 16,30 15,30 13,27 Z" />
            <circle cx="22.5" cy="20" r="3" fill={isWhite ? '#111111' : '#ffffff'} />
          </g>
        </svg>
      );
    default:
      return null;
  }
};
