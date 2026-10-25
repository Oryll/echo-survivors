// 内容表：3 个稀有度 × 10 武器 / 5 被动
import type { Element, Mechanic, PassiveDef, Tier, WeaponDef } from './types';

export const TIER_INFO: Record<Tier, { name: string; color: string; priceW: number; priceP: number; weight: number }> = {
  common: { name: '普通', color: '#8fa3bb', priceW: 400, priceP: 260, weight: 62 },
  rare: { name: '精良', color: '#5f9fd8', priceW: 1200, priceP: 780, weight: 30 },
  epic: { name: '史诗', color: '#c39bff', priceW: 2600, priceP: 1600, weight: 8 },
};

export const TIERS: Tier[] = ['common', 'rare', 'epic'];

interface WeaponBase {
  damage: number;
  cd: number;
  count?: number;
  radius?: number;
  range?: number;
  speed?: number;
}

function mkWeapon(
  id: string,
  name: string,
  tier: Tier,
  mechanic: Mechanic,
  element: Element,
  icon: string,
  desc: string,
  base: WeaponBase,
): WeaponDef {
  return {
    id,
    name,
    tier,
    mechanic,
    element,
    icon,
    color: TIER_INFO[tier].color,
    desc,
    maxLevel: 5,
    base,
  };
}

export const WEAPONS: WeaponDef[] = [
  // ---- 投掷飞刃 ----
  mkWeapon('blade0', '飞刃', 'common', 'blade', 'none', '🗡️', '向最近的敌人投出飞刃。', { damage: 11, cd: 0.72, count: 1, speed: 540 }),
  mkWeapon('blade1', '裂空刃', 'rare', 'blade', 'burn', '⚔️', '飞刃击中后点燃敌人。', { damage: 18, cd: 0.62, count: 2, speed: 580 }),
  mkWeapon('blade2', '星陨飞刃', 'epic', 'blade', 'burn', '🌟', '多枚飞刃穿透敌群。', { damage: 27, cd: 0.52, count: 3, speed: 640 }),
  // ---- 灼烧光环 ----
  mkWeapon('aura0', '灼烧光环', 'common', 'aura', 'burn', '🔥', '身周持续灼烧靠近的敌人。', { damage: 6, cd: 0.5, radius: 96 }),
  mkWeapon('aura1', '熔火领域', 'rare', 'aura', 'burn', '🌋', '更大的灼烧范围。', { damage: 11, cd: 0.44, radius: 122 }),
  mkWeapon('aura2', '日冕', 'epic', 'aura', 'burn', '☀️', '太阳般的火环。', { damage: 18, cd: 0.38, radius: 152 }),
  // ---- 闪电链 ----
  mkWeapon('chain0', '电弧', 'common', 'chain', 'none', '⚡', '随机电击一个敌人。', { damage: 20, cd: 1.5, count: 1, range: 430 }),
  mkWeapon('chain1', '连锁闪电', 'rare', 'chain', 'slow', '🌩️', '电击多个目标并减速。', { damage: 30, cd: 1.3, count: 2, range: 460 }),
  mkWeapon('chain2', '雷霆审判', 'epic', 'chain', 'slow', '⛈️', '雷暴横扫全场。', { damage: 44, cd: 1.1, count: 3, range: 500 }),
  // ---- 回旋镖 ----
  mkWeapon('boomer0', '回旋镖', 'common', 'boomerang', 'none', '🔁', '飞出后折返，来回命中。', { damage: 16, cd: 1.4, range: 300, speed: 430 }),
  mkWeapon('boomer1', '风暴回旋', 'rare', 'boomerang', 'slow', '🌀', '更大更慢的回旋镖。', { damage: 26, cd: 1.25, range: 340, speed: 470 }),
  mkWeapon('boomer2', '死神回旋', 'epic', 'boomerang', 'none', '☠️', '巨大的双刃回旋。', { damage: 40, cd: 1.1, range: 380, speed: 520 }),
  // ---- 新星 ----
  mkWeapon('nova0', '震波', 'common', 'nova', 'none', '💥', '周期性向四周爆发冲击。', { damage: 16, cd: 2.0, radius: 130 }),
  mkWeapon('nova1', '冲击波', 'rare', 'nova', 'slow', '🌊', '冲击波会减速敌人。', { damage: 26, cd: 1.8, radius: 160 }),
  mkWeapon('nova2', '湮灭新星', 'epic', 'nova', 'burn', '💫', '毁灭性的环状爆发。', { damage: 42, cd: 1.6, radius: 195 }),
  // ---- 光束 ----
  mkWeapon('beam0', '光束', 'common', 'beam', 'none', '🔆', '射出一道穿透光束。', { damage: 14, cd: 1.6, range: 460 }),
  mkWeapon('beam1', '贯穿射线', 'rare', 'beam', 'burn', '🔅', '灼热的贯穿射线。', { damage: 22, cd: 1.4, range: 520 }),
  mkWeapon('beam2', '裁决之光', 'epic', 'beam', 'burn', '✨', '圣光扫过整条直线。', { damage: 34, cd: 1.2, range: 600 }),
  // ---- 落石/陨星 ----
  mkWeapon('strike0', '落石', 'common', 'strike', 'none', '⛰️', '随机砸向敌人。', { damage: 24, cd: 1.7, count: 1, radius: 46 }),
  mkWeapon('strike1', '陨星', 'rare', 'strike', 'burn', '☄️', '燃烧的陨星。', { damage: 36, cd: 1.5, count: 2, radius: 54 }),
  mkWeapon('strike2', '天罚', 'epic', 'strike', 'burn', '🔥', '连续坠落的天火。', { damage: 54, cd: 1.3, count: 3, radius: 62 }),
  // ---- 散弹 ----
  mkWeapon('spray0', '碎石散弹', 'common', 'spray', 'none', '💨', '近距离扇形弹幕。', { damage: 8, cd: 0.95, count: 3, range: 260 }),
  mkWeapon('spray1', '烈焰喷射', 'rare', 'spray', 'burn', '🌡️', '扇形火焰点燃烧敌人。', { damage: 13, cd: 0.85, count: 5, range: 280 }),
  mkWeapon('spray2', '龙息', 'epic', 'spray', 'burn', '🐉', '毁灭性的火焰吐息。', { damage: 20, cd: 0.72, count: 7, range: 300 }),
  // ---- 环绕刃 ----
  mkWeapon('orbit0', '环绕刃', 'common', 'orbit', 'none', '⚙️', '环绕自身旋转的刀刃。', { damage: 8, cd: 0.34, count: 2, radius: 68 }),
  mkWeapon('orbit1', '碎星环', 'rare', 'orbit', 'slow', '💠', '更多的环绕刃并减速。', { damage: 13, cd: 0.3, count: 3, radius: 82 }),
  mkWeapon('orbit2', '星环', 'epic', 'orbit', 'slow', '🧿', '星环碾过一切。', { damage: 20, cd: 0.26, count: 5, radius: 96 }),
  // ---- 脉冲 ----
  mkWeapon('pulse0', '脉动', 'common', 'pulse', 'none', '📡', '一圈圈扩散的冲击。', { damage: 12, cd: 1.9, radius: 170 }),
  mkWeapon('pulse1', '冲击脉冲', 'rare', 'pulse', 'slow', '🔊', '更快的脉冲波。', { damage: 20, cd: 1.6, radius: 205 }),
  mkWeapon('pulse2', '虚空回响', 'epic', 'pulse', 'burn', '🌌', '来自虚空的连续回响。', { damage: 32, cd: 1.3, radius: 245 }),
];

