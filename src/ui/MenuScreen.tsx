import type { MetaSave } from '../meta/save';
import { PASSIVES, TIER_INFO, TIERS, WEAPONS } from '../game/content';
import { STAGES, stageUnlocked } from '../game/config';

function fmtTime(t: number): string {
  const s = Math.floor(t);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function MenuScreen({
  save,
  stage,
  onTopUp,
  onSelectStage,
  onPlay,
  onShop,
  onGacha,
}: {
  save: MetaSave;
  stage: number;
  onTopUp: () => void;
  onSelectStage: (i: number) => void;
  onPlay: () => void;
  onShop: () => void;
  onGacha: () => void;
}) {
  const ownedW = save.weapons.length;
  const ownedP = save.passives.length;
  return (
    <div className="menu-screen">
      <div className="menu-hero">
        <p className="menu-kicker">ROGUELITE SURVIVORS · v0.3</p>
        <h1 className="menu-title">回响幸存者</h1>
        <p className="menu-sub">一直刷怪、一直升级、一直变强。活到 10:00。</p>
      </div>

      <div className="wallet-row">
        <div className="wallet">
          <span className="wallet-icon">💰</span>
          <span className="wallet-value">{save.coins.toLocaleString()}</span>
          <span className="wallet-label">金币</span>
        </div>
        <button className="btn btn-ghost btn-mini topup-btn" onClick={onTopUp} type="button">
          补满金币
        </button>
      </div>

      <div className="stage-select">
        <div className="stage-title">选择关卡</div>
        <div className="stage-list">
          {STAGES.map((st, i) => {
            const unlocked = stageUnlocked(st, save.stats.wins);
            const active = i === stage;
            return (
              <button
                key={st.id}
                type="button"
                className={`stage-card ${active ? 'is-active' : ''} ${unlocked ? '' : 'is-locked'}`}
                style={{ borderColor: active ? st.color : undefined }}
                disabled={!unlocked}
                onClick={() => onSelectStage(i)}
              >
                <span className="stage-name" style={{ color: st.color }}>
                  {st.name}
                </span>
                <span className="stage-desc">{st.desc}</span>
                <span className="stage-meta">
                  {unlocked ? (
                    <>
                      Boss × {st.bossTimes.length} · 金币 ×{st.coinMul}
                    </>
                  ) : (
                    <>通关 {st.unlockWins} 次解锁（当前 {save.stats.wins}）</>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="menu-actions">
        <button className="btn btn-primary btn-large" onClick={onPlay} type="button">
          开始一局
        </button>
        <button className="btn btn-large" onClick={onShop} type="button">
          商城
        </button>
        <button className="btn btn-large" onClick={onGacha} type="button">
          轮盘抽奖
        </button>
      </div>

      <div className="menu-stats">
        <div>
          <b>{save.stats.runs}</b>
          <span>总局数</span>
        </div>
        <div>
          <b>{save.stats.wins}</b>
          <span>通关</span>
        </div>
        <div>
          <b>{fmtTime(save.stats.bestTime)}</b>
          <span>最佳存活</span>
        </div>
        <div>
          <b>{save.stats.totalKills}</b>
          <span>累计击杀</span>
        </div>
      </div>

      <div className="menu-collection">
        <div className="collection-title">已解锁</div>
        <div className="collection-row">
          {TIERS.map((tier) => {
            const ws = WEAPONS.filter((w) => w.tier === tier);
            const ps = PASSIVES.filter((p) => p.tier === tier);
            const wOwned = ws.filter((w) => save.weapons.includes(w.id)).length;
            const pOwned = ps.filter((p) => save.passives.includes(p.id)).length;
            return (
              <div className="collection-item" key={tier} style={{ color: TIER_INFO[tier].color }}>
                <b>{TIER_INFO[tier].name}</b>
                <span>
                  武器 {wOwned}/{ws.length} · 被动 {pOwned}/{ps.length}
                </span>
              </div>
            );
          })}
        </div>
        <div className="collection-total">
          共 {ownedW + ownedP} / 45 件
        </div>
      </div>

      <div className="menu-foot">WASD 移动 · 武器自动攻击 · 升级三选一（1/2/3）</div>
    </div>
  );
}
