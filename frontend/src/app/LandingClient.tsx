'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Gamepad2, Users, Rocket, Trophy, MessageSquare, ShieldAlert, ChevronDown,
  Activity, Star, Zap, Globe, Shield, ChevronRight, Play, ArrowRight,
  Swords, Brain, Dice1, Clock, Volume2, Crown, Medal
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import { useTranslation } from '../hooks/useTranslation';

/* ── Fake live stats (placeholder — replace with real API if available) ── */
const LIVE_STATS = { players: 14_832, matches: 3_291, tournaments: 48 };

/* ── Ticker items ── */
const TICKER_ITEMS = [
  { icon: '⚡', text: '14,832 Commanders Online' },
  { icon: '🎮', text: '3,291 Active Matches' },
  { icon: '🏆', text: '48 Tournaments Today' },
  { icon: '🚀', text: 'Season 4 Now Live' },
  { icon: '🌌', text: 'New Cosmic Ludo Board Unlocked' },
  { icon: '⭐', text: 'Ranked Season Resets in 12 Days' },
  { icon: '💎', text: '2× XP Weekend Active' },
  { icon: '🔥', text: 'PlayerX is on a 12-win Streak' },
];

/* ── Testimonials ── */
const TESTIMONIALS = [
  {
    avatar: '👨‍🚀',
    username: 'NebulaCaptain',
    rank: 'Commander',
    rating: 5,
    comment: 'The Ramudu-Seetha game is absolutely mind-bending. Best social deduction experience on any platform. Period.',
  },
  {
    avatar: '🤖',
    username: 'CyberAce77',
    rank: 'Veteran',
    rating: 5,
    comment: "Cosmic Ludo with real-time voice chat changed how I play board games online. The visuals are insanely good.",
  },
  {
    avatar: '👽',
    username: 'OrbitQueen',
    rank: 'Legend',
    rating: 5,
    comment: 'GravityX is the only platform where I can play with my whole friend group regardless of location. The lobby UX is flawless.',
  },
];

/* ── Feature items ── */
const FEATURES = [
  {
    icon: <Volume2 size={28} />,
    color: 'cyberblue',
    gradient: 'from-cyberblue/20 to-transparent',
    title: 'Live Voice Chat',
    desc: 'Built-in peer-to-peer voice channels inside every lobby. Toggle on/off per room at host discretion.',
  },
  {
    icon: <Rocket size={28} />,
    color: 'primary',
    gradient: 'from-primary/20 to-transparent',
    title: 'Orbital Aesthetics',
    desc: 'Premium glassmorphic UI built with neon gradients, orbital starfields, and immersive game environments.',
  },
  {
    icon: <Trophy size={28} />,
    color: 'cybergold',
    gradient: 'from-cybergold/20 to-transparent',
    title: 'XP & Progression',
    desc: 'Earn XP every match. Unlock rank tiers, collect coins, and rise through the Division Leaderboard.',
  },
  {
    icon: <Users size={28} />,
    color: 'cyberpink',
    gradient: 'from-cyberpink/20 to-transparent',
    title: 'Social Drawer',
    desc: 'Add friends, send instant invites, chat privately, and check live match status — all from a sleek overlay.',
  },
  {
    icon: <Shield size={28} />,
    color: 'cybersuccess',
    gradient: 'from-cybersuccess/20 to-transparent',
    title: 'Private Rooms',
    desc: 'Host invite-only rooms with custom game rules, coin stakes, and turn timers for competitive play.',
  },
  {
    icon: <Globe size={28} />,
    color: 'cyberblue',
    gradient: 'from-cyberblue/20 to-transparent',
    title: 'Global Matchmaking',
    desc: 'Join public rooms from players worldwide. Real-time ping tracking and connection quality indicators.',
  },
];

