// ============================================================
// ГРОБНИКИ — общие игровые данные (клиент ↔ сервер)
// ============================================================

export interface WeaponDef {
  id: string;
  name: string;
  minDmg: number;
  maxDmg: number;
  crit: number; // бонус к шансу крита
  desc: string;
  rarity: "common" | "rare" | "epic";
}

export const WEAPONS: WeaponDef[] = [
  { id: "claws", name: "Острые когти", minDmg: 2, maxDmg: 5, crit: 0.04, desc: "Чем гробник роется в могиле и врагах.", rarity: "common" },
  { id: "candelabra", name: "Канделябр", minDmg: 3, maxDmg: 7, crit: 0.05, desc: "Тяжёлый, позолоченный, горячий.", rarity: "common" },
  { id: "pan", name: "Сковорода ведьмы", minDmg: 4, maxDmg: 8, crit: 0.06, desc: "Звонкая. Оглушает чаще других.", rarity: "common" },
  { id: "scythe", name: "Ржавая коса", minDmg: 5, maxDmg: 11, crit: 0.08, desc: "Пахнет покосом и вечностью.", rarity: "rare" },
  { id: "bone_sword", name: "Костяной меч", minDmg: 6, maxDmg: 12, crit: 0.09, desc: "Сделан из того, кто проиграл.", rarity: "rare" },
  { id: "grave_hammer", name: "Молот могильщика", minDmg: 8, maxDmg: 15, crit: 0.06, desc: "Забивает. Очень убедительно.", rarity: "epic" },
  { id: "singing_skull", name: "Поющий череп", minDmg: 7, maxDmg: 17, crit: 0.12, desc: "Воет так, что враги теряют волю.", rarity: "epic" },
];

export const weaponById = (id: string): WeaponDef =>
  WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
}

export const SKILLS: SkillDef[] = [
  { id: "dodge", name: "Призрачный шаг", desc: "+15% к шансу увернуться" },
  { id: "crit", name: "Холодная ярость", desc: "+10% к шансу крита" },
  { id: "vampire", name: "Глоток жизни", desc: "Возвращает 25% нанесённого урона" },
  { id: "counter", name: "Последний хохот", desc: "30% шанс контратаки после уворота" },
  { id: "stone", name: "Надгробная кожа", desc: "Получаемый урон −20%" },
  { id: "berserk", name: "Гнев падшего", desc: "+35% урона, когда HP ниже половины" },
  { id: "stun", name: "Оглушающий вой", desc: "15% шанс оглушить врага на ход" },
  { id: "swift", name: "Ноги-спички", desc: "+2 к скорости" },
  { id: "tough", name: "Толстая шкура", desc: "+15 к здоровью" },
  { id: "strong", name: "Костяные мускулы", desc: "+2 к силе" },
];

export const skillById = (id: string): SkillDef | undefined =>
  SKILLS.find((s) => s.id === id);

// --- Проклятие дня: ежедневный модификатор арены ---
export interface CurseDef {
  id: string;
  name: string;
  desc: string;
}

export const CURSES: CurseDef[] = [
  { id: "blood_moon", name: "Кровавая луна", desc: "Шанс крита у всех ×2" },
  { id: "fog", name: "Мёртвый туман", desc: "У всех +15% к увороту" },
  { id: "crystal_night", name: "Хрустальная ночь", desc: "Весь урон +20%" },
  { id: "sticky_soil", name: "Вязкая земля", desc: "Никто не может увернуться" },
  { id: "quiet_hour", name: "Тихий час", desc: "Оглушение не работает, урон +10%" },
  { id: "hungry_ghosts", name: "Голод духов", desc: "Вампиризм есть у всех (15%)" },
  { id: "old_bones", name: "Старые кости", desc: "Все получают на 20% меньше урона" },
];

export const curseOfDay = (dayKey: string): CurseDef => {
  let h = 0;
  for (let i = 0; i < dayKey.length; i++) h = (h * 31 + dayKey.charCodeAt(i)) >>> 0;
  return CURSES[h % CURSES.length];
};

// --- Имена ---
const NAME_A = ["Кост", "Прах", "Могил", "Гроб", "Склеп", "Тлен", "Мрак", "Пыл", "Клык", "Шёпот", "Гнил", "Свеч"];
const NAME_B = ["ик", "юха", "ель", "озавр", "омет", "уша", "елька", "арий", "уля", "один", "еслав", "озуб"];

export const makeName = (rand: () => number): string =>
  NAME_A[Math.floor(rand() * NAME_A.length)] + NAME_B[Math.floor(rand() * NAME_B.length)];

const EPITHETS = ["Бессонный", "Пыльный", "Ворчливый", "Хрустящий", "Тихий", "Заплесневелый", "Наглый", "Сиротливый", "Вечный", "Пятничный"];

export const makeOpponentName = (rand: () => number): string =>
  `${makeName(rand)} ${EPITHETS[Math.floor(rand() * EPITHETS.length)]}`;

// --- Баланс ---
export const TORCHES_PER_DAY = 5;
export const TORCH_CAP = 8;
export const LEVEL_CAP = 10;
export const xpForLevel = (level: number) => level * 90;

// --- Типы состояния ---
export interface PlayerState {
  token: string;
  name: string;
  lookSeed: number;
  level: number;
  xp: number;
  xpNext: number;
  maxHp: number;
  str: number;
  agi: number;
  spd: number;
  weaponId: string;
  skills: string[];
  torches: number;
  generation: number;
  wins: number;
  losses: number;
  canDaily: boolean;
  canRelease: boolean;
  pendingPerks: PerkOffer[] | null;
  curse: CurseDef;
}

export interface PerkOffer {
  type: "weapon" | "skill" | "stat";
  id: string; // weaponId / skillId / 'str' | 'agi' | 'spd' | 'hp'
  name: string;
  desc: string;
}

export interface Ancestor {
  id: number;
  name: string;
  generation: number;
  level: number;
  weaponId: string;
  wins: number;
  losses: number;
  heirloomName: string;
}

export type BattleEvent =
  | { t: "start"; a: FighterSnapshot; b: FighterSnapshot }
  | { t: "hit"; who: 0 | 1; dmg: number; crit: boolean; hpA: number; hpB: number; text: string }
  | { t: "miss"; who: 0 | 1; hpA: number; hpB: number; text: string }
  | { t: "counter"; who: 0 | 1; dmg: number; hpA: number; hpB: number; text: string }
  | { t: "stun"; who: 0 | 1; text: string }
  | { t: "heal"; who: 0 | 1; amount: number; hpA: number; hpB: number }
  | { t: "end"; winner: 0 | 1 };

export interface FighterSnapshot {
  name: string;
  lookSeed: number;
  level: number;
  maxHp: number;
  weaponId: string;
  isPlayer: boolean;
}

export interface FightResult {
  events: BattleEvent[];
  won: boolean;
  xpGained: number;
  leveledTo: number | null;
  torchesLeft: number;
  player: PlayerState;
}
