import { useEffect, useRef } from 'react';
import type { Game } from '../game/types';
import { VIEW_H, VIEW_W } from '../game/config';
import { draw } from '../render/draw';
import { update } from '../game/engine';
import { hudSignature, makeHud, type HudSnapshot } from './hud';

const MOVE_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

export function GameCanvas({
  game,
  onHud,
  paused,
}: {
  game: Game;
  onHud: (h: HudSnapshot) => void;
  paused: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef(game);
  gameRef.current = game;
  const hudRef = useRef(onHud);
  hudRef.current = onHud;
  const keysRef = useRef<Set<string>>(new Set());
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = VIEW_W * dpr;
    canvas.height = VIEW_H * dpr;

    const onDown = (e: KeyboardEvent) => {
      if (MOVE_KEYS.has(e.code)) {
        keysRef.current.add(e.code);
        e.preventDefault();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };
    const onBlur = () => keysRef.current.clear();
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);

    const speedParam = Number(new URLSearchParams(window.location.search).get('speed') ?? '1');
    const timeScale = Number.isFinite(speedParam) && speedParam > 0 ? Math.min(4, speedParam) : 1;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let sig = '';
    hudRef.current(makeHud(gameRef.current));

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const g = gameRef.current;
      const keys = keysRef.current;
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      g.input.x = x;
      g.input.y = y;
      if (pausedRef.current) g.paused = true;
      else g.paused = false;

      acc += dt * timeScale;
      let steps = 0;
      while (acc >= 1 / 60 && steps < 8) {
        update(g, 1 / 60);
        acc -= 1 / 60;
        steps += 1;
      }
      if (steps >= 8) acc = 0;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(ctx, g);

      const s = hudSignature(g);
      if (s !== sig) {
        sig = s;
        hudRef.current(makeHud(g));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return (
    <div className="stage">
      <div className="canvas-wrap">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
