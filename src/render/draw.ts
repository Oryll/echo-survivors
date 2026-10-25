// Canvas 渲染：只读 Game，世界坐标 + 相机
import type { Game } from '../game/types';
import { ENEMY_MAP, VIEW_H, VIEW_W, VIEW_ZOOM, WORLD_H, WORLD_W } from '../game/config';
import { WEAPON_MAP } from '../game/content';
import { pickupRadius } from '../game/engine';

const FONT = '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif';
const ZOOM = VIEW_ZOOM;

function drawGround(ctx: CanvasRenderingContext2D, g: Game) {
  const cam = g.camera;
  ctx.fillStyle = '#0a0e15';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // 世界网格
  const grid = 80;
  const startX = Math.floor(cam.x / grid) * grid;
  const startY = Math.floor(cam.y / grid) * grid;
  ctx.strokeStyle = 'rgba(110, 140, 190, 0.06)';
  ctx.lineWidth = 1;
  for (let x = startX; x < cam.x + VIEW_W + grid; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x - cam.x, 0);
    ctx.lineTo(x - cam.x, VIEW_H);
    ctx.stroke();
  }
  for (let y = startY; y < cam.y + VIEW_H + grid; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y - cam.y);
    ctx.lineTo(VIEW_W, y - cam.y);
    ctx.stroke();
  }

  // 拾取范围（很淡）
  const pr = pickupRadius(g);
  ctx.beginPath();
  ctx.arc(g.player.pos.x - cam.x, g.player.pos.y - cam.y, pr, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(227, 192, 95, 0.10)';
  ctx.stroke();

  // 世界边界
  ctx.strokeStyle = 'rgba(120, 160, 220, 0.25)';
  ctx.lineWidth = 3;
  ctx.strokeRect(-cam.x, -cam.y, WORLD_W, WORLD_H);
}

