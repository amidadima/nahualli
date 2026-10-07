import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { players, ancestors } from "@db/schema";
import {
  WEAPONS,
  SKILLS,
  weaponById,
  skillById,
  curseOfDay,
  makeOpponentName,
  TORCHES_PER_DAY,
  TORCH_CAP,
  LEVEL_CAP,
  xpForLevel,
  type PlayerState,
  type PerkOffer,
  type FightResult,
} from "../../contracts/game";
import { generateOpponent, simulate, effectiveStats, type Combatant } from "../game/engine";

const rand = () => Math.random();
const todayKey = () => new Date().toISOString().slice(0, 10);

type PlayerRow = typeof players.$inferSelect;

function toState(p: PlayerRow): PlayerState {
  const today = todayKey();
  const eff = effectiveStats(p);
  return {
    token: p.token,
    name: p.name,
    lookSeed: p.lookSeed,
    level: p.level,
    xp: p.xp,
    xpNext: xpForLevel(p.level),
    maxHp: eff.maxHp,
    str: eff.str,
    agi: eff.agi,
    spd: eff.spd,
    weaponId: p.weaponId,
    skills: p.skills,
    torches: p.dayKey === today ? p.torches : TORCHES_PER_DAY,
    generation: p.generation,
    wins: p.wins,
    losses: p.losses,
    canDaily: p.lastDaily !== today,
    canRelease: p.level >= LEVEL_CAP,
    pendingPerks: (p.pendingPerks as PerkOffer[] | null) ?? null,
    curse: curseOfDay(today),
  };
}

async function findPlayer(token: string): Promise<PlayerRow | null> {
  const rows = await getDb().select().from(players).where(eq(players.token, token)).limit(1);
  return rows[0] ?? null;
}

async function mustPlayer(token: string): Promise<PlayerRow> {
  const p = await findPlayer(token);
  if (!p) throw new Error("Гробник не найден. Создайте нового.");
  return p;
}

/** Пополнение факелов раз в день, лениво — при любом действии */
async function refreshTorches(p: PlayerRow): Promise<PlayerRow> {
  const today = todayKey();
  if (p.dayKey !== today) {
    await getDb().update(players).set({ torches: TORCHES_PER_DAY, dayKey: today }).where(eq(players.id, p.id));
    return { ...p, torches: TORCHES_PER_DAY, dayKey: today };
  }
  return p;
}

function rollPerks(p: PlayerRow): PerkOffer[] {
  const offers: PerkOffer[] = [];
  const weaponPool = WEAPONS.filter((w) => w.id !== p.weaponId);
  const skillPool = SKILLS.filter((s) => !p.skills.includes(s.id));
  const statPool: PerkOffer[] = [
    { type: "stat", id: "str", name: "+2 Сила", desc: "Бьёт больнее всех по соседям" },
    { type: "stat", id: "agi", name: "+2 Ловкость", desc: "Уворачивается от костяшек" },
    { type: "stat", id: "spd", name: "+2 Скорость", desc: "Ходит первым и чаще" },
    { type: "stat", id: "hp", name: "+10 Здоровье", desc: "Толще надгробия" },
  ];
  const pickOne = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const wantWeapon = weaponPool.length > 0 && rand() < 0.6;
  if (wantWeapon) {
    const w = pickOne(weaponPool);
    offers.push({ type: "weapon", id: w.id, name: w.name, desc: `${w.desc} Урон ${w.minDmg}–${w.maxDmg}` });
  }
  while (offers.length < 3) {
    const useSkill = skillPool.length > 0 && rand() < 0.6;
    if (useSkill) {
      const s = pickOne(skillPool);
      if (!offers.some((o) => o.id === s.id)) {
        offers.push({ type: "skill", id: s.id, name: s.name, desc: s.desc });
        continue;
      }
    }
    const st = pickOne(statPool);
    if (!offers.some((o) => o.id === st.id)) offers.push(st);
    if (offers.length === 0) offers.push(statPool[0]);
  }
  return offers.slice(0, 3);
}

