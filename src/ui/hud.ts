// HUD 快照（v0.2）
import type { Choice, Game, Phase } from '../game/types';
import { STAGES } from '../game/config';
import { PASSIVE_MAP, WEAPON_MAP, weaponStat } from '../game/content';

export interface HudSnapshot {
  phase: Phase;
  paused: boolean;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpNext: number;
  time: number;
  kills: number;
  coins: number;
  weapons: { id: string; name: string; icon: string; level: number; max: number; color: string }[];
  passives: { id: string; name: string; icon: string; level: number; max: number; color: string }[];
  choices: Choice[];
  banners: { text: string; sub: string } | null;
  pendingLevels: number;
  levelCategory: 'weapon' | 'passive' | 'mixed' | 'none';
  nextBoss: number | null;
  rerolls: number;
  stageName: string;
  stageDuration: number;
  pendingReplace: { kind: 'weapon' | 'passive'; name: string; icon: string } | null;
  weaponSlots: { id: string; name: string; icon: string; level: number; color: string }[];
  passiveSlots: { id: string; name: string; icon: string; level: number; color: string }[];
}

export function makeHud(g: Game): HudSnapshot {
  const stage = STAGES[g.stage];
  const nextBossTime = stage.bossTimes.find((t) => t > g.time) ?? null;
  const kinds = new Set(g.choices.map((c) => c.kind).filter((k) => k !== 'heal'));
  const levelCategory: 'weapon' | 'passive' | 'mixed' | 'none' =
    kinds.size === 0 ? 'none' : kinds.size > 1 ? 'mixed' : kinds.has('weapon') ? 'weapon' : 'passive';
  const pendingChoice = g.pendingReplace
    ? g.choices.find((c) => c.id === g.pendingReplace?.choiceId)
    : null;
  return {
    phase: g.phase,
    paused: g.paused,
    hp: Math.max(0, Math.ceil(g.player.hp)),
    maxHp: Math.round(g.player.maxHp),
    level: g.level,
    xp: g.xp,
    xpNext: g.xpNext,
    time: g.time,
    kills: g.kills,
    coins: Math.floor(g.coins),
    weapons: g.weapons.map((w) => {
      const def = WEAPON_MAP[w.id];
      const st = def ? weaponStat(def, w.level) : null;
      return {
        id: w.id,
        name: def?.name ?? w.id,
        icon: def?.icon ?? '?',
        level: w.level,
        max: def?.maxLevel ?? 5,
        color: def?.color ?? '#888',
        damage: st?.damage ?? 0,
      };
    }),
    passives: Object.entries(g.passives)
      .filter(([, lv]) => lv > 0)
      .map(([id, lv]) => {
        const def = PASSIVE_MAP[id];
        return {
          id,
          name: def?.name ?? id,
          icon: def?.icon ?? '?',
          level: lv,
          max: def?.maxLevel ?? 5,
          color: def?.color ?? '#888',
        };
      }),
    choices: g.choices,
    banners: g.banners ? { text: g.banners.text, sub: g.banners.sub } : null,
    pendingLevels: g.pendingLevels,
    nextBoss: nextBossTime == null ? null : Math.max(0, nextBossTime - g.time),
    rerolls: g.rerolls,
    levelCategory,
    stageName: stage.name,
    stageDuration: stage.duration,
    pendingReplace: pendingChoice
      ? {
          kind: pendingChoice.kind === 'weapon' ? 'weapon' : 'passive',
          name: pendingChoice.name,
          icon: pendingChoice.icon,
        }
      : null,
    weaponSlots: g.weapons.map((w) => {
      const def = WEAPON_MAP[w.id];
      return {
        id: w.id,
        name: def?.name ?? w.id,
        icon: def?.icon ?? '?',
        level: w.level,
        color: def?.color ?? '#888',
      };
    }),
    passiveSlots: Object.entries(g.passives)
      .filter(([, lv]) => lv > 0)
      .map(([id, lv]) => {
        const def = PASSIVE_MAP[id];
        return {
          id,
          name: def?.name ?? id,
          icon: def?.icon ?? '?',
          level: lv,
          color: def?.color ?? '#888',
        };
      }),
  };
}

export function hudSignature(g: Game): string {
  return [
    g.phase,
    g.paused ? 1 : 0,
    Math.ceil(g.player.hp),
    Math.round(g.player.maxHp),
    g.level,
    Math.floor((g.xp / Math.max(1, g.xpNext)) * 100),
    Math.floor(g.time),
    g.kills,
    Math.floor(g.coins),
    g.weapons.map((w) => w.id + w.level).join(','),
    Object.entries(g.passives).map(([k, v]) => k + v).join(','),
    g.choices.map((c) => c.id).join(','),
    g.banners ? g.banners.text : '',
    g.pendingLevels,
    g.rerolls,
    g.choices.map((c) => c.kind).join(''),
    g.pendingReplace ? g.pendingReplace.choiceId : '',
    g.stage,
  ].join('|');
}
