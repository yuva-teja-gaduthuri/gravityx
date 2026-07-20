'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Gamepad2, Users, Rocket, Trophy, MessageSquare, ShieldAlert, ChevronDown, Activity, Star } from 'lucide-react';

export default function LandingClient() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: "What is GravityX?",
      a: "GravityX is a real-time online multiplayer gaming platform designed around space themes. You can create private lobbies to play with friends or matchmake globally with players."
    },
    {
      q: "What is the Ramudu-Seetha game?",
      a: "Ramudu-Seetha is an exclusive social deduction game. In a room of 3 to 10 players, one player is secretly Ramudu, one is Seetha, and others are protective mythological characters. Ramudu must guess who Seetha is before time/attempts run out, while players protect her identity."
    },
    {
      q: "Does GravityX support voice chat?",
      a: "Yes! Lobbies have built-in voice chat capabilities that can be toggled on/off by the host during room creation."
    },
    {
      q: "How do I purchase custom skins?",
      a: "You earn coins by playing matches and leveling up. Use these coins in the Store to purchase customized dice skins, avatar borders, and board frames."
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-transparent">
      {/* Dynamic planets background */}
      <div className="absolute top-1/4 left-10 w-72 h-72 rounded-full bg-gradient-to-br from-cyberpink/20 to-primary/10 blur-3xl animate-float-slow pointer-events-none"></div>
      <div className="absolute bottom-1/3 right-10 w-96 h-96 rounded-full bg-gradient-to-tl from-cyberblue/20 to-primary/10 blur-3xl animate-float-medium pointer-events-none"></div>

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full glass-panel border-b border-white/5 py-4 px-6 md:px-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-cyberblue flex items-center justify-center shadow-neon-blue group-hover:rotate-12 transition-transform duration-300">
            <span className="font-extrabold text-xl text-white">GX</span>
          </div>
          <span className="font-extrabold text-2xl tracking-wider bg-gradient-to-r from-white via-cyberblue to-cyberpink bg-clip-text text-transparent">
            GRAVITYX
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
          <a href="#games" className="hover:text-cyberblue transition-colors">Games</a>
          <a href="#features" className="hover:text-cyberblue transition-colors">Features</a>
          <a href="#leaderboard" className="hover:text-cyberblue transition-colors">Leaderboards</a>
          <a href="#faq" className="hover:text-cyberblue transition-colors">FAQ</a>
        </nav>

        <div className="flex items-center gap-4">
          <Link href="/auth" className="px-5 py-2 text-sm font-semibold rounded-xl glass-card text-white hover:border-cyberpink transition-all">
            Login
          </Link>
          <Link href="/auth?tab=guest" className="px-5 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-primary to-cyberblue hover:opacity-90 shadow-neon-blue transition-all">
            Play Now
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-24 pb-16 md:pt-36 md:pb-28 max-w-5xl mx-auto z-10">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel border-cyberblue/30 text-xs font-semibold text-cyberblue mb-6 shadow-neon-blue uppercase tracking-widest animate-pulse-slow">
          <Activity size={14} /> Anti-Gravity Multiplayer Playground
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-6">
          Play Together. <br />
          <span className="bg-gradient-to-r from-cyberblue via-primary to-cyberpink bg-clip-text text-transparent">
            Anywhere. Anytime.
          </span>
        </h1>

        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-10 leading-relaxed">
          Step into a futuristic orbital arena. Join rooms, launch games, and challenge your friends in classic matches and exclusive local board designs.
        </p>

        <div className="flex flex-col sm:flex-row gap-5 items-center justify-center w-full">
          <Link href="/auth?tab=guest" className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-primary via-cyberblue to-primary bg-[size:200%] hover:bg-[100%] text-base font-bold shadow-neon-purple hover:scale-105 transition-all text-center">
            Launch Guest Session
          </Link>
          <Link href="/auth?tab=register" className="w-full sm:w-auto px-8 py-4 rounded-2xl glass-card border-white/10 hover:border-cyberpink text-base font-bold hover:scale-105 transition-all text-center">
            Create Account
          </Link>
        </div>
      </section>

      {/* Games Showcase */}
      <section id="games" className="py-20 px-6 md:px-12 max-w-6xl mx-auto w-full z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold mb-4">The Launch Bay</h2>
          <p className="text-gray-400 max-w-xl mx-auto">Two distinct real-time experiences engineered with low latency synchronization.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-10">
          {/* Ramudu Seetha Game Card */}
          <div className="glass-card rounded-3xl p-8 flex flex-col justify-between group cursor-pointer border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyberpink/10 rounded-full blur-2xl group-hover:bg-cyberpink/20 transition-all"></div>
            <div>
              <div className="w-14 h-14 rounded-2xl bg-cyberpink/10 flex items-center justify-center text-cyberpink mb-6 group-hover:scale-110 transition-transform">
                <Gamepad2 size={28} />
              </div>
              <span className="text-xs uppercase font-extrabold text-cyberpink tracking-wider">Mythological Deduction</span>
              <h3 className="text-2xl md:text-3xl font-extrabold mt-2 mb-4 group-hover:text-cyberpink transition-colors">Ramudu-Seetha</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                An exclusive hidden identity deduction game for 3 to 10 players. Ramudu searches for Seetha through direct reveal clicks. Keep Seetha safe from discovery while maintaining your cover.
              </p>
            </div>
            <div className="flex justify-between items-center border-t border-white/5 pt-6 mt-4">
              <span className="text-xs text-gray-500 font-semibold uppercase">3-10 Players</span>
              <Link href="/auth" className="text-sm font-bold text-cyberpink group-hover:underline">Play Game &rarr;</Link>
            </div>
          </div>

          {/* Ludo Game Card */}
          <div className="glass-card rounded-3xl p-8 flex flex-col justify-between group cursor-pointer border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyberblue/10 rounded-full blur-2xl group-hover:bg-cyberblue/20 transition-all"></div>
            <div>
              <div className="w-14 h-14 rounded-2xl bg-cyberblue/10 flex items-center justify-center text-cyberblue mb-6 group-hover:scale-110 transition-transform">
                <Trophy size={28} />
              </div>
              <span className="text-xs uppercase font-extrabold text-cyberblue tracking-wider">Classic Strategy</span>
              <h3 className="text-2xl md:text-3xl font-extrabold mt-2 mb-4 group-hover:text-cyberblue transition-colors">Cosmic Ludo</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                A fully multiplayer-ready, turn-based Ludo match. Roll animated 3D dice, navigate tokens through orbital safe stars, knock back adversaries, and secure top placement with turn timers and connection guards.
              </p>
            </div>
            <div className="flex justify-between items-center border-t border-white/5 pt-6 mt-4">
              <span className="text-xs text-gray-500 font-semibold uppercase">2 or 4 Players</span>
              <Link href="/auth" className="text-sm font-bold text-cyberblue group-hover:underline">Play Game &rarr;</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Features */}
      <section id="features" className="py-20 bg-darkbg/40 border-y border-white/5">
        <div className="max-w-6xl mx-auto px-6 md:px-12 w-full">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4">Orbital Systems</h2>
            <p className="text-gray-400 max-w-xl mx-auto">Advanced design framework built to ensure clean interactions and low-latency fun.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="glass-card rounded-2xl p-6 border-white/5">
              <div className="text-cyberblue mb-4"><Users size={32} /></div>
              <h4 className="text-lg font-bold mb-2">Live Social Drawer</h4>
              <p className="text-sm text-gray-400">Add friends, send invites, chat privately, and inspect user profile ranks directly in the dashboard overlay.</p>
            </div>

            <div className="glass-card rounded-2xl p-6 border-white/5">
              <div className="text-cyberpink mb-4"><Rocket size={32} /></div>
              <h4 className="text-lg font-bold mb-2">Glassmorphism Aesthetic</h4>
              <p className="text-sm text-gray-400">Premium visual language designed with rich gradients, neon-glowing components, and orbital starfields.</p>
            </div>

            <div className="glass-card rounded-2xl p-6 border-white/5">
              <div className="text-cybergold mb-4"><Trophy size={32} /></div>
              <h4 className="text-lg font-bold mb-2">XP Progression</h4>
              <p className="text-sm text-gray-400">Unlock level tiers, accumulate reward coins, climb division boards, and achieve legendary game medals.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 max-w-3xl mx-auto px-6 w-full z-10">
        <h2 className="text-3xl md:text-5xl font-extrabold text-center mb-12">Security & Telemetry FAQ</h2>
        <div className="flex flex-col gap-4">
          {faqs.map((faq, idx) => (
            <div key={idx} className="glass-card rounded-2xl border-white/5 overflow-hidden">
              <button 
                onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                className="w-full px-6 py-5 flex items-center justify-between text-left font-bold text-lg hover:text-cyberblue transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown className={`transform transition-transform ${activeFaq === idx ? 'rotate-180 text-cyberblue' : ''}`} />
              </button>
              {activeFaq === idx && (
                <div className="px-6 pb-6 text-sm text-gray-400 leading-relaxed border-t border-white/5 pt-4">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/5 glass-panel py-10 px-6 md:px-12 flex flex-col sm:flex-row items-center justify-between text-sm text-gray-500 gap-6">
        <div>&copy; 2026 GravityX Systems. All Rights Reserved.</div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-white">Privacy Policy</a>
          <a href="#" className="hover:text-white">Terms of Use</a>
          <a href="#" className="hover:text-white">Status API</a>
        </div>
      </footer>
    </div>
  );
}
