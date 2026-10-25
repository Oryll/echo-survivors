// 幸存者核心模拟（v0.2）：移动、刷怪、10 种武器机制、状态、经验、升级、金币
import type {
  Choice,
  Element,
  Enemy,
  EnemyKind,
  Game,
  Tier,
  Vec,
  WeaponState,
} from './types';
import {
  BASE_PICKUP,
  BASE_REROLLS,
  ENEMY_MAP,
  PASSIVE_SLOTS,
  PLAYER,
  STAGES,
  VIEW_H,
  VIEW_W,
  VIEW_ZOOM,
  WEAPON_SLOTS,
  WORLD_H,
  WORLD_W,
  damageMul,
  hpMul,
  levelXp,
  spawnBatch,
  spawnInterval,
} from './config';
import {
  PASSIVES,
  PASSIVE_MAP,
  STARTER_PASSIVES,
  STARTER_WEAPONS,
  TIER_INFO,
  WEAPONS,
  WEAPON_MAP,
  weaponStat,
} from './content';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist2 = (a: Vec, b: Vec) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

function id(g: Game): number {
  return g.nextId++;
}

export interface MetaInfo {
  weapons: string[];
  passives: string[];
}

export function createGame(meta?: MetaInfo, stageIndex = 0): Game {
  const ownedWeapons = meta?.weapons ?? [...STARTER_WEAPONS];
  const ownedPassives = meta?.passives ?? [...STARTER_PASSIVES];
  const weapons: WeaponState[] = [];
  if (ownedWeapons.includes('blade0')) weapons.push({ id: 'blade0', level: 1, cd: 0 });
  else if (ownedWeapons.length > 0) weapons.push({ id: ownedWeapons[0], level: 1, cd: 0 });

  const passives: Record<string, number> = {};
  for (const p of PASSIVES) passives[p.id] = 0;

  const maxHp = PLAYER.maxHp;
  return {
    phase: 'menu',
    time: 0,
    player: {
      pos: { x: WORLD_W / 2, y: WORLD_H / 2 },
      hp: maxHp,
      maxHp,
      radius: PLAYER.radius,
      speed: PLAYER.speed,
      invuln: 0,
      facing: 0,
      moving: false,
      revived: false,
    },
    weapons,
    passives,
    enemies: [],
    projectiles: [],
    gems: [],
    effects: [],
    camera: { x: WORLD_W / 2 - VIEW_W / 2, y: WORLD_H / 2 - VIEW_H / 2 },
    spawnTimer: 0.6,
    eliteTimer: 55,
    bossIndex: 0,
    kills: 0,
    level: 1,
    xp: 0,
    xpNext: levelXp(1),
    pendingLevels: 0,
    choices: [],
    shake: 0,
    nextId: 1,
    paused: false,
    coins: 0,
    stage: Math.max(0, Math.min(STAGES.length - 1, stageIndex)),
    rerolls: BASE_REROLLS,
    pendingReplace: null,
    ownedWeapons,
    ownedPassives,
    stats: { damage: 0, gems: 0, kills: 0 },
    banners: null,
    input: { x: 0, y: 0 },
  };
}

export function startRun(g: Game): void {
  const fresh = createGame({ weapons: g.ownedWeapons, passives: g.ownedPassives }, g.stage);
  Object.assign(g, fresh);
  g.phase = 'playing';
  g.banners = { text: '活下去', sub: 'WASD / 方向键移动，武器会自动攻击', ttl: 3 };
}

// ---------------- 被动聚合 ----------------
export interface Derived {
  dmgMul: number;
  cdMul: number;
  moveMul: number;
  maxHpBonus: number;
  pickupMul: number;
  critChance: number;
  lifesteal: number;
  thorns: number;
  xpMul: number;
  flatReduce: number;
  coinMul: number;
  hasRevive: boolean;
}

export function derived(g: Game): Derived {
  const p = g.passives;
  const lv = (k: string) => p[k] ?? 0;
  return {
    dmgMul: 1 + 0.1 * lv('pow') + 0.22 * lv('slaughter'),
    cdMul: Math.pow(0.92, lv('haste')) * Math.pow(0.86, lv('gale')),
    moveMul: 1 + 0.08 * lv('swift') + 0.05 * lv('titan'),
    maxHpBonus: 15 * lv('vigor') + 40 * lv('titan'),
    pickupMul: 1 + 0.3 * lv('magnet'),
    critChance: 0.08 * lv('crit'),
    lifesteal: 0.02 * lv('leech'),
    thorns: 10 * lv('thorns'),
    xpMul: 1 + 0.15 * lv('luck'),
    flatReduce: 2 * lv('guard'),
    coinMul: 1 + 0.35 * lv('greed'),
    hasRevive: lv('revive') > 0,
  };
}

