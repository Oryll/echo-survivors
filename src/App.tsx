import { useCallback, useEffect, useRef, useState } from 'react';
import type { Game } from './game/types';
import { STAGES } from './game/config';
import {
  applyReplace,
  cancelReplace,
  chooseUpgrade,
  createGame,
  devForceLevelup,
  payout,
  rerollChoices,
  rollGacha,
  startRun,
  update,
} from './game/engine';
import { GACHA_COST, PASSIVE_MAP, PASSIVES, TIER_INFO, WEAPONS, WEAPON_MAP } from './game/content';
import { DEFAULT_COINS, loadSave, writeSave, type MetaSave } from './meta/save';
import { GameCanvas } from './ui/GameCanvas';
import { makeHud, type HudSnapshot } from './ui/hud';
import { MenuScreen } from './ui/MenuScreen';
import { ShopScreen } from './ui/ShopScreen';
import { GachaScreen, type GachaPrize } from './ui/GachaScreen';

type ScreenName = 'menu' | 'shop' | 'gacha' | 'run';

function fmt(t: number): string {
  const s = Math.floor(t);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function bootDemo(g: Game, mode: string): void {
  startRun(g);
  if (mode === 'replace' || mode === 'replacew' || mode === 'slotpick') {
    // 模拟「全部内容已解锁」的后期状态
    g.ownedWeapons = WEAPONS.map((w) => w.id);
    g.ownedPassives = PASSIVES.map((p) => p.id);
    g.weapons = ['blade0', 'aura0', 'chain0', 'nova0', 'beam0'].map((id, i) => ({
      id,
      level: 2 + (i % 2),
      cd: 0,
    }));
    for (const pid of ['pow', 'haste', 'swift', 'vigor', 'magnet', 'crit']) g.passives[pid] = 1;
    g.level = mode === 'replacew' ? 13 : 12;
    g.xpNext = 80;
    devForceLevelup(g);
    if (mode === 'slotpick') {
      const replaceChoice = g.choices.find((c) => c.replace);
      if (replaceChoice) chooseUpgrade(g, replaceChoice.id);
    }
    return;
  }
  if (mode === 'win') {
    g.time = STAGES[0].duration - 1;
    g.level = 40;
    g.kills = 3200;
    g.coins = 1280;
    g.phase = 'won';
    return;
  }
  const budget = mode === 'play' ? 75 : 120;
  for (let i = 0; i < 60 * budget && g.phase === 'playing'; i++) {
    let fx = 0;
    let fy = 0;
    const p = g.player.pos;
    for (const e of g.enemies) {
      const dx = p.x - e.pos.x;
      const dy = p.y - e.pos.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 200) {
        const w = (200 - d) / 200;
        fx += (dx / d) * w * w;
        fy += (dy / d) * w * w;
      }
    }
    for (const gem of g.gems) {
      const dx = gem.pos.x - p.x;
      const dy = gem.pos.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 240) {
        fx += (dx / d) * 0.5;
        fy += (dy / d) * 0.5;
      }
    }
    const len = Math.hypot(fx, fy) || 1;
    g.input.x = len > 0.01 ? fx / len : 0;
    g.input.y = len > 0.01 ? fy / len : 0;
    update(g, 1 / 60);
    const phase: string = g.phase;
    if (phase === 'levelup') chooseUpgrade(g, g.choices[0].id);
  }
  g.input.x = 0;
  g.input.y = 0;
}

