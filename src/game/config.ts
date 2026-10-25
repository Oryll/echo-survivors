// 世界 / 难度 / 敌人 / 玩家 基础配置（内容表在 content.ts）
import type { EnemyDef } from './types';

export const VIEW_W = 960;
export const VIEW_H = 600;
export const VIEW_ZOOM = 1.25;
export const WORLD_W = 2400;
export const WORLD_H = 1600;

export const WIN_TIME = 600;
export const BASE_PICKUP = 70;
export const BOSS_TIMES = [300, 540];

/** 每局可用的重抽次数 */
export const BASE_REROLLS = 3;
export const WEAPON_SLOTS = 5;
export const PASSIVE_SLOTS = 6;

export interface StageDef {
  id: string;
  name: string;
  desc: string;
  /** 存活多久算通关（秒） */
  duration: number;
  hpMul: number;
  /** 刷怪间隔倍率（<1 更密） */
  spawnMul: number;
  coinMul: number;
  bossTimes: number[];
  /** 需要通关多少次解锁 */
  unlockWins: number;
  color: string;
}

export const STAGES: StageDef[] = [
  {
    id: 'corridor',
    name: '回响回廊',
    desc: '标准难度 · 活到 10:00',
    duration: 600,
    hpMul: 1,
    spawnMul: 1,
    coinMul: 1,
    bossTimes: [300, 540],
    unlockWins: 0,
    color: '#5f9fd8',
  },
  {
    id: 'ember',
    name: '熔火深渊',
    desc: '12:00 · 敌人更硬、刷得更密 · 金币 +30%',
    duration: 720,
    hpMul: 1.28,
    spawnMul: 0.9,
    coinMul: 1.3,
    bossTimes: [300, 540, 660],
    unlockWins: 1,
    color: '#e08a4e',
  },
  {
    id: 'void',
    name: '虚空回廊',
    desc: '15:00 · 极限压力 · 金币 +60%',
    duration: 900,
    hpMul: 1.55,
    spawnMul: 0.82,
    coinMul: 1.6,
    bossTimes: [280, 520, 720, 860],
    unlockWins: 3,
    color: '#a077d8',
  },
];

export function stageUnlocked(stage: StageDef, wins: number): boolean {
  return wins >= stage.unlockWins;
}

export const ENEMIES: EnemyDef[] = [
  { kind: 'crawler', name: '蠕行者', hp: 12, speed: 60, radius: 11, color: '#d46055', xp: 1, damage: 7, coin: 0.12 },
  { kind: 'runner', name: '疾行者', hp: 10, speed: 108, radius: 9, color: '#e3c05f', xp: 1, damage: 5, coin: 0.12 },
  { kind: 'tank', name: '重甲', hp: 62, speed: 40, radius: 16, color: '#8b96ab', xp: 3, damage: 12, coin: 0.4 },
  { kind: 'splitter', name: '分裂体', hp: 34, speed: 62, radius: 13, color: '#a077d8', xp: 2, damage: 8, coin: 0.25 },
  { kind: 'shard', name: '碎片', hp: 9, speed: 88, radius: 8, color: '#c9a9ef', xp: 1, damage: 5, coin: 0.05 },
  { kind: 'elite', name: '精英', hp: 210, speed: 50, radius: 22, color: '#ff8a5c', xp: 8, damage: 15, coin: 2 },
  { kind: 'boss', name: '回响巨像', hp: 1500, speed: 40, radius: 34, color: '#ff6b5c', xp: 80, damage: 18, coin: 8, boss: true },
];

export const ENEMY_MAP: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.kind, e]));

export function hpMul(time: number): number {
  return 1 + (time / 60) * 0.45;
}

export function damageMul(time: number): number {
  return 1 + (time / 600) * 0.6;
}

export function spawnInterval(time: number): number {
  return Math.max(0.14, 0.42 - (time / 600) * 0.28);
}

export function spawnBatch(time: number): number {
  return 1 + Math.floor(time / 250);
}

export function levelXp(level: number): number {
  return 6 + Math.round(level * 4.4);
}

export const PLAYER = {
  maxHp: 110,
  speed: 200,
  radius: 12,
  invulnTime: 0.6,
};