function applyMaxHp(g: Game): void {
  const target = PLAYER.maxHp + derived(g).maxHpBonus;
  const delta = target - g.player.maxHp;
  if (delta !== 0) {
    g.player.maxHp = target;
    g.player.hp = Math.min(target, g.player.hp + Math.max(0, delta));
  }
}

export function moveSpeed(g: Game): number {
  return PLAYER.speed * derived(g).moveMul;
}
export function pickupRadius(g: Game): number {
  return BASE_PICKUP * derived(g).pickupMul;
}

// ---------------- 刷怪 ----------------
function pickEnemyKind(time: number): EnemyKind {
  const r = Math.random();
  if (time < 45) return 'crawler';
  if (time < 120) return r < 0.72 ? 'crawler' : 'runner';
  if (time < 200) return r < 0.5 ? 'crawler' : r < 0.8 ? 'runner' : 'tank';
  if (time < 300) return r < 0.4 ? 'crawler' : r < 0.65 ? 'runner' : r < 0.85 ? 'tank' : 'splitter';
  return r < 0.3 ? 'crawler' : r < 0.55 ? 'runner' : r < 0.78 ? 'tank' : 'splitter';
}

function spawnPoint(g: Game): Vec {
  const p = g.player.pos;
  const radius = 480;
  for (let i = 0; i < 8; i++) {
    const a = rand(0, Math.PI * 2);
    const x = clamp(p.x + Math.cos(a) * radius, 40, WORLD_W - 40);
    const y = clamp(p.y + Math.sin(a) * radius, 40, WORLD_H - 40);
    if (
      x < g.camera.x - 40 ||
      x > g.camera.x + VIEW_W + 40 ||
      y < g.camera.y - 40 ||
      y > g.camera.y + VIEW_H + 40
    ) {
      return { x, y };
    }
  }
  return { x: clamp(p.x + radius, 40, WORLD_W - 40), y: clamp(p.y, 40, WORLD_H - 40) };
}

function spawn(g: Game, kind: EnemyKind, pos: Vec, mul = 1): Enemy {
  const def = ENEMY_MAP[kind];
  const hp = Math.round(def.hp * hpMul(g.time) * STAGES[g.stage].hpMul * mul);
  const e: Enemy = {
    id: id(g),
    kind,
    hp,
    maxHp: hp,
    speed: def.speed,
    radius: def.radius,
    color: def.color,
    xp: def.xp,
    coin: def.coin,
    damage: def.damage * damageMul(g.time),
    pos,
    hitFlash: 0,
    boss: def.boss,
    wobble: rand(0, Math.PI * 2),
    burn: 0,
    burnT: 0.5,
    slowT: 0,
    slowFactor: 1,
  };
  g.enemies.push(e);
  return e;
}

function spawnBoss(g: Game): void {
  const e = spawn(g, 'boss', spawnPoint(g));
  g.banners = { text: '回响巨像降临', sub: '它很慢，但一下就能要你的命', ttl: 3 };
  g.shake = 9;
  g.effects.push({ kind: 'ring', pos: e.pos, r: 160, ttl: 0.7, max: 0.7, color: '#ff6b5c', width: 4 });
}

// ---------------- 伤害 ----------------
function applyElement(e: Enemy, element: Element): void {
  if (e.hp <= 0) return;
  if (element === 'burn') {
    e.burn = Math.min(10, e.burn + 1);
    e.burnT = Math.min(e.burnT, 0.5);
  } else if (element === 'slow') {
    e.slowT = 1.7;
    e.slowFactor = 0.55;
  }
}

function damageEnemy(g: Game, e: Enemy, amount: number, color: string, element: Element = 'none'): void {
  if (e.hp <= 0) return;
  const d = derived(g);
  let dmg = amount;
  let crit = false;
  if (d.critChance > 0 && Math.random() < d.critChance) {
    dmg *= 2;
    crit = true;
  }
  dmg = Math.max(1, Math.round(dmg));
  e.hp -= dmg;
  e.hitFlash = 0.1;
  g.stats.damage += dmg;
  if (d.lifesteal > 0) {
    g.player.hp = Math.min(g.player.maxHp, g.player.hp + dmg * d.lifesteal);
  }
  if (dmg >= 24 || crit) {
    g.effects.push({
      kind: 'text',
      pos: { x: e.pos.x + rand(-6, 6), y: e.pos.y - e.radius - 4 },
      text: crit ? `${dmg}!` : String(dmg),
      ttl: 0.55,
      max: 0.55,
      color: crit ? '#ffd76e' : color,
    });
  }
  applyElement(e, element);
  if (e.hp <= 0) killEnemy(g, e);
}

