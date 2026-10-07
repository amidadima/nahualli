import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import GrobnikAvatar from "@/components/GrobnikAvatar";
import BattleView from "@/components/BattleView";
import {
  weaponById,
  skillById,
  makeName,
  TORCH_CAP,
  LEVEL_CAP,
  type FightResult,
  type PerkOffer,
} from "../../contracts/game";

declare global {
  interface Window { Telegram?: any }
}

function getToken(): string {
  try {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser?.id) return `tg-${tgUser.id}`;
  } catch { /* noop */ }
  let t = localStorage.getItem("grobnik_token");
  if (!t) {
    t = crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem("grobnik_token", t);
  }
  return t;
}

function tgDisplayName(): string {
  try {
    const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (u?.first_name) return String(u.first_name).slice(0, 24);
  } catch { /* noop */ }
  return makeName(Math.random);
}

const RARITY_COLOR: Record<string, string> = {
  common: "var(--g-muted)",
  rare: "var(--g-violet)",
  epic: "var(--g-amber)",
};

export default function Home() {
  const token = useMemo(getToken, []);
  const utils = trpc.useUtils();
  const stateQ = trpc.game.state.useQuery({ token });
  const player = stateQ.data?.player ?? null;

  const [fight, setFight] = useState<FightResult | null>(null);
  const [dailyText, setDailyText] = useState<string | null>(null);
  const [showDynasty, setShowDynasty] = useState(false);
  const [showRelease, setShowRelease] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Telegram WebApp: развернуть, подкрасить
  useEffect(() => {
    try {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
        tg.setHeaderColor?.("#150f1e");
        tg.setBackgroundColor?.("#150f1e");
      }
    } catch { /* noop */ }
  }, []);

  const fightM = trpc.game.fight.useMutation({
    onSuccess: (r) => { setFight(r); setError(null); utils.game.state.invalidate(); },
    onError: (e) => setError(e.message),
  });
  const perkM = trpc.game.choosePerk.useMutation({
    onSuccess: () => utils.game.state.invalidate(),
    onError: (e) => setError(e.message),
  });
  const dailyM = trpc.game.claimDaily.useMutation({
    onSuccess: (r) => { setDailyText(r.rewardText); utils.game.state.invalidate(); },
    onError: (e) => setError(e.message),
  });

  useEffect(() => {
    if (error) {
      const tm = setTimeout(() => setError(null), 3200);
      return () => clearTimeout(tm);
    }
  }, [error]);

  if (stateQ.isLoading) {
    return (
      <div className="crypt-bg min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="anim-bob"><GrobnikAvatar seed={777} size={110} /></div>
        <div className="font-display text-sm tracking-widest" style={{ color: "var(--g-muted)" }}>
          ОТКРЫВАЕМ ГРОБ…
        </div>
      </div>
    );
  }

  if (!player) return <CreateScreen token={token} onCreated={() => utils.game.state.invalidate()} />;

  const w = weaponById(player.weaponId);
  const canFight = player.torches > 0 && !player.pendingPerks && !fightM.isPending;

  return (
    <div className="crypt-bg min-h-screen relative overflow-hidden">
      {/* пыль-светлячки */}
      {[12, 38, 64, 82, 25, 55].map((l, i) => (
        <div key={i} className="dust" style={{ left: `${l}%`, top: `${12 + i * 14}%`, animationDelay: `${i * 0.9}s` }} />
      ))}

      <div className="desktop-frame relative z-10 mx-auto max-w-md px-4 pb-10"
        style={{ paddingTop: "max(env(safe-area-inset-top), 14px)" }}>

        {/* шапка */}
        <header className="flex items-center justify-between mb-3 anim-fade-up">
          <div>
            <div className="font-display text-xl text-stroke" style={{ color: "var(--g-amber)" }}>
              ГРОБНИКИ
            </div>
            <div className="text-[11px]" style={{ color: "var(--g-muted)" }}>
              поколение {["I","II","III","IV","V","VI","VII","VIII","IX","X"][Math.min(9, player.generation - 1)] ?? player.generation}
            </div>
          </div>
          <button onClick={() => setShowHelp((v) => !v)}
            className="g-btn rounded-full w-11 h-11 font-display text-lg"
            style={{ background: "var(--g-panel2)", color: "var(--g-violet)" }}>
            ?
          </button>
        </header>

        {showHelp && (
          <div className="g-panel p-4 mb-3 text-[13px] leading-relaxed anim-fade-up" style={{ color: "var(--g-cream)", background: "var(--g-panel2)" }}>
            <b>Как играть.</b> Жми «В БОЙ» — гробник дерётся сам. За победы — опыт, за уровни — дары
            на выбор. Факелов — 5 в день, они обновляются утром. Открывай ежедневный гробик.
            На 10 уровне отпусти душу гробника в Род — и вырасти наследника сильнее.
            Проклятие дня меняет правила арены каждые сутки.
          </div>
        )}

        {/* проклятие дня */}
        <div className="g-panel flex items-center gap-3 px-4 py-2.5 mb-3 anim-fade-up" style={{ background: "var(--g-panel2)" }}>
          <span className="text-lg anim-glow">🌙</span>
          <div>
            <div className="font-display text-[12px]" style={{ color: "var(--g-violet)" }}>
              ПРОКЛЯТИЕ ДНЯ: {player.curse.name}
            </div>
            <div className="text-[11px]" style={{ color: "var(--g-muted)" }}>{player.curse.desc}</div>
          </div>
        </div>

        {/* карточка гробника */}
        <section className="g-panel p-4 mb-3 anim-fade-up" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center gap-4">
            <GrobnikAvatar seed={player.lookSeed} weaponId={player.weaponId} size={128} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="font-display text-2xl truncate">{player.name}</h1>
                <span className="g-btn rounded-lg px-2 py-0.5 font-display text-[11px]"
                  style={{ background: "var(--g-violet)", color: "var(--g-ink)" }}>
                  {player.level} УР
                </span>
              </div>
              {/* опыт */}
              <div className="bar-track h-3 mb-1">
                <div className="bar-fill" style={{
                  width: player.level >= LEVEL_CAP ? "100%" : `${Math.min(100, (player.xp / player.xpNext) * 100)}%`,
                  background: "var(--g-violet)",
                }} />
              </div>
              <div className="text-[11px] mb-2" style={{ color: "var(--g-muted)" }}>
                {player.level >= LEVEL_CAP ? "максимум — готов к вечности" : `${player.xp}/${player.xpNext} опыта`}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <StatChip label="HP" value={player.maxHp} color="var(--g-lime)" />
                <StatChip label="СИЛ" value={player.str} color="var(--g-blood)" />
                <StatChip label="ЛОВ" value={player.agi} color="var(--g-amber)" />
                <StatChip label="СКР" value={player.spd} color="var(--g-violet)" />
              </div>
            </div>
          </div>

          {/* оружие и навыки */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="g-btn rounded-lg px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: "var(--g-ink)", color: RARITY_COLOR[w.rarity] }}>
              {w.name} · {w.minDmg}–{w.maxDmg}
            </span>
            {player.skills.map((s) => (
              <span key={s} className="g-btn rounded-lg px-2.5 py-1 text-[11px]"
                style={{ background: "var(--g-panel2)", color: "var(--g-cream)" }}>
                {skillById(s)?.name ?? s}
              </span>
            ))}
            {player.skills.length === 0 && (
              <span className="text-[11px] px-1 py-1" style={{ color: "var(--g-muted)" }}>
                навыков пока нет — качайся
              </span>
            )}
          </div>

          <div className="mt-3 text-[11px]" style={{ color: "var(--g-muted)" }}>
            Побед: <b style={{ color: "var(--g-lime)" }}>{player.wins}</b>
            {" · "}Поражений: <b style={{ color: "var(--g-blood)" }}>{player.losses}</b>
          </div>
        </section>

        {/* факелы */}
        <div className="flex items-center justify-between mb-3 px-1 anim-fade-up" style={{ animationDelay: "100ms" }}>
          <div className="flex gap-1.5">
            {Array.from({ length: TORCH_CAP }).map((_, i) => (
              <span key={i} className={i < player.torches ? "anim-glow text-lg" : "text-lg opacity-20 grayscale"}>🔥</span>
            ))}
          </div>
          <span className="text-[11px]" style={{ color: "var(--g-muted)" }}>
            {player.torches > 0 ? `факелов: ${player.torches}` : "факелы погасли до завтра"}
          </span>
        </div>

        {/* кнопка боя */}
        <button
          onClick={() => fightM.mutate({ token })}
          disabled={!canFight}
          className="g-btn font-display w-full py-5 rounded-3xl text-2xl mb-3 anim-fade-up"
          style={{ background: "var(--g-amber)", color: "var(--g-ink)", animationDelay: "140ms" }}
        >
          {fightM.isPending ? "ИЩЕМ ЖЕРТВУ…" : player.torches > 0 ? "В БОЙ ⚔" : "КРИПТА СПИТ"}
        </button>

        {error && (
          <div className="g-panel px-4 py-2.5 mb-3 text-[13px] anim-pop"
            style={{ background: "var(--g-panel2)", color: "var(--g-blood)" }}>
            {error}
          </div>
        )}

        {/* ежедневный гробик + род */}
        <div className="grid grid-cols-2 gap-3 anim-fade-up" style={{ animationDelay: "180ms" }}>
          <button
            onClick={() => dailyM.mutate({ token })}
            disabled={!player.canDaily || dailyM.isPending}
            className="g-btn rounded-2xl py-4 font-display text-sm"
            style={{ background: "var(--g-panel2)", color: "var(--g-cream)" }}
          >
            {player.canDaily ? "⚰ ГРОБИК ДНЯ" : "ГРОБИК ПУСТ"}
          </button>
          <button
            onClick={() => setShowDynasty(true)}
            className="g-btn rounded-2xl py-4 font-display text-sm"
            style={{ background: "var(--g-panel2)", color: "var(--g-violet)" }}
          >
            👻 РОД ({player.generation - 1})
          </button>
        </div>

        {player.canRelease && (
          <button
            onClick={() => setShowRelease(true)}
            className="g-btn font-display w-full py-4 rounded-2xl text-base mt-3 anim-glow"
            style={{ background: "var(--g-violet)", color: "var(--g-ink)" }}
          >
            ОТПУСТИТЬ ДУШУ → НОВОЕ ПОКОЛЕНИЕ
          </button>
        )}
      </div>

      {/* модалки */}
      {player.pendingPerks && (
        <PerkModal
          offers={player.pendingPerks}
          level={player.level}
          busy={perkM.isPending}
          onPick={(o) => perkM.mutate({ token, type: o.type, id: o.id })}
        />
      )}
      {dailyText && (
        <Modal onClose={() => setDailyText(null)}>
          <div className="text-center">
            <div className="text-5xl mb-3 anim-pop">⚰️</div>
            <div className="font-display text-lg mb-2" style={{ color: "var(--g-amber)" }}>КРЫШКА СКРИПИТ…</div>
            <div className="text-sm mb-5" style={{ color: "var(--g-cream)" }}>{dailyText}</div>
            <button onClick={() => setDailyText(null)} className="g-btn font-display w-full py-3 rounded-2xl"
              style={{ background: "var(--g-amber)", color: "var(--g-ink)" }}>ЗАБРАТЬ</button>
          </div>
        </Modal>
      )}
      {showDynasty && <DynastyModal token={token} onClose={() => setShowDynasty(false)} />}
      {showRelease && (
        <ReleaseModal
          token={token}
          onClose={() => setShowRelease(false)}
          onDone={() => { setShowRelease(false); utils.game.state.invalidate(); utils.game.dynasty.invalidate(); }}
        />
      )}
      {fight && <BattleView result={fight} onFinish={() => { setFight(null); utils.game.state.invalidate(); }} />}
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="g-panel !rounded-xl !shadow-none px-1.5 py-1.5 text-center" style={{ background: "var(--g-ink)" }}>
      <div className="font-display text-sm" style={{ color }}>{value}</div>
      <div className="text-[9px] tracking-wider" style={{ color: "var(--g-muted)" }}>{label}</div>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-5"
      style={{ background: "rgba(10,6,18,0.75)" }}
      onClick={onClose}>
      <div className="g-panel anim-pop w-full max-w-sm p-5" style={{ background: "var(--g-panel2)" }}
        onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function PerkModal({ offers, level, busy, onPick }: {
  offers: PerkOffer[]; level: number; busy: boolean; onPick: (o: PerkOffer) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-5" style={{ background: "rgba(10,6,18,0.8)" }}>
      <div className="g-panel anim-pop w-full max-w-sm p-5" style={{ background: "var(--g-panel2)" }}>
        <div className="font-display text-center text-xl mb-1 anim-glow" style={{ color: "var(--g-amber)" }}>
          УРОВЕНЬ {level}!
        </div>
        <div className="text-center text-[12px] mb-4" style={{ color: "var(--g-muted)" }}>
          Духи крипты предлагают дар. Выбери один:
        </div>
        <div className="flex flex-col gap-2.5">
          {offers.map((o, i) => (
            <button key={o.id + i} disabled={busy} onClick={() => onPick(o)}
              className="g-btn rounded-2xl p-3.5 text-left anim-fade-up"
              style={{ background: "var(--g-panel)", animationDelay: `${i * 90}ms` }}>
              <div className="font-display text-sm mb-0.5"
                style={{ color: o.type === "weapon" ? "var(--g-amber)" : o.type === "skill" ? "var(--g-violet)" : "var(--g-lime)" }}>
                {o.type === "weapon" ? "⚔ " : o.type === "skill" ? "✦ " : "💪 "}{o.name}
              </div>
              <div className="text-[12px]" style={{ color: "var(--g-muted)" }}>{o.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== СОЗДАНИЕ ГРОБНИКА ====================
function CreateScreen({ token, onCreated }: { token: string; onCreated: () => void }) {
  const [lookSeed, setLookSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [name, setName] = useState(() => tgDisplayName());
  const createM = trpc.game.create.useMutation({ onSuccess: onCreated });

  return (
    <div className="crypt-bg min-h-screen relative overflow-hidden">
      {[15, 40, 66, 85, 30, 58].map((l, i) => (
        <div key={i} className="dust" style={{ left: `${l}%`, top: `${10 + i * 15}%`, animationDelay: `${i * 0.8}s` }} />
      ))}
      <div className="desktop-frame relative z-10 mx-auto max-w-md px-5 flex flex-col min-h-screen"
        style={{ paddingTop: "max(env(safe-area-inset-top), 24px)", paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>

        <div className="text-center mt-4 mb-2 anim-fade-up">
          <div className="font-display text-4xl text-stroke" style={{ color: "var(--g-amber)" }}>ГРОБНИКИ</div>
          <div className="text-[13px] mt-1" style={{ color: "var(--g-muted)" }}>
            арена проклятых малышей
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <div className="relative anim-fade-up" style={{ animationDelay: "80ms" }}>
            <GrobnikAvatar seed={lookSeed} size={190} />
            <button
              onClick={() => setLookSeed(Math.floor(Math.random() * 1e9))}
              className="g-btn absolute -right-3 top-1 rounded-full w-12 h-12 font-display text-lg"
              style={{ background: "var(--g-violet)", color: "var(--g-ink)" }}
              title="Другой гробник">
              ⟳
            </button>
          </div>
          <div className="text-[12px] anim-fade-up" style={{ color: "var(--g-muted)", animationDelay: "140ms" }}>
            из-под земли вылез… этот
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 24))}
            placeholder="Имя гробника"
            className="g-panel w-full max-w-xs mt-2 px-4 py-3.5 text-center font-display text-lg outline-none anim-fade-up"
            style={{ background: "var(--g-panel2)", color: "var(--g-cream)", animationDelay: "200ms" }}
          />
        </div>

        {createM.error && (
          <div className="text-center text-[13px] mb-2" style={{ color: "var(--g-blood)" }}>
            {createM.error.message}
          </div>
        )}
        <button
          onClick={() => name.trim() && createM.mutate({ token, name: name.trim(), lookSeed })}
          disabled={createM.isPending || !name.trim()}
          className="g-btn font-display w-full py-5 rounded-3xl text-xl anim-fade-up"
          style={{ background: "var(--g-amber)", color: "var(--g-ink)", animationDelay: "260ms" }}
        >
          {createM.isPending ? "КОПАЕМ…" : "ВЫКОПАТЬ ГРОБНИКА"}
        </button>
        <div className="text-center text-[11px] mt-3 pb-2" style={{ color: "var(--g-muted)" }}>
          бои проходят сами · 5 боёв в день · смерть — это начало
        </div>
      </div>
    </div>
  );
}

// ==================== РОД (династия) ====================
function DynastyModal({ token, onClose }: { token: string; onClose: () => void }) {
  const q = trpc.game.dynasty.useQuery({ token });
  const list = q.data?.ancestors ?? [];
  return (
    <Modal onClose={onClose}>
      <div className="font-display text-lg mb-1" style={{ color: "var(--g-violet)" }}>👻 РОД</div>
      <div className="text-[12px] mb-4" style={{ color: "var(--g-muted)" }}>
        Предки наблюдают из склепа. Каждое поколение сильнее предыдущего.
      </div>
      {list.length === 0 && (
        <div className="text-[13px] mb-4" style={{ color: "var(--g-muted)" }}>
          Род пока пуст. Доведи гробника до {LEVEL_CAP} уровня и отпусти его душу — наследник
          получит реликвию и бонус поколения.
        </div>
      )}
      <div className="flex flex-col gap-2 max-h-64 overflow-y-auto mb-4">
        {list.map((a) => (
          <div key={a.id} className="g-panel !shadow-none p-3 flex items-center gap-3" style={{ background: "var(--g-panel)" }}>
            <span className="text-2xl">🪦</span>
            <div className="flex-1 min-w-0">
              <div className="font-display text-sm truncate">{a.name}
                <span className="text-[11px] ml-2" style={{ color: "var(--g-muted)" }}>поколение {a.generation}</span>
              </div>
              <div className="text-[11px]" style={{ color: "var(--g-muted)" }}>
                ур. {a.level} · {a.wins} побед · реликвия: {a.heirloomName}
              </div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={onClose} className="g-btn font-display w-full py-3 rounded-2xl"
        style={{ background: "var(--g-panel)", color: "var(--g-cream)" }}>ЗАКРЫТЬ СКЛЕП</button>
    </Modal>
  );
}

// ==================== ОТПУСТИТЬ ДУШУ ====================
function ReleaseModal({ token, onClose, onDone }: { token: string; onClose: () => void; onDone: () => void }) {
  const stateQ = trpc.game.state.useQuery({ token });
  const player = stateQ.data?.player;
  const releaseM = trpc.game.releaseSoul.useMutation({ onSuccess: onDone });

  const [choice, setChoice] = useState<{ type: "weapon" | "skill"; id: string } | null>(null);
  const [newName, setNewName] = useState(() => tgDisplayName());
  const [newLook, setNewLook] = useState(() => Math.floor(Math.random() * 1e9));

  if (!player) return null;
  const w = weaponById(player.weaponId);

  return (
    <Modal onClose={onClose}>
      <div className="font-display text-lg mb-1" style={{ color: "var(--g-violet)" }}>ОТПУСТИТЬ ДУШУ</div>
      <div className="text-[12px] mb-4" style={{ color: "var(--g-muted)" }}>
        {player.name} уходит в Род с почестями. Наследник начнёт с 1 уровня,
        но получит бонус поколения и одну реликвию предка:
      </div>

      <div className="flex flex-col gap-2 mb-4">
        <button
          onClick={() => setChoice({ type: "weapon", id: w.id })}
          className="g-btn rounded-2xl p-3 text-left"
          style={{
            background: "var(--g-panel)",
            outline: choice?.type === "weapon" ? "3px solid var(--g-amber)" : "none",
          }}>
          <div className="font-display text-sm" style={{ color: "var(--g-amber)" }}>⚔ {w.name}</div>
          <div className="text-[11px]" style={{ color: "var(--g-muted)" }}>оружие предка</div>
        </button>
        {player.skills.map((s) => (
          <button key={s}
            onClick={() => setChoice({ type: "skill", id: s })}
            className="g-btn rounded-2xl p-3 text-left"
            style={{
              background: "var(--g-panel)",
              outline: choice?.type === "skill" && choice.id === s ? "3px solid var(--g-amber)" : "none",
            }}>
            <div className="font-display text-sm" style={{ color: "var(--g-violet)" }}>✦ {skillById(s)?.name}</div>
            <div className="text-[11px]" style={{ color: "var(--g-muted)" }}>{skillById(s)?.desc}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <GrobnikAvatar seed={newLook} size={84} />
          <button onClick={() => setNewLook(Math.floor(Math.random() * 1e9))}
            className="g-btn absolute -right-2 -top-1 rounded-full w-8 h-8 text-sm"
            style={{ background: "var(--g-violet)", color: "var(--g-ink)" }}>⟳</button>
        </div>
        <input value={newName} onChange={(e) => setNewName(e.target.value.slice(0, 24))}
          placeholder="Имя наследника"
          className="g-panel !shadow-none flex-1 px-3 py-3 font-display text-sm outline-none"
          style={{ background: "var(--g-panel)", color: "var(--g-cream)" }} />
      </div>

      {releaseM.error && (
        <div className="text-[12px] mb-2" style={{ color: "var(--g-blood)" }}>{releaseM.error.message}</div>
      )}
      <button
        disabled={!choice || !newName.trim() || releaseM.isPending}
        onClick={() => choice && releaseM.mutate({
          token, heirloomType: choice.type, heirloomId: choice.id,
          newName: newName.trim(), newLookSeed: newLook,
        })}
        className="g-btn font-display w-full py-3.5 rounded-2xl"
        style={{ background: "var(--g-violet)", color: "var(--g-ink)" }}>
        {releaseM.isPending ? "РИТУАЛ…" : "ПРОВЕСТИ РИТУАЛ"}
      </button>
    </Modal>
  );
}
