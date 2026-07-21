'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getApiUrl, fetchWithCache, invalidateCache } from '../utils/api';

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
  createdAt: string;
}

export interface UserStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
}

export function useAuth(requireAuth = true) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [matchHistory, setMatchHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    const token = localStorage.getItem('gravityx_token');
    if (!token) {
      setLoading(false);
      if (requireAuth) router.push('/auth');
      return;
    }

    try {
      const data = await fetchWithCache('/api/auth/profile', 30000); // 30s stale time
      setUser(data.user);
      setStats(data.stats);
      setInventory(data.inventory);
      setAchievements(data.achievements);
      setMatchHistory(data.matchHistory);

      // Cache updated user summary locally
      localStorage.setItem('gravityx_user', JSON.stringify(data.user));
    } catch (err) {
      console.error(err);
      localStorage.removeItem('gravityx_token');
      localStorage.removeItem('gravityx_user');
      if (requireAuth) router.push('/auth');
    } finally {
      setLoading(false);
    }
  }, [router, requireAuth]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const logout = () => {
    invalidateCache('/api/auth/profile');
    localStorage.removeItem('gravityx_token');
    localStorage.removeItem('gravityx_user');
    router.push('/');
  };

  return {
    user,
    stats,
    inventory,
    achievements,
    matchHistory,
    loading,
    logout,
    refreshProfile: fetchProfile,
  };
}