function killEnemy(g: Game, e: Enemy): void {
  g.kills += 1;
  g.stats.kills += 1;
  g.coins += e.coin * derived(g).coinMul * STAGES[g.stage].coinMul;
  g.effects.push({ kind: 'spark', pos: { ...e.pos }, ttl: 0.3, max: 0.3, color: e.color });
  const count = e.boss ? 12 : e.kind === 'elite' ? 4 : 1;
  for (let i = 0; i < count; i++) {
    g.gems.push({
      id: id(g),
      pos: { x: e.pos.x + rand(-14, 14), y: e.pos.y + rand(-14, 14) },
      value: Math.max(1, Math.round(e.xp / count)),
      big: e.xp >= 8,
    });
  }
  if (e.kind === 'splitter') {
    for (let i = 0; i < 2; i++) {
      const a = rand(0, Math.PI * 2);
      spawn(g, 'shard', { x: e.pos.x + Math.cos(a) * 16, y: e.pos.y + Math.sin(a) * 16 });
    }
  }
  if (e.boss) g.shake = 10;
}

function damagePlayer(g: Game, amount: number, source: Enemy | null): void {
  if (g.player.invuln > 0) return;
  const d = derived(g);
  const dmg = Math.max(1, Math.round(amount - d.flatReduce));
  g.player.hp -= dmg;
  g.player.invuln = PLAYER.invulnTime;
  g.shake = 7;
  g.effects.push({ kind: 'ring', pos: { ...g.player.pos }, r: 42, ttl: 0.3, max: 0.3, color: '#ff6b5c', width: 3 });
  if (d.thorns > 0 && source) damageEnemy(g, source, d.thorns, '#9ff0c8');
  if (g.player.hp <= 0) {
    if (d.hasRevive && !g.player.revived) {
      g.player.revived = true;
      g.player.hp = Math.round(g.player.maxHp * 0.5);
      g.player.invuln = 2;
      g.banners = { text: '不死之火燃起', sub: '你以 50% 生命复活了', ttl: 3 };
      g.shake = 12;
      return;
    }
    g.player.hp = 0;
    g.phase = 'dead';
  }
}

// ---------------- 武器 ----------------
function nearestEnemies(g: Game, from: Vec, n: number, maxDist = 99999): Enemy[] {
  return g.enemies
    .filter((e) => e.hp > 0)
    .map((e) => ({ e, d: dist2(from, e.pos) }))
    .filter((x) => x.d <= maxDist * maxDist)
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((x) => x.e);
}

