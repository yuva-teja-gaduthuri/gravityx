'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { getApiUrl, fetchWithCache, invalidateCache } from '../../utils/api';
import { Coins, ArrowLeft, ShieldAlert, Check, User, Crown, Dices, Gamepad2, Sparkles } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'DICE' | 'BOARD' | 'FRAME' | 'AVATAR'>('DICE');
  const [boardSubFilter, setBoardSubFilter] = useState<'ALL' | 'LUDO' | 'CHESS'>('ALL');
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
        <p className="text-xs text-gray-500 uppercase tracking-widest font-black">{t('decryptingShop', 'Decrypting Shop Matrix...')}</p>
      </div>
    );
  }

  // Helper to categorize boards
  const isLudoBoard = (id: string) => ['ludo_king_royal', 'ludo_club_star', 'mpl_pro_cyber', 'neon_abyss', 'mahogany_vintage', 'void_station', 'neon_abyss_board'].includes(id);
  const isChessBoard = (id: string) => ['chesscom_green', 'chesscom_walnut', 'lichess_blue', 'chess24_synth', 'royal_marble'].includes(id);

  const filteredItems = items.filter((item) => {
    if (item.type !== activeTab) return false;
    if (activeTab === 'BOARD' && boardSubFilter !== 'ALL') {
      if (boardSubFilter === 'LUDO') return isLudoBoard(item.identifier);
      if (boardSubFilter === 'CHESS') return isChessBoard(item.identifier);
    }
    return true;
  });

  const ownedIds = new Set(inventory.map((inv) => inv.id));

  // Determine if item is currently equipped
  const isEquipped = (item: StoreItem) => {
    if (item.type === 'AVATAR') return user.avatar === item.identifier;
    if (item.type === 'DICE') return user.diceSkin === item.identifier;
    if (item.type === 'BOARD') return user.boardTheme === item.identifier;
    if (item.type === 'FRAME') return user.profileFrame === item.identifier;
    return false;
  };

  // Helper to get platform/brand tag
  const getBrandTag = (item: StoreItem) => {
    const id = item.identifier;
    if (id.includes('ludo_king')) return { label: 'Ludo King', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    if (id.includes('ludo_club')) return { label: 'Ludo Club', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    if (id.includes('mpl')) return { label: 'MPL Pro', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
    if (id.includes('chesscom')) return { label: 'Chess.com', color: 'bg-emerald-600/30 text-emerald-400 border-emerald-500/40' };
    if (id.includes('lichess')) return { label: 'Lichess', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' };
    if (id.includes('chess24')) return { label: 'Chess24', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
    if (isLudoBoard(id)) return { label: 'LUDO', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
    if (isChessBoard(id)) return { label: 'CHESS', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
    return null;
  };

  return (
    <div className="flex-grow p-3 sm:p-6 md:p-8 max-w-6xl mx-auto w-full space-y-4 sm:space-y-8 overflow-y-auto">
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
            <span className="text-[9px] sm:text-[10px] uppercase font-extrabold text-cyberpink tracking-wider block">
              {t('personalizationDepot', 'Personalization Depot')}
            </span>
            <h2 className="text-xl sm:text-3xl font-black text-white leading-tight flex items-center gap-2">
              <span>{t('gravityShop', 'Gravity Shop')}</span>
              <Sparkles className="w-5 h-5 text-cybergold animate-pulse" />
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-2xl bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-500/30 shadow-neon-gold shrink-0">
          <Coins className="text-cybergold w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-sm sm:text-lg font-black text-cybergold tracking-wide">{user.coins} 🪙</span>
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

      {/* Main Tabs list */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex rounded-2xl glass-panel p-1 border-white/10 w-full sm:w-auto overflow-x-auto no-scrollbar gap-1">
          {(['DICE', 'BOARD', 'FRAME', 'AVATAR'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setError(''); setSuccess(''); }}
              className={`flex-1 sm:flex-none px-4 py-2.5 text-xs font-black rounded-xl uppercase transition-all whitespace-nowrap flex items-center justify-center gap-2 ${
                activeTab === tab 
                  ? 'bg-gradient-to-r from-primary to-indigo-600 shadow-neon-blue text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab === 'DICE' && <Dices size={14} />}
              {tab === 'BOARD' && <Gamepad2 size={14} />}
              {tab === 'FRAME' && <Crown size={14} />}
              {tab === 'AVATAR' && <User size={14} />}
              <span>{tab === 'DICE' ? 'Dices' : tab === 'BOARD' ? 'Boards' : tab === 'FRAME' ? 'Frames' : 'Avatars'}</span>
            </button>
          ))}
        </div>

        {/* Board Sub-Filter (Ludo vs Chess) */}
        {activeTab === 'BOARD' && (
          <div className="flex rounded-xl bg-white/5 p-1 border border-white/10 text-xs font-bold gap-1 self-stretch sm:self-auto">
            {(['ALL', 'LUDO', 'CHESS'] as const).map((sub) => (
              <button
                key={sub}
                onClick={() => setBoardSubFilter(sub)}
                className={`px-3 py-1.5 rounded-lg transition-all text-[11px] font-extrabold uppercase ${
                  boardSubFilter === sub 
                    ? 'bg-cyberpink text-white shadow-neon-pink' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {sub === 'ALL' ? 'All Boards' : sub === 'LUDO' ? '🎲 Ludo King / Club' : '♟️ Chess.com'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Catalog items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredItems.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-gray-500 font-semibold glass-card rounded-2xl border-white/5">
            {t('shopEmpty', 'Catalog is empty for this category. New items coming soon!')}
          </div>
        ) : (
          filteredItems.map((item) => {
            const isOwned = ownedIds.has(item.id);
            const activeEquip = isEquipped(item);
            const brandTag = getBrandTag(item);

            return (
              <div 
                key={item.id} 
                className={`glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 border flex flex-col justify-between h-full transition-all hover:border-white/20 relative group overflow-hidden ${
                  activeEquip ? 'border-cyberblue shadow-neon-blue ring-1 ring-cyberblue/50' : 'border-white/10'
                }`}
              >
                <div>
                  {/* Item Image / Render Area */}
                  <div className="w-full h-36 sm:h-44 rounded-2xl bg-gradient-to-b from-white/10 to-white/5 flex items-center justify-center relative overflow-hidden border border-white/10 mb-3 shadow-inner">
                    
                    {/* Brand / Game Tag Badge */}
                    {brandTag && (
                      <span className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider ${brandTag.color}`}>
                        {brandTag.label}
                      </span>
                    )}

                    {/* Category Tag Badge */}
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-extrabold text-gray-300 uppercase tracking-wider border border-white/10">
                      {item.type}
                    </span>

                    {/* Custom Visual Renderers */}
                    {(() => {
                      const type = item.type;
                      const id = item.identifier;

                      // AVATAR PREVIEWS
                      if (type === 'AVATAR') {
                        const avatarEmojis: { [key: string]: string } = {
                          cyber_pilot: '👨‍🚀', nebula_ghost: '👾', cosmic_emperor: '👑', grandmaster_knight: '🐴', alien_warlord: '👽', supernova_titan: '💥', android_vanguard: '🤖', galactic_ranger: '🌌', starship_captain: '🚀', void_stalker: '🕳️', solar_sentinel: '☀️', archmage_merlin: '🧙‍♂️', enchantress_sorceress: '🧙‍♀️', spellbound_scholar: '📜', phoenix_summoner: '🦅', crystal_alchemist: '🔮', shadow_necromancer: '💀', celestial_astrologer: '✨', mystic_druid: '🌿', arcane_illusionist: '🎭', rune_warden: '🛡️', sovereign_chess_king: '♔', imperial_chess_queen: '♕', iron_fortress_rook: '♖', battle_bishop: '♗', brave_vanguard_pawn: '♙', wizard_chess_golem: '🗿', chess_strategist: '🧠', speed_blitz_master: '⚡', checkmate_champion: '🏆', ludo_king_monarch: '🤴', ludo_queen_empress: '👸', golden_dice_roller: '🎲', lucky_six_legend: '🍀', crimson_general: '🔴', emerald_pathfinder: '🟢', sapphire_voyager: '🔵', amber_conqueror: '🟡', royal_court_jester: '🃏', champion_realm: '🥇', infernal_dragon: '🐉', royal_lion_heart: '🦁', shadow_ninja: '🥷', cyberpunk_samurai: '⚔️', golden_eagle: '🦅', frost_wolf: '🐺', thunder_falcon: '⚡', cyber_panther: '🐆', cosmic_valkyrie: '🛡️', omega_overlord: '🔱', quantum_hacker: '💻', master_tactician: '🎯'
                        };
                        let emoji = avatarEmojis[id];
                        if (!emoji) {
                          if (id.includes('dragon')) emoji = '🐉';
                          else if (id.includes('phoenix')) emoji = '🦅';
                          else if (id.includes('samurai') || id.includes('striker')) emoji = '⚔️';
                          else if (id.includes('warlock') || id.includes('archon')) emoji = '🧙‍♂️';
                          else if (id.includes('phantom') || id.includes('assassin')) emoji = '🥷';
                          else if (id.includes('titan') || id.includes('templar')) emoji = '🛡️';
                          else if (id.includes('guardian') || id.includes('vanguard')) emoji = '🤖';
                          else if (id.includes('starlight') || id.includes('astra')) emoji = '✨';
                          else if (id.includes('cosmo') || id.includes('nebula')) emoji = '🌌';
                          else emoji = '🛸';
                        }
                        return (
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/20 border-2 border-cyberpink flex items-center justify-center text-3xl sm:text-4xl shadow-neon-pink transform group-hover:scale-110 transition-transform">
                            {emoji}
                          </div>
                        );
                      }

                      // DICE PREVIEWS
                      if (type === 'DICE') {
                        let bgGrad = 'bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-900 border-cyberblue text-white shadow-neon-blue';
                        if (id.includes('red') || id.includes('ruby') || id.includes('fire') || id.includes('inferno')) {
                          bgGrad = 'bg-gradient-to-br from-red-600 via-red-700 to-red-950 border-amber-400 text-yellow-300 shadow-lg shadow-red-900/60';
                        } else if (id.includes('emerald') || id.includes('green') || id.includes('blitz')) {
                          bgGrad = 'bg-gradient-to-br from-emerald-600 via-green-700 to-green-950 border-emerald-300 text-amber-200 shadow-lg shadow-emerald-900/50';
                        } else if (id.includes('gold') || id.includes('titan') || id.includes('solar')) {
                          bgGrad = 'bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-800 border-yellow-200 text-slate-950 shadow-neon-gold';
                        } else if (id.includes('purple') || id.includes('amethyst') || id.includes('plasma') || id.includes('void')) {
                          bgGrad = 'bg-gradient-to-br from-fuchsia-600 via-purple-700 to-slate-950 border-cyan-400 text-cyan-300 shadow-neon-pink';
                        } else if (id.includes('diamond') || id.includes('crystal') || id.includes('frost') || id.includes('lunar')) {
                          bgGrad = 'bg-gradient-to-br from-sky-300 via-cyan-400 to-blue-700 border-white text-white shadow-lg shadow-sky-500/50';
                        }

                        return (
                          <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 flex items-center justify-center text-3xl font-black transform group-hover:rotate-6 transition-transform ${bgGrad}`}>
                            ⚅
                          </div>
                        );
                      }

                      // BOARD PREVIEWS (Ludo & Chess)
                      if (type === 'BOARD') {
                        const isLudoStyle = id.includes('ludo') || id.includes('cyber') || id.includes('abyss') || id.includes('star') || id.includes('lava') || id.includes('frost');
                        if (isLudoStyle) {
                          return (
                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-950 border-2 border-amber-400 p-1.5 grid grid-cols-2 gap-1.5 shadow-neon-gold">
                              <div className="bg-red-600 rounded-lg flex items-center justify-center text-white text-[10px] font-black border border-amber-300/40">🔴</div>
                              <div className="bg-green-600 rounded-lg flex items-center justify-center text-white text-[10px] font-black border border-amber-300/40">🟢</div>
                              <div className="bg-blue-600 rounded-lg flex items-center justify-center text-white text-[10px] font-black border border-amber-300/40">🔵</div>
                              <div className="bg-yellow-500 rounded-lg flex items-center justify-center text-white text-[10px] font-black border border-amber-300/40">🟡</div>
                            </div>
                          );
                        }

                        let darkColor = 'bg-[#769656]';
                        let lightColor = 'bg-[#eeeed2]';
                        let boardBorder = 'border-emerald-500 shadow-emerald-950/60';

                        if (id.includes('walnut') || id.includes('wood') || id.includes('mahogany')) {
                          darkColor = 'bg-[#b58863]';
                          lightColor = 'bg-[#f0d9b5]';
                          boardBorder = 'border-amber-700 shadow-amber-950/60';
                        } else if (id.includes('blue') || id.includes('slate') || id.includes('sky')) {
                          darkColor = 'bg-[#5b8bb0]';
                          lightColor = 'bg-[#dee3e6]';
                          boardBorder = 'border-sky-400 shadow-sky-950/60';
                        } else if (id.includes('synth') || id.includes('neon') || id.includes('violet')) {
                          darkColor = 'bg-[#2d124d]';
                          lightColor = 'bg-[#00f0ff]/30';
                          boardBorder = 'border-cyan-400 shadow-neon-pink';
                        } else if (id.includes('marble') || id.includes('gold') || id.includes('royal')) {
                          darkColor = 'bg-[#1a1a24] text-amber-300';
                          lightColor = 'bg-[#e2e8f0] text-slate-900';
                          boardBorder = 'border-amber-300 shadow-neon-gold';
                        }

                        return (
                          <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 grid grid-cols-4 grid-rows-4 overflow-hidden shadow-lg ${boardBorder}`}>
                            {[...Array(16)].map((_, i) => {
                              const row = Math.floor(i / 4);
                              const col = i % 4;
                              const isDark = (row + col) % 2 === 1;
                              return (
                                <div key={i} className={`w-full h-full flex items-center justify-center text-[10px] ${isDark ? darkColor : lightColor}`}>
                                  {i === 2 ? '♟' : i === 13 ? '♞' : ''}
                                </div>
                              );
                            })}
                          </div>
                        );
                      }

                      // FRAME PREVIEWS
                      if (type === 'FRAME') {
                        let frameBorder = 'border-cyberblue ring-cyberblue/40 bg-cyberblue/10 shadow-neon-blue';
                        let badgeIcon = '✨';

                        if (id.includes('crown') || id.includes('laurel') || id.includes('gold') || id.includes('sovereign')) {
                          frameBorder = 'border-amber-400 ring-yellow-500/40 bg-amber-950/40 shadow-neon-gold';
                          badgeIcon = '👑';
                        } else if (id.includes('pink') || id.includes('event') || id.includes('dragon') || id.includes('burst')) {
                          frameBorder = 'border-cyberpink ring-cyberpink/40 bg-cyberpink/10 shadow-neon-pink';
                          badgeIcon = '🔥';
                        } else if (id.includes('diamond') || id.includes('crest') || id.includes('shield')) {
                          frameBorder = 'border-sky-300 ring-cyan-400/50 bg-sky-950/40 shadow-lg shadow-sky-400/60';
                          badgeIcon = '💎';
                        } else if (id.includes('emerald') || id.includes('phoenix') || id.includes('star')) {
                          frameBorder = 'border-emerald-400 ring-emerald-500/40 bg-emerald-950/40 shadow-lg shadow-emerald-500/50';
                          badgeIcon = '🌿';
                        }

                        return (
                          <div className="relative flex items-center justify-center">
                            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 ring-4 flex items-center justify-center ${frameBorder}`}>
                              <User className="text-white w-6 h-6 sm:w-8 sm:h-8" />
                            </div>
                            <div className="absolute -top-3.5 text-2xl filter drop-shadow-md">
                              {badgeIcon}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center font-bold text-xl text-cyberblue border border-cyberblue/30 uppercase shadow-neon-blue">
                          {item.name[0]}
                        </div>
                      );
                    })()}
                  </div>

                  <h3 className="font-extrabold text-sm sm:text-base text-gray-100 truncate group-hover:text-cyberblue transition-colors">
                    {item.name}
                  </h3>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mt-4 pt-3 border-t border-white/10">
                  {!isOwned ? (
                    <>
                      <span className="text-sm sm:text-base font-black text-cybergold flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-cybergold" />
                        <span>{item.price}</span>
                      </span>
                      <button
                        onClick={() => handleBuy(item.id)}
                        disabled={storeLoading || user.coins < item.price}
                        className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-black text-white transition-all bg-gradient-to-r from-primary to-indigo-600 hover:brightness-110 shadow-neon-blue ${
                          user.coins < item.price ? 'opacity-40 cursor-not-allowed' : 'active:scale-95'
                        }`}
                      >
                        {t('buyBtn', 'Unlock Item')}
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-cybersuccess flex items-center gap-1.5 truncate">
                        <Check className="w-4 h-4 shrink-0 text-cybersuccess" /> 
                        <span className="truncate">{t('itemOwned', 'Unlocked')}</span>
                      </span>
                      <button
                        onClick={() => handleEquip(item.identifier, item.type)}
                        disabled={storeLoading || activeEquip}
                        className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-black transition-all ${
                          activeEquip 
                            ? 'bg-cyberblue/20 border border-cyberblue text-cyberblue shadow-neon-blue cursor-default' 
                            : 'bg-white/10 hover:bg-white/20 text-white border border-white/10 active:scale-95'
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
