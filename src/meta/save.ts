// 本地存档：金币 / 已解锁内容 / 统计
import { STARTER_PASSIVES, STARTER_WEAPONS } from '../game/content';

const KEY = 'echo-survivors-save-v1';
export const DEFAULT_COINS = 999999;
export const SAVE_VERSION = 2;

export interface MetaSave {
  v: number;
  coins: number;
  weapons: string[];
  passives: string[];
  selectedStage: number;
  stats: {
    runs: number;
    wins: number;
    bestTime: number;
    totalKills: number;
  };
}

export function defaultSave(): MetaSave {
  return {
    v: SAVE_VERSION,
    coins: DEFAULT_COINS,
    weapons: [...STARTER_WEAPONS],
    passives: [...STARTER_PASSIVES],
    selectedStage: 0,
    stats: { runs: 0, wins: 0, bestTime: 0, totalKills: 0 },
  };
}

export function loadSave(): MetaSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const fresh = defaultSave();
      writeSave(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<MetaSave>;
    const base = defaultSave();
    const next: MetaSave = {
      v: SAVE_VERSION,
      coins: typeof parsed.coins === 'number' ? parsed.coins : base.coins,
      weapons: Array.isArray(parsed.weapons) ? unique([...STARTER_WEAPONS, ...parsed.weapons]) : base.weapons,
      passives: Array.isArray(parsed.passives) ? unique([...STARTER_PASSIVES, ...parsed.passives]) : base.passives,
      selectedStage: typeof parsed.selectedStage === 'number' ? parsed.selectedStage : 0,
      stats: {
        runs: parsed.stats?.runs ?? 0,
        wins: parsed.stats?.wins ?? 0,
        bestTime: parsed.stats?.bestTime ?? 0,
        totalKills: parsed.stats?.totalKills ?? 0,
      },
    };
    // v1 → v2：老存档直接补到 999,999 金币
    if ((parsed.v ?? 1) < SAVE_VERSION) {
      next.coins = Math.max(next.coins, DEFAULT_COINS);
      writeSave(next);
    }
    return next;
  } catch {
    return defaultSave();
  }
}

export function writeSave(save: MetaSave): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // 隐私模式下 localStorage 可能不可用，忽略
  }
}

export function resetSave(): MetaSave {
  const fresh = defaultSave();
  writeSave(fresh);
  return fresh;
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export function isOwned(save: MetaSave, id: string): boolean {
  return save.weapons.includes(id) || save.passives.includes(id);
}