function fireWeapon(g: Game, w: WeaponState): void {
  const def = WEAPON_MAP[w.id];
  if (!def) return;
  const st = weaponStat(def, w.level);
  const dmg = st.damage * derived(g).dmgMul;
  const p = g.player.pos;

  switch (def.mechanic) {
    case 'blade': {
      const targets = nearestEnemies(g, p, st.count ?? 1, 560);
      for (const target of targets) {
        const a = Math.atan2(target.pos.y - p.y, target.pos.x - p.x);
        g.projectiles.push({
          id: id(g),
          kind: 'blade',
          pos: { ...p },
          vel: { x: Math.cos(a) * st.speed, y: Math.sin(a) * st.speed },
          dmg,
          ttl: 1.0,
          pierce: w.level >= 5 ? 2 : 1,
          radius: 6,
          color: def.color,
          element: def.element,
          hit: [],
        });
      }
      break;
    }
    case 'aura': {
      const r = st.radius ?? 100;
      g.effects.push({ kind: 'ring', pos: { ...p }, r, ttl: 0.32, max: 0.32, color: def.color, width: 3 });
      for (const e of g.enemies) {
        if (e.hp > 0 && dist2(p, e.pos) <= (r + e.radius) ** 2) damageEnemy(g, e, dmg, def.color, def.element);
      }
      break;
    }
    case 'chain': {
      const n = st.count ?? 1;
      const picked = new Set<number>();
      for (let i = 0; i < n; i++) {
        const list = g.enemies.filter((e) => e.hp > 0 && !picked.has(e.id));
        if (list.length === 0) break;
        const t = list[Math.floor(Math.random() * list.length)];
        picked.add(t.id);
        g.effects.push({ kind: 'line', a: { ...p }, b: { ...t.pos }, ttl: 0.18, max: 0.18, color: def.color, width: 2.5 });
        damageEnemy(g, t, dmg, def.color, def.element);
      }
      break;
    }
    case 'boomerang': {
      const target = nearestEnemies(g, p, 1, 460)[0];
      const dir = target
        ? Math.atan2(target.pos.y - p.y, target.pos.x - p.x)
        : Math.random() * Math.PI * 2;
      g.projectiles.push({
        id: id(g),
        kind: 'boomerang',
        pos: { ...p },
        vel: { x: Math.cos(dir) * st.speed, y: Math.sin(dir) * st.speed },
        dmg,
        ttl: 3,
        pierce: 999,
        radius: 10,
        color: def.color,
        element: def.element,
        hit: [],
        origin: { ...p },
        returning: false,
        range: st.range ?? 300,
      });
      break;
    }
    case 'nova':
    case 'pulse': {
      const r = st.radius ?? 140;
      const dur = def.mechanic === 'pulse' ? 0.5 : 0.35;
      g.effects.push({ kind: 'ring', pos: { ...p }, r, ttl: dur, max: dur, color: def.color, width: def.mechanic === 'pulse' ? 6 : 4 });
      for (const e of g.enemies) {
        if (e.hp > 0 && dist2(p, e.pos) <= (r + e.radius) ** 2) damageEnemy(g, e, dmg, def.color, def.element);
      }
      break;
    }
    case 'beam': {
      const target = nearestEnemies(g, p, 1, st.range ?? 460)[0];
      if (!target) break;
      const dir = Math.atan2(target.pos.y - p.y, target.pos.x - p.x);
      const len = st.range ?? 460;
      g.effects.push({
        kind: 'line',
        a: { ...p },
        b: { x: p.x + Math.cos(dir) * len, y: p.y + Math.sin(dir) * len },
        ttl: 0.22,
        max: 0.22,
        color: def.color,
        width: 7,
      });
      for (const e of g.enemies) {
        if (e.hp <= 0) continue;
        const proj = (e.pos.x - p.x) * Math.cos(dir) + (e.pos.y - p.y) * Math.sin(dir);
        if (proj < 0 || proj > len) continue;
        const perp = Math.abs(-(e.pos.x - p.x) * Math.sin(dir) + (e.pos.y - p.y) * Math.cos(dir));
        if (perp <= 26 + e.radius) damageEnemy(g, e, dmg, def.color, def.element);
      }
      break;
    }
    case 'strike': {
      const n = st.count ?? 1;
      const picked = new Set<number>();
      for (let i = 0; i < n; i++) {
        const list = g.enemies.filter((e) => e.hp > 0 && !picked.has(e.id));
        if (list.length === 0) break;
        const t = list[Math.floor(Math.random() * list.length)];
        picked.add(t.id);
        const r = st.radius ?? 46;
        g.effects.push({ kind: 'ring', pos: { ...t.pos }, r, ttl: 0.3, max: 0.3, color: def.color, width: 4 });
        for (const e of g.enemies) {
          if (e.hp > 0 && dist2(t.pos, e.pos) <= (r + e.radius) ** 2) damageEnemy(g, e, dmg, def.color, def.element);
        }
      }
      break;
    }
    case 'spray': {
      const target = nearestEnemies(g, p, 1, 340)[0];
      const base = target ? Math.atan2(target.pos.y - p.y, target.pos.x - p.x) : Math.random() * Math.PI * 2;
      const n = st.count ?? 3;
      for (let i = 0; i < n; i++) {
        const a = base + rand(-0.42, 0.42);
        const sp = 420;
        g.projectiles.push({
          id: id(g),
          kind: 'blade',
          pos: { ...p },
          vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
          dmg,
          ttl: (st.range ?? 260) / sp,
          pierce: 1,
          radius: 5,
          color: def.color,
          element: def.element,
          hit: [],
        });
      }
      break;
    }
    case 'orbit': {
      const n = st.count ?? 2;
      const r = st.radius ?? 70;
      g.effects.push({ kind: 'ring', pos: { ...p }, r, ttl: 0.18, max: 0.18, color: def.color, width: 1.5 });
      for (let i = 0; i < n; i++) {
        const a = g.time * 2.4 + (i / n) * Math.PI * 2;
        const ox = p.x + Math.cos(a) * r;
        const oy = p.y + Math.sin(a) * r;
        for (const e of g.enemies) {
          if (e.hp <= 0) continue;
          if ((ox - e.pos.x) ** 2 + (oy - e.pos.y) ** 2 <= (e.radius + 18) ** 2) {
            damageEnemy(g, e, dmg, def.color, def.element);
          }
        }
      }
      break;
    }
  }
}

