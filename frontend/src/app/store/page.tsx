'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { getApiUrl } from '../../utils/api';
import { Coins, ArrowLeft, ShieldAlert, Sparkles, Check } from 'lucide-react';

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

  const [items, setItems] = useState<StoreItem[]>([]);
  const [activeTab, setActiveTab] = useState<'AVATAR' | 'DICE' | 'BOARD' | 'FRAME'>('AVATAR');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [storeLoading, setStoreLoading] = useState(false);

  // Fetch shop catalog
  const fetchStoreItems = async () => {
    const token = localStorage.getItem('gravityx_token');
    try {
      const res = await fetch(getApiUrl('/api/store/items'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
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
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest font-black">Decrypting Shop Matrix...</p>
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
    <div className="flex-grow p-6 md:p-8 max-w-5xl mx-auto w-full space-y-8 overflow-y-auto">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/dashboard')} 
            className="p-2.5 rounded-xl glass-card border-white/10 text-gray-400 hover:text-white hover:border-cyberblue transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <span className="text-[10px] uppercase font-bold text-cyberpink tracking-wider">personalization depot</span>
            <h2 className="text-3xl font-black text-white mt-0.5">Gravity Shop</h2>
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/5 shadow-inner">
          <Coins className="text-cybergold w-5 h-5" />
          <span className="text-lg font-black text-cybergold">{user.coins} 🪙</span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-cybererror/10 border border-cybererror/30 text-cybererror text-sm flex gap-3">
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-cybersuccess/10 border border-cybersuccess/30 text-cybersuccess text-sm flex gap-3">
          <Check size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* Tabs list */}
      <div className="flex rounded-2xl glass-panel p-1 border-white/5 max-w-md">
        {(['AVATAR', 'DICE', 'BOARD', 'FRAME'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setError(''); setSuccess(''); }}
            className={`flex-1 py-3 text-xs font-bold rounded-xl uppercase transition-all ${
              activeTab === tab ? 'bg-primary shadow-lg text-white font-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'AVATAR' ? 'Borders' : tab === 'DICE' ? 'Dices' : tab === 'BOARD' ? 'Boards' : 'Frames'}
          </button>
        ))}
      </div>

      {/* Catalog items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
        {filteredItems.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-gray-500 font-semibold">
            Catalog is empty. New blueprints arriving soon.
          </div>
        ) : (
          filteredItems.map((item) => {
            const isOwned = ownedIds.has(item.id);
            const activeEquip = isEquipped(item);

            return (
              <div 
                key={item.id} 
                className={`glass-card rounded-3xl p-5 border flex flex-col justify-between h-72 ${
                  activeEquip ? 'border-cyberblue shadow-neon-blue' : 'border-white/5'
                }`}
              >
                <div>
                  <div className="w-full h-32 rounded-2xl bg-white/5 flex items-center justify-center relative overflow-hidden border border-white/5 mb-4">
                    {/* Simulated skin icons */}
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center font-bold text-xl text-cyberblue border border-cyberblue/30 uppercase shadow-neon-blue">
                      {item.name[0]}
                    </div>
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-black/40 text-[9px] font-bold text-gray-400 uppercase">
                      {item.type}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-sm text-gray-200">{item.name}</h3>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                  {!isOwned ? (
                    <>
                      <span className="text-sm font-black text-cybergold flex items-center gap-1">
                        {item.price} 🪙
                      </span>
                      <button
                        onClick={() => handleBuy(item.id)}
                        disabled={storeLoading || user.coins < item.price}
                        className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all bg-primary hover:opacity-90 ${
                          user.coins < item.price ? 'opacity-30 cursor-default' : 'active:scale-95'
                        }`}
                      >
                        Buy Blueprint
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-cybersuccess flex items-center gap-1">
                        <Check size={12} /> Blueprint Owned
                      </span>
                      <button
                        onClick={() => handleEquip(item.identifier, item.type)}
                        disabled={storeLoading || activeEquip}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                          activeEquip 
                            ? 'bg-cyberblue/10 border border-cyberblue/30 text-cyberblue' 
                            : 'bg-white/5 hover:bg-white/10 text-white'
                        }`}
                      >
                        {activeEquip ? 'Equipped' : 'Equip Skin'}
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