/* ── Game data ── */
const GAMES = [
  {
    id: 'rs',
    tag: 'Mythological Deduction',
    name: 'Ramudu-Seetha',
    desc: 'An exclusive hidden identity deduction game for 3–10 players. One is Ramudu, one is Seetha — and only clever questioning reveals the truth.',
    players: '3–10 Players',
    badge: 'EXCLUSIVE',
    badgeColor: 'badge-pink',
    accentColor: '#FF5EDF',
    glowClass: 'glow-pink',
    bgGrad: 'from-cyberpink/20 via-primary/10 to-transparent',
    icon: <Brain size={32} />,
    iconBg: 'bg-cyberpink/15',
    iconColor: 'text-cyberpink',
    borderHover: 'hover:border-cyberpink/50',
    ctaColor: 'text-cyberpink',
    features: ['Social Deduction', 'Hidden Roles', '3-10 Players', 'Voice Chat Ready'],
  },
  {
    id: 'ludo',
    tag: 'Classic Strategy',
    name: 'Cosmic Ludo',
    desc: 'Turn-based Ludo reimagined in orbital space. Roll animated 3D dice, navigate tokens through star-safe zones, and eliminate rivals.',
    players: '2 or 4 Players',
    badge: 'POPULAR',
    badgeColor: 'badge-blue',
    accentColor: '#00F5FF',
    glowClass: 'glow-blue',
    bgGrad: 'from-cyberblue/20 via-primary/10 to-transparent',
    icon: <Dice1 size={32} />,
    iconBg: 'bg-cyberblue/15',
    iconColor: 'text-cyberblue',
    borderHover: 'hover:border-cyberblue/50',
    ctaColor: 'text-cyberblue',
    features: ['3D Dice Animation', 'Turn Timers', 'Coin Stakes', 'Spectator Mode'],
  },
  {
    id: 'chess',
    tag: 'Classic Strategy',
    name: 'Chess Strategy',
    desc: 'Standard FIDE chess with real-time socket sync, optional time controls, active clocks, and full spectator support.',
    players: '2 Players',
    badge: 'RANKED',
    badgeColor: 'badge-gold',
    accentColor: '#FFD700',
    glowClass: 'glow-gold',
    bgGrad: 'from-cybergold/20 via-primary/10 to-transparent',
    icon: <Crown size={32} />,
    iconBg: 'bg-cybergold/15',
    iconColor: 'text-cybergold',
    borderHover: 'hover:border-cybergold/50',
    ctaColor: 'text-cybergold',
    features: ['FIDE Rules', 'Time Controls', 'Rating System', 'Move Hints'],
  },
];