// ---------------- 经验与升级 ----------------
function gainXp(g: Game, amount: number): void {
  const gain = Math.max(1, Math.round(amount * derived(g).xpMul));
  g.xp += gain;
  g.stats.gems += 1;
  while (g.xp >= g.xpNext) {
    g.xp -= g.xpNext;
    g.level += 1;
    g.xpNext = levelXp(g.level);
    g.pendingLevels += 1;
    const heal = Math.max(3, Math.round(g.player.maxHp * 0.08));
    g.player.hp = Math.min(g.player.maxHp, g.player.hp + heal);
  }
  if (g.pendingLevels > 0 && g.phase === 'playing') {
    g.phase = 'levelup';
    g.choices = rollChoices(g);
    g.effects.push({ kind: 'ring', pos: { ...g.player.pos }, r: 70, ttl: 0.5, max: 0.5, color: '#e3c05f', width: 3 });
  }
}

function tierWeight(tier: Tier, stage: number): number {
  const base = tier === 'epic' ? 2 : tier === 'rare' ? 3 : 4;
  if (tier === 'common') return Math.max(1.2, base - stage * 0.7);
  return base + stage * (tier === 'epic' ? 0.9 : 0.5);
}

function takeDistinct(pool: Choice[], n: number, used: Set<string>): Choice[] {
  const out: Choice[] = [];
  let guard = 0;
  while (out.length < n && guard < 300) {
    guard += 1;
    const candidates = pool.filter((c) => !used.has(c.id));
    if (candidates.length === 0) break;
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    used.add(picked.id);
    out.push(picked);
  }
  return out;
}

/** 在「替换 / 新内容 / 升级」三组里凑 3 张：最多 1 张替换，其余优先升级 */
function composePicks(
  replacePool: Choice[],
  newPool: Choice[],
  upgradePool: Choice[],
  used: Set<string>,
): Choice[] {
  const picks: Choice[] = [];
  if (replacePool.length > 0) {
    picks.push(...takeDistinct(replacePool, 1, used));
    picks.push(...takeDistinct(upgradePool, 3 - picks.length, used));
    if (picks.length < 3) picks.push(...takeDistinct(newPool, 3 - picks.length, used));
  } else {
    picks.push(...takeDistinct([...newPool, ...upgradePool], 3, used));
  }

  // 稀有度保底：三张全普通时换一张非普通（不增加替换数量）
  const nonCommon = [...upgradePool, ...newPool].filter(
    (c) => c.tier && c.tier !== 'common' && !used.has(c.id),
  );
  if (picks.length > 0 && picks.every((c) => !c.tier || c.tier === 'common') && nonCommon.length > 0) {
    const idx = picks.findIndex((c) => !c.replace);
    if (idx >= 0) {
      const swap = nonCommon[Math.floor(Math.random() * nonCommon.length)];
      used.add(swap.id);
      picks[idx] = swap;
    }
  }
  return picks;
}

