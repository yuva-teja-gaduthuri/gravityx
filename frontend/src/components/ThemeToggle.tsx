'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('gravityx_theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (document.documentElement.classList.contains('light')) {
      setTheme('light');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);

    const root = document.documentElement;
    if (nextTheme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
    localStorage.setItem('gravityx_theme', nextTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-3 rounded-xl glass-card border-white/10 text-gray-400 hover:text-white hover:border-cyberblue transition-all flex items-center justify-center"
      title={theme === 'dark' ? 'Activate Light Mode' : 'Activate Dark Mode'}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
