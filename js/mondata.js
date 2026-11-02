// Monster-name and monster-class lookup.
// C ref: mondata.c name_to_mon() and name_to_monclass().
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_GROWTH_TARGET, MONSTER_MOVE, MONSTER_NAME, MONSTER_SIZE, MONSTER_SOUND, MONSTER_SYMBOL, SPECIAL_PM, monsterIsAmorphous, monsterIsHumanoid, monsterIsMindFlayer, monsterIsRider, monsterIsSlithy, monsterIsUndead, monsterIsUnicorn, monsterIsVerySmall, monsterIsWhirly, monsterTypeName, monsterYoungerForm, requireMonsterData, MONSTER_RESISTS, monsterIsVampireShifter, MONSTER_COLOR, monsterClassSymbol, } from './monster_data.js';
import { AD_ACID, AD_BLND, AD_COLD, AD_CORR, AD_DISE, AD_DISN, AD_DRLI, AD_DRST, AD_ELEC, AD_FIRE, AD_HALU, AD_MAGM, AD_PHYS, AD_PLYS, AD_RUST, AD_SLEE, AD_SLOW, AD_STON, AD_WERE, AT_HUGS, AD_SEDU, AD_SSEX, } from './monster_attack_types.js';
import { dragonFormForArmor } from './armor.js';
import { artifactById } from './artifacts.js';
import { M_SEEN_ACID, M_SEEN_COLD, M_SEEN_DISINT, M_SEEN_ELEC, M_SEEN_FIRE, M_SEEN_MAGR, M_SEEN_NOTHING, M_SEEN_POISON, M_SEEN_REFL, M_SEEN_SLEEP, W_ARM, W_WEP, } from './const.js';
import { game, requireLiveGame } from './gstate.js';
import { speciesWasGenocided } from './mon.js';
import { rn2 } from './rng.js';
import { monsterWieldedWeapon } from './weapon.js';
import { roles } from './roles.js';
import { makeSingular } from './objnam.js';
import { monsterHasLineOfSightToHero } from './vision.js';
import { canSpotMonster } from './display.js';
import { heroIsHallucinating } from './senses.js';
import { ARTIFACT_DATA } from './artifact_data.js';
import { BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES } from './object_data.js';
import { heroSpecies } from './hero_species.js';
import { questMonsterFlags2 } from './role_monsters.js';
import { monsterCarriesAmulet } from './wizard.js';
import { dist2 } from './hacklib.js';
import { clearPath } from './vision.js';
import { heroMonsterForm } from './polyself.js';
export const MONSTER_CLASS_SYMBOLS = [
    '', ...'abcdefghijklmnopqrstuvwxyz', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    '@', ' ', "'", '&', ';', ':', '~', ']',
];
const MONSTER_CLASS_NAMES = [
    '',
    'ant or other insect', 'blob', 'cockatrice', 'dog or other canine',
    'eye or sphere', 'cat or other feline', 'gremlin', 'humanoid',
    'imp or minor demon', 'jelly', 'kobold', 'leprechaun', 'mimic',
    'nymph', 'orc', 'piercer', 'quadruped', 'rodent',
    'arachnid or centipede', 'trapper or lurker above',
    'unicorn or horse', 'vortex', 'worm',
    'xan or other mythical/fantastic insect', 'light', 'zruty',
    'angelic being', 'bat or bird', 'centaur', 'dragon', 'elemental',
    'fungus or mold', 'gnome', 'giant humanoid', 'invisible monster',
    'jabberwock', 'Keystone Kop', 'lich', 'mummy', 'naga', 'ogre',
    'pudding or ooze', 'quantum mechanic',
    'rust monster or disenchanter', 'snake', 'troll', 'umber hulk',
    'vampire', 'wraith', 'xorn', 'apelike creature', 'zombie',
    'human or elf', 'ghost', 'golem', 'major demon', 'sea monster',
    'lizard', 'long worm tail', 'mimic',
];
function canonicalMonsterNumber(name) {
    return MONSTER_NAME.findIndex(candidate => candidate?.toLowerCase() === name.toLowerCase());
}
const MONSTER_NAME_ALIAS_ENTRIES = [
    ['grey dragon', 'gray dragon'],
    ['baby grey dragon', 'baby gray dragon'],
    ['grey unicorn', 'gray unicorn'],
    ['grey ooze', 'gray ooze'],
    ['gray-elf', 'Grey-elf'],
    ['mindflayer', 'mind flayer'],
    ['master mindflayer', 'master mind flayer'],
    ['aligned priest', 'aligned cleric', 0],
    ['aligned priestess', 'aligned cleric', 1],
    ['high priest', 'high cleric', 0],
    ['high priestess', 'high cleric', 1],
    ['master of thief', 'Master of Thieves'],
    ['master thief', 'Master of Thieves'],
    ['master of assassin', 'Master Assassin'],
    ['master-lich', 'master lich'],
    ['masterlich', 'master lich'],
    ['invisible stalker', 'stalker'],
    ['high-elf', 'elven monarch'],
    ['wood-elf', 'Woodland-elf'],
    ['wood elf', 'Woodland-elf'],
    ['woodland nymph', 'wood nymph'],
    ['halfling', 'hobbit'],
    ['genie', 'djinni'],
    ['human wererat', 261],
    ['human werejackal', 262],
    ['human werewolf', 263],
    ['rat wererat', 91],
    ['jackal werejackal', 15],
    ['wolf werewolf', 21],
    ['ki rin', 'ki-rin'],
    ['kirin', 'ki-rin'],
    ['uruk hai', 'Uruk-hai'],
    ['orc captain', 'orc-captain'],
    ['woodland elf', 'Woodland-elf'],
    ['green elf', 'Green-elf'],
    ['grey elf', 'Grey-elf'],
    ['gray elf', 'Grey-elf'],
    ['elf lady', 'elf-noble', 1],
    ['elf lord', 'elf-noble', 0],
    ['elf noble', 'elf-noble'],
    ['olog hai', 'Olog-hai'],
    ['arch lich', 'arch-lich'],
    ['archlich', 'arch-lich'],
    ['incubi', 'amorous demon', 0],
    ['succubi', 'amorous demon', 1],
    ['violet fungi', 'violet fungus'],
    ['homunculi', 'homunculus'],
    ['baluchitheria', 'baluchitherium'],
    ['lurkers above', 'lurker above'],
    ['cavemen', 'cave dweller', 0],
    ['cavewomen', 'cave dweller', 1],
    ['watchmen', 'watchman'],
    ['djinn', 'djinni'],
    ['mumakil', 'mumak'],
    ['erinyes', 'erinys'],
];
const MONSTER_NAME_ALIASES = new Map(MONSTER_NAME_ALIAS_ENTRIES.map(([alias, target, gender = 2]) => [
    alias,
    { mnum: typeof target === 'number' ? target : canonicalMonsterNumber(target), gender },
]));
function withoutMonsterArticle(value) {
    return value.replace(/^(?:a|an|the) /, '');
}
function normalizeMonsterName(value) {
    let name = withoutMonsterArticle(value).toLowerCase();
    const vortices = name.indexOf('vortices');
    if (vortices >= 0)
        return `${name.slice(0, vortices + 4)}ex`;
    if (name.length > 3 && name.endsWith('ies') && !name.endsWith('zombies'))
        name = `${name.slice(0, -3)}y`;
    else if (name.length > 3 && name.endsWith('ves'))
        name = `${name.slice(0, -3)}f`;
    return name;
}
function acceptedNameRemainder(remainder) {
    return !remainder || remainder.startsWith(' ')
        || /^(?:s|es|'|'s)(?: |$)/.test(remainder);
}
function monsterNames(mnum) {
    const neutral = MONSTER_NAME[mnum]?.toLowerCase() ?? '';
    const male = monsterTypeName(mnum, false).toLowerCase();
    const female = monsterTypeName(mnum, true).toLowerCase();
    const names = [
        { name: neutral, gender: 2 },
    ];
    if (male !== female) {
        names.push({ name: male, gender: 0 }, { name: female, gender: 1 });
    }
    return names.filter(candidate => candidate.name.length > 0);
}
function roleTitleMonster(name) {
    // botl.c:title_to_mon() takes the first rank prefix in role order.
    // The whole-word and longest-name rules above apply to species names,
    // while rank prefixes deliberately accept an attached suffix.
    for (const role of roles) {
        for (const title of role.title || []) {
            for (const value of [title.m, title.f]) {
                const candidate = value?.toLowerCase();
                if (candidate && name.startsWith(candidate))
                    return { length: candidate.length, mnum: SPECIAL_PM + 1 + role.mnum };
            }
        }
    }
    return null;
}
export function nameToMonster(value) {
    return resolveMonsterName(value)?.mnum ?? -1;
}
export function resolveMonsterName(value) {
    const match = resolveMonsterNamePrefix(value);
    return match ? { mnum: match.mnum, gender: match.gender } : null;
}
// name_to_monplus() lets wishes retain the object noun after a monster name.
export function resolveMonsterNamePrefix(value) {
    const requested = normalizeMonsterName(value);
    if (!requested)
        return null;
    const source = withoutMonsterArticle(value);
    for (const [alias, match] of MONSTER_NAME_ALIASES) {
        if (requested.startsWith(alias)
            && (!requested[alias.length] || requested[alias.length] === ' '
                || requested[alias.length] === "'")) {
            return { ...match, remainder: source.slice(alias.length), overridesGender: true };
        }
    }
    let best = null;
    for (let mnum = 0; mnum < MONSTER_NAME.length; mnum++) {
        for (const { name, gender } of monsterNames(mnum)) {
            if (!requested.startsWith(name)
                || !acceptedNameRemainder(requested.slice(name.length))) {
                continue;
            }
            if (!best || name.length > best.length)
                best = { length: name.length, mnum, gender };
        }
    }
    if (best)
        return {
            mnum: best.mnum, gender: best.gender,
            remainder: source.slice(best.length), overridesGender: false,
        };
    const title = roleTitleMonster(requested);
    return title ? {
        mnum: title.mnum, gender: 2,
        remainder: source.slice(title.length), overridesGender: false,
    } : null;
}
function classDescriptionMatches(description, wanted) {
    const start = description.toLowerCase().indexOf(wanted);
    if (start < 0 || (start > 0 && description[start - 1] !== ' '))
        return false;
    const end = start + wanted.length;
    return end === description.length || description[end] === ' ';
}
export function nameToMonsterClass(value) {
    return resolveMonsterClass(value).monsterClass;
}
// name_to_monclass() can identify one species as well as its class.
export function resolveMonsterClass(value) {
    const raw = value;
    if (!raw)
        return { monsterClass: 0, mnum: -1 };
    if (raw.length === 1) {
        const found = MONSTER_CLASS_SYMBOLS.indexOf(raw);
        if (found === 60)
            return { monsterClass: 13, mnum: -1 };
        if (found === 59)
            return { monsterClass: 23, mnum: canonicalMonsterNumber('long worm') };
        return { monsterClass: found < 0 ? 0 : found, mnum: -1 };
    }
    if (raw.toLowerCase() === 'long')
        return { monsterClass: 0, mnum: -1 };
    const wanted = makeSingular(raw).toLowerCase();
    if (['an', 'the', 'or', 'other', 'or other'].includes(wanted))
        return { monsterClass: 0, mnum: -1 };
    if (wanted === 'long worm')
        return { monsterClass: 23, mnum: canonicalMonsterNumber('long worm') };
    const special = new Map([
        ['demon', 56], ['devil', 56], ['bug', 24], ['fish', 57],
    ]).get(wanted);
    if (special)
        return { monsterClass: special, mnum: -1 };
    for (let monsterClass = 1; monsterClass < MONSTER_CLASS_NAMES.length; monsterClass++) {
        if (classDescriptionMatches(MONSTER_CLASS_NAMES[monsterClass] ?? '', wanted))
            return { monsterClass, mnum: -1 };
    }
    const mnum = nameToMonster(wanted);
    return { monsterClass: mnum < 0 ? 0 : (MONSTER_SYMBOL[mnum] ?? 0), mnum };
}
// Native mondata.c:defended() and artifact.c:defends(). This is the
// wielded-weapon/dragon-body check; innate and carried resistances are separate.
const ARTIFACT_DEFENSE = {
    [AD_PHYS]: null, [AD_DRLI]: 'life-drain', [AD_DRST]: 'poison',
    [AD_MAGM]: 'magic', [AD_COLD]: 'cold', [AD_FIRE]: 'fire',
    [AD_WERE]: 'lycanthropy', [AD_BLND]: 'blindness',
};
const DRAGON_DEFENSE = {
    [AD_MAGM]: MONSTER_NAME.indexOf('gray dragon'),
    [AD_HALU]: MONSTER_NAME.indexOf('gold dragon'),
    [AD_FIRE]: MONSTER_NAME.indexOf('red dragon'),
    [AD_COLD]: MONSTER_NAME.indexOf('white dragon'),
    [AD_DRST]: MONSTER_NAME.indexOf('green dragon'),
    [AD_DISE]: MONSTER_NAME.indexOf('green dragon'),
    [AD_SLEE]: MONSTER_NAME.indexOf('orange dragon'),
    [AD_PLYS]: MONSTER_NAME.indexOf('orange dragon'),
    [AD_DISN]: MONSTER_NAME.indexOf('black dragon'),
    [AD_DRLI]: MONSTER_NAME.indexOf('black dragon'),
    [AD_ELEC]: MONSTER_NAME.indexOf('blue dragon'),
    [AD_SLOW]: MONSTER_NAME.indexOf('blue dragon'),
    [AD_ACID]: MONSTER_NAME.indexOf('yellow dragon'),
    [AD_STON]: MONSTER_NAME.indexOf('yellow dragon'),
};
const FIRST_DRAGON = MONSTER_NAME.indexOf('gray dragon');
const LAST_DRAGON = MONSTER_NAME.indexOf('yellow dragon');
export function monsterCombatDefense(monster, damageType, state = game) {
    const artifact = artifactById(monsterWieldedWeapon(monster)?.oartifact, state);
    const defense = ARTIFACT_DEFENSE[damageType];
    if (artifact && defense !== undefined && (artifact.defense ?? null) === defense)
        return true;
    const armor = (monster.minvent ?? monster.inventory ?? [])
        .find(object => (object.owornmask ?? 0) & W_ARM);
    const dragon = monster.mnum >= FIRST_DRAGON && monster.mnum <= LAST_DRAGON
        ? monster.mnum : dragonFormForArmor(armor);
    return dragon !== null && dragon === DRAGON_DEFENSE[damageType];
}
// C mondata.c:passes_bars(). Rust monsters and some puddings destroy bars;
// postmov (monmove.c) reuses the same corrosion test for its iron-bars meal.
const M1_WALLWALK = 0x00000008;
const M1_AMORPHOUS = 0x00000004;
const M1_UNSOLID = 0x00100000;
const M1_METALLIVORE = 0x80000000;
const M1_SLITHY = 0x00080000;
const MZ_LARGE = 3;
export function monsterPassesBars(monster) {
    const body = MONSTER_FLAGS1[monster.mnum] ?? 0;
    return !!(body & (M1_WALLWALK | M1_AMORPHOUS | M1_UNSOLID | M1_METALLIVORE))
        || monsterIsWhirly(monster)
        || monsterIsVerySmall(monster.mnum) || monsterCorrodesBars(monster)
        || !!(body & M1_SLITHY) && (MONSTER_SIZE[monster.mnum] ?? MZ_LARGE) < MZ_LARGE;
}
export function monsterCorrodesBars(monster) {
    return (MONSTER_ATTACKS[monster.mnum] ?? []).some(([, damage]) => damage === AD_RUST || damage === AD_CORR);
}
// C mondata.c:can_blow(). Hero strangulation is an actor-specific check.
const M1_BREATHLESS = 0x400, M1_NOHEAD = 0x8000;
const MS_SILENT = 0, MS_BUZZ = 10, MZ_SMALL = 1, S_EEL = 57;
export function speciesCanBlow(mnum) {
    const sound = requireMonsterData(MONSTER_SOUND, mnum);
    if (sound !== MS_SILENT && sound !== MS_BUZZ)
        return true;
    return !(requireMonsterData(MONSTER_FLAGS1, mnum) & (M1_BREATHLESS | M1_NOHEAD))
        && requireMonsterData(MONSTER_SIZE, mnum) >= MZ_SMALL
        && requireMonsterData(MONSTER_SYMBOL, mnum) !== S_EEL;
}
// Native mondata.c:same_race(). Species families used by cannibalism.
const species = (name) => MONSTER_NAME.indexOf(name);
const symbol = (name) => requireMonsterData(MONSTER_SYMBOL, species(name));
const GOLEM = symbol('stone golem');
const KOBOLD = symbol('kobold');
const IMP = symbol('imp');
const raceFlags = [0x08, 0x10, 0x20, 0x40, 0x80, 0x2000];
const classFamilies = ['ogre', 'water nymph', 'plains centaur', 'red dragon', 'red naga'].map(symbol);
const undeadFamilies = ['human zombie', 'human mummy', 'vampire', 'lich', 'wraith', 'ghost'].map(symbol);
const kobolds = new Set(['kobold zombie', 'kobold mummy'].map(species));
const gargoyles = new Set(['gargoyle', 'winged gargoyle'].map(species));
const bees = new Set(['killer bee', 'queen bee'].map(species));
const longWorms = new Set(['baby long worm', 'long worm', 'long worm tail'].map(species));
const TENGU = species('tengu');
export function sameMonsterRace(left, right) {
    if (left === right)
        return true;
    const leftFlags = requireMonsterData(MONSTER_FLAGS2, left);
    const rightFlags = requireMonsterData(MONSTER_FLAGS2, right);
    const leftClass = requireMonsterData(MONSTER_SYMBOL, left);
    const rightClass = requireMonsterData(MONSTER_SYMBOL, right);
    for (const flag of raceFlags)
        if (leftFlags & flag)
            return !!(rightFlags & flag);
    if (leftClass === GOLEM)
        return rightClass === GOLEM;
    if (monsterIsMindFlayer(left))
        return monsterIsMindFlayer(right);
    if (leftClass === KOBOLD || kobolds.has(left))
        return rightClass === KOBOLD || kobolds.has(right);
    if (classFamilies.includes(leftClass))
        return leftClass === rightClass;
    if (monsterIsUnicorn(left))
        return monsterIsUnicorn(right);
    if (monsterIsRider({ mnum: left }))
        return monsterIsRider({ mnum: right });
    if (leftFlags & 0x1000)
        return !!(rightFlags & 0x1000);
    if (left === TENGU || right === TENGU)
        return false;
    if (leftClass === IMP)
        return rightClass === IMP;
    if (rightClass === IMP)
        return false;
    if (leftFlags & 0x100)
        return !!(rightFlags & 0x100);
    if (monsterIsUndead(left)) {
        if (undeadFamilies.includes(leftClass))
            return leftClass === rightClass;
    }
    else if (monsterIsUndead(right))
        return false;
    if (leftClass === rightClass) {
        for (const nextForm of [monsterYoungerForm,
            (mnum) => requireMonsterData(MONSTER_GROWTH_TARGET, mnum)]) {
            let current = left;
            for (;;) {
                const next = nextForm(current);
                if (next === current)
                    break;
                if (next === right)
                    return true;
                current = next;
            }
        }
    }
    for (const family of [gargoyles, bees, longWorms])
        if (family.has(left))
            return family.has(right);
    return false;
}
// C mondata.c:locomotion() and stagger(). Describe the actual body, even
// when its name is hidden or hallucinated.
const S_EYE = 5;
const S_LIGHT = 25;
const M1_FLY = 0x00000001;
const M1_NOLIMBS = 0x00006000;
export function monsterLocomotion(mnum, fallback) {
    const body = MONSTER_FLAGS1[mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[mnum];
    let verb = fallback;
    if (symbol === S_EYE || symbol === S_LIGHT)
        verb = 'float';
    else if (body & M1_FLY)
        verb = 'fly';
    else if (monsterIsSlithy(mnum))
        verb = 'slither';
    else if (monsterIsAmorphous({ mnum }))
        verb = 'ooze';
    else if (!MONSTER_MOVE[mnum])
        verb = 'wiggle';
    else if ((body & M1_NOLIMBS) === M1_NOLIMBS)
        verb = 'crawl';
    return fallback.charAt(0) === fallback.charAt(0).toUpperCase()
        ? verb.charAt(0).toUpperCase() + verb.slice(1) : verb;
}
// C mondata.c:stagger(): the faltering counterpart of locomotion().
export function monsterStagger(mnum, fallback) {
    const body = MONSTER_FLAGS1[mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[mnum];
    let verb = fallback;
    if (symbol === S_EYE || symbol === S_LIGHT)
        verb = 'wobble';
    else if (body & M1_FLY)
        verb = (MONSTER_SIZE[mnum] ?? 0) <= MZ_SMALL ? 'flutter' : 'stagger';
    else if (monsterIsSlithy(mnum))
        verb = 'falter';
    else if (monsterIsAmorphous({ mnum }))
        verb = 'tremble';
    else if (!MONSTER_MOVE[mnum])
        verb = 'pulsate';
    else if ((body & M1_NOLIMBS) === M1_NOLIMBS)
        verb = 'falter';
    return fallback.charAt(0) === fallback.charAt(0).toUpperCase()
        ? verb.charAt(0).toUpperCase() + verb.slice(1) : verb;
}
// C mondata.c:on_fire(). The affected body determines what heat looks like.
export function monsterFireDescription(monster, method) {
    const species = requireMonsterData(MONSTER_NAME, monster.mnum);
    switch (species) {
        case 'flaming sphere':
        case 'fire vortex':
        case 'fire elemental':
        case 'salamander':
            return 'already on fire';
        case 'water elemental':
        case 'fog cloud':
        case 'steam vortex':
            return 'boiling';
        case 'ice vortex':
        case 'glass golem':
            return 'melting';
        case 'stone golem':
        case 'clay golem':
        case 'gold golem':
        case 'air elemental':
        case 'earth elemental':
        case 'dust vortex':
        case 'energy vortex':
            return 'heating up';
        default:
            return method === AT_HUGS ? 'being roasted' : 'on fire';
    }
}
// C mondata.c:cvt_adtyp_to_mseenres(): these eight damage types and bits share an order.
export function seenResistanceForDamage(damageType) {
    return damageType >= AD_MAGM && damageType <= AD_ACID
        ? M_SEEN_MAGR << (damageType - AD_MAGM) : M_SEEN_NOTHING;
}
// C mondata.c:cvt_prop_to_mseenres().  Worn items confer these nine
const M_SEEN_BY_PROPERTY = {
    antimagic: M_SEEN_MAGR,
    fireResistance: M_SEEN_FIRE,
    coldResistance: M_SEEN_COLD,
    sleepResistance: M_SEEN_SLEEP,
    disintegrationResistance: M_SEEN_DISINT,
    shockResistance: M_SEEN_ELEC,
    poisonResistance: M_SEEN_POISON,
    acidResistance: M_SEEN_ACID,
    reflection: M_SEEN_REFL,
};
// C mondata.c:cvt_prop_to_mseenres().
export function seenResistanceForProperty(property) {
    return M_SEEN_BY_PROPERTY[property] ?? M_SEEN_NOTHING;
}
// monstseesu() and monstunseesu() share this loop: every living monster
// which could see the hero (m_canseeu) gets the resistance update.
function monstersThatCanSeeHero(state, canSeeHero) {
    if (state.u?.uswallow)
        return [];
    const seesHero = canSeeHero
        || ((monster) => monsterHasLineOfSightToHero(monster, state));
    return (state.level?.monsters || []).filter(monster => monster && !monster.dead && (monster.mhp ?? 1) > 0
        && seesHero(monster));
}
// C mondata.c:monstseesu(). Monsters in line of sight remember hero resisting.
export function monstersObserveHeroResistance(resistance, state = game, canSeeHero = null) {
    if (!resistance || resistance === M_SEEN_NOTHING)
        return 0;
    const observers = monstersThatCanSeeHero(state, canSeeHero);
    for (const monster of observers) {
        monster.seen_resistance = (monster.seen_resistance ?? 0)
            | resistance;
    }
    return observers.length;
}
// C mondata.c:monstunseesu(). Monsters in line of sight forget hero resistance.
export function monstersForgetHeroResistance(resistance, state = game, canSeeHero = null) {
    if (!resistance || resistance === M_SEEN_NOTHING)
        return 0;
    const observers = monstersThatCanSeeHero(state, canSeeHero);
    for (const monster of observers) {
        monster.seen_resistance = (monster.seen_resistance ?? 0)
            & ~resistance;
    }
    return observers.length;
}
// C mondata.c:dmgtype(AD_SEDU/AD_SSEX): seducers keep their powers when
// traits are saved and restored.
export function monsterHasSeductionAttack(mnum) {
    return (MONSTER_ATTACKS[mnum] || []).some(([, damageType]) => damageType === AD_SEDU
        || damageType === AD_SSEX);
}
const MR_FIRE = 0x01;
const MR_COLD = 0x02;
const MR_SLEEP = 0x04;
const MR_DISINTEGRATION = 0x08;
const MR_ELECTRIC = 0x10;
const MR_ACID = 0x40;
const MR_POISON = 0x20;
const MR_STONE = 0x80;
const M2_UNDEAD = 0x00000002;
const M2_WERE = 0x00000004;
const M2_DEMON = 0x00000100;
const M2_STALK = 0x01000000;
const PM_DEATH = 311;
const PM_BLACK_DRAGON = MONSTER_NAME.indexOf('black dragon');
const PM_GRAY_DRAGON = MONSTER_NAME.indexOf('gray dragon');
const PM_YELLOW_DRAGON = MONSTER_NAME.indexOf('yellow dragon');
const ARTIFACT_BY_ID = new Map(ARTIFACT_DATA.map(artifact => [artifact.id, artifact]));
function artifactForObject(object) {
    return object?.oartifact === undefined ? null : ARTIFACT_BY_ID.get(object.oartifact) || null;
}
function monsterInventory(monster) {
    return monster?.minvent || monster?.inventory || [];
}
function monsterWeapon(monster) {
    return monster?.mw || monsterInventory(monster).find(object => object?.wielded || ((object?.owornmask ?? 0) & W_WEP));
}
function monsterWearsOneOf(monster, objectTypes, mask) {
    return (monster?.minvent || monster?.inventory || []).some(object => objectTypes.includes(object?.otyp)
        && !!((object?.owornmask ?? 0) & mask));
}
export function monsterResistanceBits(monster) {
    if (!monster)
        return 0;
    return (MONSTER_RESISTS[monster.mnum] ?? 0)
        | (monster?.mextrinsics ?? 0) | (monster?.mintrinsics ?? 0);
}
function monsterArtifactDefends(monster, element) {
    return artifactForObject(monsterWeapon(monster))?.defense === element
        || monsterInventory(monster).some(object => artifactForObject(object)?.carriedDefense === element);
}
export function monsterHasFireResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_FIRE)
        || monsterArtifactDefends(monster, 'fire');
}
export function monsterHasColdResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_COLD)
        || monsterArtifactDefends(monster, 'cold');
}
export function monsterHasShockResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_ELECTRIC)
        || monsterArtifactDefends(monster, 'shock');
}
export function monsterHasDisintegrationResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_DISINTEGRATION)
        || monsterWearsOneOf(monster, [BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES], W_ARM);
}
export function monsterHasDrainResistance(monster) {
    if (!monster)
        return false;
    const flags = MONSTER_FLAGS2[monster.mnum] ?? 0;
    return !!(flags & (M2_UNDEAD | M2_WERE | M2_DEMON))
        || monster?.mnum === PM_DEATH
        || monsterIsVampireShifter(monster)
        || artifactForObject(monsterWeapon(monster))?.defense === 'life-drain'
        || (monster.mnum >= PM_GRAY_DRAGON && monster.mnum <= PM_YELLOW_DRAGON
            ? monster.mnum === PM_BLACK_DRAGON
            : monsterWearsOneOf(monster, [
                BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES,
            ], W_ARM));
}
// C resists_drli(&youmonst), not the broader Drain_resistance property.
// Direct divine level loss does not accept a shield or generic intrinsic.
export function heroResistsLifeDrain(state = game) {
    const hero = state.u;
    const form = { mnum: heroSpecies(state) };
    if (hero.mcham !== undefined)
        form.cham = hero.mcham;
    const armor = state.uarm || hero.uarm;
    const weapon = state.uwep || hero.uwep;
    const dragonBody = form.mnum >= PM_GRAY_DRAGON && form.mnum <= PM_YELLOW_DRAGON;
    return monsterHasDrainResistance(form)
        || (typeof hero.ulycn === 'number' && Number.isInteger(hero.ulycn) && hero.ulycn >= 0)
        || (!dragonBody
            && armor !== null && armor !== undefined
            && [BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES].includes(armor.otyp))
        || artifactForObject(weapon)?.defense === 'life-drain';
}
export function monsterHasAcidResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_ACID);
}
export function monsterHasPoisonResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_POISON)
        || monsterArtifactDefends(monster, 'poison');
}
export function monsterHasStoneResistance(monster) {
    return !!(monsterResistanceBits(monster) & MR_STONE);
}
// C include/monst.h:274 resists_sleep() over mondata.c Resists_Elem(),
// with the mondata.c:91 defended(mon, AD_SLEE) half of the caller checks.
export function monsterResistsSleep(monster) {
    return !!(monsterResistanceBits(monster) & MR_SLEEP)
        || !!monster?.defendedSleep;
}
// C include/mondata.h:26 breathless().
export function monsterIsBreathless(monster) {
    return !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_BREATHLESS);
}
// C include/monst.h:251 helpless().
export function monsterIsHelpless(monster) {
    return !!(monster.msleeping
        || !monster.mcanmove || (monster.mfrozen ?? 0) > 0);
}
// C mondata.c:levl_follower(). Used by dog.c keepdogs() when the hero
// changes levels.
export function levelFollower(monster, state) {
    if (monster === state.u.usteed)
        return true;
    if (monster.iswiz && monsterCarriesAmulet(monster))
        return false;
    if (monster.mtame || monster.iswiz || monster.isshk && monster.eshk?.following)
        return true;
    return !!(questMonsterFlags2(monster.mnum, state) & M2_STALK)
        && (!monster.mflee || !!state.u.uhave?.amulet);
}
// C mondata.c:poly_when_stoned(). Callers use this before fatal prose.
const S_GOLEM_POLY = 55;
const PM_STONE_GOLEM_POLY = 257;
export function monsterPolymorphsWhenStoned(monster) {
    return MONSTER_SYMBOL[monster.mnum] === S_GOLEM_POLY
        && monster.mnum !== PM_STONE_GOLEM_POLY
        && !speciesWasGenocided(PM_STONE_GOLEM_POLY, game);
}
const POSSESSIVE_PRONOUNS = ['his', 'her', 'its', 'their'];
const SUBJECT_PRONOUNS = ['he', 'she', 'it', 'they'];
const OBJECT_PRONOUNS = ['him', 'her', 'it', 'them'];
const PRONOUN_G_UNIQ = 0x1000;
const PRONOUN_M2_NEUTER = 0x00040000;
const PRONOUN_M2_PNAME = 0x00080000;
// C mondata.c:pronoun_gender(), the mhis()/mhim() macros in include/you.h.
// Hallucination precedes visibility and sex and uses the core RNG.
export function monsterPossessive(monster, { state = game, random = rn2, noIt = false } = {}) {
    return POSSESSIVE_PRONOUNS[monsterPronounGender(monster, { state, random, noIt })];
}
export function monsterSubjectPronoun(monster, { state = game, noIt = false } = {}) {
    return SUBJECT_PRONOUNS[monsterPronounGender(monster, { state, noIt })];
}
// The same perceived gender, in the object case.
export function monsterObjectPronoun(monster, { state = game, random = rn2, noIt = false } = {}) {
    return OBJECT_PRONOUNS[monsterPronounGender(monster, { state, random, noIt })];
}
export function monsterPronounGender(monster, { state = game, random = rn2, noIt = false } = {}) {
    requireLiveGame(state);
    if (heroIsHallucinating(state)) {
        const gender = random(4);
        if (gender === 0 || gender === 1 || gender === 2 || gender === 3)
            return gender;
        throw new RangeError(`Invalid hallucinated pronoun gender: ${gender}`);
    }
    if ((!noIt && !canSpotMonster(monster)) || ((MONSTER_FLAGS2[monster.mnum] ?? 0) & PRONOUN_M2_NEUTER))
        return 2;
    return monsterIsHumanoid(monster.mnum)
        || ((MONSTER_GENO[monster.mnum] ?? 0) & PRONOUN_G_UNIQ)
        || ((MONSTER_FLAGS2[monster.mnum] ?? 0) & PRONOUN_M2_PNAME)
        ? monster.female ? 1 : 0 : 2;
}
// C mondata.c:set_mon_data(). Change a monster's species without
// rebuilding the monster.
export function setMonsterSpecies(monster, mnum) {
    const oldSpeed = MONSTER_MOVE[monster.mnum] ?? monster.mmove ?? 0;
    const newSpeed = MONSTER_MOVE[mnum] ?? monster.mmove ?? 0;
    if (monster.movement && newSpeed < oldSpeed && oldSpeed > 0) {
        monster.movement = Math.trunc(monster.movement * newSpeed / oldSpeed);
    }
    monster.mnum = mnum;
    monster.mmove = newSpeed;
    monster.symbol = monsterClassSymbol(mnum);
    monster.color = requireMonsterData(MONSTER_COLOR, mnum);
    return monster;
}
// C mondata.c:mon_learns_traps() and mons_see_trap().
const M1_NOEYES = 0x00001000;
const M1_MINDLESS = 0x00010000;
const M1_ANIMAL = 0x00040000;
export function monsterKnowsTrap(monster, trap) {
    const known = monster.mtrapseen ?? 0;
    if (trap.ttyp === -1)
        return known !== 0;
    if (trap.ttyp === 0)
        return known === 0;
    return (known & (1 << (trap.ttyp - 1))) !== 0;
}
export function monsterLearnsTrap(monster, trap) {
    if (!trap)
        return;
    if (trap.ttyp === -1)
        monster.mtrapseen = -1;
    else if (trap.ttyp === 0)
        monster.mtrapseen = 0;
    else
        monster.mtrapseen = (monster.mtrapseen ?? 0) | (1 << (trap.ttyp - 1));
}
// C mondata.c:mons_see_trap().  Trap knowledge belongs to each observer,
// rather than to the level or monster class.  An unlit trigger teaches only
// adjacent sighted, thinking monsters; a lit trigger can teach observers up
// to seven squares away when clear_path() succeeds.
export function monstersSeeTrap(state, trap) {
    if (!trap)
        return;
    const tile = state?.level?.at?.(trap.tx, trap.ty);
    const maxDistance = tile?.lit ? 49 : 2;
    for (const observer of state?.level?.monsters || []) {
        if (!observer || (observer.mhp ?? 1) <= 0)
            continue;
        const flags = MONSTER_FLAGS1[observer.mnum] ?? 0;
        if ((flags & (M1_ANIMAL | M1_MINDLESS | M1_NOEYES))
            || observer.mcansee === false || observer.mcansee === 0) {
            continue;
        }
        if (dist2(observer.mx, observer.my, trap.tx, trap.ty) > maxDistance)
            continue;
        if (!clearPath(observer.mx, observer.my, trap.tx, trap.ty))
            continue;
        monsterLearnsTrap(observer, trap);
    }
}
const S_RODENT = 18;
const PM_ROCK_MOLE = 92;
const PM_WOODCHUCK = 93;
const PM_PONY = 100;
const PM_HORSE = 104;
const PM_WARHORSE = 105;
// C mondata.c:cantvomit().
export function heroCannotVomit(state) {
    const form = heroMonsterForm(state);
    if (form == null)
        return false;
    if (MONSTER_SYMBOL[form] === S_RODENT
        && form !== PM_ROCK_MOLE && form !== PM_WOODCHUCK)
        return true;
    return form === PM_PONY || form === PM_HORSE || form === PM_WARHORSE;
}
//# sourceMappingURL=mondata.js.map