export const gameRouter = createRouter({
  // Создать гробника
  create: publicQuery
    .input(z.object({
      token: z.string().min(8).max(64),
      name: z.string().min(1).max(24),
      lookSeed: z.number().int().min(0),
    }))
    .mutation(async ({ input }) => {
      const existing = await findPlayer(input.token);
      if (existing) return { player: toState(existing) };
      await getDb().insert(players).values({
        token: input.token,
        name: input.name.slice(0, 24),
        lookSeed: input.lookSeed,
        maxHp: 28 + Math.floor(rand() * 7),
        str: 2 + Math.floor(rand() * 3),
        agi: 2 + Math.floor(rand() * 3),
        spd: 2 + Math.floor(rand() * 3),
        skills: [],
        torches: TORCHES_PER_DAY,
        dayKey: todayKey(),
      });
      const p = await mustPlayer(input.token);
      return { player: toState(p) };
    }),

  state: publicQuery
    .input(z.object({ token: z.string().min(8).max(64) }))
    .query(async ({ input }) => {
      const p = await findPlayer(input.token);
      if (!p) return { player: null };
      const refreshed = await refreshTorches(p);
      return { player: toState(refreshed) };
    }),

  // Бой — всё считается на сервере
  fight: publicQuery
    .input(z.object({ token: z.string().min(8).max(64) }))
    .mutation(async ({ input }) => {
      let p = await mustPlayer(input.token);
      p = await refreshTorches(p);
      if (p.pendingPerks && (p.pendingPerks as unknown[]).length > 0) {
        throw new Error("Сначала выбери дар за уровень!");
      }
      if (p.torches <= 0) throw new Error("Факелы погасли. Возвращайся завтра — крипта подождёт.");
      if (p.level >= LEVEL_CAP && p.pendingPerks == null) {
        // на капе бой разрешён, XP не начисляется сверх меры
      }

      const curse = curseOfDay(todayKey());
      const eff = effectiveStats(p);
      const me: Combatant = {
        name: p.name, lookSeed: p.lookSeed, level: p.level,
        maxHp: eff.maxHp, str: eff.str, agi: eff.agi, spd: eff.spd,
        weaponId: p.weaponId, skills: p.skills,
      };
      const opp = generateOpponent(p.level, rand);
      opp.name = makeOpponentName(rand);

      const events = simulate(me, opp, curse, rand);
      const end = events[events.length - 1];
      const won = end.t === "end" && end.winner === 0;

      const xpGained = won ? 30 + Math.floor(rand() * 21) : 10 + Math.floor(rand() * 9);
      let { xp, level, maxHp, str, agi, spd, skills } = p;
      let leveledTo: number | null = null;
      let pendingPerks = p.pendingPerks as PerkOffer[] | null;

      if (level < LEVEL_CAP) {
        xp += xpGained;
        while (level < LEVEL_CAP && xp >= xpForLevel(level)) {
          xp -= xpForLevel(level);
          level += 1;
          leveledTo = level;
          maxHp += 3 + Math.floor(rand() * 3);
          const stat = ["str", "agi", "spd"][Math.floor(rand() * 3)];
          if (stat === "str") str += 1; else if (stat === "agi") agi += 1; else spd += 1;
        }
        if (leveledTo) pendingPerks = rollPerks({ ...p, skills, weaponId: p.weaponId });
      }

      await getDb().update(players).set({
        xp, level, maxHp, str, agi, spd,
        torches: p.torches - 1,
        wins: p.wins + (won ? 1 : 0),
        losses: p.losses + (won ? 0 : 1),
        pendingPerks: pendingPerks ?? null,
      }).where(eq(players.id, p.id));

      const fresh = await mustPlayer(input.token);
      const result: FightResult = {
        events, won, xpGained,
        leveledTo,
        torchesLeft: p.torches - 1,
        player: toState(fresh),
      };
      return result;
    }),

  // Выбор дара после повышения уровня
  choosePerk: publicQuery
    .input(z.object({
      token: z.string().min(8).max(64),
      type: z.enum(["weapon", "skill", "stat"]),
      id: z.string().max(40),
    }))
    .mutation(async ({ input }) => {
      const p = await mustPlayer(input.token);
      const pending = (p.pendingPerks as PerkOffer[] | null) ?? [];
      const offer = pending.find((o) => o.type === input.type && o.id === input.id);
      if (!offer) throw new Error("Такого дара в предложении нет.");

      const patch: Partial<PlayerRow> = { pendingPerks: null };
      if (offer.type === "weapon") patch.weaponId = offer.id;
      else if (offer.type === "skill") patch.skills = [...p.skills, offer.id];
      else if (offer.id === "str") patch.str = p.str + 2;
      else if (offer.id === "agi") patch.agi = p.agi + 2;
      else if (offer.id === "spd") patch.spd = p.spd + 2;
      else if (offer.id === "hp") patch.maxHp = p.maxHp + 10;

      await getDb().update(players).set(patch).where(eq(players.id, p.id));
      const fresh = await mustPlayer(input.token);
      return { player: toState(fresh) };
    }),

  // Ежедневный гробик с наградой
  claimDaily: publicQuery
    .input(z.object({ token: z.string().min(8).max(64) }))
    .mutation(async ({ input }) => {
      const p = await mustPlayer(input.token);
      const today = todayKey();
      if (p.lastDaily === today) throw new Error("Гробик уже открыт сегодня.");
      const roll = rand();
      let rewardText: string;
      const patch: Partial<PlayerRow> = { lastDaily: today };
      if (roll < 0.35) {
        patch.torches = Math.min(TORCH_CAP, p.torches + 2);
        rewardText = "Внутри — два свежих факела!";
      } else if (roll < 0.9) {
        const bonus = 20 + Math.floor(rand() * 31);
        patch.xp = p.level < LEVEL_CAP ? p.xp + bonus : p.xp;
        rewardText = `Внутри — ${bonus} опыта и запах ладана.`;
      } else {
        patch.maxHp = p.maxHp + 3;
        rewardText = "Внутри — костяной амулет: +3 к здоровью навсегда!";
      }
      await getDb().update(players).set(patch).where(eq(players.id, p.id));
      const fresh = await mustPlayer(input.token);
      return { player: toState(fresh), rewardText };
    }),

  // Род: список предков
  dynasty: publicQuery
    .input(z.object({ token: z.string().min(8).max(64) }))
    .query(async ({ input }) => {
      const rows = await getDb().select().from(ancestors)
        .where(eq(ancestors.playerToken, input.token));
      return {
        ancestors: rows
          .sort((x, y) => x.generation - y.generation)
          .map((a) => ({
            id: a.id, name: a.name, generation: a.generation, level: a.level,
            weaponId: a.weaponId, wins: a.wins, losses: a.losses, heirloomName: a.heirloomName,
          })),
      };
    }),

  // Отпустить душу: гробник уходит в Род, начинается новое поколение
  releaseSoul: publicQuery
    .input(z.object({
      token: z.string().min(8).max(64),
      heirloomType: z.enum(["weapon", "skill"]),
      heirloomId: z.string().max(40),
      newName: z.string().min(1).max(24),
      newLookSeed: z.number().int().min(0),
    }))
    .mutation(async ({ input }) => {
      const p = await mustPlayer(input.token);
      if (p.level < LEVEL_CAP) throw new Error("Гробник ещё не готов к вечности (нужен 10 уровень).");

      let heirloomName = "";
      const patch: Partial<PlayerRow> = {};
      if (input.heirloomType === "weapon") {
        const w = weaponById(input.heirloomId);
        if (w.id !== p.weaponId) throw new Error("Наследовать можно только оружие предка.");
        heirloomName = w.name;
        patch.weaponId = w.id;
      } else {
        const s = skillById(input.heirloomId);
        if (!s || !p.skills.includes(s.id)) throw new Error("Наследовать можно только навык предка.");
        heirloomName = s.name;
        patch.skills = [s.id];
      }
      if (input.heirloomType === "skill") patch.weaponId = "claws";
      if (input.heirloomType === "weapon") patch.skills = [];

      await getDb().insert(ancestors).values({
        playerToken: p.token,
        name: p.name,
        generation: p.generation,
        level: p.level,
        weaponId: p.weaponId,
        wins: p.wins,
        losses: p.losses,
        heirloomName,
        playerId: p.id,
      });

      // наследие поколений: +1 к случайной характеристике за каждое поколение
      const bonus = Math.min(5, p.generation);
      const stats = ["str", "agi", "spd"] as const;
      let { str, agi, spd } = { str: 2 + Math.floor(rand() * 3), agi: 2 + Math.floor(rand() * 3), spd: 2 + Math.floor(rand() * 3) };
      for (let i = 0; i < bonus; i++) {
        const s = stats[Math.floor(rand() * 3)];
        if (s === "str") str += 1; else if (s === "agi") agi += 1; else spd += 1;
      }

      await getDb().update(players).set({
        ...patch,
        name: input.newName.slice(0, 24),
        lookSeed: input.newLookSeed,
        level: 1, xp: 0,
        maxHp: 28 + Math.floor(rand() * 7),
        str, agi, spd,
        torches: TORCHES_PER_DAY,
        generation: p.generation + 1,
        pendingPerks: null,
      }).where(eq(players.id, p.id));

      const fresh = await mustPlayer(input.token);
      return { player: toState(fresh) };
    }),
});
