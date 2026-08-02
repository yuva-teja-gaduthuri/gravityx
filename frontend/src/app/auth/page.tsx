'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Lock, Mail, User, ShieldAlert, ArrowLeft, CheckCircle2, Eye, EyeOff,
  Rocket, Gamepad2, Zap, Shield, Star, Trophy
} from 'lucide-react';
import Turnstile from 'react-turnstile';
import { getApiUrl, parseResponseJson } from '../../utils/api';
import { useTranslation } from '../../hooks/useTranslation';

/* ── Password Strength Meter ── */
function PasswordStrength({ password }: { password: string }) {
  const getStrength = () => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const score = getStrength();
  if (!password) return null;

  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', 'bg-red-500', 'bg-orange-400', 'bg-cyberblue', 'bg-cybersuccess'];
  const textColors = ['', 'text-red-400', 'text-orange-400', 'text-cyberblue', 'text-cybersuccess'];

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`flex-1 h-1 rounded-full transition-all duration-400 ${i <= score ? colors[score] : 'bg-white/10'}`}
          />
        ))}
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-wider ${textColors[score]}`}>
        {labels[score]}
      </span>
    </div>
  );
}

/* ── Loading Spinner ── */
function SpinnerIcon() {
  return (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

/* ── Side Art Panel ── */
function SideArtPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden bg-gradient-to-b from-primary/10 via-surface/50 to-cyberblue/8 border-r border-white/[0.06]">
      {/* Ambient glows */}
      <div className="absolute top-0 left-0 w-80 h-80 rounded-full bg-primary/15 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-60 h-60 rounded-full bg-cyberblue/12 blur-[80px] pointer-events-none" />

      {/* Top — Brand */}
      <div className="relative z-10">
        <Link href="/" className="flex items-center gap-3 group mb-10">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-cyberblue flex items-center justify-center shadow-neon-blue">
            <span className="font-extrabold text-white font-display text-base">GX</span>
          </div>
          <span className="font-display font-extrabold text-xl">
            <span className="text-holographic">GRAVITYX</span>
          </span>
        </Link>

        <h2 className="font-display text-3xl font-bold text-white mb-3 leading-tight">
          Enter the<br />Orbital Arena.
        </h2>
        <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
          Join 14,800+ commanders playing real-time games with friends. Private lobbies. Voice chat. Legendary ranks.
        </p>
      </div>

      {/* Middle — Game feature cards */}
      <div className="relative z-10 space-y-3 my-8">
        {[
          { icon: <Gamepad2 size={16} />, color: 'text-cyberpink', title: 'Ramudu-Seetha', sub: 'Social Deduction · 3-10 Players' },
          { icon: <Trophy size={16} />, color: 'text-cyberblue', title: 'Cosmic Ludo', sub: 'Classic Strategy · 2-4 Players' },
          { icon: <Zap size={16} />, color: 'text-cybergold', title: 'Chess Strategy', sub: 'FIDE Rules · Ranked Mode' },
        ].map((g, i) => (
          <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl glass-card border-white/[0.05]">
            <div className={`${g.color} flex-shrink-0`}>{g.icon}</div>
            <div>
              <div className="text-sm font-semibold text-white">{g.title}</div>
              <div className="text-[10px] text-gray-500">{g.sub}</div>
            </div>
            <div className="ml-auto live-dot" style={{ width: '6px', height: '6px' }} />
          </div>
        ))}
      </div>

      {/* Bottom — Social proof */}
      <div className="relative z-10">
        <div className="flex items-center gap-3 p-4 rounded-2xl glass-card border-white/[0.05]">
          <div className="flex -space-x-2 flex-shrink-0">
            {['👨‍🚀', '🤖', '👽', '👾'].map((em, i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-surface-elevated border border-white/10 flex items-center justify-center text-sm">
                {em}
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs font-bold text-white">14,832 Online Now</div>
            <div className="flex items-center gap-1 mt-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={10} fill="#FFD700" color="#FFD700" />
              ))}
              <span className="text-[10px] text-gray-500 ml-1">Rated 4.9/5</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN AUTH CONTENT
══════════════════════════════════════════ */
function AuthContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'login';

  const [tab, setTab] = useState(initialTab);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Verification & Reset states
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && t !== tab) { setTab(t); }
  }, [searchParams, tab]);

  useEffect(() => { setTurnstileToken(null); }, [tab]);

  const verifyDispatched = useRef(false);
  const guestLoginDispatched = useRef(false);

  useEffect(() => {
    const token = searchParams.get('token');
    if (tab === 'verify' && token && !verifyDispatched.current) {
      verifyDispatched.current = true;
      const verifyToken = async () => {
        setError(''); setSuccess(''); setLoading(true);
        try {
          const res = await fetch(getApiUrl('/api/auth/verify'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          });
          const data = await parseResponseJson(res);
          if (!res.ok) throw new Error(data.error || 'Verification failed');
          setSuccess(data.message || 'Email verified successfully! You can now log in.');
          router.replace('/auth?tab=login');
          setTab('login');
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      verifyToken();
    }
  }, [tab, searchParams, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await parseResponseJson(res);
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setSuccess(data.message || 'Verification email sent. Please check your inbox.');
      setUnverifiedEmail(email);
      setTab('verify-pending');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername: email || username, password }),
      });
      const data = await parseResponseJson(res);
      if (!res.ok) {
        if (data.unverified) {
          setUnverifiedEmail(data.email);
          setTab('verify-pending');
          throw new Error('Email verification required. Check inbox or request a new link below.');
        }
        throw new Error(data.error || 'Login failed');
      }
      localStorage.setItem('gravityx_token', data.token);
      localStorage.setItem('gravityx_user', JSON.stringify({
        id: data.user.id, username: data.user.username, email: data.user.email,
        coins: data.user.coins, xp: data.user.xp, level: data.user.level,
        rank: data.user.rank, avatar: data.user.avatar, profileFrame: data.user.profileFrame,
      }));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError(''); setSuccess(''); setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/guest'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await parseResponseJson(res);
      if (!res.ok) throw new Error(data.error || 'Guest login failed');
      localStorage.setItem('gravityx_token', data.token);
      localStorage.setItem('gravityx_user', JSON.stringify({
        id: data.user.id, username: data.user.username, isGuest: true,
        coins: data.user.coins, xp: data.user.xp, level: data.user.level,
        rank: data.user.rank, avatar: data.user.avatar, profileFrame: data.user.profileFrame,
      }));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
      setTab('login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'guest' && !guestLoginDispatched.current) {
      guestLoginDispatched.current = true;
      handleGuestLogin();
    }
  }, [tab]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setError(''); setSuccess(''); setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await parseResponseJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch reset link');
      setForgotSent(true);
      setSuccess(data.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    const token = searchParams.get('token');
    if (!token) { setError('Reset token is missing from the link'); return; }
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: newPassword }),
      });
      const data = await parseResponseJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      setSuccess(data.message || 'Password reset successfully! You can now log in.');
      router.replace('/auth?tab=login');
      setTab('login');
      setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setError(''); setSuccess(''); setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/resend-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: unverifiedEmail }),
      });
      const data = await parseResponseJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to resend link');
      setSuccess(data.message || 'Verification email resent successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (newTab: string) => {
    setTab(newTab); setError(''); setSuccess('');
  };

  const showHeaderTabs = tab === 'login' || tab === 'register';

  return (
    <div className="flex-1 flex items-stretch min-h-screen">
      {/* ── Left Art Panel ── */}
      <SideArtPanel />

      {/* ── Right Form Panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
        {/* Back to landing */}
        <Link
          href="/"
          className="absolute top-6 left-6 flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-white transition-colors group"
          aria-label="Back to home"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Deck
        </Link>

        {/* Form card */}
        <div className="w-full max-w-md animate-scale-in">
          {/* Mobile-only brand header */}
          <div className="flex items-center justify-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-cyberblue flex items-center justify-center shadow-neon-blue">
              <span className="font-extrabold text-white font-display text-sm">GX</span>
            </div>
            <span className="font-display font-extrabold text-xl text-holographic">GRAVITYX</span>
          </div>

          <div className="surface-elevated rounded-3xl p-8 relative overflow-hidden">
            {/* Top accent line */}
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-primary via-cyberblue to-cyberpink" />
            {/* Corner ambient glow */}
            <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-primary/15 blur-3xl pointer-events-none" />

            {/* ── Form Title ── */}
            {showHeaderTabs ? (
              <div className="text-center mb-7">
                <h1 className="font-display text-2xl font-bold text-white mb-1">
                  {tab === 'login' ? 'Welcome Back' : 'Join GravityX'}
                </h1>
                <p className="text-xs text-gray-500 uppercase tracking-widest">
                  {tab === 'login' ? 'Orbital Identity Sync' : 'Create Your Command Account'}
                </p>
              </div>
            ) : null}

            {/* ── Alerts ── */}
            {error && (
              <div className={`mb-5 p-4 rounded-xl bg-cybererror/10 border border-cybererror/30 text-cybererror text-sm flex items-center gap-3 ${error ? 'animate-shake' : ''}`}>
                <ShieldAlert size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="mb-5 p-4 rounded-xl bg-cybersuccess/10 border border-cybersuccess/30 text-cybersuccess text-sm flex items-center gap-3">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* ── Tab Switcher ── */}
            {showHeaderTabs && (
              <div className="flex rounded-2xl p-1 mb-7 gap-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {[
                  { id: 'login', label: t('login', 'Sign In') },
                  { id: 'register', label: t('createAccount', 'Register') },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => switchTab(item.id)}
                    id={`auth-tab-${item.id}`}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${tab === item.id
                        ? 'bg-gradient-to-r from-primary to-cyberblue text-white shadow-neon-blue'
                        : 'text-gray-500 hover:text-gray-300'
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {/* ══════════════════
                LOGIN FORM
            ══════════════════ */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-5">
                {/* Username / Email */}
                <div>
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block mb-2">
                    {t('emailOrUser', 'Username or Email')}
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input
                      id="login-email-input"
                      type="text"
                      required
                      autoComplete="username"
                      placeholder="Enter username or email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setUsername(e.target.value); }}
                      className="w-full pl-11 pr-4 py-3.5 rounded-xl glass-input text-sm"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">
                      {t('password', 'Password')}
                    </label>
                    <button
                      type="button"
                      onClick={() => switchTab('forgot')}
                      className="text-[10px] font-bold text-cyberblue hover:text-white transition-colors"
                    >
                      {t('forgotPassword', 'Forgot Password?')}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input
                      id="login-password-input"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-12 py-3.5 rounded-xl glass-input text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Turnstile */}
                {siteKey && (
                  <div className="flex justify-center my-2">
                    <Turnstile sitekey={siteKey} onVerify={(t) => setTurnstileToken(t)} />
                  </div>
                )}

                {/* Submit */}
                <button
                  id="login-submit-btn"
                  type="submit"
                  disabled={loading || (!!siteKey && !turnstileToken)}
                  className="w-full py-3.5 rounded-xl btn-primary text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <><SpinnerIcon /> <span>{t('verifying', 'Signing In...')}</span></> : <><Shield size={16} /> {t('login', 'Sign In')}</>}
                </button>

                {/* Divider */}
                <div className="relative flex items-center">
                  <div className="flex-grow h-px bg-white/[0.06]" />
                  <span className="mx-4 text-[10px] font-bold text-gray-600 uppercase tracking-widest">{t('guestSession', 'Or')}</span>
                  <div className="flex-grow h-px bg-white/[0.06]" />
                </div>

                {/* Guest CTA */}
                <button
                  id="login-guest-btn"
                  type="button"
                  onClick={handleGuestLogin}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl btn-ghost text-sm font-bold flex items-center justify-center gap-2 group disabled:opacity-50"
                >
                  <Rocket size={16} className="text-cyberpink group-hover:scale-110 transition-transform" />
                  <span>{t('startGuest', 'Play as Guest')}</span>
                </button>
              </form>
            )}

            {/* ══════════════════
                REGISTER FORM
            ══════════════════ */}
            {tab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-5">
                {/* Username */}
                <div>
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block mb-2">
                    {t('username', 'Username')}
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input
                      id="register-username-input"
                      type="text"
                      required
                      autoComplete="username"
                      placeholder="ChooseYourCallsign"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 rounded-xl glass-input text-sm"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block mb-2">
                    {t('email', 'Email Address')}
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input
                      id="register-email-input"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="name@station.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 rounded-xl glass-input text-sm"
                    />
                  </div>
                </div>

                {/* Password + Strength meter */}
                <div>
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block mb-2">
                    {t('password', 'Password')}
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input
                      id="register-password-input"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      placeholder="Minimum 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-12 py-3.5 rounded-xl glass-input text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <PasswordStrength password={password} />
                </div>

                {/* Turnstile */}
                {siteKey && (
                  <div className="flex justify-center my-2">
                    <Turnstile sitekey={siteKey} onVerify={(t) => setTurnstileToken(t)} />
                  </div>
                )}

                {/* Submit */}
                <button
                  id="register-submit-btn"
                  type="submit"
                  disabled={loading || (!!siteKey && !turnstileToken)}
                  className="w-full py-3.5 rounded-xl btn-primary text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <><SpinnerIcon /> <span>{t('registering', 'Creating Account...')}</span></> : <><Zap size={16} /> {t('createAccount', 'Create Command Account')}</>}
                </button>

                {/* Terms note */}
                <p className="text-center text-[10px] text-gray-600">
                  By registering you agree to our{' '}
                  <a href="#" className="text-cyberblue hover:underline">Terms of Use</a>{' '}
                  and{' '}
                  <a href="#" className="text-cyberblue hover:underline">Privacy Policy</a>
                </p>
              </form>
            )}

            {/* ══════════════════
                FORGOT PASSWORD
            ══════════════════ */}
            {tab === 'forgot' && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-xl font-bold text-white mb-1">Reset Password</h2>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Enter your registered email address. We&apos;ll send orbital reset telemetry to your inbox.
                  </p>
                </div>

                {forgotSent ? (
                  <div className="p-4 rounded-xl bg-cybersuccess/10 border border-cybersuccess/30 text-cybersuccess text-sm">
                    Reset link dispatched! Check your inbox for instructions.
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block mb-2">Email Address</label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                          id="forgot-email-input"
                          type="email" required placeholder="name@station.com"
                          value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                          className="w-full pl-11 pr-4 py-3.5 rounded-xl glass-input text-sm"
                        />
                      </div>
                    </div>
                    <button type="submit" disabled={loading} id="forgot-submit-btn"
                      className="w-full py-3.5 rounded-xl btn-primary text-sm font-bold disabled:opacity-50">
                      {loading ? 'Transmitting...' : 'Transmit Reset Link'}
                    </button>
                  </form>
                )}
                <button onClick={() => switchTab('login')} className="w-full text-center text-xs font-semibold text-gray-500 hover:text-white transition-colors py-2">
                  ← Return to Sign In
                </button>
              </div>
            )}

            {/* ══════════════════
                VERIFY PENDING
            ══════════════════ */}
            {tab === 'verify-pending' && (
              <div className="space-y-6 text-center">
                <div className="w-16 h-16 rounded-full bg-cyberblue/15 border border-cyberblue/30 flex items-center justify-center mx-auto">
                  <Mail size={28} className="text-cyberblue" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold text-white mb-2">Check Your Inbox</h2>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Verification link sent to{' '}
                    <span className="text-cyberblue font-bold">{unverifiedEmail}</span>.
                    Confirm your identity to authorize access.
                  </p>
                </div>
                <button id="resend-verify-btn" onClick={handleResendVerification} disabled={loading}
                  className="w-full py-3.5 rounded-xl btn-primary text-sm font-bold disabled:opacity-50">
                  {loading ? 'Re-sending...' : 'Resend Verification Link'}
                </button>
                <button onClick={() => switchTab('login')} className="w-full text-center text-xs font-semibold text-gray-500 hover:text-white transition-colors">
                  ← Return to Sign In
                </button>
              </div>
            )}

            {/* ══════════════════
                RESET PASSWORD
            ══════════════════ */}
            {tab === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div>
                  <h2 className="font-display text-xl font-bold text-white mb-1">New Password</h2>
                  <p className="text-xs text-gray-400">Overwrite your security parameters below.</p>
                </div>
                {['newPassword', 'confirmPassword'].map((field, i) => (
                  <div key={field}>
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block mb-2">
                      {i === 0 ? 'New Password' : 'Confirm New Password'}
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        id={`reset-${field}-input`}
                        type={showPassword ? 'text' : 'password'} required placeholder="••••••••"
                        value={i === 0 ? newPassword : confirmPassword}
                        onChange={(e) => i === 0 ? setNewPassword(e.target.value) : setConfirmPassword(e.target.value)}
                        className="w-full pl-11 pr-12 py-3.5 rounded-xl glass-input text-sm"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                ))}
                <button id="reset-submit-btn" type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl btn-primary text-sm font-bold disabled:opacity-50">
                  {loading ? 'Re-writing...' : 'Confirm Password Reset'}
                </button>
              </form>
            )}

            {/* ══════════════════
                LOADING STATES (verify, guest)
            ══════════════════ */}
            {(tab === 'verify' || tab === 'guest') && (
              <div className="flex flex-col items-center justify-center py-10 space-y-4">
                <div className="relative w-14 h-14">
                  <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-cyberblue animate-spin" />
                  <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-cyberpink animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {tab === 'verify' ? 'Verifying Identity Token...' : 'Deploying Guest Telemetry...'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-cyberblue animate-spin" />
        </div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-4">Syncing Auth Telemetry...</p>
      </div>
    }>
      <AuthContent />
    </Suspense>
  );
}
