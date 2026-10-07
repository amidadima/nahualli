// Серверный движок боя. Клиент получает только готовый лог событий.
import {
  WEAPONS,
  weaponById,
  type BattleEvent,
  type CurseDef,
  type FighterSnapshot,
} from "../../contracts/game";

export interface Combatant {
  name: string;
  lookSeed: number;
  level: number;
  maxHp: number;
  str: number;
  agi: number;
  spd: number;
  weaponId: string;
  skills: string[];
}

export function effectiveStats(c: {
  maxHp: number; str: number; agi: number; spd: number; skills: string[];
}) {
  let { maxHp, str, agi, spd } = c;
  for (const s of c.skills) {
    if (s === "tough") maxHp += 15;
    if (s === "strong") str += 2;
    if (s === "swift") spd += 2;
  }
  return { maxHp, str, agi, spd };
}

export function generateOpponent(level: number, rand: () => number): Combatant {
  const lvl = Math.max(1, Math.min(10, level + Math.floor(rand() * 3) - 1));
  const base = 26 + lvl * 4;
  const skillsPool = ["dodge", "crit", "vampire", "counter", "stone", "berserk", "stun"];
  const skills: string[] = [];
  const nSkills = Math.min(3, Math.floor(lvl / 2) + (rand() < 0.25 ? 1 : 0));
  while (skills.length < nSkills) {
    const s = skillsPool[Math.floor(rand() * skillsPool.length)];
    if (!skills.includes(s)) skills.push(s);
  }
  const weaponPool = WEAPONS.filter((w) =>
    w.rarity === "common" || (w.rarity === "rare" && lvl >= 3) || (w.rarity === "epic" && lvl >= 6)
  );
  return {
    name: "",
    lookSeed: Math.floor(rand() * 1e9),
    level: lvl,
    maxHp: base + Math.floor(rand() * 10),
    str: 2 + Math.floor(rand() * (2 + lvl * 0.8)),
    agi: 2 + Math.floor(rand() * (2 + lvl * 0.8)),
    spd: 2 + Math.floor(rand() * (2 + lvl * 0.8)),
    weaponId: weaponPool[Math.floor(rand() * weaponPool.length)].id,
    skills,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function simulate(
  a: Combatant,
  b: Combatant,
  curse: CurseDef,
  rand: () => number,
  maxRounds = 40
): BattleEvent[] {
  const events: BattleEvent[] = [];
  const sa = effectiveStats(a);
  const sb = effectiveStats(b);
  const wa = weaponById(a.weaponId);
  const wb = weaponById(b.weaponId);

  const snap = (c: Combatant, isPlayer: boolean, hp: number): FighterSnapshot => ({
    name: c.name, lookSeed: c.lookSeed, level: c.level, maxHp: hp, weaponId: c.weaponId, isPlayer,
  });
  events.push({ t: "start", a: snap(a, true, sa.maxHp), b: snap(b, false, sb.maxHp) });

  let hpA = sa.maxHp, hpB = sb.maxHp;
  let stunA = false, stunB = false;
  const push = (e: BattleEvent) => events.push(e);

  for (let round = 0; round < maxRounds && hpA > 0 && hpB > 0; round++) {
    // порядок хода: скорость + случайность
    const first: 0 | 1 = sa.spd + rand() * 6 >= sb.spd + rand() * 6 ? 0 : 1;
    for (const side of [first, first === 0 ? 1 : 0] as const) {
      if (hpA <= 0 || hpB <= 0) break;
      const atk = side === 0 ? a : b;
      const def = side === 0 ? b : a;
      const atkS = side === 0 ? sa : sb;
      const defS = side === 0 ? sb : sa;
      const w = side === 0 ? wa : wb;
      const atkName = atk.name;

      if (side === 0 && stunA) { stunA = false; push({ t: "stun", who: 0, text: `${atkName} приходит в себя` }); continue; }
      if (side === 1 && stunB) { stunB = false; push({ t: "stun", who: 1, text: `${atkName} приходит в себя` }); continue; }

      // уворот
      let dodgeChance = clamp(0.06 + (defS.agi - atkS.agi) * 0.02 + (def.skills.includes("dodge") ? 0.15 : 0), 0, 0.55);
      if (curse.id === "fog") dodgeChance = clamp(dodgeChance + 0.15, 0, 0.6);
      if (curse.id === "sticky_soil") dodgeChance = 0;

      if (rand() < dodgeChance) {
        const hp = side === 0 ? { hpA, hpB } : { hpA, hpB };
        push({ t: "miss", who: side, ...hp, text: `${def.name} уворачивается!` });
        // контратака
        if (def.skills.includes("counter") && rand() < 0.3) {
          const cdmg = Math.max(1, Math.floor((weaponById(def.weaponId).minDmg + defS.str) / 2));
          if (side === 0) hpA = Math.max(0, hpA - cdmg); else hpB = Math.max(0, hpB - cdmg);
          push({ t: "counter", who: side === 0 ? 1 : 0, dmg: cdmg, hpA, hpB, text: `${def.name} хохочет и бьёт в ответ!` });
        }
        continue;
      }

      // урон
      let dmg = w.minDmg + Math.floor(rand() * (w.maxDmg - w.minDmg + 1)) + atkS.str;
      let critChance = 0.05 + w.crit + (atk.skills.includes("crit") ? 0.1 : 0);
      if (curse.id === "blood_moon") critChance *= 2;
      const crit = rand() < critChance;
      if (crit) dmg = Math.floor(dmg * 1.8);
      if (atk.skills.includes("berserk")) {
        const atkHp = side === 0 ? hpA : hpB;
        if (atkHp < atkS.maxHp / 2) dmg = Math.floor(dmg * 1.35);
      }
      if (curse.id === "crystal_night") dmg = Math.floor(dmg * 1.2);
      if (curse.id === "quiet_hour") dmg = Math.floor(dmg * 1.1);
      if (def.skills.includes("stone") || curse.id === "old_bones") dmg = Math.floor(dmg * 0.8);
      dmg = Math.max(1, dmg);

      if (side === 0) hpB = Math.max(0, hpB - dmg); else hpA = Math.max(0, hpA - dmg);
      push({ t: "hit", who: side, dmg, crit, hpA, hpB, text: `${atkName} бьёт: ${w.name}${crit ? " — КРИТ!" : ""}` });

      // вампиризм
      const vamp = atk.skills.includes("vampire") ? 0.25 : curse.id === "hungry_ghosts" ? 0.15 : 0;
      if (vamp > 0 && dmg > 1) {
        const heal = Math.max(1, Math.floor(dmg * vamp));
        if (side === 0) hpA = Math.min(sa.maxHp, hpA + heal); else hpB = Math.min(sb.maxHp, hpB + heal);
        push({ t: "heal", who: side, amount: heal, hpA, hpB });
      }

      // оглушение
      const stunChance = atk.skills.includes("stun") ? 0.15 : w.id === "pan" ? 0.12 : 0;
      if (stunChance > 0 && curse.id !== "quiet_hour" && rand() < stunChance) {
        if (side === 0) stunB = true; else stunA = true;
        push({ t: "stun", who: side === 0 ? 1 : 0, text: `${def.name} оглушён!` });
      }
    }
  }

  // если лимит раундов — побеждает тот, у кого больше HP%
  const winner: 0 | 1 =
    hpB <= 0 ? 0 : hpA <= 0 ? 1 : hpA / sa.maxHp >= hpB / sb.maxHp ? 0 : 1;
  events.push({ t: "end", winner });
  return events;
}
