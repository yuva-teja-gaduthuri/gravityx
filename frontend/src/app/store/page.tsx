'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { getApiUrl, fetchWithCache, invalidateCache } from '../../utils/api';
import { Coins, ArrowLeft, ShieldAlert, Sparkles, Check, User } from 'lucide-react';

interface StoreItem {
  id: string;
  type: 'AVATAR' | 'DICE' | 'BOARD' | 'FRAME';
  name: string;
  identifier: string;
  price: number;
  imageUrl: string;
}

export default function StorePage() {
  const router = useRouter();
  const { user, inventory, refreshProfile, loading } = useAuth(true);
  const { t } = useTranslation();

  const [items, setItems] = useState<StoreItem[]>([]);
  const [activeTab, setActiveTab] = useState<'AVATAR' | 'DICE' | 'BOARD' | 'FRAME'>('AVATAR');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [storeLoading, setStoreLoading] = useState(false);

  // Fetch shop catalog
  const fetchStoreItems = async () => {
    try {
      const data = await fetchWithCache('/api/store/items', 120000); // 2-minute staleTime
      setItems(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchStoreItems();
    }
  }, [user]);

  const handleBuy = async (itemId: string) => {
    setError('');
    setSuccess('');
    setStoreLoading(true);
    const token = localStorage.getItem('gravityx_token');

    try {
      const res = await fetch(getApiUrl('/api/store/buy'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ itemId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete transaction');

      setSuccess('Item added to inventory!');
      invalidateCache('/api/auth/profile');
      refreshProfile(); // Refresh coins and inventory
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStoreLoading(false);
    }
  };

  const handleEquip = async (identifier: string, type: string) => {
    setError('');
    setSuccess('');
    setStoreLoading(true);
    const token = localStorage.getItem('gravityx_token');

    try {
      const res = await fetch(getApiUrl('/api/store/equip'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ identifier, type }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to equip item');

      setSuccess('Item equipped successfully!');
      invalidateCache('/api/auth/profile');
      refreshProfile();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStoreLoading(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-cyberblue animate-spin mb-4"></div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest font-black">{t('decryptingShop', 'Decrypting Shop Matrix...')}</p>
      </div>
    );
  }

  const filteredItems = items.filter((item) => item.type === activeTab);
  const ownedIds = new Set(inventory.map((inv) => inv.id));

  // Determine if item is currently equipped
  const isEquipped = (item: StoreItem) => {
    if (item.type === 'AVATAR') return user.avatar === item.identifier;
    if (item.type === 'DICE') return user.diceSkin === item.identifier;
    if (item.type === 'BOARD') return user.boardTheme === item.identifier;
    if (item.type === 'FRAME') return user.profileFrame === item.identifier;
    return false;
  };

  return (
    <div className="flex-grow p-3 sm:p-6 md:p-8 max-w-5xl mx-auto w-full space-y-4 sm:space-y-8 overflow-y-auto">
      {/* Header controls */}
      <div className="flex flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button 
            onClick={() => router.push('/dashboard')} 
            className="p-2 sm:p-2.5 rounded-xl glass-card border-white/10 text-gray-400 hover:text-white hover:border-cyberblue transition-all"
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <span className="text-[9px] sm:text-[10px] uppercase font-extrabold text-cyberpink tracking-wider block">{t('personalizationDepot', 'personalization depot')}</span>
            <h2 className="text-xl sm:text-3xl font-black text-white leading-tight">{t('gravityShop', 'Gravity Shop')}</h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-xl bg-white/5 border border-white/10 shadow-inner shrink-0">
          <Coins className="text-cybergold w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-sm sm:text-lg font-black text-cybergold">{user.coins} 🪙</span>
        </div>
      </div>

      {error && (
        <div className="p-3 sm:p-4 rounded-xl bg-cybererror/10 border border-cybererror/30 text-cybererror text-xs sm:text-sm flex gap-3 items-center">
          <ShieldAlert size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 sm:p-4 rounded-xl bg-cybersuccess/10 border border-cybersuccess/30 text-cybersuccess text-xs sm:text-sm flex gap-3 items-center">
          <Check size={18} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Tabs list */}
      <div className="flex rounded-2xl glass-panel p-1 border-white/5 max-w-md w-full overflow-x-auto no-scrollbar gap-1">
        {(['AVATAR', 'DICE', 'BOARD', 'FRAME'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setError(''); setSuccess(''); }}
            className={`flex-1 min-w-[68px] py-2 sm:py-3 px-2 text-[11px] sm:text-xs font-bold rounded-xl uppercase transition-all whitespace-nowrap ${
              activeTab === tab ? 'bg-primary shadow-lg text-white font-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'AVATAR' ? t('itemBorders', 'Borders') : tab === 'DICE' ? t('itemDice', 'Dices') : tab === 'BOARD' ? t('itemBoards', 'Boards') : t('itemFrames', 'Frames')}
          </button>
        ))}
      </div>

      {/* Catalog items */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
        {filteredItems.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-gray-500 font-semibold">
            {t('shopEmpty', 'Catalog is empty. New blueprints arriving soon.')}
          </div>
        ) : (
          filteredItems.map((item) => {
            const isOwned = ownedIds.has(item.id);
            const activeEquip = isEquipped(item);

            return (
              <div 
                key={item.id} 
                className={`glass-card rounded-2xl sm:rounded-3xl p-3 sm:p-5 border flex flex-col justify-between h-full min-h-[220px] sm:min-h-[280px] transition-all hover:border-white/20 ${
                  activeEquip ? 'border-cyberblue shadow-neon-blue' : 'border-white/5'
                }`}
              >
                <div>
                  <div className="w-full h-24 sm:h-32 rounded-xl sm:rounded-2xl bg-white/5 flex items-center justify-center relative overflow-hidden border border-white/5 mb-2.5 sm:mb-4">
                    {(() => {
                      const type = item.type;
                      const id = item.identifier;

                      if (type === 'AVATAR') {
                        const avatarEmojis: { [key: string]: string } = {
                          astronaut: '👨‍🚀',
                          cyborg: '🤖',
                          alien: '👽',
                          nebula: '🌌',
                          cyberpunk: '👾'
                        };
                        const emoji = avatarEmojis[id] || '🛸';
                        return (
                          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/10 border-2 border-cyberpink flex items-center justify-center text-2xl sm:text-3xl shadow-neon-pink">
                            {emoji}
                          </div>
                        );
                      }

                      if (type === 'DICE') {
                        const colors: { [key: string]: string } = {
                          neon_red: 'border-cybererror bg-cybererror/10 text-cybererror shadow-neon-error',
                          neon_blue: 'border-cyberblue bg-cyberblue/10 text-cyberblue shadow-neon-blue',
                          gold_luxe: 'border-cybergold bg-cybergold/10 text-cybergold shadow-neon-gold'
                        };
                        const colorClass = colors[id] || 'border-cyberblue bg-cyberblue/10 text-cyberblue shadow-neon-blue';
                        return (
                          <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl border-2 flex items-center justify-center font-black text-xl sm:text-2xl ${colorClass}`}>
                            ⚅
                          </div>
                        );
                      }

                      if (type === 'BOARD') {
                        const boardThemes: { [key: string]: string } = {
                          cosmo_dark: 'from-[#050816] to-[#0b0f19] border-cyberblue/40 shadow-neon-blue',
                          neon_light: 'from-white to-[#f4f6fc] border-[#6C63FF]/30 text-darkbg shadow-lg',
                          retro_synth: 'from-[#1e0b36] to-[#050014] border-cyberpink/40 shadow-neon-pink'
                        };
                        const bg = boardThemes[id] || 'from-[#050816] to-[#0b0f19] border-cyberblue/40';
                        return (
                          <div className={`w-14 h-14 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl bg-gradient-to-br border p-1 grid grid-cols-2 gap-1 ${bg}`}>
                            <div className="bg-[#ff3b30] rounded-sm opacity-80"></div>
                            <div className="bg-[#34c759] rounded-sm opacity-80"></div>
                            <div className="bg-[#007aff] rounded-sm opacity-80"></div>
                            <div className="bg-[#ffcc00] rounded-sm opacity-80"></div>
                          </div>
                        );
                      }

                      if (type === 'FRAME') {
                        const frames: { [key: string]: string } = {
                          neon_glow: 'border-cyberblue shadow-neon-blue animate-pulse',
                          event_horizon: 'border-cyberpink shadow-neon-pink animate-pulse',
                          gold_crest: 'border-cybergold shadow-neon-gold'
                        };
                        const border = frames[id] || 'border-white/20';
                        return (
                          <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full border-4 flex items-center justify-center bg-white/5 ${border}`}>
                            <User className="text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                        );
                      }

                      return (
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/20 flex items-center justify-center font-bold text-lg sm:text-xl text-cyberblue border border-cyberblue/30 uppercase shadow-neon-blue">
                          {item.name[0]}
                        </div>
                      );
                    })()}
                    <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 px-1.5 py-0.5 rounded-md sm:rounded-lg bg-black/50 backdrop-blur-md text-[8px] sm:text-[9px] font-extrabold text-gray-300 uppercase tracking-wider">
                      {item.type}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-xs sm:text-sm text-gray-200 truncate">{item.name}</h3>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-3 pt-2.5 sm:pt-3 border-t border-white/5">
                  {!isOwned ? (
                    <>
                      <span className="text-xs sm:text-sm font-black text-cybergold flex items-center gap-1">
                        {item.price} 🪙
                      </span>
                      <button
                        onClick={() => handleBuy(item.id)}
                        disabled={storeLoading || user.coins < item.price}
                        className={`w-full sm:w-auto px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold text-white transition-all bg-primary hover:opacity-90 ${
                          user.coins < item.price ? 'opacity-30 cursor-default' : 'active:scale-95'
                        }`}
                      >
                        {t('buyBtn', 'Buy Blueprint')}
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] sm:text-xs font-bold text-cybersuccess flex items-center gap-1 truncate">
                        <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> <span className="truncate">{t('itemOwned', 'Owned')}</span>
                      </span>
                      <button
                        onClick={() => handleEquip(item.identifier, item.type)}
                        disabled={storeLoading || activeEquip}
                        className={`w-full sm:w-auto px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black transition-all ${
                          activeEquip 
                            ? 'bg-cyberblue/10 border border-cyberblue/30 text-cyberblue' 
                            : 'bg-white/5 hover:bg-white/10 text-white'
                        }`}
                      >
                        {activeEquip ? t('equipped', 'Equipped') : t('equipBtn', 'Equip')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
