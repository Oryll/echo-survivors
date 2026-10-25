// 验收 v0.2 局外系统：结算入账 / 商城购买 / 轮盘抽奖 / localStorage 持久化
import { writeFileSync, mkdirSync } from 'node:fs';

const CDP = 'http://127.0.0.1:9225';
mkdirSync('shots/v02', { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(CDP + '/json/list')).json();
const page = list.find((t) => t.type === 'page' && t.url.includes('echo-survivors'));
if (!page) {
  console.error('找不到页面', list.map((t) => t.url));
  process.exit(1);
}
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
  writeFileSync(`shots/v02/${name}.png`, Buffer.from(r.data, 'base64'));
};
const clickAt = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await sleep(25);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await sleep(150);
};
const btnByText = async (text) =>
  evalJs(`(() => {
    const b = Array.from(document.querySelectorAll('button')).find((el) => el.textContent.includes(${JSON.stringify(text)}) && !el.disabled);
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
const wallet = () => evalJs(`Number((document.querySelector('.wallet-value')?.textContent ?? '0').replace(/[^0-9]/g,'')) || 0`);
const save = () => evalJs(`localStorage.getItem('echo-survivors-save-v1')`);

await send('Page.enable');
await send('Runtime.enable');
const url = 'file:///D:/gongzuoqu/echo-survivors/dist/echo-survivors.html';

// 1) 结算入账
await send('Page.navigate', { url: `${url}?demo=win` });
await sleep(1600);
const before = await wallet();
const back = await btnByText('返回大厅');
if (back) await clickAt(back.x, back.y);
await sleep(400);
const afterRun = await wallet();
console.log(`1) 结算：局内金币 1280 + 通关 200 → 钱包 ${before} → ${afterRun}`);
await shot('01-menu');

// 2) 商城购买
await send('Page.navigate', { url: `${url}?screen=shop` });
await sleep(1200);
const buy = await evalJs(`(() => {
  const b = Array.from(document.querySelectorAll('.shop-buy')).find((el) => !el.disabled && el.textContent.includes('400'));
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: b.textContent.trim() };
})()`);
const shopBefore = await wallet();
if (buy) await clickAt(buy.x, buy.y);
await sleep(400);
const shopAfter = await wallet();
const ownedCount = await evalJs(`document.querySelectorAll('.owned-tag').length`);
console.log(`2) 商城：${buy?.label} | 钱包 ${shopBefore} → ${shopAfter} | 已拥有标记 ${ownedCount}`);
await shot('02-shop');

// 3) 轮盘抽奖
await send('Page.navigate', { url: `${url}?screen=gacha` });
await sleep(1200);
const spin = await btnByText('抽一次');
const gachaBefore = await wallet();
if (spin) await clickAt(spin.x, spin.y);
await sleep(1200);
await shot('03-wheel');
await sleep(3200);
const gachaAfter = await wallet();
const result = await evalJs(`document.querySelector('.gacha-result-name')?.textContent ?? '(无结果)'`);
const tier = await evalJs(`document.querySelector('.gacha-result-tier')?.textContent ?? ''`);
console.log(`3) 抽奖：钱包 ${gachaBefore} → ${gachaAfter} | 抽到 ${result}（${tier}）`);
await shot('04-result');

// 4) 持久化
const raw = await save();
const parsed = JSON.parse(raw);
console.log('4) 存档：', {
  coins: parsed.coins,
  weapons: parsed.weapons.length,
  passives: parsed.passives.length,
  runs: parsed.stats.runs,
  wins: parsed.stats.wins,
});
console.log('错误:', errors.length ? errors.slice(0, 5) : '无');
ws.close();
