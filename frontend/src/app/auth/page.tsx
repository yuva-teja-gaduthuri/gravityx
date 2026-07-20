'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail, User, ShieldAlert, ArrowLeft } from 'lucide-react';
import { getApiUrl } from '../../utils/api';

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'login';

  const [tab, setTab] = useState(initialTab);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // Sync tab state from URL params
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t) setTab(t);
  }, [searchParams]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(getApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      localStorage.setItem('gravityx_token', data.token);
      localStorage.setItem('gravityx_user', JSON.stringify({
        id: data.user.id,
        username: data.user.username,
        email: data.user.email
      }));

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername: email || username, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('gravityx_token', data.token);
      localStorage.setItem('gravityx_user', JSON.stringify({
        id: data.user.id,
        username: data.user.username,
        email: data.user.email,
        coins: data.user.coins,
        xp: data.user.xp,
        level: data.user.level,
        rank: data.user.rank,
        avatar: data.user.avatar,
        profileFrame: data.user.profileFrame,
      }));

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const res = await fetch(getApiUrl('/api/auth/guest'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Guest login failed');

      localStorage.setItem('gravityx_token', data.token);
      localStorage.setItem('gravityx_user', JSON.stringify({
        id: data.user.id,
        username: data.user.username,
        isGuest: true,
        coins: data.user.coins,
        xp: data.user.xp,
        level: data.user.level,
        rank: data.user.rank,
        avatar: data.user.avatar,
        profileFrame: data.user.profileFrame,
      }));

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setLoading(true);
    setTimeout(() => {
      setForgotSent(true);
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
      <Link href="/" className="absolute top-6 left-6 flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
        <ArrowLeft size={16} /> Back to Deck
      </Link>

      <div className="w-full max-w-md glass-panel rounded-3xl p-8 border-white/5 relative overflow-hidden shadow-neon-purple">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-cyberblue to-cyberpink"></div>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold tracking-wider bg-gradient-to-r from-white via-cyberblue to-primary bg-clip-text text-transparent">
            GRAVITYX
          </h2>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">Orbital Identity Sync</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-cybererror/10 border border-cybererror/30 text-cybererror text-sm flex items-center gap-3">
            <ShieldAlert size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Selection */}
        {tab !== 'forgot' && (
          <div className="flex rounded-2xl glass-card p-1 mb-8 border-white/5">
            <button
              onClick={() => { setTab('login'); setError(''); }}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${tab === 'login' ? 'bg-primary shadow-lg text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('register'); setError(''); }}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${tab === 'register' ? 'bg-primary shadow-lg text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Register
            </button>
          </div>
        )}

        {/* Login Form */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Username or Email</label>
              <div className="relative">
                <User size={18} className="absolute left-4 top-3.5 text-gray-500" />
                <input
                  type="text"
                  required
                  placeholder="Enter username or email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setUsername(e.target.value); }}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl glass-input text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Password</label>
                <button type="button" onClick={() => setTab('forgot')} className="text-xs text-cyberblue hover:underline">
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-3.5 text-gray-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl glass-input text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-primary to-cyberblue hover:opacity-90 rounded-xl font-bold shadow-neon-blue transition-all disabled:opacity-50"
            >
              {loading ? 'Decrypting Credentials...' : 'Sign In'}
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-white/5"></div>
              <span className="flex-shrink mx-4 text-xs font-bold text-gray-500 uppercase">Or Continue As</span>
              <div className="flex-grow border-t border-white/5"></div>
            </div>

            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={loading}
              className="w-full py-4 rounded-xl glass-card border-white/10 hover:border-cyberpink text-sm font-bold text-white transition-all hover:scale-[1.01]"
            >
              Play as Guest (Zero Setup)
            </button>
          </form>
        )}

        {/* Register Form */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Username</label>
              <div className="relative">
                <User size={18} className="absolute left-4 top-3.5 text-gray-500" />
                <input
                  type="text"
                  required
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl glass-input text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-3.5 text-gray-500" />
                <input
                  type="email"
                  required
                  placeholder="name@station.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl glass-input text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-3.5 text-gray-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl glass-input text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-primary to-cyberblue hover:opacity-90 rounded-xl font-bold shadow-neon-blue transition-all disabled:opacity-50"
            >
              {loading ? 'Uploading Data...' : 'Create Account'}
            </button>
          </form>
        )}

        {/* Forgot Password */}
        {tab === 'forgot' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white mb-2">Sync Resets</h3>
            <p className="text-xs text-gray-400 leading-relaxed">Enter your registered email address below. We will send orbital synchronization telemetry to reset your security locks.</p>

            {forgotSent ? (
              <div className="p-4 rounded-xl bg-cybersuccess/10 border border-cybersuccess/30 text-cybersuccess text-sm">
                Telemetry link dispatched! Please check your communication logs (inbox).
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Address</label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-3.5 text-gray-500" />
                    <input
                      type="email"
                      required
                      placeholder="name@station.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl glass-input text-sm"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-primary hover:opacity-90 rounded-xl font-bold transition-all disabled:opacity-50"
                >
                  {loading ? 'Transmitting...' : 'Transmit Telemetry Link'}
                </button>
              </form>
            )}

            <button
              onClick={() => { setTab('login'); setForgotSent(false); setError(''); }}
              className="w-full py-3.5 text-center text-sm font-semibold text-gray-400 hover:text-white"
            >
              Return to Login Portal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