export default function App() {
  const [save, setSave] = useState<MetaSave>(() => {
    const base = loadSave();
    // 开发用：?coins=999999 直接把金币写进存档
    const raw = new URLSearchParams(window.location.search).get('coins');
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) {
        const next: MetaSave = { ...base, coins: Math.floor(n) };
        writeSave(next);
        return next;
      }
    }
    return base;
  });
  const [screen, setScreen] = useState<ScreenName>(() => {
    const s = new URLSearchParams(window.location.search).get('screen');
    return s === 'shop' || s === 'gacha' ? s : 'menu';
  });
  const [runId, setRunId] = useState(0);
  const [paused, setPaused] = useState(false);
  const [stage, setStage] = useState<number>(() => loadSave().selectedStage ?? 0);
  const [lastPayout, setLastPayout] = useState<{ base: number; winBonus: number; total: number } | null>(null);

  const gameRef = useRef<Game>(
    createGame({ weapons: save.weapons, passives: save.passives }, loadSave().selectedStage ?? 0),
  );
  const demoRef = useRef(false);
  const [hud, setHud] = useState<HudSnapshot>(() => {
    const g = gameRef.current;
    const demo = new URLSearchParams(window.location.search).get('demo');
    if (demo) {
      bootDemo(g, demo);
      demoRef.current = true;
    }
    return makeHud(g);
  });
  const settledRef = useRef(false);

  useEffect(() => {
    if (demoRef.current) setScreen('run');
  }, []);

  const topUpCoins = useCallback(() => {
    setSave((prev) => {
      const next: MetaSave = { ...prev, coins: DEFAULT_COINS };
      writeSave(next);
      return next;
    });
  }, []);

  const selectStage = useCallback((i: number) => {
    setStage(i);
    setSave((prev) => {
      const next: MetaSave = { ...prev, selectedStage: i };
      writeSave(next);
      return next;
    });
  }, []);

  const start = useCallback(() => {
    const g = createGame({ weapons: save.weapons, passives: save.passives }, stage);
    startRun(g);
    gameRef.current = g;
    settledRef.current = false;
    setLastPayout(null);
    setPaused(false);
    setScreen('run');
    setRunId((n) => n + 1);
    setHud(makeHud(g));
  }, [save, stage]);

  useEffect(() => {
    if (screen !== 'run') return;
    const ph = hud.phase;
    if ((ph === 'dead' || ph === 'won') && !settledRef.current) {
      settledRef.current = true;
      const g = gameRef.current;
      const pay = payout(g);
      setLastPayout(pay);
      setSave((prev) => {
        const next: MetaSave = {
          ...prev,
          coins: prev.coins + pay.total,
          stats: {
            runs: prev.stats.runs + 1,
            wins: prev.stats.wins + (ph === 'won' ? 1 : 0),
            bestTime: Math.max(prev.stats.bestTime, g.time),
            totalKills: prev.stats.totalKills + g.kills,
          },
        };
        writeSave(next);
        return next;
      });
    }
  }, [hud.phase, screen]);

  const pick = useCallback((id: string) => {
    chooseUpgrade(gameRef.current, id);
    setHud(makeHud(gameRef.current));
  }, []);

  const doReroll = useCallback(() => {
    rerollChoices(gameRef.current);
    setHud(makeHud(gameRef.current));
  }, []);

  const doReplace = useCallback((targetId: string) => {
    applyReplace(gameRef.current, targetId);
    setHud(makeHud(gameRef.current));
  }, []);

  const doCancelReplace = useCallback(() => {
    cancelReplace(gameRef.current);
    setHud(makeHud(gameRef.current));
  }, []);

  const buy = useCallback(
    (id: string, kind: 'weapon' | 'passive') => {
      const def = kind === 'weapon' ? WEAPON_MAP[id] : PASSIVE_MAP[id];
      if (!def) return;
      const price = kind === 'weapon' ? TIER_INFO[def.tier].priceW : TIER_INFO[def.tier].priceP;
      if (save.coins < price) return;
      if (kind === 'weapon' && save.weapons.includes(id)) return;
      if (kind === 'passive' && save.passives.includes(id)) return;
      const next: MetaSave = {
        ...save,
        coins: save.coins - price,
        weapons: kind === 'weapon' ? [...save.weapons, id] : save.weapons,
        passives: kind === 'passive' ? [...save.passives, id] : save.passives,
      };
      writeSave(next);
      setSave(next);
    },
    [save],
  );

  const spinStart = useCallback((): GachaPrize | null => {
    if (save.coins < GACHA_COST) return null;
    const prize = rollGacha({ weapons: save.weapons, passives: save.passives });
    const next: MetaSave = { ...save, coins: save.coins - GACHA_COST };
    writeSave(next);
    setSave(next);
    if (!prize) return { kind: 'coins', coins: 300 };
    return { kind: prize.kind, id: prize.id, tier: prize.tier };
  }, [save]);

  const grant = useCallback((p: GachaPrize) => {
    setSave((prev) => {
      let next: MetaSave = prev;
      if (p.kind === 'coins') next = { ...prev, coins: prev.coins + (p.coins ?? 300) };
      else if (p.kind === 'weapon' && p.id)
        next = { ...prev, weapons: [...new Set([...prev.weapons, p.id])] };
      else if (p.kind === 'passive' && p.id)
        next = { ...prev, passives: [...new Set([...prev.passives, p.id])] };
      writeSave(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screen !== 'run') {
        if (e.code === 'Escape') setScreen('menu');
        return;
      }
      const g = gameRef.current;
      if (g.phase === 'levelup') {
        if (g.pendingReplace && e.code === 'Escape') {
          doCancelReplace();
          return;
        }
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= 3) {
          const c = g.choices[n - 1];
          if (c) pick(c.id);
        }
        return;
      }
      if (e.code === 'KeyR' && (g.phase === 'dead' || g.phase === 'won')) {
        start();
        return;
      }
      if (e.code === 'Escape' || e.code === 'Space') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pick, start, screen, doCancelReplace]);

  const g = gameRef.current;
  const hpPct = Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100));
  const xpPct = Math.max(0, Math.min(100, (hud.xp / Math.max(1, hud.xpNext)) * 100));
  const over = hud.phase === 'dead' || hud.phase === 'won';

  if (screen === 'menu') {
    return (
      <MenuScreen
        save={save}
        stage={stage}
        onTopUp={topUpCoins}
        onSelectStage={selectStage}
        onPlay={start}
        onShop={() => setScreen('shop')}
        onGacha={() => setScreen('gacha')}
      />
    );
  }

  if (screen === 'shop') {
    return <ShopScreen save={save} onBuy={buy} onBack={() => setScreen('menu')} />;
  }

  if (screen === 'gacha') {
    return (
      <GachaScreen save={save} onSpinStart={spinStart} onGrant={grant} onBack={() => setScreen('menu')} />
    );
  }

  return (
    <div className="app">
      <header className="hud">
        <div className="hud-left">
          <div className={`hp-bar ${hpPct <= 30 ? 'is-low' : ''}`}>
            <div className="hp-fill" style={{ width: hpPct + '%' }} />
            <span className="hp-text">
              ❤ {hud.hp} / {hud.maxHp}
            </span>
          </div>
          <div className="xp-bar">
            <div className="xp-fill" style={{ width: xpPct + '%' }} />
            <span className="xp-text">
              Lv.{hud.level} · {hud.xp}/{hud.xpNext}
            </span>
          </div>
        </div>

        <div className="hud-mid">
          <div className="time">{fmt(hud.time)}</div>
          <div className="time-sub">
            击杀 {hud.kills} · 💰 {hud.coins}
            {hud.nextBoss != null && <span className="boss-hint"> · 下个 Boss {fmt(hud.nextBoss)}</span>}
          </div>
        </div>

        <div className="hud-right">
          <button className="btn btn-ghost btn-mini" onClick={() => setPaused((p) => !p)} type="button">
            {paused ? '继续' : '暂停'}
          </button>
          <button className="btn btn-ghost btn-mini" onClick={start} type="button">
            重开
          </button>
          <button className="btn btn-ghost btn-mini" onClick={() => setScreen('menu')} type="button">
            大厅
          </button>
        </div>
      </header>

      <div className="stage-wrap">
        <GameCanvas key={runId} game={g} onHud={setHud} paused={paused} />

        {hud.banners && hud.phase === 'playing' && (
          <div className="banner" key={hud.banners.text}>
            <div className="banner-title">{hud.banners.text}</div>
            {hud.banners.sub && <div className="banner-sub">{hud.banners.sub}</div>}
          </div>
        )}

        {hud.phase === 'levelup' && (
          <div className="overlay levelup-overlay">
            {hud.pendingReplace ? (
              <>
                <div className="levelup-head">
                  替换{hud.pendingReplace.kind === 'weapon' ? '武器' : '被动'}
                  <em>
                    {hud.pendingReplace.icon} {hud.pendingReplace.name}
                  </em>
                </div>
                <div className="levelup-hint">选一个要换掉的（新武器从 Lv.1 开始）</div>
                <div className="slot-grid">
                  {(hud.pendingReplace.kind === 'weapon' ? hud.weaponSlots : hud.passiveSlots).map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      className="slot-card"
                      style={{ borderColor: slot.color + '66' }}
                      onClick={() => doReplace(slot.id)}
                    >
                      <span className="slot-icon" style={{ color: slot.color }}>
                        {slot.icon}
                      </span>
                      <span className="slot-name">{slot.name}</span>
                      <span className="slot-lv">Lv.{slot.level}</span>
                    </button>
                  ))}
                </div>
                <button className="btn btn-ghost" onClick={doCancelReplace} type="button">
                  取消 <kbd>Esc</kbd>
                </button>
              </>
            ) : (
              <>
                <div className="levelup-head">
                  升级！<em>Lv.{hud.level}</em>
                  <span className="levelup-kind">
                    {hud.levelCategory === 'weapon'
                      ? '武器强化'
                      : hud.levelCategory === 'passive'
                        ? '被动强化'
                        : '综合强化'}
                  </span>
                  {hud.pendingLevels > 1 && <span className="pending">还剩 {hud.pendingLevels} 次</span>}
                  <button
                    className="btn btn-mini reroll-btn"
                    onClick={doReroll}
                    disabled={hud.rerolls <= 0}
                    type="button"
                  >
                    🎲 重抽 {hud.rerolls}
                  </button>
                </div>
                <div className="choice-grid">
                  {hud.choices.map((c, i) => (
                    <button
                      key={c.id}
                      type="button"
                      className="choice-card"
                      style={{ borderColor: c.color }}
                      onClick={() => pick(c.id)}
                    >
                      <span className="choice-key">{i + 1}</span>
                      <span className="choice-icon" style={{ background: c.color + '22', color: c.color }}>
                        {c.icon}
                      </span>
                      <span className="choice-name">
                        {c.name}
                        {c.kind === 'weapon' && (
                          <em className={c.isNew ? 'is-new' : ''}>{c.isNew ? '新武器' : `Lv.${c.level}`}</em>
                        )}
                        {c.kind === 'passive' && (
                          <em className={c.isNew ? 'is-new' : ''}>{c.isNew ? '新被动' : `Lv.${c.level}`}</em>
                        )}
                        {c.replace && <span className="replace-tag">替换</span>}
                        {c.tier && (
                          <span className="choice-tier" style={{ color: TIER_INFO[c.tier].color }}>
                            {TIER_INFO[c.tier].name}
                          </span>
                        )}
                      </span>
                      <span className="choice-desc">{c.desc}</span>
                    </button>
                  ))}
                </div>
                <div className="levelup-hint">点一张卡，或按 1 / 2 / 3</div>
              </>
            )}
          </div>
        )}

        {paused && hud.phase === 'playing' && (
          <div className="overlay paused-overlay">
            <div className="paused-card">
              <h2>已暂停</h2>
              <p>空格 / Esc 继续</p>
            </div>
          </div>
        )}

        {over && (
          <div className="overlay">
            <div className={`end-card ${hud.phase === 'won' ? 'is-win' : 'is-lose'}`}>
              <div className="end-emoji">{hud.phase === 'won' ? '🏆' : '💀'}</div>
              <h1>{hud.phase === 'won' ? '你活下来了' : '你倒下了'}</h1>
              <p>{hud.phase === 'won' ? '回廊的尽头，还有更多东西在等你。' : '再试一次，这次走位会更稳。'}</p>
              <div className="end-stats">
                <div>
                  <b>{fmt(hud.time)}</b>
                  <span>存活时间</span>
                </div>
                <div>
                  <b>Lv.{hud.level}</b>
                  <span>等级</span>
                </div>
                <div>
                  <b>{hud.kills}</b>
                  <span>击杀</span>
                </div>
              </div>
              {lastPayout && (
                <div className="end-coins">
                  <span className="coin-icon">💰</span>
                  <b>+{lastPayout.total}</b>
                  <span className="end-coins-detail">
                    击杀/拾取 {lastPayout.base}
                    {lastPayout.winBonus > 0 ? ` · 通关奖励 ${lastPayout.winBonus}` : ''}
                  </span>
                </div>
              )}
              <div className="end-actions">
                <button className="btn btn-primary btn-large" onClick={start} type="button">
                  再来一局 <kbd>R</kbd>
                </button>
                <button className="btn btn-large" onClick={() => setScreen('menu')} type="button">
                  返回大厅
                </button>
              </div>
              <p className="end-wallet">钱包：{save.coins.toLocaleString()} 💰</p>
            </div>
          </div>
        )}
      </div>

      <footer className="loadout">
        <div className="loadout-group">
          <div className="loadout-label">武器</div>
          <div className="loadout-items">
            {hud.weapons.map((w) => (
              <div className="item weapon" key={w.id} title={w.name}>
                <span className="item-icon" style={{ color: w.color }}>
                  {w.icon}
                </span>
                <span className="item-pips">
                  {Array.from({ length: w.max }, (_, i) => (
                    <i key={i} className={i < w.level ? 'on' : ''} style={{ background: i < w.level ? w.color : undefined }} />
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="loadout-group">
          <div className="loadout-label">被动</div>
          <div className="loadout-items">
            {hud.passives.length === 0 && <span className="loadout-empty">还没有——升级时选一个</span>}
            {hud.passives.map((p) => (
              <div className="item passive" key={p.id} title={p.name}>
                <span className="item-icon" style={{ color: p.color }}>
                  {p.icon}
                </span>
                <span className="item-lv">{p.level}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="loadout-tip">走位躲怪 · 捡宝石升级 · {STAGES[stage].name} · 活到 {fmt(STAGES[stage].duration)} · 金币结算入账</div>
      </footer>
    </div>
  );
}
