'use client';

import { useEffect, useRef, useCallback } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  twinkleDuration: number;
  twinkleDelay: number;
  layer: 1 | 2 | 3; // 1=far, 2=mid, 3=near
  parallaxX: number;
  parallaxY: number;
}

interface ShootingStar {
  id: number;
  x: number;
  y: number;
  startTime: number;
}

export default function SpaceBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<Star[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const shootingStarCounterRef = useRef(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const animFrameRef = useRef<number>(0);
  const lastShootRef = useRef(Date.now());

  const generateStars = useCallback(() => {
    const stars: Star[] = [];
    const counts = { far: 180, mid: 80, near: 35 };

    // Far layer — tiny, dim
    for (let i = 0; i < counts.far; i++) {
      stars.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 1.2 + 0.3,
        opacity: Math.random() * 0.4 + 0.1,
        twinkleDuration: Math.random() * 4 + 2,
        twinkleDelay: Math.random() * 6,
        layer: 1,
        parallaxX: 0.01,
        parallaxY: 0.01,
      });
    }

    // Mid layer — medium brightness
    for (let i = 0; i < counts.mid; i++) {
      stars.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 1.8 + 0.8,
        opacity: Math.random() * 0.5 + 0.25,
        twinkleDuration: Math.random() * 3 + 1.5,
        twinkleDelay: Math.random() * 5,
        layer: 2,
        parallaxX: 0.025,
        parallaxY: 0.025,
      });
    }

    // Near layer — bright, larger
    for (let i = 0; i < counts.near; i++) {
      stars.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2.5 + 1.2,
        opacity: Math.random() * 0.6 + 0.4,
        twinkleDuration: Math.random() * 2.5 + 1,
        twinkleDelay: Math.random() * 4,
        layer: 3,
        parallaxX: 0.05,
        parallaxY: 0.05,
      });
    }

    return stars;
  }, []);

  useEffect(() => {
    starsRef.current = generateStars();

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Shooting star scheduler
    const scheduleShootingStar = () => {
      const now = Date.now();
      const elapsed = now - lastShootRef.current;

      // Fire every 7–14 seconds
      if (elapsed > 7000 + Math.random() * 7000) {
        lastShootRef.current = now;
        const id = ++shootingStarCounterRef.current;
        shootingStarsRef.current.push({
          id,
          x: Math.random() * 60 + 10,
          y: Math.random() * 40 + 5,
          startTime: now,
        });

        // Remove after animation completes
        setTimeout(() => {
          shootingStarsRef.current = shootingStarsRef.current.filter(s => s.id !== id);
        }, 1600);
      }
    };

    const interval = setInterval(scheduleShootingStar, 500);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearInterval(interval);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [generateStars]);

  return (
    <div
      ref={containerRef}
      className="star-bg"
      aria-hidden="true"
      style={{ zIndex: 0 }}
    >
      {/* Deep space base gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 30% 20%, rgba(108,99,255,0.08) 0%, transparent 55%), radial-gradient(ellipse at 70% 70%, rgba(0,245,255,0.06) 0%, transparent 55%)',
          pointerEvents: 'none',
        }}
      />

      {/* Nebula blobs — layer 1 (far, slow) */}
      <div
        className="nebula-blob"
        style={{
          width: '600px', height: '400px',
          left: '10%', top: '15%',
          background: 'radial-gradient(ellipse, rgba(108,99,255,0.12) 0%, rgba(108,99,255,0.04) 50%, transparent 70%)',
          animationDuration: '28s',
          animationDelay: '0s',
        }}
      />
      <div
        className="nebula-blob"
        style={{
          width: '500px', height: '350px',
          right: '5%', top: '40%',
          background: 'radial-gradient(ellipse, rgba(0,245,255,0.09) 0%, rgba(0,245,255,0.03) 50%, transparent 70%)',
          animationDuration: '35s',
          animationDelay: '-10s',
        }}
      />
      <div
        className="nebula-blob"
        style={{
          width: '700px', height: '450px',
          left: '35%', bottom: '10%',
          background: 'radial-gradient(ellipse, rgba(255,94,223,0.07) 0%, rgba(255,94,223,0.02) 50%, transparent 70%)',
          animationDuration: '40s',
          animationDelay: '-20s',
        }}
      />

      {/* Star layers rendered as individual elements */}
      <StarLayer stars={generateStarsData('far', 180)} mouseRef={mouseRef} parallaxStrength={0.01} />
      <StarLayer stars={generateStarsData('mid', 80)} mouseRef={mouseRef} parallaxStrength={0.025} />
      <StarLayer stars={generateStarsData('near', 35)} mouseRef={mouseRef} parallaxStrength={0.05} />

      {/* Shooting star DOM elements */}
      <ShootingStarLayer />
    </div>
  );
}

