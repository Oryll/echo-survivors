import { useState } from 'react';
import type { MetaSave } from '../meta/save';
import { PASSIVES, TIER_INFO, TIERS, WEAPONS } from '../game/content';
import type { Tier } from '../game/types';

export function ShopScreen({
  save,
  onBuy,
  onBack,
}: {
  save: MetaSave;
  onBuy: (id: string, kind: 'weapon' | 'passive') => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<'weapon' | 'passive'>('weapon');
  const items = tab === 'weapon' ? WEAPONS : PASSIVES;

  return (
    <div className="shop-screen">
      <header className="sub-header">
        <button className="btn btn-ghost btn-mini" onClick={onBack} type="button">
          ← 返回
        </button>
        <h2>商城</h2>
        <div className="wallet small">
          <span className="wallet-icon">💰</span>
          <span className="wallet-value">{save.coins.toLocaleString()}</span>
        </div>
      </header>

      <div className="tabs">
        <button
          className={`tab ${tab === 'weapon' ? 'is-active' : ''}`}
          onClick={() => setTab('weapon')}
          type="button"
        >
          武器 <em>{save.weapons.length}/{WEAPONS.length}</em>
        </button>
        <button
          className={`tab ${tab === 'passive' ? 'is-active' : ''}`}
          onClick={() => setTab('passive')}
          type="button"
        >
          被动 <em>{save.passives.length}/{PASSIVES.length}</em>
        </button>
      </div>

      <div className="shop-list">
        {TIERS.map((tier: Tier) => {
          const list = items.filter((it) => it.tier === tier);
          if (list.length === 0) return null;
          const info = TIER_INFO[tier];
          return (
            <section className="tier-block" key={tier}>
              <div className="tier-head" style={{ color: info.color }}>
                <span className="tier-dot" style={{ background: info.color }} />
                {info.name}
                <span className="tier-hint">
                  {tab === 'weapon' ? `${info.priceW} 💰` : `${info.priceP} 💰`}
                </span>
              </div>
              <div className="shop-grid">
                {list.map((it) => {
                  const owned =
                    tab === 'weapon' ? save.weapons.includes(it.id) : save.passives.includes(it.id);
                  const price = tab === 'weapon' ? info.priceW : info.priceP;
                  const afford = save.coins >= price;
                  return (
                    <div
                      key={it.id}
                      className={`shop-card ${owned ? 'is-owned' : ''}`}
                      style={{ borderColor: owned ? '#2c374d' : info.color + '66' }}
                    >
                      <div className="shop-icon" style={{ background: info.color + '22', color: info.color }}>
                        {it.icon}
                      </div>
                      <div className="shop-body">
                        <div className="shop-name">
                          {it.name}
                          {owned && <span className="owned-tag">已拥有</span>}
                        </div>
                        <div className="shop-desc">{it.desc}</div>
                      </div>
                      <button
                        className={`btn ${owned ? 'btn-ghost' : 'btn-primary'} shop-buy`}
                        disabled={owned || !afford}
                        onClick={() => onBuy(it.id, tab)}
                        type="button"
                      >
                        {owned ? '—' : `${price} 💰`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="shop-foot">买的武器/被动会进入局内升级三选一的池子。</div>
    </div>
  );
}