export const WEAPON_MAP: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

export function weaponStat(def: WeaponDef, level: number) {
  const lv = Math.max(1, level);
  const dmg = Math.round(def.base.damage * (1 + 0.3 * (lv - 1)));
  const cd = def.base.cd * Math.pow(0.94, lv - 1);
  const count = def.base.count ? def.base.count + Math.floor((lv - 1) / 2) : undefined;
  const radius = def.base.radius ? def.base.radius + (lv - 1) * 10 : undefined;
  const range = def.base.range ? def.base.range + (lv - 1) * 14 : undefined;
  return { damage: dmg, cd, count, radius, range, speed: def.base.speed ?? 500 };
}

export function weaponLevelText(def: WeaponDef, level: number): string {
  const s = weaponStat(def, level);
  const bits: string[] = [`伤害 ${s.damage}`];
  if (s.count) bits.push(`${s.count} 个`);
  if (s.radius) bits.push(`半径 ${s.radius}`);
  if (s.range) bits.push(`射程 ${s.range}`);
  bits.push(`间隔 ${s.cd.toFixed(2)}s`);
  if (def.element === 'burn') bits.push('附加灼烧');
  if (def.element === 'slow') bits.push('附加减速');
  return bits.join(' · ');
}

// ---------------- 被动 ----------------
function mkPassive(
  id: string,
  name: string,
  tier: Tier,
  icon: string,
  desc: string,
): PassiveDef {
  return { id, name, tier, icon, color: TIER_INFO[tier].color, desc, maxLevel: 5 };
}

export const PASSIVES: PassiveDef[] = [
  mkPassive('pow', '锋锐', 'common', '💥', '所有伤害 +10%'),
  mkPassive('haste', '急速', 'common', '⏱️', '武器冷却 -8%'),
  mkPassive('swift', '疾行', 'common', '👟', '移动速度 +8%'),
  mkPassive('vigor', '体魄', 'common', '❤️', '生命上限 +15'),
  mkPassive('magnet', '磁铁', 'common', '🧲', '拾取范围 +30%'),
  mkPassive('crit', '锐眼', 'rare', '🎯', '暴击率 +8%（暴击 2 倍伤害）'),
  mkPassive('leech', '吸血', 'rare', '🩸', '造成伤害的 2% 转化为生命'),
  mkPassive('thorns', '荆棘', 'rare', '🌵', '被近身时反伤 10'),
  mkPassive('luck', '幸运', 'rare', '🍀', '经验获取 +15%'),
  mkPassive('guard', '铁壁', 'rare', '🛡️', '每次受到的伤害 -2'),
  mkPassive('slaughter', '屠戮', 'epic', '🔪', '所有伤害 +22%'),
  mkPassive('gale', '疾风', 'epic', '🌪️', '武器冷却 -14%'),
  mkPassive('titan', '巨躯', 'epic', '🗿', '生命上限 +40，移动速度 +5%'),
  mkPassive('greed', '贪婪', 'epic', '💰', '金币获取 +35%'),
  mkPassive('revive', '不死', 'epic', '🕯️', '每局一次：死亡时以 50% 生命复活'),
];

export const PASSIVE_MAP: Record<string, PassiveDef> = Object.fromEntries(PASSIVES.map((p) => [p.id, p]));

export const ALL_ITEM_IDS = [...WEAPONS.map((w) => w.id), ...PASSIVES.map((p) => p.id)];

/** 初始就拥有的东西 */
export const STARTER_WEAPONS = ['blade0', 'aura0'];
export const STARTER_PASSIVES = ['pow', 'swift'];

/** 抽奖花费 */
export const GACHA_COST = 150;
