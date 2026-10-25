// 引擎级自检：槽位满替换 / 重抽 / 关卡参数
import type { Game } from '../src/game/types';
import {
  applyReplace,
  chooseUpgrade,
  createGame,
  devForceLevelup,
  rerollChoices,
  startRun,
} from '../src/game/engine';
import { PASSIVES, WEAPONS } from '../src/game/content';
import { STAGES } from '../src/game/config';

const all = { weapons: WEAPONS.map((w) => w.id), passives: PASSIVES.map((p) => p.id) };

function fresh(stage = 0): Game {
  const g = createGame(all, stage);
  startRun(g);
  return g;
}

// 1) 武器格满时出现「替换」选项
const g = fresh();
g.weapons = ['blade0', 'aura0', 'chain0', 'nova0', 'beam0'].map((id) => ({ id, level: 2, cd: 0 }));
for (const p of ['pow', 'haste', 'swift', 'vigor', 'magnet', 'crit']) g.passives[p] = 1;
g.level = 3; // 奇数等级 → 只出武器
devForceLevelup(g);
const replaceChoice = g.choices.find((c) => c.replace);
console.log('1) 槽满三选一：', g.choices.map((c) => `${c.name}${c.replace ? '(替换)' : '(升级)'}`).join(' / '));
if (!replaceChoice) throw new Error('槽位满了却没有替换选项');

// 2) 选中替换 → 进入选槽 → 换掉一个
chooseUpgrade(g, replaceChoice.id);
console.log('2) 进入替换模式：', g.pendingReplace ? '是' : '否', '| 类型:', replaceChoice.kind);
if (replaceChoice.kind === 'weapon') {
  const before = g.weapons.map((w) => `${w.id}${w.level}`).join(',');
  applyReplace(g, g.weapons[0].id);
  const after = g.weapons.map((w) => `${w.id}${w.level}`).join(',');
  console.log('   替换前:', before);
  console.log('   替换后:', after, '| 武器数', g.weapons.length, '| 回到 playing:', g.phase);
} else {
  applyReplace(g, 'pow');
  const active = Object.entries(g.passives).filter(([, v]) => v > 0).length;
  console.log('   被动替换后：pow=', g.passives.pow, '| 生效被动数', active, '| 回到 playing:', g.phase);
}

// 3) 被动槽满时的替换
const g2 = fresh();
g2.weapons = ['blade0', 'aura0', 'chain0', 'nova0', 'beam0'].map((id) => ({ id, level: 1, cd: 0 }));
for (const p of ['pow', 'haste', 'swift', 'vigor', 'magnet', 'crit']) g2.passives[p] = 2;
g2.level = 4; // 偶数等级 → 只出被动
devForceLevelup(g2);
let pReplace = g2.choices.find((c) => c.replace && c.kind === 'passive');
for (let i = 0; i < 30 && !pReplace; i++) {
  rerollChoices(g2);
  if (g2.rerolls <= 0) {
    g2.rerolls = 3;
  }
  pReplace = g2.choices.find((c) => c.replace && c.kind === 'passive');
}
if (!pReplace) throw new Error('被动槽满了却没有替换选项');
chooseUpgrade(g2, pReplace.id);
applyReplace(g2, 'pow');
const active = Object.entries(g2.passives).filter(([, v]) => v > 0).length;
console.log('3) 被动替换后：pow=', g2.passives.pow, '| 生效被动数', active);

// 4) 重抽
const g3 = fresh();
g3.level = 3;
devForceLevelup(g3);
const first = g3.choices.map((c) => c.name).join('/');
const ok = rerollChoices(g3);
console.log('4) 重抽:', ok ? '成功' : '失败', '| 剩余', g3.rerolls, '| 之前', first, '→', g3.choices.map((c) => c.name).join('/'));
if (g3.rerolls !== 2) throw new Error('重抽次数不对');