function rollChoices(g: Game): Choice[] {
  const stage = g.stage;
  const weaponFull = g.weapons.length >= WEAPON_SLOTS;
  const passiveCount = Object.values(g.passives).filter((v) => v > 0).length;
  const passiveFull = passiveCount >= PASSIVE_SLOTS;

  // 武器池
  const wReplace: Choice[] = [];
  const wNew: Choice[] = [];
  const wUp: Choice[] = [];
  // 被动池
  const pReplace: Choice[] = [];
  const pNew: Choice[] = [];
  const pUp: Choice[] = [];

  for (const wid of g.ownedWeapons) {
    if (g.weapons.some((w) => w.id === wid)) continue;
    const def = WEAPON_MAP[wid];
    if (!def) continue;
    const copies = Math.round(tierWeight(def.tier, stage) * 2);
    for (let i = 0; i < copies; i++) {
      const item: Choice = {
        id: 'w-new-' + wid,
        kind: 'weapon',
        weaponId: wid,
        name: def.name,
        icon: def.icon,
        color: def.color,
        desc: def.desc,
        tier: def.tier,
        isNew: true,
        level: 1,
        replace: weaponFull,
      };
      (weaponFull ? wReplace : wNew).push(item);
    }
  }

  for (const pid of g.ownedPassives) {
    const def = PASSIVE_MAP[pid];
    if (!def) continue;
    if ((g.passives[pid] ?? 0) > 0) continue;
    const copies = Math.round(tierWeight(def.tier, stage) * 2);
    for (let i = 0; i < copies; i++) {
      const item: Choice = {
        id: 'p-new-' + pid,
        kind: 'passive',
        passiveId: pid,
        name: def.name,
        icon: def.icon,
        color: def.color,
        desc: def.desc,
        tier: def.tier,
        isNew: true,
        level: 1,
        replace: passiveFull,
      };
      (passiveFull ? pReplace : pNew).push(item);
    }
  }

  for (const w of g.weapons) {
    const def = WEAPON_MAP[w.id];
    if (!def || w.level >= def.maxLevel) continue;
    const copies = Math.max(1, 5 - w.level);
    for (let i = 0; i < copies; i++) {
      wUp.push({
        id: 'w-up-' + w.id,
        kind: 'weapon',
        weaponId: w.id,
        name: def.name,
        icon: def.icon,
        color: def.color,
        desc: def.desc,
        tier: def.tier,
        isNew: false,
        level: w.level + 1,
      });
    }
  }

  for (const pid of g.ownedPassives) {
    const def = PASSIVE_MAP[pid];
    if (!def) continue;
    const lv = g.passives[pid] ?? 0;
    if (lv <= 0 || lv >= def.maxLevel) continue;
    const copies = Math.max(1, 5 - lv);
    for (let i = 0; i < copies; i++) {
      pUp.push({
        id: 'p-up-' + pid,
        kind: 'passive',
        passiveId: pid,
        name: def.name,
        icon: def.icon,
        color: def.color,
        desc: def.desc,
        tier: def.tier,
        isNew: false,
        level: lv + 1,
      });
    }
  }

  // 规则：奇数等级只出武器，偶数等级只出被动
  const wantWeapon = g.level % 2 === 1;
  const used = new Set<string>();
  let picks: Choice[] = [];

  const primary = wantWeapon ? [wReplace, wNew, wUp] : [pReplace, pNew, pUp];
  const backup = wantWeapon ? [pReplace, pNew, pUp] : [wReplace, wNew, wUp];

  picks = composePicks(primary[0], primary[1], primary[2], used);
  // 该类别实在没有可选项时，退回到另一类
  if (picks.length === 0) {
    picks = composePicks(backup[0], backup[1], backup[2], used);
  }
  // 还不够 3 张，用另一类补
  if (picks.length < 3) {
    picks.push(...composePicks(backup[0], backup[1], backup[2], used).slice(0, 3 - picks.length));
  }

  while (picks.length < 3) {
    picks.push({
      id: 'heal-' + picks.length,
      kind: 'heal',
      name: '治疗',
      icon: '💊',
      color: '#62c48d',
      desc: '回复 30 点生命',
      isNew: false,
      level: 1,
    });
  }
  return picks;
}

function applyChoice(g: Game, c: Choice): void {
  if (c.kind === 'weapon' && c.weaponId) {
    const existing = g.weapons.find((w) => w.id === c.weaponId);
    const def = WEAPON_MAP[c.weaponId];
    if (existing && def) existing.level = Math.min(def.maxLevel, existing.level + 1);
    else if (def) g.weapons.push({ id: c.weaponId, level: 1, cd: 0 });
  } else if (c.kind === 'passive' && c.passiveId) {
    const pid = c.passiveId;
    const def = PASSIVE_MAP[pid];
    if (def) {
      g.passives[pid] = Math.min(def.maxLevel, (g.passives[pid] ?? 0) + 1);
      applyMaxHp(g);
    }
  } else if (c.kind === 'heal') {
    g.player.hp = Math.min(g.player.maxHp, g.player.hp + 30);
  }
}

function finishLevelStep(g: Game): void {
  g.pendingLevels -= 1;
  g.pendingReplace = null;
  if (g.pendingLevels > 0) {
    g.choices = rollChoices(g);
  } else {
    g.phase = 'playing';
    g.choices = [];
  }
}

export function chooseUpgrade(g: Game, choiceId: string): void {
  if (g.phase !== 'levelup') return;
  const c = g.choices.find((x) => x.id === choiceId);
  if (!c) return;
  // 槽位已满 → 进入「选择要替换掉哪一个」
  if (c.replace) {
    g.pendingReplace = { choiceId: c.id };
    return;
  }
  applyChoice(g, c);
  finishLevelStep(g);
}

/** 替换槽位：targetId 是要换掉的旧武器 id 或旧被动 id */
export function applyReplace(g: Game, targetId: string): void {
  if (!g.pendingReplace) return;
  const c = g.choices.find((x) => x.id === g.pendingReplace?.choiceId);
  if (!c) return;
  if (c.kind === 'weapon' && c.weaponId) {
    const idx = g.weapons.findIndex((w) => w.id === targetId);
    const def = WEAPON_MAP[c.weaponId];
    if (idx < 0 || !def) return;
    g.weapons.splice(idx, 1, { id: c.weaponId, level: 1, cd: 0 });
  } else if (c.kind === 'passive' && c.passiveId) {
    if ((g.passives[targetId] ?? 0) <= 0) return;
    const def = PASSIVE_MAP[c.passiveId];
    if (!def) return;
    g.passives[targetId] = 0;
    g.passives[c.passiveId] = 1;
    applyMaxHp(g);
  } else {
    return;
  }
  finishLevelStep(g);
}

