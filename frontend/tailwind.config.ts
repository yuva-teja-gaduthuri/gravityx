import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-outfit)', 'sans-serif'],
        display: ['var(--font-space-grotesk)', 'var(--font-outfit)', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
      colors: {
        // Core palette
        primary: {
          DEFAULT: '#6C63FF',
          light: '#8B85FF',
          dark: '#4A43CC',
          50: 'rgba(108,99,255,0.05)',
          100: 'rgba(108,99,255,0.1)',
          200: 'rgba(108,99,255,0.2)',
          400: 'rgba(108,99,255,0.4)',
          600: 'rgba(108,99,255,0.6)',
        },
        // Deep space backgrounds
        deepspace: {
          950: '#010812',
          900: '#020B18',
          800: '#060F22',
          700: '#0A1628',
          600: '#0F1F3D',
          500: '#152848',
        },
        // Surface layers
        surface: {
          DEFAULT: '#0A1628',
          elevated: '#111F38',
          high: '#192A4A',
          overlay: 'rgba(10,22,40,0.85)',
        },
        // Cyber colors
        cyberblue: '#00F5FF',
        cyberpink: '#FF5EDF',
        cybergold: '#FFD700',
        cybersuccess: '#00D084',
        cybererror: '#FF4444',
        cyberlime: '#39FF14',
        // Legacy compat
        darkbg: '#020B18',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'space-nebula': 'radial-gradient(circle at center, rgba(108,99,255,0.15) 0%, rgba(2,11,24,1) 80%)',
        'aurora': 'linear-gradient(135deg, rgba(108,99,255,0.15) 0%, rgba(0,245,255,0.1) 50%, rgba(255,94,223,0.1) 100%)',
        'card-surface': 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
        'primary-gradient': 'linear-gradient(135deg, #6C63FF 0%, #00F5FF 100%)',
        'pink-gradient': 'linear-gradient(135deg, #FF5EDF 0%, #6C63FF 100%)',
        'gold-gradient': 'linear-gradient(135deg, #FFD700 0%, #FF9F43 100%)',
        'game-ludo': 'linear-gradient(135deg, rgba(0,245,255,0.15) 0%, rgba(108,99,255,0.1) 100%)',
        'game-chess': 'linear-gradient(135deg, rgba(255,213,79,0.15) 0%, rgba(108,99,255,0.1) 100%)',
        'game-rs': 'linear-gradient(135deg, rgba(255,94,223,0.15) 0%, rgba(108,99,255,0.1) 100%)',
      },
      boxShadow: {
        // Neon glows
        'neon-blue': '0 0 10px rgba(0,245,255,0.5), 0 0 30px rgba(0,245,255,0.25)',
        'neon-pink': '0 0 10px rgba(255,94,223,0.5), 0 0 30px rgba(255,94,223,0.25)',
        'neon-purple': '0 0 15px rgba(108,99,255,0.6), 0 0 40px rgba(108,99,255,0.3)',
        'neon-gold': '0 0 10px rgba(255,215,0,0.6), 0 0 30px rgba(255,215,0,0.3)',
        'neon-green': '0 0 10px rgba(57,255,20,0.5), 0 0 25px rgba(57,255,20,0.2)',
        'neon-error': '0 0 10px rgba(255,68,68,0.5), 0 0 25px rgba(255,68,68,0.3)',
        // Card shadows
        'card': '0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
        'card-hover': '0 20px 60px rgba(108,99,255,0.2), 0 8px 32px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.07)',
        'card-glow-blue': '0 8px 32px rgba(0,245,255,0.15), 0 4px 16px rgba(0,0,0,0.6)',
        'card-glow-pink': '0 8px 32px rgba(255,94,223,0.15), 0 4px 16px rgba(0,0,0,0.6)',
        'card-glow-gold': '0 8px 32px rgba(255,215,0,0.15), 0 4px 16px rgba(0,0,0,0.6)',
        // Panel shadows
        'glass': '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        'glass-heavy': '0 20px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)',
        // Inner glows
        'inner-blue': 'inset 0 0 20px rgba(0,245,255,0.1)',
        'inner-purple': 'inset 0 0 20px rgba(108,99,255,0.1)',
      },
      animation: {
        // Floating
        'float-slow': 'float 8s ease-in-out infinite',
        'float-medium': 'float 6s ease-in-out infinite',
        'float-fast': 'float 4s ease-in-out infinite',
        // Orbiting
        'orbit-slow': 'orbit 40s linear infinite',
        'orbit-medium': 'orbit 20s linear infinite',
        'orbit-fast': 'orbit 10s linear infinite',
        // Pulsing
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
        'pulse-ring': 'pulseRing 2s ease-in-out infinite',
        // Spinning
        'spin-slow': 'spin 12s linear infinite',
        'spin-medium': 'spin 6s linear infinite',
        // Space effects
        'nebula-drift': 'nebulaDrift 20s ease-in-out infinite',
        'aurora-shift': 'auroraShift 8s ease-in-out infinite',
        'shooting-star': 'shootingStar 1.5s ease-out forwards',
        'star-twinkle': 'starTwinkle 3s ease-in-out infinite',
        // UI animations
        'fade-in': 'fadeIn 0.4s cubic-bezier(0.23,1,0.32,1) forwards',
        'fade-in-up': 'fadeInUp 0.5s cubic-bezier(0.23,1,0.32,1) forwards',
        'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.23,1,0.32,1) forwards',
        'slide-in-left': 'slideInLeft 0.4s cubic-bezier(0.23,1,0.32,1) forwards',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.23,1,0.32,1) forwards',
        // Achievement
        'achievement-pop': 'achievementPop 0.6s cubic-bezier(0.23,1,0.32,1) forwards',
        'score-pop': 'scorePop 0.4s cubic-bezier(0.23,1,0.32,1) forwards',
        // Holographic shimmer
        'shimmer': 'shimmer 2.5s linear infinite',
        'holo-shimmer': 'holoShimmer 4s linear infinite',
        // Ticker
        'ticker': 'ticker 30s linear infinite',
        'ticker-slow': 'ticker 60s linear infinite',
        // Shake
        'shake': 'shake 0.5s ease-in-out',
        // Countdown
        'countdown-pulse': 'countdownPulse 1s ease-in-out infinite',
        // Chakra
        'chakra-spin': 'chakraSpin 25s linear infinite',
        // Bounce lift
        'pawn-lift': 'pawnBounceLift 1.1s infinite ease-in-out',
        // Coin
        'coin-spin': 'coinSpin 1s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-16px)' },
        },
        orbit: {
          '0%': { transform: 'rotate(0deg) translateX(120px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(120px) rotate(-360deg)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
        nebulaDrift: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)', opacity: '0.4' },
          '33%': { transform: 'translate(30px,-20px) scale(1.1)', opacity: '0.6' },
          '66%': { transform: 'translate(-20px,15px) scale(0.95)', opacity: '0.3' },
        },
        auroraShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        shootingStar: {
          '0%': { transform: 'translateX(0) translateY(0)', opacity: '1' },
          '100%': { transform: 'translateX(400px) translateY(400px)', opacity: '0' },
        },
        starTwinkle: {
          '0%, 100%': { opacity: '0.2', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.2)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(32px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-32px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        achievementPop: {
          '0%': { opacity: '0', transform: 'scale(0.5) translateY(20px)' },
          '60%': { transform: 'scale(1.15) translateY(-4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        scorePop: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.3)' },
          '100%': { transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        holoShimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-6px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(6px)' },
        },
        countdownPulse: {
          '0%, 100%': { transform: 'scale(1)', textShadow: '0 0 0 transparent' },
          '50%': { transform: 'scale(1.04)', textShadow: '0 0 20px rgba(0,245,255,0.8)' },
        },
        chakraSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        pawnBounceLift: {
          '0%, 100%': { transform: 'translateY(-4px) scale(1.12)' },
          '50%': { transform: 'translateY(-14px) scale(1.18)' },
        },
        coinSpin: {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(360deg)' },
        },
        pulseGold: {
          '0%': { boxShadow: '0 0 5px rgba(255,215,0,0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(255,215,0,0.6)' },
        },
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      screens: {
        'xs': '375px',
        '3xl': '1920px',
        '4xl': '2560px',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'bounce-out': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
      },
      backdropBlur: {
        xs: '2px',
        '4xl': '72px',
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
    },
  },
  plugins: [],
};
export default config;
