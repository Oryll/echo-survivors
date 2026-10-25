// 幸存者原型 —— 类型定义（v0.2：内容分级 + 局外经济）

export interface Vec {
  x: number;
  y: number;
}

export type Tier = 'common' | 'rare' | 'epic';
export type Element = 'none' | 'burn' | 'slow';
export type Mechanic =
  | 'blade'
  | 'aura'
  | 'chain'
  | 'boomerang'
  | 'nova'
  | 'beam'
  | 'strike'
  | 'spray'
  | 'orbit'
  | 'pulse';

export type EnemyKind = 'crawler' | 'runner' | 'tank' | 'splitter' | 'shard' | 'elite' | 'boss';
export type Phase = 'menu' | 'shop' | 'gacha' | 'playing' | 'levelup' | 'dead' | 'won';

export interface WeaponDef {
  id: string;
  name: string;
  tier: Tier;
  mechanic: Mechanic;
  element: Element;
  icon: string;
  color: string;
  desc: string;
  maxLevel: number;
  base: {
    damage: number;
    cd: number;
    count?: number;
    radius?: number;
    range?: number;
    speed?: number;
  };
}

export interface PassiveDef {
  id: string;
  name: string;
  tier: Tier;
  icon: string;
  color: string;
  desc: string;
  maxLevel: number;
}

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  speed: number;
  radius: number;
  color: string;
  xp: number;
  damage: number;
  coin: number;
  boss?: boolean;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  color: string;
  xp: number;
  damage: number;
  coin: number;
  pos: Vec;
  hitFlash: number;
  boss?: boolean;
  wobble: number;
  burn: number;
  burnT: number;
  slowT: number;
  slowFactor: number;
}

export interface Projectile {
  id: number;
  kind: 'blade' | 'boomerang';
  pos: Vec;
  vel: Vec;
  dmg: number;
  ttl: number;
  pierce: number;
  radius: number;
  color: string;
  element: Element;
  hit: number[];
  origin?: Vec;
  returning?: boolean;
  range?: number;
}

export interface Gem {
  id: number;
  pos: Vec;
  value: number;
  big: boolean;
  collected?: boolean;
}

export type Effect =
  | { kind: 'ring'; pos: Vec; r: number; ttl: number; max: number; color: string; width?: number }
  | { kind: 'spark'; pos: Vec; ttl: number; max: number; color: string }
  | { kind: 'line'; a: Vec; b: Vec; ttl: number; max: number; color: string; width?: number }
  | { kind: 'text'; pos: Vec; text: string; ttl: number; max: number; color: string };

export interface Player {
  pos: Vec;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  invuln: number;
  facing: number;
  moving: boolean;
  revived: boolean;
}

export interface WeaponState {
  id: string;
  level: number;
  cd: number;
}

export interface Choice {
  id: string;
  kind: 'weapon' | 'passive' | 'heal';
  weaponId?: string;
  passiveId?: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
  tier?: Tier;
  isNew: boolean;
  level: number;
  /** 槽位已满：选中后需要选择替换掉哪一个 */
  replace?: boolean;
}

export interface Game {
  phase: Phase;
  time: number;
  player: Player;
  weapons: WeaponState[];
  passives: Record<string, number>;
  enemies: Enemy[];
  projectiles: Projectile[];
  gems: Gem[];
  effects: Effect[];
  camera: Vec;
  spawnTimer: number;
  eliteTimer: number;
  bossIndex: number;
  kills: number;
  level: number;
  xp: number;
  xpNext: number;
  pendingLevels: number;
  choices: Choice[];
  shake: number;
  nextId: number;
  paused: boolean;
  coins: number;
  stage: number;
  rerolls: number;
  pendingReplace: { choiceId: string } | null;
  ownedWeapons: string[];
  ownedPassives: string[];
  stats: {
    damage: number;
    gems: number;
    kills: number;
  };
  banners: { text: string; sub: string; ttl: number } | null;
  input: { x: number; y: number };
}
