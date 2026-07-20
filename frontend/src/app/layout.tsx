import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import '../styles/globals.css';

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
    <html lang="en" className={`${outfit.variable} dark`}>
      <body className="font-sans antialiased overflow-x-hidden min-h-screen relative">
        {/*Twinkling Stars Background Layer*/}
        <div className="star-bg">
          <div className="star" style={{ top: '10%', left: '15%', width: '2px', height: '2px', animationDuration: '3s' }}></div>
          <div className="star" style={{ top: '25%', left: '45%', width: '3px', height: '3px', animationDuration: '5s' }}></div>
          <div className="star" style={{ top: '40%', left: '80%', width: '1px', height: '1px', animationDuration: '4s' }}></div>
          <div className="star" style={{ top: '60%', left: '20%', width: '3px', height: '3px', animationDuration: '6s' }}></div>
          <div className="star" style={{ top: '75%', left: '65%', width: '2px', height: '2px', animationDuration: '3s' }}></div>
          <div className="star" style={{ top: '85%', left: '35%', width: '1px', height: '1px', animationDuration: '5s' }}></div>
          <div className="star" style={{ top: '92%', left: '85%', width: '2px', height: '2px', animationDuration: '4s' }}></div>
        </div>
        
        {/* Main Content Area */}
        <div className="relative z-10 flex flex-col min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
