import { useMemo, useRef, useState } from 'react';
import type { MetaSave } from '../meta/save';
import { GACHA_COST, PASSIVES, PASSIVE_MAP, TIER_INFO, WEAPONS, WEAPON_MAP } from '../game/content';

export interface GachaPrize {
  kind: 'weapon' | 'passive' | 'coins';
  id?: string;
  tier?: string;
  coins?: number;
}

const SEGMENTS = 8;
const SLICE = 360 / SEGMENTS;

interface Seg {
  label: string;
  icon: string;
  color: string;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function wedgePath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Z`;
}

function prizeSeg(p: GachaPrize): Seg {
  if (p.kind === 'coins') return { label: `${p.coins} 金币`, icon: '💰', color: '#e3c05f' };
  if (p.kind === 'weapon') {
    const d = WEAPON_MAP[p.id!];
    return { label: d?.name ?? p.id!, icon: d?.icon ?? '?', color: TIER_INFO[d?.tier ?? 'common'].color };
  }
  const d = PASSIVE_MAP[p.id!];
  return { label: d?.name ?? p.id!, icon: d?.icon ?? '?', color: TIER_INFO[d?.tier ?? 'common'].color };
}

function randomOtherSeg(save: MetaSave): Seg {
  const pool: Seg[] = [
    ...WEAPONS.filter((w) => !save.weapons.includes(w.id)).map((w) => ({
      label: w.name,
      icon: w.icon,
      color: TIER_INFO[w.tier].color,
    })),
    ...PASSIVES.filter((p) => !save.passives.includes(p.id)).map((p) => ({
      label: p.name,
      icon: p.icon,
      color: TIER_INFO[p.tier].color,
    })),
  ];
  if (pool.length === 0) return { label: '200 金币', icon: '💰', color: '#e3c05f' };
  return pool[Math.floor(Math.random() * pool.length)];
}

export function GachaScreen({
  save,
  onSpinStart,
  onGrant,
  onBack,
}: {
  save: MetaSave;
  onSpinStart: () => GachaPrize | null;
  onGrant: (p: GachaPrize) => void;
  onBack: () => void;
}) {
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<GachaPrize | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [segs, setSegs] = useState<Seg[]>(() => Array.from({ length: SEGMENTS }, () => randomOtherSeg(save)));
  const timer = useRef<number | null>(null);

  const canAfford = save.coins >= GACHA_COST;

  const deal = () => {
    if (spinning) return;
    const prize = onSpinStart();
    if (!prize) {
      setToast('金币不足');
      window.setTimeout(() => setToast(null), 1200);
      return;
    }
    const idx = Math.floor(Math.random() * SEGMENTS);
    const next: Seg[] = Array.from({ length: SEGMENTS }, (_, i) =>
      i === idx ? prizeSeg(prize) : randomOtherSeg(save),
    );
    setSegs(next);
    setResult(null);
    setSpinning(true);
    setRot((prev) => {
      const target = 360 * 5 + (360 - (idx * SLICE + SLICE / 2));
      const current = ((prev % 360) + 360) % 360;
      return prev + target - current;
    });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setSpinning(false);
      setResult(prize);
      onGrant(prize);
    }, 3400);
  };

  const resultView = useMemo(() => {
    if (!result) return null;
    if (result.kind === 'coins') {
      return { name: `${result.coins} 金币`, icon: '💰', color: '#e3c05f', tier: '金币' };
    }
    const def =
      result.kind === 'weapon' ? WEAPON_MAP[result.id!] : PASSIVE_MAP[result.id!];
    return {
      name: def?.name ?? result.id,
      icon: def?.icon ?? '?',
      color: TIER_INFO[def?.tier ?? 'common'].color,
      tier: TIER_INFO[def?.tier ?? 'common'].name,
    };
  }, [result]);

  return (
    <div className="gacha-screen">
      <header className="sub-header">
        <button className="btn btn-ghost btn-mini" onClick={onBack} type="button">
          ← 返回
        </button>
        <h2>轮盘抽奖</h2>
        <div className="wallet small">
          <span className="wallet-icon">💰</span>
          <span className="wallet-value">{save.coins.toLocaleString()}</span>
        </div>
      </header>

      <div className="gacha-body">
        <div className="wheel-wrap">
          <div className="wheel-pointer" />
          <svg viewBox="0 0 340 340" className="wheel" style={{ transform: `rotate(${rot}deg)` }}>
            <circle cx="170" cy="170" r="168" fill="#0e131d" stroke="#26314a" strokeWidth="2" />
            {segs.map((s, i) => {
              const a0 = i * SLICE;
              const a1 = (i + 1) * SLICE;
              const mid = a0 + SLICE / 2;
              const p = polar(170, 170, 118, mid);
              return (
                <g key={i}>
                  <path d={wedgePath(170, 170, 160, a0, a1)} fill={s.color + '22'} stroke="#26314a" strokeWidth="1" />
                  <text
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="20"
                    style={{ transform: `rotate(${mid}deg)`, transformOrigin: `${p.x}px ${p.y}px` }}
                  >
                    {s.icon}
                  </text>
                  <text
                    x={p.x}
                    y={p.y + 20}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#c7d2e4"
                    style={{ transform: `rotate(${mid}deg)`, transformOrigin: `${p.x}px ${p.y}px` }}
                  >
                    {s.label.slice(0, 6)}
                  </text>
                </g>
              );
            })}
            <circle cx="170" cy="170" r="34" fill="#121a27" stroke="#3a4a68" strokeWidth="2" />
            <text x="170" y="170" textAnchor="middle" dominantBaseline="middle" fontSize="14" fill="#e3ad57">
              抽
            </text>
          </svg>
        </div>

        <div className="gacha-side">
          <p className="gacha-desc">
            花 <b>{GACHA_COST}</b> 金币转一次轮盘，必得一件还没拥有的武器或被动。
            <br />
            全部集齐后，会改出金币。
          </p>
          <button
            className="btn btn-primary btn-large"
            onClick={deal}
            disabled={spinning || !canAfford}
            type="button"
          >
            {spinning ? '转动中…' : `抽一次 · ${GACHA_COST} 💰`}
          </button>
          {!canAfford && <div className="gacha-poor">金币不够，先去打一局</div>}
          {toast && <div className="toast toast-bad">{toast}</div>}

          {resultView && (
            <div className="gacha-result" style={{ borderColor: resultView.color }}>
              <div className="gacha-result-kicker">抽到了</div>
              <div className="gacha-result-icon" style={{ color: resultView.color }}>
                {resultView.icon}
              </div>
              <div className="gacha-result-name">{resultView.name}</div>
              <div className="gacha-result-tier" style={{ color: resultView.color }}>
                {resultView.tier}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
