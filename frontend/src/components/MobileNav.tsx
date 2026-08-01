'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Swords, ShoppingBag, Trophy, User } from 'lucide-react';

interface MobileNavProps {
  onOpenSocial?: () => void;
  unreadSocialCount?: number;
}

export default function MobileNav({ onOpenSocial, unreadSocialCount = 0 }: MobileNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      name: 'Home',
      href: '/',
      icon: LayoutDashboard,
      active: pathname === '/' || pathname === '/dashboard',
    },
    {
      name: 'Lobbies',
      href: '/dashboard',
      icon: Swords,
      active: pathname.startsWith('/dashboard') || pathname.startsWith('/room'),
    },
    {
      name: 'Store',
      href: '/store',
      icon: ShoppingBag,
      active: pathname.startsWith('/store'),
    },
    {
      name: 'Ranks',
      href: '/leaderboard',
      icon: Trophy,
      active: pathname.startsWith('/leaderboard'),
    },
    {
      name: 'Profile',
      href: '/profile',
      icon: User,
      active: pathname.startsWith('/profile'),
    },
  ];

  return (
    <nav 
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 mobile-nav-bar px-2 py-2 pb-safe"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.active;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all duration-200 min-tap-target touch-press relative ${
                isActive
                  ? 'text-cyberblue font-semibold scale-105'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {/* Top Active Glow Bar Indicator */}
              {isActive && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-7 h-1 bg-gradient-to-r from-cyberblue to-primary rounded-full shadow-[0_0_10px_#00F5FF]" />
              )}

              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-cyberblue filter drop-shadow-[0_0_8px_rgba(0,245,255,0.7)]' : ''}`} />
                {item.name === 'Profile' && unreadSocialCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-cyberpink text-[10px] font-bold text-white shadow-[0_0_8px_#FF5EDF]">
                    {unreadSocialCount > 9 ? '9+' : unreadSocialCount}
                  </span>
                )}
              </div>

              <span className="text-[11px] mt-1 tracking-tight">
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
