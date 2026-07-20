'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { ArrowLeft, Volume2, ShieldAlert, Check, HelpCircle, Lock } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const { user, refreshProfile, loading } = useAuth(true);

  const [music, setMusic] = useState(true);
  const [sound, setSound] = useState(true);
  const [volume, setVolume] = useState(80);
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState('English');
  const [privacy, setPrivacy] = useState('Public');
  const [success, setSuccess] = useState('');

  const handleSave = () => {
    setSuccess('Settings cached in terminal logs.');
    setTimeout(() => setSuccess(''), 3000);
  };

  if (loading || !user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-cyberblue animate-spin mb-4"></div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest font-black">decrypting config logs...</p>
      </div>
    );
  }

  return (
    <div className="flex-grow p-6 md:p-8 max-w-2xl mx-auto w-full space-y-8 overflow-y-auto">
      {/* Header controls */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => router.push('/dashboard')} 
          className="p-2.5 rounded-xl glass-card border-white/10 text-gray-400 hover:text-white hover:border-cyberblue transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <span className="text-[10px] uppercase font-bold text-cyberblue tracking-wider">telemetry configuration</span>
          <h2 className="text-3xl font-black text-white mt-0.5">Lobby Settings</h2>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-cybersuccess/10 border border-cybersuccess/30 text-cybersuccess text-sm flex gap-3">
          <Check size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* Settings Options container */}
      <div className="glass-panel rounded-3xl p-6 border-white/5 space-y-6">
        
        {/* Audio section */}
        <div className="space-y-4">
          <h3 className="text-sm uppercase font-extrabold text-cyberpink tracking-wider flex items-center gap-2">
            <Volume2 size={18} /> Audio Telemetry
          </h3>

          <div className="space-y-4 pt-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-bold text-gray-200">Ambient Background Music</span>
              <button 
                onClick={() => setMusic(!music)}
                className={`w-12 h-6 rounded-full p-1 transition-all ${music ? 'bg-primary' : 'bg-white/10'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-all ${music ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="font-bold text-gray-200">Interactive Game Sound Effects</span>
              <button 
                onClick={() => setSound(!sound)}
                className={`w-12 h-6 rounded-full p-1 transition-all ${sound ? 'bg-primary' : 'bg-white/10'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-all ${sound ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs font-bold text-gray-400">
                <span>Console Volume</span>
                <span>{volume}%</span>
              </div>
              <input 
                type="range" 
                min={0} 
                max={100}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-white/5 my-6"></div>

        {/* System telemetry section */}
        <div className="space-y-4">
          <h3 className="text-sm uppercase font-extrabold text-cyberblue tracking-wider flex items-center gap-2">
            <Lock size={18} /> Comms & Privacy
          </h3>

          <div className="space-y-4 pt-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-bold text-gray-200">Desktop Notifications</span>
              <button 
                onClick={() => setNotifications(!notifications)}
                className={`w-12 h-6 rounded-full p-1 transition-all ${notifications ? 'bg-primary' : 'bg-white/10'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-all ${notifications ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="font-bold text-gray-200">Lobby Language</span>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="glass-input rounded-xl px-3 py-1.5 text-xs focus:border-cyberblue"
              >
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="Hindi">Hindi</option>
                <option value="Telugu">Telugu</option>
              </select>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="font-bold text-gray-200">Profile Visibility</span>
              <select 
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value)}
                className="glass-input rounded-xl px-3 py-1.5 text-xs focus:border-cyberblue"
              >
                <option value="Public">Public (Global Leaderboards)</option>
                <option value="Friends">Friends Only</option>
                <option value="Private">Private</option>
              </select>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <button
            onClick={handleSave}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-primary via-cyberblue to-primary bg-[size:200%] hover:bg-[100%] font-bold shadow-neon-blue transition-all active:scale-[0.99]"
          >
            Save Telemetry Settings
          </button>
        </div>
      </div>
    </div>
  );
}
