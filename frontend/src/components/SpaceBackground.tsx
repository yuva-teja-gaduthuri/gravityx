'use client';

import { useEffect, useRef } from 'react';

export default function SpaceBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Mouse movement parallax offset
    let mouseX = 0;
    let mouseY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX - window.innerWidth / 2) * 0.04;
      mouseY = (e.clientY - window.innerHeight / 2) * 0.04;
    };
    window.addEventListener('mousemove', handleMouseMove);

    class Star {
      x: number;
      y: number;
      z: number;
      color: string;

      constructor() {
        this.x = Math.random() * width - width / 2;
        this.y = Math.random() * height - height / 2;
        this.z = Math.random() * width;
        this.color = Math.random() > 0.5 ? '#6C63FF' : '#FF5EDF';
      }

      update() {
        this.z -= 1.0;
        if (this.z <= 0) {
          this.z = width;
          this.x = Math.random() * width - width / 2;
          this.y = Math.random() * height - height / 2;
        }
      }

      draw(c: CanvasRenderingContext2D, isLightMode: boolean) {
        const px = (this.x / this.z) * width + width / 2 + mouseX;
        const py = (this.y / this.z) * height + height / 2 + mouseY;
        const size = (1 - this.z / width) * 3.5;

        if (px >= 0 && px <= width && py >= 0 && py <= height) {
          c.fillStyle = isLightMode 
            ? (this.color === '#6C63FF' ? '#4A42FF' : '#D122AC') 
            : this.color;
          c.beginPath();
          c.arc(px, py, size, 0, Math.PI * 2);
          c.fill();
        }
      }
    }

    const stars = Array.from({ length: 150 }, () => new Star());

    const renderLoop = () => {
      const isLightMode = document.documentElement.classList.contains('light');
      ctx.fillStyle = isLightMode ? 'rgba(244, 246, 252, 0.2)' : 'rgba(5, 8, 22, 0.2)';
      ctx.fillRect(0, 0, width, height);

      stars.forEach((s) => {
        s.update();
        s.draw(ctx, isLightMode);
      });

      animationFrameId = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}
