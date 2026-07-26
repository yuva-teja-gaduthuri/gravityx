'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getApiUrl, invalidateCache } from '../utils/api';

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  isGuest: boolean;
  coins: number;
  xp: number;
  level: number;
  rank: string;
  avatar: string;
  diceSkin: string;
  boardTheme: string;
  profileFrame: string;
  victoryEffect: string;
  role: 'USER' | 'ADMIN';
  bio?: string;
  language: string;
  createdAt: string;
}

export interface UserStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
}

let activeProfilePromise: Promise<any> | null = null;

export function useAuth(requireAuth = true) {
  const router = useRouter();
  
  // 1. Initialize state synchronously from localStorage to prevent empty flashes
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gravityx_user');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });

  const [stats, setStats] = useState<UserStats | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gravityx_stats');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });

  const [inventory, setInventory] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [matchHistory, setMatchHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 2. Fetch fresh profile from the server bypassing cache
  const fetchProfile = useCallback(async () => {
    const token = localStorage.getItem('gravityx_token');
    if (!token) {
      setLoading(false);
      if (requireAuth) router.push('/auth');
      return;
    }

    try {
      let activeToken = token;
      try {
        const refreshUrl = getApiUrl('/api/auth/refresh');
        const refreshRes = await fetch(refreshUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          activeToken = refreshData.token;
          localStorage.setItem('gravityx_token', activeToken);
        } else if (refreshRes.status === 401 || refreshRes.status === 403) {
          throw { status: refreshRes.status, message: 'Session expired' };
        }
      } catch (refreshErr: any) {
        if (refreshErr.status === 401 || refreshErr.status === 403) {
          throw refreshErr;
        }
        // Fail-open for other errors like server offline/network hiccups
      }

      if (!activeProfilePromise) {
        const url = getApiUrl('/api/auth/profile');
        activeProfilePromise = fetch(url, {
          headers: {
            Authorization: `Bearer ${activeToken}`,
            'Content-Type': 'application/json',
          },
        }).then((res) => {
          if (res.status === 401 || res.status === 403) {
            throw { status: res.status, message: 'Unauthorized' };
          }
          if (!res.ok) throw new Error(`Profile fetch failed status: ${res.status}`);
          return res.json();
        }).finally(() => {
          activeProfilePromise = null;
        });
      }

      const data = await activeProfilePromise;
      
      setUser(data.user);
      setStats(data.stats);
      setInventory(data.inventory || []);
      setAchievements(data.achievements || []);
      setMatchHistory(data.matchHistory || []);

      // Cache updated profile info locally
      localStorage.setItem('gravityx_user', JSON.stringify(data.user));
      localStorage.setItem('gravityx_stats', JSON.stringify(data.stats));
      
      // Dispatch sync event for active client hooks
      window.dispatchEvent(new Event('gravityx_user_updated'));
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      // ONLY clear credentials and redirect to auth if it is an authorization failure
      if (err.status === 401 || err.status === 403) {
        localStorage.removeItem('gravityx_token');
        localStorage.removeItem('gravityx_user');
        localStorage.removeItem('gravityx_stats');
        setUser(null);
        setStats(null);
        window.dispatchEvent(new Event('gravityx_user_updated'));
        if (requireAuth) router.push('/auth');
      }
    } finally {
      setLoading(false);
    }
  }, [router, requireAuth]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // 3. Keep hook states in sync in real-time across components and tabs
  useEffect(() => {
    const handleUserUpdate = () => {
      const savedUser = localStorage.getItem('gravityx_user');
      const savedStats = localStorage.getItem('gravityx_stats');
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {}
      }
      if (savedStats) {
        try {
          setStats(JSON.parse(savedStats));
        } catch (e) {}
      }
    };

    window.addEventListener('gravityx_user_updated', handleUserUpdate);
    window.addEventListener('storage', handleUserUpdate); // tab sync

    return () => {
      window.removeEventListener('gravityx_user_updated', handleUserUpdate);
      window.removeEventListener('storage', handleUserUpdate);
    };
  }, []);

  const logout = () => {
    invalidateCache('/api/auth/profile');
    localStorage.removeItem('gravityx_token');
    localStorage.removeItem('gravityx_user');
    localStorage.removeItem('gravityx_stats');
    setUser(null);
    setStats(null);
    window.dispatchEvent(new Event('gravityx_user_updated'));
    router.push('/auth');
  };

  const refreshProfile = useCallback(async () => {
    invalidateCache('/api/auth/profile');
    await fetchProfile();
  }, [fetchProfile]);

  return {
    user,
    stats,
    inventory,
    achievements,
    matchHistory,
    loading,
    logout,
    refreshProfile,
  };
}