export function cancelReplace(g: Game): void {
  g.pendingReplace = null;
}

/** 开发/测试用：立刻进入一次升级三选一 */
export function devForceLevelup(g: Game): void {
  g.pendingLevels = 1;
  g.phase = 'levelup';
  g.choices = rollChoices(g);
}

/** 重抽（每局有限次数） */
export function rerollChoices(g: Game): boolean {
  if (g.phase !== 'levelup' || g.pendingReplace) return false;
  if (g.rerolls <= 0) return false;
  g.rerolls -= 1;
  g.choices = rollChoices(g);
  return true;
}

// ---------------- 主循环 ----------------
export function update(g: Game, dtRaw: number): void {
  const dt = Math.min(dtRaw, 0.05);
  if (g.phase !== 'playing') {
    if (g.phase !== 'levelup' && g.phase !== 'menu') decayVisuals(g, dt);
    return;
  }
  if (g.paused) return;

  g.time += dt;
  const p = g.player;

  const ix = g.input.x;
  const iy = g.input.y;
  const len = Math.hypot(ix, iy);
  if (len > 0.01) {
    p.pos.x = clamp(p.pos.x + (ix / len) * moveSpeed(g) * dt, p.radius, WORLD_W - p.radius);
    p.pos.y = clamp(p.pos.y + (iy / len) * moveSpeed(g) * dt, p.radius, WORLD_H - p.radius);
    p.facing = Math.atan2(iy, ix);
    p.moving = true;
  } else {
    p.moving = false;
  }
  p.invuln = Math.max(0, p.invuln - dt);

  const halfW = VIEW_W / 2 / VIEW_ZOOM;
  const halfH = VIEW_H / 2 / VIEW_ZOOM;
  const cx = clamp(p.pos.x, halfW, WORLD_W - halfW);
  const cy = clamp(p.pos.y, halfH, WORLD_H - halfH);
  g.camera.x += (cx - VIEW_W / 2 - g.camera.x) * Math.min(1, dt * 8);
  g.camera.y += (cy - VIEW_H / 2 - g.camera.y) * Math.min(1, dt * 8);

  const stageDef = STAGES[g.stage];
  g.spawnTimer -= dt;
  if (g.spawnTimer <= 0) {
    g.spawnTimer = spawnInterval(g.time) * stageDef.spawnMul;
    const batch = spawnBatch(g.time);
    if (g.enemies.length < 220) {
      for (let i = 0; i < batch; i++) spawn(g, pickEnemyKind(g.time), spawnPoint(g));
    }
  }
  g.eliteTimer -= dt;
  if (g.eliteTimer <= 0) {
    g.eliteTimer = 55;
    spawn(g, 'elite', spawnPoint(g));
    g.banners = { text: '精英出现', sub: '它掉落的经验很多', ttl: 2 };
  }
  if (g.bossIndex < stageDef.bossTimes.length && g.time >= stageDef.bossTimes[g.bossIndex]) {
    g.bossIndex += 1;
    spawnBoss(g);
  }

  for (const e of g.enemies) {
    if (e.hp <= 0) continue;
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    e.wobble += dt * 6;
    if (e.slowT > 0) {
      e.slowT -= dt;
      if (e.slowT <= 0) e.slowFactor = 1;
    }
    if (e.burn > 0) {
      e.burnT -= dt;
      if (e.burnT <= 0) {
        e.burnT = 0.5;
        const burnDmg = Math.max(1, Math.round(e.burn * 1.6));
        e.hp -= burnDmg;
        g.stats.damage += burnDmg;
        e.burn = Math.max(0, e.burn - 1);
        if (e.hp <= 0) {
          killEnemy(g, e);
          continue;
        }
      }
    }
    const dx = p.pos.x - e.pos.x;
    const dy = p.pos.y - e.pos.y;
    const dd = Math.hypot(dx, dy) || 1;
    const sp = e.speed * (e.slowT > 0 ? e.slowFactor : 1);
    e.pos.x += (dx / dd) * sp * dt;
    e.pos.y += (dy / dd) * sp * dt;
    if (dd < e.radius + p.radius) damagePlayer(g, e.damage, e);
    if ((g.phase as string) === 'dead') return;
  }

  for (const w of g.weapons) {
    w.cd -= dt;
    if (w.cd <= 0) {
      const def = WEAPON_MAP[w.id];
      if (!def) continue;
      const st = weaponStat(def, w.level);
      w.cd = st.cd * derived(g).cdMul;
      const always = def.mechanic === 'aura' || def.mechanic === 'orbit' || def.mechanic === 'pulse';
      if (g.enemies.length > 0 || always) fireWeapon(g, w);
    }
  }

  for (const pr of g.projectiles) {
    if (pr.kind === 'boomerang') {
      const range = pr.range ?? 300;
      if (!pr.returning && pr.origin && dist2(pr.pos, pr.origin) > range * range) pr.returning = true;
      if (pr.returning) {
        const dx = p.pos.x - pr.pos.x;
        const dy = p.pos.y - pr.pos.y;
        const dd = Math.hypot(dx, dy) || 1;
        pr.vel = { x: (dx / dd) * 480, y: (dy / dd) * 480 };
        if (dd < 24) {
          pr.ttl = 0;
          continue;
        }
      }
    }
    pr.pos.x += pr.vel.x * dt;
    pr.pos.y += pr.vel.y * dt;
    pr.ttl -= dt;
    for (const e of g.enemies) {
      if (e.hp <= 0 || pr.hit.includes(e.id)) continue;
      if (dist2(pr.pos, e.pos) < (e.radius + pr.radius) ** 2) {
        pr.hit.push(e.id);
        damageEnemy(g, e, pr.dmg, pr.color, pr.element);
        if (pr.pierce !== 999) {
          pr.pierce -= 1;
          if (pr.pierce <= 0) pr.ttl = 0;
        }
      }
    }
  }
  g.projectiles = g.projectiles.filter(
    (pr) =>
      pr.ttl > 0 &&
      pr.pos.x > -60 &&
      pr.pos.x < WORLD_W + 60 &&
      pr.pos.y > -60 &&
      pr.pos.y < WORLD_H + 60,
  );

  const pickR = pickupRadius(g);
  for (const gem of g.gems) {
    if (gem.collected) continue;
    const dx = p.pos.x - gem.pos.x;
    const dy = p.pos.y - gem.pos.y;
    const dd = Math.hypot(dx, dy) || 1;
    if (dd < pickR * 2.6) {
      const sp = dd < pickR ? (dd < pickR * 0.6 ? 460 : 260) : 110;
      gem.pos.x += (dx / dd) * sp * dt;
      gem.pos.y += (dy / dd) * sp * dt;
    }
    if (dd < p.radius + 12) {
      gem.collected = true;
      gainXp(g, gem.value);
    }
  }

  decayVisuals(g, dt);
  if (g.time >= stageDef.duration) g.phase = 'won';
}

