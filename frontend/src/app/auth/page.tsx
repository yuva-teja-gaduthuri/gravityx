'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail, User, ShieldAlert, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { getApiUrl } from '../../utils/api';

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'login';

  const [tab, setTab] = useState(initialTab);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Verification & Reset states
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Sync tab state from URL params
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && t !== tab) {
      setTab(t);
    }
  }, [searchParams, tab]);

  const verifyDispatched = useRef(false);

  // Handle auto email verification when entering /auth?tab=verify&token=XYZ
  useEffect(() => {
    const token = searchParams.get('token');
    if (tab === 'verify' && token && !verifyDispatched.current) {
      verifyDispatched.current = true;
      const verifyToken = async () => {
        setError('');
        setSuccess('');
        setLoading(true);
        try {
          const res = await fetch(getApiUrl('/api/auth/verify'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Verification failed');
          setSuccess(data.message || 'Email verified successfully! You can now log in.');
          
          // Clear URL search params to avoid infinite loops and re-verifying
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
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch(getApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();
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
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername: email || username, password }),
      });

      const data = await res.json();
      
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
    setSuccess('');
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
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
    setError('');
    setSuccess('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const token = searchParams.get('token');
    if (!token) {
      setError('Reset token is missing from the link');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      setSuccess(data.message || 'Password reset successfully! You can now log in.');
      
      // Clear URL search params to avoid token reuse and sync tab issues
      router.replace('/auth?tab=login');
      setTab('login');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/resend-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: unverifiedEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend link');
      setSuccess(data.message || 'Verification email resent successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const showHeaderTabs = tab === 'login' || tab === 'register';

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
      <Link href="/" className="absolute top-6 left-6 flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
        <ArrowLeft size={16} /> Back to Deck
      </Link>

      <div className="w-full max-w-md glass-panel rounded-3xl p-8 border-white/5 relative overflow-hidden shadow-neon-purple animate-fade-in">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-cyberblue to-cyberpink"></div>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold tracking-wider bg-gradient-to-r from-white via-cyberblue to-primary bg-clip-text text-transparent">
            GRAVITYX
          </h2>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">Orbital Identity Sync</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-cybererror/10 border border-cybererror/30 text-cybererror text-sm flex items-center gap-3 animate-shake">
            <ShieldAlert size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-xl bg-cybersuccess/10 border border-cybersuccess/30 text-cybersuccess text-sm flex items-center gap-3">
            <CheckCircle2 size={18} className="shrink-0 text-cybersuccess" />
            <span>{success}</span>
          </div>
        )}

        {/* Tab Selection */}
        {showHeaderTabs && (
          <div className="flex rounded-2xl glass-card p-1 mb-8 border-white/5">
            <button
              onClick={() => { setTab('login'); setError(''); setSuccess(''); }}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${tab === 'login' ? 'bg-primary shadow-lg text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('register'); setError(''); setSuccess(''); }}
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
                <button type="button" onClick={() => { setTab('forgot'); setError(''); setSuccess(''); }} className="text-xs text-cyberblue hover:underline">
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
                Reset link sent! If that email exists in our system, you will receive instructions shortly.
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
                  {loading ? 'Transmitting...' : 'Transmit Reset Link'}
                </button>
              </form>
            )}

            <button
              onClick={() => { setTab('login'); setForgotSent(false); setError(''); setSuccess(''); }}
              className="w-full py-3.5 text-center text-sm font-semibold text-gray-400 hover:text-white"
            >
              Return to Login Portal
            </button>
          </div>
        )}

        {/* Verification Pending Screen */}
        {tab === 'verify-pending' && (
          <div className="space-y-6 text-center">
            <h3 className="text-xl font-bold text-white mb-2">Identity Auth Required</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              We have sent a verification code to <span className="text-cyberblue font-bold">{unverifiedEmail}</span>. 
              Confirm your identity to authorize system login.
            </p>

            <button
              onClick={handleResendVerification}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-primary to-cyberblue hover:opacity-90 rounded-xl font-bold shadow-neon-blue transition-all disabled:opacity-50 text-sm"
            >
              {loading ? 'Re-sending...' : 'Resend Verification Link'}
            </button>

            <button
              onClick={() => { setTab('login'); setError(''); setSuccess(''); }}
              className="w-full py-3.5 text-center text-sm font-semibold text-gray-400 hover:text-white"
            >
              Return to Login Portal
            </button>
          </div>
        )}

        {/* Reset Password Form */}
        {tab === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <h3 className="text-xl font-bold text-white mb-2">Configure Credentials</h3>
            <p className="text-xs text-gray-400 leading-relaxed">Overwrite your credentials security parameters. Enter your new password below.</p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">New Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-3.5 text-gray-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl glass-input text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Confirm New Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-3.5 text-gray-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl glass-input text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-primary to-cyberpink hover:opacity-90 rounded-xl font-bold shadow-neon-pink transition-all disabled:opacity-50"
            >
              {loading ? 'Re-writing Parameters...' : 'Confirm Overwrite'}
            </button>
          </form>
        )}

        {/* Auto verification state loader */}
        {tab === 'verify' && (
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-cyberblue animate-spin"></div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Verifying Identity Token...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-cyberblue animate-spin mb-4"></div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest font-black">Syncing Auth Telemetry...</p>
      </div>
    }>
      <AuthContent />
    </Suspense>
  );
}
