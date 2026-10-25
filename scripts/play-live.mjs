// 在可见浏览器里真玩回响幸存者：键盘走位 + 点升级卡
import { writeFileSync, mkdirSync } from 'node:fs';

const CDP = 'http://127.0.0.1:9224';
const DURATION = Number(process.argv[2] ?? 200000);
mkdirSync('shots/live', { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(CDP + '/json/list')).json();
const page = list.find((t) => t.type === 'page' && t.url.includes('echo-survivors'));
if (!page) throw new Error('窗口里没有游戏页面:\n' + JSON.stringify(list.map((t) => t.url)));

const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.text ?? 'exception');
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
  }
});
await new Promise((r) => ws.addEventListener('open', r));
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`shots/live/${name}.png`, Buffer.from(r.data, 'base64'));
};

// ---- 键盘 ----
const KEYMAP = {
  up: { key: 'w', code: 'KeyW', vk: 87 },
  down: { key: 's', code: 'KeyS', vk: 83 },
  left: { key: 'a', code: 'KeyA', vk: 65 },
  right: { key: 'd', code: 'KeyD', vk: 68 },
};
const held = new Set();
async function setKeys(dirs) {
  const want = new Set(dirs);
  for (const d of [...held]) {
    if (!want.has(d)) {
      const k = KEYMAP[d];
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k.key, code: k.code, windowsVirtualKeyCode: k.vk });
      held.delete(d);
    }
  }
  for (const d of want) {
    if (!held.has(d)) {
      const k = KEYMAP[d];
      await send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: k.key,
        code: k.code,
        windowsVirtualKeyCode: k.vk,
        text: k.key,
      });
      held.add(d);
    }
  }
}

const state = () =>
  evalJs(`(() => {
    const g = window.__game;
    const t = (s) => (document.querySelector(s)?.textContent ?? '').trim();
    if (!g) return null;
    return {
      phase: g.phase,
      time: Math.round(g.time),
      level: g.level,
      kills: g.kills,
      hp: Math.ceil(g.player.hp),
      maxHp: Math.round(g.player.maxHp),
      x: g.player.pos.x,
      y: g.player.pos.y,
      enemies: g.enemies.filter((e) => e.hp > 0).slice(0, 90).map((e) => ({ pos: { x: e.pos.x, y: e.pos.y } })),
      gems: g.gems.slice(0, 60).map((gem) => ({ pos: { x: gem.pos.x, y: gem.pos.y } })),
      weapons: g.weapons.map((w) => w.kind + w.level).join(','),
      passives: Object.entries(g.passives).filter(([, v]) => v > 0).map(([k, v]) => k + v).join(','),
      hudTime: t('.time'),
    };
  })()`);

// 16 方向采样：躲怪 + 捡宝石 + 远离边界
const DIRS = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  return { x: Math.cos(a), y: Math.sin(a) };
});

function chooseDir(g) {
  let best = DIRS[0];
  let bestScore = -Infinity;
  for (const d of DIRS) {
    const nx = g.x + d.x * 150;
    const ny = g.y + d.y * 150;
    // 以「离最近敌人的距离」为主：最大化生存空间
    let nearest = 600;
    let crowd = 0;
    for (const e of g.enemies) {
      const dx = nx - e.pos.x;
      const dy = ny - e.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < nearest) nearest = dist;
      if (dist < 260) crowd += (260 - dist) / 260;
    }
    let gems = 0;
    for (const gem of g.gems) {
      const dist = Math.hypot(nx - gem.pos.x, ny - gem.pos.y);
      if (dist < 240) gems += (240 - dist) / 240;
    }
    let score = nearest * 1.1 - crowd * 34 + gems * 55;
    // 远离边界
    const edge = Math.min(nx, 2400 - nx, ny, 1600 - ny);
    if (edge < 260) score -= (260 - edge) * 1.4;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

const cards = () =>
  evalJs(`Array.from(document.querySelectorAll('.choice-card')).map((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.x + r.width / 2,
      y: r.y + r.height / 2,
      text: el.textContent.trim().slice(0, 40),
    };
  })`);

async function click(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await sleep(20);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await sleep(60);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', {
  url: 'file:///D:/gongzuoqu/echo-survivors/dist/echo-survivors.html?speed=2&t=' + Date.now(),
});
await sleep(1500);

// 点开始
const startBtn = await evalJs(`(() => {
  const b = Array.from(document.querySelectorAll('button')).find((el) => el.textContent.trim() === '开始');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
})()`);
if (startBtn) await click(startBtn.x, startBtn.y);
console.log('开始游戏');

const t0 = Date.now();
let lastLog = 0;
let lastShot = 0;
let shotN = 0;
const timeline = [];

while (Date.now() - t0 < DURATION) {
  const s = await state();
  if (!s) break;
  if (s.phase === 'dead' || s.phase === 'won') {
    timeline.push(`${s.hudTime} ${s.phase === 'won' ? '通关' : '死亡'} Lv.${s.level} 击杀${s.kills}`);
    break;
  }
  if (s.phase === 'levelup') {
    const cs = await cards();
    if (cs.length) {
      // 优先武器升级/新武器，其次被动
      const pick = cs[0];
      await click(pick.x, pick.y);
      timeline.push(`${s.hudTime} 升级 Lv.${s.level}：${pick.text.split('\n')[0]}`);
    }
    continue;
  }
  const dir = chooseDir(s);
  const dirs = [];
  if (dir.x > 0.3) dirs.push('right');
  if (dir.x < -0.3) dirs.push('left');
  if (dir.y > 0.3) dirs.push('down');
  if (dir.y < -0.3) dirs.push('up');
  await setKeys(dirs);

  if (Date.now() - lastLog > 15000) {
    lastLog = Date.now();
    console.log(
      `${s.hudTime} | Lv.${s.level} | 击杀 ${s.kills} | HP ${s.hp}/${s.maxHp} | 怪 ${s.enemies} | ${s.weapons}`,
    );
  }
  if (Date.now() - lastShot > 18000) {
    lastShot = Date.now();
    shotN += 1;
    await shot(`s${String(shotN).padStart(2, '0')}`);
  }
  await sleep(90);
}

await setKeys([]);
const end = await state();
await shot('end');
console.log('\n=== 结果 ===');
console.log(end);
console.log('时间线:');
for (const l of timeline) console.log('  ', l);
console.log('错误:', errors.length ? errors.slice(0, 5) : '无');
ws.close();