function decayVisuals(g: Game, dt: number): void {
  if (g.enemies.some((e) => e.hp <= 0)) g.enemies = g.enemies.filter((e) => e.hp > 0);
  if (g.gems.some((gem) => gem.collected)) g.gems = g.gems.filter((gem) => !gem.collected);
  g.shake = Math.max(0, g.shake - dt * 30);
  for (const fx of g.effects) fx.ttl -= dt;
  if (g.effects.length > 220) g.effects.splice(0, g.effects.length - 220);
  if (g.effects.some((fx) => fx.ttl <= 0)) g.effects = g.effects.filter((fx) => fx.ttl > 0);
  if (g.banners && g.banners.ttl < 900) {
    g.banners.ttl -= dt;
    if (g.banners.ttl <= 0) g.banners = null;
  }
}

/** 结算：局内金币 + 通关奖励 */
export function payout(g: Game): { base: number; winBonus: number; total: number } {
  const winBonus = g.phase === 'won' ? 200 + g.stage * 150 : 0;
  const base = Math.round(g.coins);
  return { base, winBonus, total: base + winBonus };
}

/** 抽奖：按稀有度权重随机一个未拥有的物品 */
export function rollGacha(owned: { weapons: string[]; passives: string[] }): {
  kind: 'weapon' | 'passive';
  id: string;
  tier: string;
} | null {
  const pool: { kind: 'weapon' | 'passive'; id: string; tier: string; weight: number }[] = [];
  for (const w of WEAPONS) {
    if (owned.weapons.includes(w.id)) continue;
    pool.push({ kind: 'weapon', id: w.id, tier: w.tier, weight: TIER_INFO[w.tier].weight });
  }
  for (const p of PASSIVES) {
    if (owned.passives.includes(p.id)) continue;
    pool.push({ kind: 'passive', id: p.id, tier: p.tier, weight: TIER_INFO[p.tier].weight });
  }
  if (pool.length === 0) return null;
  const total = pool.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const item of pool) {
    r -= item.weight;
    if (r <= 0) return { kind: item.kind, id: item.id, tier: item.tier };
  }
  return { kind: pool[0].kind, id: pool[0].id, tier: pool[0].tier };
}
