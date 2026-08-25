import { useEffect, useRef } from 'react';
import type { LaserPoint, RemoteLaserEvent } from './collabChannel';

interface Props {
  localPoints: LaserPoint[];
  remoteLasers: RemoteLaserEvent[];
  slideRect: DOMRect | null;
  scale: number;
}

interface ActiveTrail {
  color: string;
  points: { screenX: number; screenY: number; at: number }[];
}

export function LaserLayer({ localPoints, remoteLasers, slideRect, scale }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trailsRef = useRef<ActiveTrail[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Resize canvas
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth * (window.devicePixelRatio || 1);
        canvasRef.current.height = window.innerHeight * (window.devicePixelRatio || 1);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update active trails from local & remote points
  useEffect(() => {
    if (!slideRect) return;

    const nextTrails: ActiveTrail[] = [];

    // Local laser trail (Default luminous laser crimson or user theme)
    if (localPoints.length > 0) {
      const convertedLocal = localPoints.map((p) => ({
        screenX: slideRect.left + p.x * scale,
        screenY: slideRect.top + p.y * scale,
        at: p.at,
      }));
      nextTrails.push({
        color: '#FF2E54', // Neon laser crimson
        points: convertedLocal,
      });
    }

    // Remote peer laser trails
    remoteLasers.forEach((laser) => {
      if (laser.points.length > 0) {
        const converted = laser.points.map((p) => ({
          screenX: slideRect.left + p.x * scale,
          screenY: slideRect.top + p.y * scale,
          at: p.at,
        }));
        nextTrails.push({
          color: laser.color || '#FF2E54',
          points: converted,
        });
      }
    });

    trailsRef.current = nextTrails;

    if (nextTrails.length > 0 && !animFrameRef.current) {
      startRender();
    }
  }, [localPoints, remoteLasers, slideRect, scale]);

  const startRender = () => {
    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const now = Date.now();
      const FADE_DURATION = 900; // 900ms trail lifetime

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      let hasActivePoints = false;

      trailsRef.current.forEach((trail) => {
        // Filter out expired points
        trail.points = trail.points.filter((p) => now - p.at < FADE_DURATION);

        if (trail.points.length < 2) {
          if (trail.points.length === 1) {
            hasActivePoints = true;
            const p = trail.points[0];
            const age = now - p.at;
            const alpha = Math.max(0, 1 - age / FADE_DURATION);

            // Draw glowing head
            ctx.save();
            ctx.shadowBlur = 12;
            ctx.shadowColor = trail.color;
            ctx.fillStyle = trail.color;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(p.screenX, p.screenY, 5, 0, Math.PI * 2);
            ctx.fill();

            // Core bright white dot
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(p.screenX, p.screenY, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          return;
        }

        hasActivePoints = true;

        // Draw segmented fading glowing laser ribbon
        for (let i = 1; i < trail.points.length; i++) {
          const p0 = trail.points[i - 1];
          const p1 = trail.points[i];
          const age = now - p1.at;
          const alpha = Math.max(0, 1 - age / FADE_DURATION);
          const progress = i / trail.points.length;
          const lineWidth = 2 + progress * 3;

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(p0.screenX, p0.screenY);
          ctx.lineTo(p1.screenX, p1.screenY);

          ctx.strokeStyle = trail.color;
          ctx.lineWidth = lineWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.shadowBlur = 10;
          ctx.shadowColor = trail.color;
          ctx.globalAlpha = alpha;
          ctx.stroke();

          // White hot center highlight
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = lineWidth * 0.45;
          ctx.shadowBlur = 0;
          ctx.globalAlpha = alpha * 0.9;
          ctx.stroke();
          ctx.restore();
        }

        // Draw head dot
        const head = trail.points[trail.points.length - 1];
        if (head) {
          const headAge = now - head.at;
          const headAlpha = Math.max(0, 1 - headAge / FADE_DURATION);

          ctx.save();
          ctx.shadowBlur = 16;
          ctx.shadowColor = trail.color;
          ctx.fillStyle = trail.color;
          ctx.globalAlpha = headAlpha;
          ctx.beginPath();
          ctx.arc(head.screenX, head.screenY, 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(head.screenX, head.screenY, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });

      ctx.restore();

      if (hasActivePoints) {
        animFrameRef.current = requestAnimationFrame(render);
      } else {
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(render);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 260,
      }}
    />
  );
}
