import { useEffect, useMemo, useRef, useState } from "react";
import type { BattleEvent, FightResult } from "../../contracts/game";
import GrobnikAvatar from "./GrobnikAvatar";

declare global {
  interface Window { Telegram?: any }
}

interface DmgPopup { id: number; side: 0 | 1; text: string; crit: boolean }

export default function BattleView({ result, onFinish }: { result: FightResult; onFinish: () => void }) {
  const events = result.events;
  const start = events[0] as Extract<BattleEvent, { t: "start" }>;
  const [idx, setIdx] = useState(1);
  const [hpA, setHpA] = useState(start.a.maxHp);
  const [hpB, setHpB] = useState(start.b.maxHp);
  const [lunge, setLunge] = useState<0 | 1 | null>(null);
  const [hitSide, setHitSide] = useState<0 | 1 | null>(null);
  const [popups, setPopups] = useState<DmgPopup[]>([]);
  const [log, setLog] = useState<string[]>([`${start.a.name} против ${start.b.name}!`]);
  const [ended, setEnded] = useState<null | boolean>(null); // won?
  const logRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  const haptic = (kind: "light" | "medium" | "heavy") => {
    try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(kind); } catch { /* noop */ }
  };

  useEffect(() => {
    if (idx >= events.length) return;
    const ev = events[idx];
    const delay = ev.t === "end" ? 500 : ev.t === "hit" ? 640 : 520;
    const tm = setTimeout(() => {
      if (ev.t === "hit" || ev.t === "counter") {
        const defender = ev.who === 0 ? 1 : 0;
        setLunge(ev.who);
        setHitSide(defender);
        setHpA(ev.hpA); setHpB(ev.hpB);
        idRef.current += 1;
        const crit = ev.t === "hit" ? ev.crit : false;
        setPopups((p) => [...p.slice(-5), { id: idRef.current, side: defender, text: `-${ev.dmg}`, crit }]);
        setLog((l) => [...l.slice(-30), ev.text]);
        haptic(crit ? "heavy" : "light");
        if (crit) haptic("heavy");
        setTimeout(() => { setLunge(null); setHitSide(null); }, 340);
      } else if (ev.t === "miss") {
        setHpA(ev.hpA); setHpB(ev.hpB);
        setLog((l) => [...l.slice(-30), ev.text]);
      } else if (ev.t === "heal") {
        setHpA(ev.hpA); setHpB(ev.hpB);
        idRef.current += 1;
        setPopups((p) => [...p.slice(-5), { id: idRef.current, side: ev.who, text: `+${ev.amount}`, crit: false }]);
      } else if (ev.t === "stun") {
        setLog((l) => [...l.slice(-30), `💫 ${ev.text}`]);
      } else if (ev.t === "end") {
        setEnded(ev.winner === 0);
        haptic(ev.winner === 0 ? "heavy" : "medium");
        return;
      }
      setIdx((i) => i + 1);
    }, delay);
    return () => clearTimeout(tm);
  }, [idx, events]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  const fighters = useMemo(() => [start.a, start.b], [start]);

  const renderFighter = (side: 0 | 1) => {
    const f = fighters[side];
    const hp = side === 0 ? hpA : hpB;
    const isDead = ended !== null && ((ended && side === 1) || (!ended && side === 0));
    const animClass =
      lunge === side ? (side === 0 ? "anim-lunge-l" : "anim-lunge-r")
      : hitSide === side ? "anim-hit" : "";
    return (
      <div className={`relative flex flex-col items-center ${side === 1 ? "order-3" : ""}`}>
        <div className="w-full max-w-[150px] mb-2">
          <div className="flex justify-between items-baseline mb-1">
            <span className="font-display text-[11px] truncate" style={{ color: "var(--g-cream)" }}>{f.name}</span>
            <span className="text-[10px]" style={{ color: "var(--g-muted)" }}>{f.level} ур</span>
          </div>
          <div className="bar-track h-3.5">
            <div
              className="bar-fill"
              style={{
                width: `${Math.max(0, (hp / f.maxHp) * 100)}%`,
                background: hp / f.maxHp > 0.4 ? "var(--g-lime)" : "var(--g-blood)",
              }}
            />
          </div>
          <div className="text-right text-[10px] mt-0.5" style={{ color: "var(--g-muted)" }}>{hp}/{f.maxHp}</div>
        </div>
        <div className={animClass}>
          <GrobnikAvatar seed={f.lookSeed} weaponId={f.weaponId} size={130} flip={side === 1} dead={isDead} />
        </div>
        {popups.filter((p) => p.side === side).map((p) => (
          <div
            key={p.id}
            className={`dmg-float absolute -top-2 font-display ${p.crit ? "text-3xl" : "text-xl"}`}
            style={{
              color: p.text.startsWith("+") ? "var(--g-lime)" : p.crit ? "var(--g-blood)" : "var(--g-amber)",
              left: "50%", marginLeft: "-20px",
              textShadow: "2px 2px 0 #0a0612",
            }}
          >
            {p.text}{p.crit ? "!" : ""}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`fixed inset-0 z-50 crypt-bg flex flex-col ${hitSide !== null && popups.some((p) => p.crit) ? "anim-shake" : ""}`}
      style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}
    >
      <div className="text-center font-display text-sm tracking-widest pt-2" style={{ color: "var(--g-violet)" }}>
        АРЕНА ЗАБЫТЫХ
      </div>

      <div className="flex-1 flex items-end justify-center gap-6 px-6 pb-2">
        {renderFighter(0)}
        <div className="font-display text-2xl self-center text-stroke" style={{ color: "var(--g-blood)" }}>VS</div>
        {renderFighter(1)}
      </div>

      <div className="px-4 pb-2" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}>
        <div ref={logRef} className="battle-log g-panel mx-auto max-w-md h-28 overflow-y-auto px-4 py-2 text-[12px] leading-relaxed"
          style={{ color: "var(--g-muted)" }}>
          {log.map((l, i) => (
            <div key={i} className={i === log.length - 1 ? "font-semibold" : ""} style={i === log.length - 1 ? { color: "var(--g-cream)" } : {}}>
              {l}
            </div>
          ))}
        </div>
      </div>

      {ended !== null && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-6" style={{ background: "rgba(10,6,18,0.72)" }}>
          <div className="g-panel anim-pop w-full max-w-sm p-6 text-center" style={{ background: "var(--g-panel2)" }}>
            <div
              className="font-display text-4xl mb-1 text-stroke"
              style={{ color: ended ? "var(--g-amber)" : "var(--g-blood)" }}
            >
              {ended ? "ПОБЕДА!" : "ПОРАЖЕНИЕ"}
            </div>
            <div className="text-sm mb-4" style={{ color: "var(--g-muted)" }}>
              {ended
                ? "Крипта гордится тобой. Зрители-призраки аплодируют костяшками."
                : "Гробник ворчит и отряхивается. Завтра будет лучше."}
            </div>
            <div className="g-panel inline-block px-5 py-2 mb-3 font-display" style={{ color: "var(--g-lime)" }}>
              +{result.xpGained} опыта
            </div>
            {result.leveledTo && (
              <div className="font-display mb-3 anim-glow" style={{ color: "var(--g-amber)" }}>
                НОВЫЙ УРОВЕНЬ: {result.leveledTo}!
              </div>
            )}
            <button
              onClick={onFinish}
              className="g-btn font-display w-full py-3.5 rounded-2xl text-lg"
              style={{ background: "var(--g-amber)", color: "var(--g-ink)" }}
            >
              {result.leveledTo ? "ЗАБРАТЬ ДАР" : "В КРИПТУ"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
