import { useEffect, useRef } from 'react';
import type { ReactionEvent } from './collabChannel';

interface Props {
  reactions: ReactionEvent[];
}

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  tilt: number;
  tiltSpeed: number;
  spin: number;
  spinSpeed: number;
  color: string;
  landed: boolean;
  emoji?: string;
}

interface Burst {
  id: string;
  userName: string;
  userColor: string;
  originX: number;
  originY: number;
  groundY: number;
  age: number;
  pieces: Piece[];
}

const CONFETTI = ['#10B981', '#34D399', '#F59E0B', '#F87171', '#60A5FA', '#A78BFA', '#FBBF24'];

const GRAVITY = 0.42;
const DRAG = 0.986;
const LIFT = 0.992;
const BOUNCE = 0.24;
const FRICTION = 0.72;
const SETTLE_FRAMES = 200;
const FADE_FRAMES = 46;

export function ReactionBursts({ reactions }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const burstsRef = useRef<Burst[]>([]);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (!reactions.length) return;
    const latest = reactions[reactions.length - 1];
    if (latest.id === lastIdRef.current) return;
    lastIdRef.current = latest.id;

    const stage = document.querySelector<HTMLElement>('[data-slide]');
    const rect = stage?.getBoundingClientRect();

    let originX = window.innerWidth / 2;
    let originY = window.innerHeight / 2;
    if (rect && rect.width > 0) {
      const scale = rect.width / 1920;
      originX = rect.left + latest.x * scale;
      originY = rect.top + latest.y * scale;
    }
    originX = Math.max(40, Math.min(window.innerWidth - 40, originX));
    originY = Math.max(60, Math.min(window.innerHeight - 80, originY));

    // Confetti settles on the slide floor, or the viewport floor without one.
    const floor = rect && rect.height > 0 ? rect.bottom : window.innerHeight - 24;
    const groundY = Math.max(originY + 60, Math.min(window.innerHeight - 16, floor));

    const pieces: Piece[] = [];

    // The emoji itself is one heavier piece, thrown straight up so it reads first.
    pieces.push({
      x: originX,
      y: originY,
      vx: (Math.random() - 0.5) * 1.6,
      vy: -13.5,
      w: 34,
      h: 34,
      // Sits at sin() = 1 so the emoji is never squashed by the tumble scale.
      tilt: Math.PI / 2,
      tiltSpeed: 0,
      spin: 0,
      spinSpeed: (Math.random() - 0.5) * 0.06,
      color: latest.userColor,
      landed: false,
      emoji: latest.emoji,
    });

    for (let i = 0; i < 38; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const speed = 7 + Math.random() * 9;
      pieces.push({
        x: originX + (Math.random() - 0.5) * 10,
        y: originY + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: 5 + Math.random() * 6,
        h: 8 + Math.random() * 7,
        tilt: Math.random() * Math.PI * 2,
        tiltSpeed: 0.16 + Math.random() * 0.22,
        spin: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 0.34,
        color: i % 6 === 0 ? latest.userColor : CONFETTI[i % CONFETTI.length],
        landed: false,
      });
    }

    burstsRef.current.push({
      id: latest.id,
      userName: latest.userName,
      userColor: latest.userColor,
      originX,
      originY,
      groundY,
      age: 0,
      pieces,
    });

    if (frameRef.current === null) {
      lastTimeRef.current = 0;
      frameRef.current = requestAnimationFrame(render);
    }
  }, [reactions]);

  const render = (now: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      frameRef.current = null;
      return;
    }

    // Step in 60fps units so a 120Hz display does not run the sim at double speed.
    const step = lastTimeRef.current ? Math.min(3, (now - lastTimeRef.current) / 16.667) : 1;
    lastTimeRef.current = now;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    for (let b = burstsRef.current.length - 1; b >= 0; b--) {
      const burst = burstsRef.current[b];
      burst.age += step;

      const fadeIn = Math.max(0, burst.age - SETTLE_FRAMES);
      const burstAlpha = 1 - Math.min(1, fadeIn / FADE_FRAMES);
      if (burstAlpha <= 0) {
        burstsRef.current.splice(b, 1);
        continue;
      }

      if (burst.age < 90) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (90 - burst.age) / 40) * burstAlpha;
        ctx.font = 'bold 11px monospace';
        const boxW = ctx.measureText(burst.userName).width + 12;
        const boxX = burst.originX - boxW / 2;
        const boxY = burst.originY + 18;
        ctx.fillStyle = burst.userColor;
        ctx.fillRect(boxX, boxY, boxW, 18);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(burst.userName, boxX + 6, boxY + 13);
        ctx.restore();
      }

      for (const p of burst.pieces) {
        if (!p.landed) {
          p.vy += GRAVITY * step;
          p.vx *= Math.pow(DRAG, step);
          p.vy *= Math.pow(LIFT, step);
          p.x += p.vx * step;
          p.y += p.vy * step;
          p.tilt += p.tiltSpeed * step;
          p.spin += p.spinSpeed * step;

          if (p.y >= burst.groundY) {
            p.y = burst.groundY;
            if (Math.abs(p.vy) > 2.2) {
              p.vy = -Math.abs(p.vy) * BOUNCE;
              p.vx *= FRICTION;
              p.spinSpeed *= FRICTION;
            } else {
              p.landed = true;
              p.vx = 0;
              p.vy = 0;
              // Paper comes to rest flat, not on edge.
              p.tilt = Math.PI / 2;
              p.spin = p.emoji ? 0 : p.spin + (Math.random() - 0.5) * 0.6;
            }
          }
        }

        ctx.save();
        ctx.globalAlpha = burstAlpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        // Flipping the flat scale is what sells a tumbling paper edge.
        ctx.scale(1, Math.max(0.08, Math.abs(Math.sin(p.tilt))));
        if (p.emoji) {
          ctx.font = `${p.w}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.emoji, 0, 0);
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
    }

    ctx.restore();

    if (burstsRef.current.length) {
      frameRef.current = requestAnimationFrame(render);
    } else {
      frameRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
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
        zIndex: 350,
      }}
    />
  );
}
