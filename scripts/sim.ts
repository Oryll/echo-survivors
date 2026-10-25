// 无头模拟：自动走位 + 自动选升级，跑满 10 分钟
import type { Game } from '../src/game/types';
import { applyReplace, chooseUpgrade, createGame, payout, startRun, update } from '../src/game/engine';
import { ALL_ITEM_IDS, PASSIVES, WEAPONS } from '../src/game/content';
import { WORLD_H, WORLD_W } from '../src/game/config';

interface Loadout {
  weapons: string[];
  passives: string[];
}

const ALL: Loadout = {
  weapons: WEAPONS.map((w) => w.id),
  passives: PASSIVES.map((p) => p.id),
};
const STARTER: Loadout = { weapons: ['blade0', 'aura0'], passives: ['pow', 'swift'] };

function steer(g: Game): void {
  const p = g.player.pos;
  let fx = 0;
  let fy = 0;
  for (const e of g.enemies) {
    if (e.hp <= 0) continue;
    const dx = p.x - e.pos.x;
    const dy = p.y - e.pos.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 190) {
      const w = (190 - d) / 190;
      fx += (dx / d) * w * w;
      fy += (dy / d) * w * w;
    }
  }
  let gemX = 0;
  let gemY = 0;
  let gemCount = 0;
  for (const gem of g.gems) {
    const dx = gem.pos.x - p.x;
    const dy = gem.pos.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 260) {
      gemX += dx / d;
      gemY += dy / d;
      gemCount += 1;
    }
  }
  if (gemCount > 0) {
    fx += (gemX / gemCount) * 0.55;
    fy += (gemY / gemCount) * 0.55;
  }
  const margin = 120;
  if (p.x < margin) fx += (margin - p.x) / margin;
  if (p.x > WORLD_W - margin) fx -= (p.x - (WORLD_W - margin)) / margin;
  if (p.y < margin) fy += (margin - p.y) / margin;
  if (p.y > WORLD_H - margin) fy -= (p.y - (WORLD_H - margin)) / margin;
  const len = Math.hypot(fx, fy);
  g.input.x = len > 0.01 ? fx / len : 0;
  g.input.y = len > 0.01 ? fy / len : 0;
}

function score(c: { kind: string; isNew: boolean; tier?: string }): number {
  if (c.kind === 'heal') return 0.5;
  let s = c.kind === 'weapon' ? 4 : 3;
  if (c.isNew) s -= 1.2;
  if (c.tier === 'epic') s += 1.5;
  if (c.tier === 'rare') s += 0.6;
  return s;
}

function pick(g: Game): void {
  const c = [...g.choices].sort((a, b) => score(b) - score(a))[0];
  chooseUpgrade(g, c.id);
  // 槽位满时会进入「替换」状态，AI 换掉等级最低的那个
  if (g.pendingReplace) {
    const ch = g.choices.find((x) => x.id === g.pendingReplace?.choiceId);
    if (ch?.kind === 'weapon') {
      const worst = [...g.weapons].sort((a, b) => a.level - b.level)[0];
      applyReplace(g, worst.id);
    } else {
      const worst = Object.entries(g.passives)
        .filter(([, v]) => v > 0)
        .sort((a, b) => a[1] - b[1])[0];
      if (worst) applyReplace(g, worst[0]);
    }
  }
}

function run(loadout: Loadout) {
  const g = createGame(loadout);
  startRun(g);
  let step = 0;
  while (g.phase === 'playing' && step < 60 * 620) {
    steer(g);
    update(g, 1 / 60);
    if (g.phase === 'levelup') pick(g);
    step += 1;
  }
  const pay = payout(g);
  return {
    won: g.phase === 'won',
    time: Math.round(g.time),
    level: g.level,
    kills: g.kills,
    coins: pay.total,
    weapons: g.weapons.map((w) => `${w.id}${w.level}`).join(' '),
  };
}

const which = process.argv[2] ?? 'all';
const runs = Number(process.argv[3] ?? 3);
const loadout = which === 'starter' ? STARTER : ALL;
console.log('loadout:', which, '| 武器', loadout.weapons.length, '被动', loadout.passives.length);
for (let i = 0; i < runs; i++) {
  const r = run(loadout);
  console.log(
    `#${i + 1} ${r.won ? '通关' : '死亡'} 存活 ${r.time}s | Lv.${r.level} | 击杀 ${r.kills} | 金币 ${r.coins} | ${r.weapons}`,
  );
}
void ALL_ITEM_IDS;