// 5) 关卡差异
for (let i = 0; i < STAGES.length; i++) {
  const gs = fresh(i);
  console.log(`5) 关卡${i}: ${STAGES[i].name} 目标 ${STAGES[i].duration}s | Boss × ${STAGES[i].bossTimes.length} | 金币 × ${STAGES[i].coinMul} | g.stage=${gs.stage}`);
}

// 6) 组合规则：槽位全满时，三张里最多 1 张「替换」，其余必须是升级
const g4 = fresh();
g4.ownedWeapons = WEAPONS.map((w) => w.id);
g4.ownedPassives = PASSIVES.map((p) => p.id);
g4.weapons = ['blade0', 'aura0', 'chain0', 'nova0', 'beam0'].map((id) => ({ id, level: 1, cd: 0 }));
for (const p of ['pow', 'haste', 'swift', 'vigor', 'magnet', 'crit']) g4.passives[p] = 1;

let maxReplace = 0;
let minUpgrades = 99;
let badCombo = 0;
for (let i = 0; i < 300; i++) {
  g4.level = 3; // 奇数 → 武器
  devForceLevelup(g4);
  const replaceCount = g4.choices.filter((c) => c.replace).length;
  const upgradeCount = g4.choices.filter((c) => !c.isNew && c.kind !== 'heal').length;
  maxReplace = Math.max(maxReplace, replaceCount);
  minUpgrades = Math.min(minUpgrades, upgradeCount);
  if (replaceCount > 1) badCombo += 1;
  if (upgradeCount < 2) badCombo += 1;
  g4.phase = 'playing';
  g4.choices = [];
}
console.log(`6) 槽满组合规则：300 次三选一 | 单次最多替换 ${maxReplace} 张 | 单次最少升级 ${minUpgrades} 张 | 违规 ${badCombo} 次`);
if (badCombo > 0) throw new Error('组合规则不满足');

// 7) 空槽阶段：新内容仍可正常出现（不强制 2 张升级）
const g5 = fresh();
g5.weapons = [{ id: 'blade0', level: 1, cd: 0 }];
g5.passives.pow = 1;
g5.level = 3;
devForceLevelup(g5);
console.log('7) 空槽阶段三选一：', g5.choices.map((c) => `${c.name}${c.replace ? '(替换)' : c.isNew ? '(新)' : '(升级)'}`).join(' / '));

// 8) 奇偶等级规则：奇数等级只出武器，偶数等级只出被动
const g6 = fresh();
g6.ownedWeapons = WEAPONS.map((w) => w.id);
g6.ownedPassives = PASSIVES.map((p) => p.id);
g6.weapons = ['blade0', 'aura0', 'chain0', 'nova0', 'beam0'].map((id) => ({ id, level: 1, cd: 0 }));
for (const p of ['pow', 'haste', 'swift', 'vigor', 'magnet', 'crit']) g6.passives[p] = 2;

let parityBad = 0;
for (let lv = 2; lv <= 15; lv++) {
  g6.level = lv;
  devForceLevelup(g6);
  const kinds = new Set(g6.choices.filter((c) => c.kind !== 'heal').map((c) => c.kind));
  const want = lv % 2 === 1 ? 'weapon' : 'passive';
  const fallback = kinds.size === 0;
  const ok = fallback || kinds.has(want);
  if (!ok) parityBad += 1;
  console.log(
    `   Lv.${lv}（应 ${want === 'weapon' ? '武器' : '被动'}）：`,
    g6.choices.map((c) => `${c.name}${c.kind === 'heal' ? '(治疗)' : ''}`).join(' / '),
    ok ? '✓' : '✗',
  );
  g6.phase = 'playing';
  g6.choices = [];
}
console.log(`8) 奇偶等级规则：15 个等级检查，违规 ${parityBad} 次`);
if (parityBad > 0) throw new Error('奇偶等级规则不满足');

console.log('全部检查通过');
