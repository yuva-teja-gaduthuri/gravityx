import type { Metadata } from 'next';
import { Outfit, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import '../styles/globals.css';

import SpaceBackground from '../components/SpaceBackground';
import { LanguageProvider } from '../hooks/useTranslation';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GravityX — Play Together. Anywhere. Anytime.',
  description: 'A premium real-time multiplayer gaming platform. Join private lobbies, compete in Cosmic Ludo, Chess, and Ramudu-Seetha with glassmorphic orbital aesthetics.',
  keywords: 'online multiplayer game, ludo online, chess online, social deduction game, GravityX, gaming platform',
  authors: [{ name: 'GravityX Systems' }],
  openGraph: {
    title: 'GravityX — Play Together. Anywhere. Anytime.',
    description: 'Premium real-time multiplayer gaming platform with Cosmic Ludo, Chess & Ramudu-Seetha.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" />
        <meta name="theme-color" content="#020B18" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('gravityx_theme') || 'dark';
                  document.documentElement.classList.add(theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased overflow-x-hidden min-h-screen relative">
        {/* Cinematic Space Background — multi-layer parallax */}
        <SpaceBackground />

        {/* Main Content — layered above background */}
        <LanguageProvider>
          <div className="relative z-10 flex flex-col min-h-screen">
            {children}
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