export default function LandingClient() {
  const { t } = useTranslation();
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsVisible(true);
    // Auto-rotate testimonials
    const timer = setInterval(() => {
      setTestimonialIdx(prev => (prev + 1) % TESTIMONIALS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const faqs = [
    {
      q: t('faq1Q', 'What is GravityX?'),
      a: t('faq1A', 'GravityX is a real-time online multiplayer gaming platform built around a space theme. Create private lobbies to play with friends or matchmake globally with players worldwide.'),
    },
    {
      q: t('faq2Q', 'What is the Ramudu-Seetha game?'),
      a: t('faq2A', 'Ramudu-Seetha is our exclusive social deduction game. In a room of 3–10 players, one player is secretly Ramudu, one is Seetha, and others are protective characters. Ramudu must guess who Seetha is before attempts run out, while players try to protect her identity.'),
    },
    {
      q: t('faq3Q', 'Does GravityX support voice chat?'),
      a: t('faq3A', 'Yes! Lobbies have built-in voice chat capabilities that can be toggled on/off by the host during room creation. No third-party apps needed.'),
    },
    {
      q: t('faq4Q', 'How do I purchase custom skins?'),
      a: t('faq4A', 'Earn coins by playing matches and leveling up. Use coins in the in-game Store to purchase custom dice skins, avatar borders, and board frames.'),
    },
    {
      q: t('faq5Q', 'Is there a mobile version?'),
      a: t('faq5A', 'GravityX is fully responsive and works seamlessly on mobile browsers — no app download required. Native apps are planned for future release.'),
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-transparent">

      {/* ── Background ambient orbs ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-1/4 left-[-5%] w-[500px] h-[500px] rounded-full bg-primary/8 blur-[120px] animate-float-slow" />
        <div className="absolute bottom-1/3 right-[-8%] w-[600px] h-[600px] rounded-full bg-cyberblue/6 blur-[140px] animate-float-medium" />
        <div className="absolute top-2/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-cyberpink/5 blur-[100px] animate-float-fast" />
      </div>

      {/* ══════════════════════════════════════════
          NAVIGATION HEADER
      ══════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 w-full glass-panel border-b border-white/[0.06] py-2.5 px-3.5 sm:py-3.5 sm:px-6 md:px-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group" aria-label="GravityX Home">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-cyberblue flex items-center justify-center shadow-neon-blue group-hover:shadow-neon-purple group-hover:rotate-12 transition-all duration-300">
            <span className="font-extrabold text-sm sm:text-base text-white font-display tracking-tight">GX</span>
          </div>
          <span className="font-extrabold text-lg sm:text-xl tracking-wider font-display">
            <span className="text-holographic">GRAVITYX</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-gray-400" aria-label="Main navigation">
          {[
            { href: '#games', label: t('navGames', 'Games') },
            { href: '#features', label: t('navFeatures', 'Features') },
            { href: '#leaderboard', label: t('navLeaderboard', 'Leaderboards') },
            { href: '#faq', label: t('navFaq', 'FAQ') },
          ].map(item => (
            <a
              key={item.href}
              href={item.href}
              className="relative hover:text-white transition-colors duration-200 group"
            >
              {item.label}
              <span className="absolute -bottom-0.5 left-0 w-0 h-[1.5px] bg-gradient-to-r from-primary to-cyberblue group-hover:w-full transition-all duration-300" />
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/auth"
            className="hidden sm:block px-5 py-2 text-sm font-semibold rounded-xl btn-ghost"
          >
            {t('login', 'Login')}
          </Link>
          <Link
            href="/auth?tab=guest"
            id="nav-play-now-btn"
            className="px-3 py-1.5 text-xs sm:px-5 sm:py-2 sm:text-sm font-extrabold rounded-lg sm:rounded-xl btn-primary whitespace-nowrap inline-flex items-center gap-1.5 shadow-md hover:scale-105 active:scale-95 transition-all"
          >
            <span>{t('playNow', 'Play Now')}</span>
            <span className="text-[10px] sm:text-xs">▶</span>
          </Link>
        </div>
      </header>

      {/* ══════════════════════════════════════════
          LIVE STATS TICKER
      ══════════════════════════════════════════ */}
      <div className="w-full border-b border-white/[0.04] bg-gradient-to-r from-primary/5 via-cyberblue/5 to-cyberpink/5 py-2 overflow-hidden" aria-label="Live platform stats">
        <div className="ticker-wrapper">
          <div className="ticker-content">
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} className="inline-flex items-center gap-2 mx-8 text-xs font-semibold text-gray-400">
                <span>{item.icon}</span>
                <span>{item.text}</span>
                <span className="mx-4 text-white/10">·</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          HERO SECTION
      ══════════════════════════════════════════ */}
      <section
        ref={heroRef}
        className="relative flex flex-col items-center justify-center text-center px-6 pt-20 pb-16 md:pt-32 md:pb-24 max-w-6xl mx-auto w-full z-10"
        aria-labelledby="hero-heading"
      >
        {/* Live badge */}
        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card border-white/10 text-xs font-bold uppercase tracking-widest mb-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <span className="live-dot" />
          <span className="text-cyberlime">Live</span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-300 text-stat">{LIVE_STATS.players.toLocaleString()} Commanders Online</span>
        </div>

        {/* Main headline */}
        <h1
          id="hero-heading"
          className={`font-display text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 leading-[1.05] transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <span className="block text-white">Play Together.</span>
          <span className="block text-holographic py-1">Anywhere. Anytime.</span>
        </h1>

        {/* Sub-headline */}
        <p className={`text-base md:text-xl text-gray-400 max-w-2xl mb-10 leading-relaxed transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          {t('heroSubtitle', 'Step into a futuristic orbital arena. Join rooms, launch games, and challenge your friends in classic matches and exclusive local board designs.')}
        </p>

        {/* CTA buttons */}
        <div className={`flex flex-col sm:flex-row gap-4 items-center justify-center w-full transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <Link
            href="/auth?tab=guest"
            id="hero-guest-btn"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl btn-primary text-base font-bold"
          >
            <Rocket size={18} />
            {t('launchGuest', 'Launch Guest Session')}
          </Link>
          <Link
            href="/auth?tab=register"
            id="hero-register-btn"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl btn-ghost text-base font-bold"
          >
            {t('createAccount', 'Create Account')}
            <ArrowRight size={18} />
          </Link>
        </div>

        {/* Social proof */}
        <div className={`mt-10 flex items-center gap-4 text-xs text-gray-500 transition-all duration-700 delay-400 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex -space-x-2">
            {['👨‍🚀', '🤖', '👽', '🌌', '👾'].map((em, i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-surface-elevated border border-white/10 flex items-center justify-center text-sm">
                {em}
              </div>
            ))}
          </div>
          <span className="font-semibold text-gray-400">Join <span className="text-white font-bold">14,800+</span> orbital commanders</span>
        </div>

        {/* Floating game mini-cards (decorative) */}
        <div className="absolute right-0 top-16 hidden xl:flex flex-col gap-3 opacity-60 animate-float-slow pointer-events-none" aria-hidden="true">
          {[
            { emoji: '🎲', label: 'Cosmic Ludo', color: '#00F5FF' },
            { emoji: '♟️', label: 'Chess', color: '#FFD700' },
          ].map((g, i) => (
            <div key={i} className="glass-card rounded-xl px-4 py-2 flex items-center gap-2 text-xs font-bold" style={{ borderColor: `${g.color}25` }}>
              <span>{g.emoji}</span>
              <span className="text-gray-300">{g.label}</span>
              <span className="live-dot" style={{ width: '6px', height: '6px' }} />
            </div>
          ))}
        </div>
        <div className="absolute left-0 top-24 hidden xl:flex flex-col gap-3 opacity-60 animate-float-medium pointer-events-none" aria-hidden="true">
          <div className="glass-card rounded-xl px-4 py-2 flex items-center gap-2 text-xs font-bold border-cyberpink/20">
            <span>🔮</span>
            <span className="text-gray-300">Ramudu-Seetha</span>
            <span className="live-dot" style={{ width: '6px', height: '6px' }} />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          GAMES SHOWCASE
      ══════════════════════════════════════════ */}
      <section id="games" className="py-20 px-6 md:px-12 max-w-7xl mx-auto w-full z-10">
        <div className="text-center mb-16">
          <span className="badge badge-primary mb-4 inline-block">{t('gamesBadge', 'Launch Bay')}</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-4 text-white">
            {t('gamesTitle', 'Choose Your Arena')}
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-base">
            {t('gamesSubtitle', 'Three distinct real-time experiences engineered with low-latency synchronization.')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {GAMES.map((game, idx) => (
            <div
              key={game.id}
              className={`game-portal group ${game.borderHover} transition-all duration-500`}
              style={{
                animationDelay: `${idx * 0.1}s`,
              }}
            >
              {/* Top gradient accent */}
              <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${game.bgGrad} opacity-80`} />
              {/* Inner ambient glow */}
              <div
                className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(circle, ${game.accentColor}22 0%, transparent 70%)` }}
              />

              <div className="p-7 lg:p-8 flex flex-col h-full gap-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className={`w-14 h-14 rounded-2xl ${game.iconBg} flex items-center justify-center ${game.iconColor} group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}>
                    {game.icon}
                  </div>
                  <span className={`badge ${game.badgeColor}`}>{game.badge}</span>
                </div>

                {/* Title */}
                <div>
                  <span className={`text-[10px] uppercase font-extrabold tracking-widest ${game.iconColor} opacity-80`}>
                    {game.tag}
                  </span>
                  <h3 className="font-display text-2xl md:text-3xl font-bold mt-1.5 text-white group-hover:text-opacity-95 transition-colors">
                    {game.name}
                  </h3>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-400 leading-relaxed flex-grow">{game.desc}</p>

                {/* Feature chips */}
                <div className="flex flex-wrap gap-2">
                  {game.features.map(feat => (
                    <span key={feat} className="badge badge-primary text-[9px]">{feat}</span>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-white/[0.06] mt-auto">
                  <div className="flex items-center gap-1.5">
                    <span className="live-dot" style={{ width: '6px', height: '6px' }} />
                    <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{game.players}</span>
                  </div>
                  <Link
                    href="/auth"
                    id={`game-card-play-${game.id}`}
                    className={`inline-flex items-center gap-1.5 text-sm font-bold ${game.ctaColor} hover:opacity-80 transition-opacity`}
                  >
                    {t('playGame', 'Play Game')}
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          TOURNAMENT BANNER
      ══════════════════════════════════════════ */}
      <section className="py-8 px-6 md:px-12 max-w-7xl mx-auto w-full z-10">
        <div className="relative rounded-3xl overflow-hidden border border-cybergold/25 bg-gradient-to-r from-cybergold/10 via-primary/5 to-cybergold/10 p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Animated border glow */}
          <div className="absolute inset-0 rounded-3xl" style={{ boxShadow: 'inset 0 0 60px rgba(255,215,0,0.06)' }} />
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-cybergold/8 blur-3xl pointer-events-none" />

          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-cybergold/15 flex items-center justify-center text-cybergold animate-pulse-gold flex-shrink-0">
              <Medal size={28} />
            </div>
            <div>
              <span className="badge badge-gold mb-2 block w-fit">🏆 Season 4 Tournament</span>
              <h3 className="font-display text-2xl font-bold text-white">Grand Orbital Championship</h3>
              <p className="text-gray-400 text-sm mt-1">Compete across Ludo, Chess & Ramudu-Seetha for the ultimate crown.</p>
            </div>
          </div>

          <div className="flex items-center gap-6 relative z-10">
            <div className="text-center">
              <div className="text-stat text-2xl font-bold text-cybergold">12</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Days Left</div>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div className="text-center">
              <div className="text-stat text-2xl font-bold text-white">₹50K</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Prize Pool</div>
            </div>
            <Link
              href="/auth?tab=register"
              id="tournament-register-btn"
              className="px-6 py-3 rounded-xl btn-mythic-gold text-sm font-bold whitespace-nowrap"
            >
              Register Now
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          PLATFORM FEATURES
      ══════════════════════════════════════════ */}
      <section id="features" className="py-20 px-6 md:px-12 z-10 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.03] to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto w-full">
          <div className="text-center mb-16">
            <span className="badge badge-primary mb-4 inline-block">Orbital Systems</span>
            <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-4 text-white">
              {t('featuresTitle', 'Built for Champions')}
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto text-base">
              {t('featuresSubtitle', 'Advanced systems engineered for clean interactions, low-latency play, and competitive excellence.')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feat, idx) => (
              <div
                key={idx}
                className="glass-card rounded-2xl p-7 group border-white/[0.05] hover:border-white/[0.12]"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feat.gradient} flex items-center justify-center text-${feat.color} mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  {feat.icon}
                </div>
                <h4 className="font-display text-lg font-bold text-white mb-2.5">{feat.title}</h4>
                <p className="text-sm text-gray-400 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════ */}
      <section id="leaderboard" className="py-20 px-6 md:px-12 max-w-4xl mx-auto w-full z-10">
        <div className="text-center mb-14">
          <span className="badge badge-gold mb-4 inline-block">Crew Ratings</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-white">
            {t('testimonialsTitle', 'What Commanders Say')}
          </h2>
        </div>

        <div className="relative">
          {TESTIMONIALS.map((t, idx) => (
            <div
              key={idx}
              className={`transition-all duration-700 absolute inset-0 ${idx === testimonialIdx ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}
            >
              <div className="glass-card rounded-3xl p-8 md:p-10 border-white/[0.06] text-center">
                <div className="flex justify-center mb-4">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} size={18} fill="#FFD700" color="#FFD700" className="mx-0.5" />
                  ))}
                </div>
                <p className="text-gray-200 text-lg md:text-xl leading-relaxed mb-8 font-medium">
                  &ldquo;{t.comment}&rdquo;
                </p>
                <div className="flex items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-surface-elevated border border-white/10 flex items-center justify-center text-xl">
                    {t.avatar}
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-white">{t.username}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">{t.rank}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {/* Spacer for absolute-positioned cards */}
          <div className="glass-card rounded-3xl p-8 md:p-10 opacity-0 pointer-events-none">
            <div className="h-44" />
          </div>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-8">
          {TESTIMONIALS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setTestimonialIdx(idx)}
              aria-label={`Testimonial ${idx + 1}`}
              className={`rounded-full transition-all duration-300 ${idx === testimonialIdx ? 'w-6 h-2 bg-primary' : 'w-2 h-2 bg-white/20'}`}
            />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FAQ SECTION
      ══════════════════════════════════════════ */}
      <section id="faq" className="py-20 max-w-3xl mx-auto px-6 w-full z-10">
        <div className="text-center mb-14">
          <span className="badge badge-primary mb-4 inline-block">FAQ</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-white">
            {t('faqTitle', 'Got Questions?')}
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="glass-card rounded-2xl border-white/[0.05] overflow-hidden transition-all duration-300"
              style={{
                borderColor: activeFaq === idx ? 'rgba(108,99,255,0.3)' : undefined,
                boxShadow: activeFaq === idx ? '0 4px 24px rgba(108,99,255,0.1)' : undefined,
              }}
            >
              <button
                onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                className="w-full px-6 py-5 flex items-center justify-between text-left font-semibold text-base hover:text-white transition-colors group"
                aria-expanded={activeFaq === idx}
                id={`faq-btn-${idx}`}
              >
                <span className="pr-4 text-gray-200 group-hover:text-white transition-colors">{faq.q}</span>
                <ChevronDown
                  size={18}
                  className={`shrink-0 transition-transform duration-300 text-primary ${activeFaq === idx ? 'rotate-180' : ''}`}
                />
              </button>
              <div className={`overflow-hidden transition-all duration-400 ${activeFaq === idx ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="px-6 pb-6 text-sm text-gray-400 leading-relaxed border-t border-white/[0.05] pt-4">
                  {faq.a}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FINAL CTA SECTION
      ══════════════════════════════════════════ */}
      <section className="py-20 px-6 z-10 relative">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative rounded-4xl overflow-hidden border border-primary/25 bg-gradient-to-br from-primary/10 via-surface/50 to-cyberblue/8 p-12 md:p-16">
            <div className="absolute inset-0 rounded-4xl" style={{ boxShadow: 'inset 0 0 80px rgba(108,99,255,0.08)' }} />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />

            <div className="relative z-10">
              <div className="text-4xl mb-4">🚀</div>
              <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-white mb-4">
                Ready to Launch?
              </h2>
              <p className="text-gray-400 text-base md:text-lg mb-10 max-w-xl mx-auto">
                Create an account in seconds or jump straight into a game as a guest. Your orbital command awaits.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/auth?tab=register"
                  id="final-cta-register"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl btn-primary text-base font-bold"
                >
                  <Zap size={18} />
                  Create Free Account
                </Link>
                <Link
                  href="/auth?tab=guest"
                  id="final-cta-guest"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl btn-ghost text-base font-bold"
                >
                  <Play size={18} />
                  Try as Guest
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════ */}
      <footer className="mt-auto border-t border-white/[0.05] glass-panel py-12 px-6 md:px-12 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-cyberblue flex items-center justify-center">
                  <span className="font-extrabold text-sm text-white font-display">GX</span>
                </div>
                <span className="font-display font-extrabold text-lg text-white">GRAVITYX</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Premium real-time multiplayer gaming platform. Built for champions. Designed for immersion.
              </p>
            </div>
            {/* Games */}
            <div>
              <h5 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Games</h5>
              <ul className="space-y-2 text-xs text-gray-500">
                {['Cosmic Ludo', 'Chess Strategy', 'Ramudu-Seetha'].map(g => (
                  <li key={g}><Link href="/auth" className="hover:text-white transition-colors">{g}</Link></li>
                ))}
              </ul>
            </div>
            {/* Platform */}
            <div>
              <h5 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Platform</h5>
              <ul className="space-y-2 text-xs text-gray-500">
                {['Leaderboard', 'Store', 'Tournaments', 'Profile'].map(p => (
                  <li key={p}><Link href="/auth" className="hover:text-white transition-colors">{p}</Link></li>
                ))}
              </ul>
            </div>
            {/* Legal */}
            <div>
              <h5 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Legal</h5>
              <ul className="space-y-2 text-xs text-gray-500">
                {['Privacy Policy', 'Terms of Use', 'Status API', 'Support'].map(l => (
                  <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
          </div>

          <div className="divider-neon mb-8" />

          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-gray-600 gap-4">
            <div>&copy; 2026 GravityX Systems. All Rights Reserved.</div>
            <div className="flex items-center gap-3">
              <span className="badge badge-success text-[9px]">● All Systems Operational</span>
              <span className="text-stat text-gray-600">v4.1.0</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
