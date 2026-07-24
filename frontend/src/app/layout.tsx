import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import '../styles/globals.css';

import SpaceBackground from '../components/SpaceBackground';

const outfit = Outfit({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: 'GravityX - Play Together. Anywhere. Anytime.',
  description: 'A premium, real-time multiplayer gaming platform featuring Ramudu-Seetha and Ludo with state of the art glassmorphism visual aesthetics.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={outfit.variable}>
      <head>
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
        {/* Interactive 3D Space Parallax Background */}
        <SpaceBackground />
        
        {/* Main Content Area */}
        <div className="relative z-10 flex flex-col min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