/* ---- Sub-components ---- */

function generateStarsData(layer: 'far' | 'mid' | 'near', count: number) {
  // Deterministic pseudo-random using seeded pattern
  const stars = [];
  const sizeMap = { far: [0.3, 1.4], mid: [0.8, 2.4], near: [1.2, 3.6] };
  const opacityMap = { far: [0.08, 0.45], mid: [0.25, 0.65], near: [0.4, 0.9] };
  const durationMap = { far: [3, 7], mid: [2, 5], near: [1.5, 4] };

  for (let i = 0; i < count; i++) {
    const seed = (i * 9301 + 49297) % 233280;
    const r = () => { return seed / 233280; };
    const r1 = ((i * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const r2 = ((i * 22695477 + 1) & 0x7fffffff) / 0x7fffffff;
    const r3 = ((i * 6364136223846793005 + 1442695040888963407) & 0x7fffffff) / 0x7fffffff;
    const r4 = ((i * 2862933555777941757 + 3037000493) & 0x7fffffff) / 0x7fffffff;
    const r5 = ((i * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff;

    const [sMin, sMax] = sizeMap[layer];
    const [oMin, oMax] = opacityMap[layer];
    const [dMin, dMax] = durationMap[layer];

    stars.push({
      id: `${layer}-${i}`,
      x: (r1 * 100),
      y: (r2 * 100),
      size: sMin + r3 * (sMax - sMin),
      opacity: oMin + r4 * (oMax - oMin),
      duration: dMin + r5 * (dMax - dMin),
      delay: r1 * 8,
    });
  }
  return stars;
}

interface StarData {
  id: string;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
}

function StarLayer({ stars, mouseRef, parallaxStrength }: {
  stars: StarData[];
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
  parallaxStrength: number;
}) {
  return (
    <>
      {stars.map(star => (
        <div
          key={star.id}
          className="star"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
            willChange: 'opacity, transform',
          }}
        />
      ))}
    </>
  );
}

function ShootingStarLayer() {
  // Shooting stars are managed via CSS animation; spawned periodically
  return (
    <div
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}
    >
      {/* Static shooting stars with staggered delays — CSS-only approach */}
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${15 + i * 25}%`,
            top: `${8 + i * 15}%`,
            width: '2px',
            height: '2px',
            background: 'white',
            borderRadius: '50%',
            opacity: 0,
            animation: `shootingStarSequence ${10 + i * 7}s ${i * 4}s linear infinite`,
            transform: 'rotate(-45deg)',
          }}
        >
          <div style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            transform: 'translateY(-50%)',
            width: '100px',
            height: '1px',
            background: 'linear-gradient(90deg, rgba(255,255,255,0.9), transparent)',
          }} />
        </div>
      ))}
      <style>{`
        @keyframes shootingStarSequence {
          0%, 92%, 100% { opacity: 0; transform: rotate(-45deg) translateX(0) translateY(0); }
          94% { opacity: 1; }
          99% { opacity: 0; transform: rotate(-45deg) translateX(350px) translateY(350px); }
        }
      `}</style>
    </div>
  );
}