function drawGems(ctx: CanvasRenderingContext2D, g: Game) {
  const cam = g.camera;
  const t = g.time;
  for (const gem of g.gems) {
    const x = gem.pos.x - cam.x;
    const y = gem.pos.y - cam.y;
    if (x < -20 || x > VIEW_W + 20 || y < -20 || y > VIEW_H + 20) continue;
    const s = gem.big ? 7 : 4.5;
    const pulse = 1 + Math.sin(t * 6 + gem.id) * 0.12;
    ctx.beginPath();
    ctx.moveTo(x, y - s * pulse);
    ctx.lineTo(x + s * pulse, y);
    ctx.lineTo(x, y + s * pulse);
    ctx.lineTo(x - s * pulse, y);
    ctx.closePath();
    ctx.fillStyle = gem.big ? '#c9a9ef' : '#7fd6a8';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawEnemies(ctx: CanvasRenderingContext2D, g: Game) {
  const cam = g.camera;
  for (const e of g.enemies) {
    if (e.hp <= 0) continue;
    const x = e.pos.x - cam.x;
    const y = e.pos.y - cam.y;
    if (x < -60 || x > VIEW_W + 60 || y < -60 || y > VIEW_H + 60) continue;

    // 影子
    ctx.beginPath();
    ctx.ellipse(x, y + e.radius * 0.6, e.radius * 0.9, e.radius * 0.38, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    // 身体
    const wob = Math.sin(e.wobble) * 1.6;
    ctx.beginPath();
    ctx.arc(x, y + wob, e.radius, 0, Math.PI * 2);
    ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = e.boss ? 3 : 1.5;
    ctx.stroke();

    if (e.slowT > 0) {
      ctx.beginPath();
      ctx.arc(x, y + wob, e.radius + 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(120, 190, 255, 0.75)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (e.burn > 0) {
      ctx.beginPath();
      ctx.arc(x + Math.sin(g.time * 9 + e.id) * 3, y - e.radius - 2, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 150, 70, 0.9)';
      ctx.fill();
    }

    // 眼睛（朝向玩家）
    if (!e.boss && e.radius >= 9) {
      const ang = Math.atan2(g.player.pos.y - e.pos.y, g.player.pos.x - e.pos.x);
      const ex = Math.cos(ang) * e.radius * 0.35;
      const ey = Math.sin(ang) * e.radius * 0.35;
      const px = -Math.sin(ang) * e.radius * 0.32;
      const py = Math.cos(ang) * e.radius * 0.32;
      ctx.fillStyle = 'rgba(20, 24, 34, 0.85)';
      ctx.beginPath();
      ctx.arc(x + ex + px, y + wob + ey + py, e.radius * 0.16, 0, Math.PI * 2);
      ctx.arc(x + ex - px, y + wob + ey - py, e.radius * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }

    if (e.boss || e.kind === 'elite') {
      const bw = e.boss ? 110 : 46;
      const by = y - e.radius - 12;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x - bw / 2 - 1, by - 1, bw + 2, 7);
      ctx.fillStyle = e.boss ? '#e0665a' : '#e3c05f';
      ctx.fillRect(x - bw / 2, by, bw * Math.max(0, e.hp / e.maxHp), 5);
      if (e.boss) {
        ctx.fillStyle = '#f0c3bc';
        ctx.font = `bold 12px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(ENEMY_MAP[e.kind].name, x, by - 5);
        ctx.textAlign = 'left';
      }
    }
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, g: Game) {
  const cam = g.camera;
  const p = g.player;
  const x = p.pos.x - cam.x;
  const y = p.pos.y - cam.y;

  // 无敌闪烁
  const blink = p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0;
  ctx.globalAlpha = blink ? 0.45 : 1;

  // 外圈
  ctx.beginPath();
  ctx.arc(x, y, p.radius + 5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(140, 200, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 身体
  ctx.beginPath();
  ctx.arc(x, y, p.radius, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(x - 4, y - 5, 2, x, y, p.radius);
  grad.addColorStop(0, '#eaf4ff');
  grad.addColorStop(1, '#6fa8dc');
  ctx.fillStyle = grad;
  ctx.fill();

  // 朝向
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(p.facing) * (p.radius + 2), y + Math.sin(p.facing) * (p.radius + 2));
  ctx.lineTo(x + Math.cos(p.facing + 2.4) * (p.radius + 2), y + Math.sin(p.facing + 2.4) * (p.radius + 2));
  ctx.lineTo(x + Math.cos(p.facing - 2.4) * (p.radius + 2), y + Math.sin(p.facing - 2.4) * (p.radius + 2));
  ctx.closePath();
  ctx.fillStyle = '#cfe6ff';
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawOrbits(ctx: CanvasRenderingContext2D, g: Game) {
  const cam = g.camera;
  const p = g.player.pos;
  for (const w of g.weapons) {
    const def = WEAPON_MAP[w.id];
    if (!def || def.mechanic !== 'orbit') continue;
    const r = (def.base.radius ?? 70) + (w.level - 1) * 10;
    const n = (def.base.count ?? 2) + Math.floor((w.level - 1) / 2);
    for (let i = 0; i < n; i++) {
      const a = g.time * 2.4 + (i / n) * Math.PI * 2;
      const x = p.x + Math.cos(a) * r - cam.x;
      const y = p.y + Math.sin(a) * r - cam.y;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function drawProjectiles(ctx: CanvasRenderingContext2D, g: Game) {
  const cam = g.camera;
  for (const pr of g.projectiles) {
    const x = pr.pos.x - cam.x;
    const y = pr.pos.y - cam.y;
    if (pr.kind === 'blade') {
      const a = Math.atan2(pr.vel.y, pr.vel.x);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = pr.color;
      ctx.fillRect(-10, -2, 18, 4);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(g.time * 10);
      ctx.strokeStyle = pr.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, pr.radius, 0.4, Math.PI * 1.5);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawEffects(ctx: CanvasRenderingContext2D, g: Game) {
  const cam = g.camera;
  for (const fx of g.effects) {
    const a = Math.max(0, fx.ttl / fx.max);
    if (fx.kind === 'ring') {
      const p = 1 - a;
      ctx.beginPath();
      ctx.arc(fx.pos.x - cam.x, fx.pos.y - cam.y, fx.r * (0.6 + 0.4 * p), 0, Math.PI * 2);
      ctx.strokeStyle = fx.color;
      ctx.globalAlpha = a * 0.9;
      ctx.lineWidth = fx.width ?? 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (fx.kind === 'spark') {
      const p = 1 - a;
      ctx.beginPath();
      ctx.arc(fx.pos.x - cam.x, fx.pos.y - cam.y, 6 + p * 14, 0, Math.PI * 2);
      ctx.fillStyle = fx.color;
      ctx.globalAlpha = a * 0.5;
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (fx.kind === 'line') {
      ctx.beginPath();
      ctx.moveTo(fx.a.x - cam.x, fx.a.y - cam.y);
      ctx.lineTo(fx.b.x - cam.x, fx.b.y - cam.y);
      ctx.strokeStyle = fx.color;
      ctx.globalAlpha = a;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (fx.kind === 'text') {
      ctx.globalAlpha = a;
      ctx.font = `bold 13px ${FONT}`;
      ctx.fillStyle = fx.color;
      ctx.textAlign = 'center';
      ctx.fillText(fx.text, fx.pos.x - cam.x, fx.pos.y - cam.y - (1 - a) * 20);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }
}

function drawVignette(ctx: CanvasRenderingContext2D, g: Game) {
  const p = g.player;
  const hpRatio = p.hp / p.maxHp;
  if (hpRatio < 0.35) {
    const a = (0.35 - hpRatio) * 1.4;
    const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.25, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.75);
    grad.addColorStop(0, 'rgba(255,0,0,0)');
    grad.addColorStop(1, `rgba(180,20,20,${a.toFixed(3)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

export function draw(ctx: CanvasRenderingContext2D, g: Game): void {
  const shakeX = g.shake > 0 ? (Math.random() - 0.5) * g.shake : 0;
  const shakeY = g.shake > 0 ? (Math.random() - 0.5) * g.shake : 0;

  ctx.save();
  ctx.translate(Math.round(shakeX), Math.round(shakeY));
  ctx.translate(VIEW_W / 2, VIEW_H / 2);
  ctx.scale(ZOOM, ZOOM);
  ctx.translate(-VIEW_W / 2, -VIEW_H / 2);
  drawGround(ctx, g);
  drawGems(ctx, g);
  drawEnemies(ctx, g);
  drawPlayer(ctx, g);
  drawProjectiles(ctx, g);
  drawOrbits(ctx, g);
  drawEffects(ctx, g);
  ctx.restore();

  drawVignette(ctx, g);
}
