// Species and actor predicates, and monster data queries.
// C mondata.h and mondata.c, including defended(), resists_blnd(),
// can_blnd(), can_blow(), can_be_strangled(), olfaction(), can_chant(),
// resist_conflict(), petrifying species and poly_when_stoned().

import { levelHasCeiling } from './dungeon.js';
import {

    MONSTER_ATTACKS,

    MONSTER_FLAGS1,

    MONSTER_FLAGS2,

    MONSTER_GENO,

    MONSTER_GROWTH_TARGET,

    MONSTER_LEVEL,

    MONSTER_MOVE,

    MONSTER_NAME,

    MONSTER_SIZE,

    MONSTER_SOUND,

    MONSTER_SYMBOL,

    requireMonsterData,

    MONSTER_RESISTS,

    MONSTER_COLOR,

    monsterClassSymbol,

    FLAMING_SPECIES,

    MONSTER_FLAGS3,

    PM_GREEN_SLIME,

    S_GHOST,

} from './monster_data.js';
import { monsterTypeName } from './do_name.js';
import {
    AD_ACID, AD_BLND, AD_COLD, AD_CORR, AD_DCAY, AD_DISE, AD_DISN, AD_DRLI, AD_DRST, AD_ELEC, AD_FIRE, AD_HALU,
    AD_MAGM, AD_PHYS, AD_PLYS, AD_RBRE, AD_RUST, AD_SLEE, AD_SLOW, AD_STON, AD_WERE, AT_BITE, AT_BOOM, AT_BREA, AT_BUTT,
    AT_CLAW, AT_ENGL, AT_EXPL, AT_GAZE, AT_HUGS, AT_KICK, AT_MAGC, AT_NONE, AT_SPIT, AT_STNG, AT_TENT, AT_TUCH,
    AT_WEAP, AD_SEDU, AD_SSEX, AD_DGST, AD_STCK, AD_WRAP,
} from './monster_attack_types.js';
import type { AttackMethod, DamageType } from './monster_attack_types.js';
import { dragonFormForArmor, heroHasNoHead, heroIsBreathless, heroMonsterForm, heroSpecies, heroIsPolymorphed } from './polyself.js';
import { artifactById, heroHasArtifactDefense, monsterHasArtifactDefense } from './artifact.js';
import type { ArtifactDefender, ArtifactDefenseQuery } from './artifact.js';
import { currentAttribute } from './attrib.js';
import {
    M_SEEN_ACID, M_SEEN_COLD, M_SEEN_DISINT, M_SEEN_ELEC, M_SEEN_FIRE, M_SEEN_MAGR, M_SEEN_NOTHING, M_SEEN_POISON,
    M_SEEN_REFL, M_SEEN_SLEEP, W_ARM, W_ARMH, W_ARMOR, W_ACCESSORY, W_WEP, G_GENOD, A_CHA,
} from './const.js';
import { game, requireLiveGame } from './gstate.js';
import { speciesWasGenocided } from './mon.js';
import { rn2 } from './rng.js';
import { monsterWieldedWeapon } from './weapon.js';
import type { ArtifactDefense } from './data_types.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { MonsterCallLog, RollOne } from './monster_action_types.js';
import type { PropertyName } from './property_types.js';
import { makeSingular } from './objnam.js';
import { titleToMon } from './botl.js';
import { monsterHasLineOfSightToHero, clearPath } from './vision.js';
import { canSpotMonster } from './display.js';
import { blindfolded, heroIsBlind, heroIsHallucinating, heroIsUnaware } from './senses.js';
import type { GameObject } from './object_types.js';
import { ARTIFACT_DATA } from './artifact_data.js';
import { BANANA, BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES, BLINDING_VENOM, CLOAK_OF_MAGIC_RESISTANCE, CORPSE, CREAM_PIE, GRAY_DRAGON_SCALE_MAIL, GRAY_DRAGON_SCALES, POT_BLINDNESS } from './object_data.js';
import { FOOD_CLASS } from './objclass.js';
import { OBJ_DESCR, objectMaterial } from './o_init.js';
import { questMonsterFlags2, questMonsterFlags3, questMonsterSound } from './role_monsters.js';
import { monsterCarriesAmulet } from './wizard.js';
import type { Trap } from './map_types.js';
import { dist2 } from './hacklib.js';
import type { Hero } from './hero_types.js';
import { hasPermanentIntrinsicProperty } from './properties.js';

type SpeciesReference = Pick<Monster, 'mnum'>;
type ShifterReference = SpeciesReference & Partial<Pick<Monster, 'cham'>>;

// Native MALE, FEMALE, and NEUTRAL name indices.
export type MonsterNameGender = 0 | 1 | 2;

export interface MonsterNameMatch {
    readonly mnum: number;
    readonly gender: MonsterNameGender;
}

export interface MonsterNamePrefix extends MonsterNameMatch {
    readonly remainder: string;
    readonly overridesGender: boolean;
}

export interface MonsterClassMatch {
    readonly monsterClass: number;
    readonly mnum: number;
}

export const MONSTER_CLASS_SYMBOLS: readonly string[] = [
    '', ...'abcdefghijklmnopqrstuvwxyz', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    '@', ' ', "'", '&', ';', ':', '~', ']',
];

const MONSTER_CLASS_NAMES: readonly string[] = [
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

// Part of C mondata.c:name_to_monplus(): resolving a canonical species name.
function canonicalMonsterNumber(name: string) {
    return MONSTER_NAME.findIndex(candidate =>
        candidate?.toLowerCase() === name.toLowerCase());
}

const MONSTER_NAME_ALIAS_ENTRIES: readonly (readonly [string, string | number, MonsterNameGender?])[] = [
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

const MONSTER_NAME_ALIASES = new Map<string, MonsterNameMatch>(MONSTER_NAME_ALIAS_ENTRIES.map(([alias, target, gender = 2]) => [
    alias,
    { mnum: typeof target === 'number' ? target : canonicalMonsterNumber(target), gender },
]));

// Part of C mondata.c:name_to_monplus(): stripping the leading article.
function withoutMonsterArticle(value: string) {
    return value.replace(/^(?:a|an|the) /, '');
}

// Part of C mondata.c:name_to_monplus(): the plural-to-singular folding.
function normalizeMonsterName(value: string) {
    let name = withoutMonsterArticle(value).toLowerCase();
    const vortices = name.indexOf('vortices');
    if (vortices >= 0) return `${name.slice(0, vortices + 4)}ex`;
    if (name.length > 3 && name.endsWith('ies') && !name.endsWith('zombies'))
        name = `${name.slice(0, -3)}y`;
    else if (name.length > 3 && name.endsWith('ves')) name = `${name.slice(0, -3)}f`;
    return name;
}

// Part of C mondata.c:name_to_monplus(): the trailing-suffix acceptance.
function acceptedNameRemainder(remainder: string) {
    return !remainder || remainder.startsWith(' ')
        || /^(?:s|es|'|'s)(?: |$)/.test(remainder);
}

// Part of C mondata.c:name_to_monplus(): the per-species name candidates.
function monsterNames(mnum: number) {
    const neutral = MONSTER_NAME[mnum]?.toLowerCase() ?? '';
    const male = monsterTypeName(mnum, false).toLowerCase();
    const female = monsterTypeName(mnum, true).toLowerCase();
    const names: { name: string; gender: MonsterNameGender }[] = [
        { name: neutral, gender: 2 },
    ];
    if (male !== female) {
        names.push({ name: male, gender: 0 }, { name: female, gender: 1 });
    }
    return names.filter(candidate => candidate.name.length > 0);
}

// C mondata.c:name_to_mon():
export function nameToMonster(value: string) {
    return resolveMonsterName(value)?.mnum ?? -1;
}

// Part of C mondata.c:name_to_monplus(): the mnum-and-gender pair result.
export function resolveMonsterName(value: string): MonsterNameMatch | null {
    const match = resolveMonsterNamePrefix(value);
    return match ? { mnum: match.mnum, gender: match.gender } : null;
}

// C mondata.c:name_to_monplus():
// name_to_monplus() lets wishes retain the object noun after a monster name.
export function resolveMonsterNamePrefix(value: string): MonsterNamePrefix | null {
    const requested = normalizeMonsterName(value);
    if (!requested) return null;
    const source = withoutMonsterArticle(value);
    for (const [alias, match] of MONSTER_NAME_ALIASES) {
        if (requested.startsWith(alias)
            && (!requested[alias.length] || requested[alias.length] === ' '
                || requested[alias.length] === "'")) {
            return { ...match, remainder: source.slice(alias.length), overridesGender: true };
        }
    }

    let best: (MonsterNameMatch & { length: number }) | null = null;
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
    if (best) return {
        mnum: best.mnum, gender: best.gender,
        remainder: source.slice(best.length), overridesGender: false,
    };
    const title = titleToMon(requested);
    return title ? {
        mnum: title.mnum, gender: 2,
        remainder: source.slice(title.length), overridesGender: false,
    } : null;
}

// Part of C mondata.c:name_to_monclass(): the class-description word match.
function classDescriptionMatches(description: string, wanted: string) {
    const start = description.toLowerCase().indexOf(wanted);
    if (start < 0 || (start > 0 && description[start - 1] !== ' '))
        return false;
    const end = start + wanted.length;
    return end === description.length || description[end] === ' ';
}

// C mondata.c:name_to_monclass():
// name_to_monclass() can identify one species as well as its class.
export function resolveMonsterClass(value: string): MonsterClassMatch {
    const raw = value;
    if (!raw) return { monsterClass: 0, mnum: -1 };
    if (raw.length === 1) {
        const found = MONSTER_CLASS_SYMBOLS.indexOf(raw);
        if (found === 60) return { monsterClass: 13, mnum: -1 };
        if (found === 59)
            return { monsterClass: 23, mnum: canonicalMonsterNumber('long worm') };
        return { monsterClass: found < 0 ? 0 : found, mnum: -1 };
    }

    if (raw.toLowerCase() === 'long') return { monsterClass: 0, mnum: -1 };
    const wanted = makeSingular(raw).toLowerCase();
    if (['an', 'the', 'or', 'other', 'or other'].includes(wanted))
        return { monsterClass: 0, mnum: -1 };
    if (wanted === 'long worm')
        return { monsterClass: 23, mnum: canonicalMonsterNumber('long worm') };
    const special = new Map([
        ['demon', 56], ['devil', 56], ['bug', 24], ['fish', 57],
    ]).get(wanted);
    if (special) return { monsterClass: special, mnum: -1 };
    for (let monsterClass = 1;
        monsterClass < MONSTER_CLASS_NAMES.length;
        monsterClass++) {
        if (classDescriptionMatches(
            MONSTER_CLASS_NAMES[monsterClass] ?? '', wanted,
        )) return { monsterClass, mnum: -1 };
    }
    const mnum = nameToMonster(wanted);
    return { monsterClass: mnum < 0 ? 0 : (MONSTER_SYMBOL[mnum] ?? 0), mnum };
}

// Native mondata.c:defended() and artifact.c:defends(). This is the
// wielded-weapon/dragon-body check; innate and carried resistances are separate.
const ARTIFACT_DEFENSE: Partial<Record<DamageType, ArtifactDefense | null>> = {
    [AD_PHYS]: null, [AD_DRLI]: 'life-drain', [AD_DRST]: 'poison',
    [AD_MAGM]: 'magic', [AD_COLD]: 'cold', [AD_FIRE]: 'fire',
    [AD_WERE]: 'lycanthropy', [AD_BLND]: 'blindness',
};
const DRAGON_DEFENSE: Partial<Record<DamageType, number>> = {
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

// Part of C mondata.c:defended(): the damage-type form.
export function monsterCombatDefense(
    monster: Monster, damageType: DamageType, state: GameState = game,
): boolean {
    const artifact = artifactById(monsterWieldedWeapon(monster)?.oartifact, state);
    const defense = ARTIFACT_DEFENSE[damageType];
    if (artifact && defense !== undefined && (artifact.defense ?? null) === defense) return true;
    const armor = (monster.minvent ?? monster.inventory ?? [])
        .find(object => (object.owornmask ?? 0) & W_ARM);
    const dragon = monster.mnum >= FIRST_DRAGON && monster.mnum <= LAST_DRAGON
        ? monster.mnum : dragonFormForArmor(armor);
    return dragon !== null && dragon === DRAGON_DEFENSE[damageType];
}

// C mondata.c:defended() — explmu()'s base immunity test for the exploding
// monster itself: a wielded artifact that defends against the damage type,
// or dragon scales — worn as body armor, or implicit in an adult dragon's
// own body. Unlike artifact.c's carries-defense helpers, items that merely
// defend while carried do not count.
const SCALE_DEFENDING_DRAGON: Partial<Record<NonNullable<ArtifactDefenseQuery>, string>> = {
    fire: 'red dragon',
    cold: 'white dragon',
    shock: 'blue dragon',
    hallucination: 'gold dragon',
};

// C mondata.c:defended(): the artifact-defense-query form.
export function monsterWieldsOrWearsDefense(
    monster: ArtifactDefender | null | undefined,
    damageType: ArtifactDefenseQuery,
    state: GameState,
): boolean {
    if (!monster || damageType == null) return false;
    const weapon = monsterWieldedWeapon(monster);
    if (artifactById(weapon?.oartifact, state)?.defense === damageType) return true;
    const dragonName = SCALE_DEFENDING_DRAGON[damageType];
    if (!dragonName) return false;
    const defender = MONSTER_NAME.indexOf(dragonName);
    if (defender < 0) return false;
    if (monster.mnum === defender) return true; /* an adult dragon is its own suit */
    const worn = (monster.minvent || monster.inventory || [])
        .find(object => ((object.owornmask ?? 0) & W_ARM) !== 0);
    return dragonFormForArmor(worn) === defender;
}

/** One side of C's can_blnd()/resists_blnd() monst argument: &gy.youmonst
    (whose monster fields all live in the game state) or a real monster. */
export type BlindCombatant =
    | { readonly youmonst: true }
    | { readonly monster: Monster };

// C mondata.c:resists_blnd(). Light-induced blindness fails against an
// unconscious or blind hero, an eyeless, sleeping or already-blind monster,
// a body with its own AD_BLND explosion or gaze attack (yellow light,
// Archon; not dust vortex, cobra or raven), or an artifact defense such as
// a wielded Sunsword.
export function resistsBlnd(mdef: BlindCombatant, state: GameState = game): boolean {
    if ('youmonst' in mdef) {
        // The hero branch folds in C's Blnd_resist catchall, which native
        // code cannot reach without resists_blnd() already having returned.
        if (heroIsBlind(state) || heroIsUnaware(state) || !!state.u.blindResistance)
            return true;
    } else {
        const monster = mdef.monster;
        if (!!monster.mblinded || !monster.mcansee || !monsterHasEyes(monster.mnum)
            || !!monster.msleeping)
            return true;
    }
    const species = 'youmonst' in mdef ? heroSpecies(state) : mdef.monster.mnum;
    if ((MONSTER_ATTACKS[species] || []).some(([method, damage]) =>
        damage === AD_BLND && (method === AT_EXPL || method === AT_GAZE)))
        return true;
    /* Sunsword, and artifacts that defend while carried */
    return 'youmonst' in mdef
        ? heroHasArtifactDefense('blindness', state)
        : monsterHasArtifactDefense(mdef.monster, 'blindness', state);
}

const PM_RAVEN = MONSTER_NAME.indexOf('raven');

// C mondata.c:can_blnd(). magr may be null (no specific aggressor); the
// hero's monster fields come from the state, and the hero is never
// cancelled. The object callers only ever hold a cream pie, blinding venom
// or a potion of blindness: thrown and scattered potions are routed to
// potionhit() before these contact paths can run.
export function canBlnd(
    magr: BlindCombatant | null,
    mdef: BlindCombatant,
    aatyp: number,
    obj: Pick<GameObject, 'otyp'> | null,
    state: GameState = game,
): boolean {
    const isYou = 'youmonst' in mdef;
    const defenderSpecies = isYou ? heroSpecies(state) : mdef.monster.mnum;
    const attackerSpecies = magr === null ? null
        : 'youmonst' in magr ? heroSpecies(state) : magr.monster.mnum;

    /* no eyes protect against all attacks for now */
    if (!monsterHasEyes(defenderSpecies)) return false;

    /* if monster has been permanently blinded, the deed is already done */
    if (!isYou && !mdef.monster.mcansee && !(mdef.monster.mblinded ?? 0))
        return false;

    /* /corvus oculum corvi non eruit/
       a saying expressed in Latin rather than a zoological observation:
       "a crow will not pluck out the eye of another crow"
       so prevent ravens from blinding each other */
    if (attackerSpecies === PM_RAVEN && defenderSpecies === PM_RAVEN)
        return false;

    let checkVisor = false;
    switch (aatyp) {
    case AT_EXPL:
    case AT_BOOM:
    case AT_GAZE:
    case AT_MAGC:
    case AT_BREA: /* assumed to be lightning */
        /* light-based attacks may be cancelled or resisted */
        if (magr !== null && 'monster' in magr && magr.monster.mcan) return false;
        return !resistsBlnd(mdef, state);

    case AT_WEAP:
    case AT_SPIT:
    case AT_NONE:
        /* an object is used (thrown/spit/other) */
        if (obj !== null && obj.otyp === CREAM_PIE) {
            if (isYou && blindfolded(state)) return false;
        } else if (obj !== null && obj.otyp === BLINDING_VENOM) {
            /* all ublindf, including LENSES, protect, cream-pies too */
            if (isYou && ((state.ublindf ?? state.u.ublindf) || state.u.ucreamed))
                return false;
            checkVisor = true;
        } else if (obj !== null && obj.otyp === POT_BLINDNESS) {
            return true; /* no defense */
        } else {
            return false; /* other objects cannot cause blindness yet */
        }
        if (magr !== null && 'youmonst' in magr && state.u.uswallow)
            return false; /* can't affect eyes while inside monster */
        break;

    case AT_ENGL:
        if (isYou && (blindfolded(state) || heroIsUnaware(state) || state.u.ucreamed))
            return false;
        if (!isYou && mdef.monster.msleeping) return false;
        break;

    case AT_CLAW:
        /* e.g. raven: all ublindf, including LENSES, protect */
        if (isYou && (state.ublindf ?? state.u.ublindf)) return false;
        if (magr !== null && 'youmonst' in magr && state.u.uswallow)
            return false; /* can't affect eyes while inside monster */
        checkVisor = true;
        break;

    case AT_TUCH:
    case AT_STNG:
        /* some physical, blind-inducing attacks can be cancelled */
        if (magr !== null && 'monster' in magr && magr.monster.mcan) return false;
        break;

    default:
        break;
    }

    /* check if wearing a visor (only checked if visor might help).  Worn
       armor stays in the inventory, so the hero scan needs no extra slot
       lookups. */
    if (checkVisor) {
        const worn = isYou ? state.inventory
            : mdef.monster.minvent ?? mdef.monster.inventory ?? [];
        if (worn.some(object => ((object.owornmask ?? 0) & W_ARMH)
            && OBJ_DESCR(object.otyp, state) === 'visored helmet'))
            return false;
    }

    return true;
}

// C mondata.c:passes_bars(). Rust monsters and some puddings destroy bars;
// postmov (monmove.c) reuses the same corrosion test for its iron-bars meal.
const M1_WALLWALK = 0x00000008;
const M1_AMORPHOUS = 0x00000004;
const M1_UNSOLID = 0x00100000;
const M1_METALLIVORE = 0x80000000;

// C mondata.c:passes_bars()
export function monsterPassesBars(monster: Pick<Monster, 'mnum'>): boolean {
    const mnum = monster.mnum;
    return monsterPassesWalls(mnum) || monsterIsAmorphous(monster)
        || monsterIsUnsolid(monster) || monsterIsWhirly(monster)
        || monsterIsVerySmall(mnum) || monsterCorrodesBars(monster)
        || metallivorous(mnum) || (monsterIsSlithy(mnum) && !monsterIsBig(mnum));
}

// Part of C mondata.c:passes_bars(): the rust-and-corrode bars test.
export function monsterCorrodesBars(monster: Pick<Monster, 'mnum'>): boolean {
    return (MONSTER_ATTACKS[monster.mnum] ?? []).some(([, damage]) => damage === AD_RUST || damage === AD_CORR);
}

// C mondata.c:can_blow(). Hero strangulation is an actor-specific check.
const M1_BREATHLESS = 0x400, M1_NOHEAD = 0x8000;
const MS_SILENT = 0, MS_BUZZ = 10, MS_BURBLE = 16, MZ_SMALL = 1, S_EEL = 57;

// Part of C mondata.c:can_blow(): the species half.
export function speciesCanBlow(mnum: number): boolean {
    const sound = requireMonsterData(MONSTER_SOUND, mnum);
    if (sound !== MS_SILENT && sound !== MS_BUZZ) return true;
    return !(monsterIsBreathless(mnum) || !monsterHasHead({ mnum }))
        && requireMonsterData(MONSTER_SIZE, mnum) >= MZ_SMALL
        && requireMonsterData(MONSTER_SYMBOL, mnum) !== S_EEL;
}

// C mondata.c:can_blow(). The species half is speciesCanBlow() above; this
// is the youmonst half, whose only extra check is hero strangulation.
export function heroCanBlow(state: GameState = game) {
    if (state.u.strangled || (state.u.strangledTurns ?? 0) > 0) return false;
    return speciesCanBlow(heroSpecies(state));
}

// C mondata.c:can_chant(), shared by reading and calling on a deity.
export function heroCanChant(state = game) {
    const hero = state.u;
    if (hero.strangled || (hero.strangledTurns ?? 0) > 0) return false;
    const mnum = hero.umonnum;
    if (mnum === undefined || !Number.isInteger(mnum)) return true;
    const sound = MONSTER_SOUND[mnum] ?? MS_SILENT;
    return sound !== MS_SILENT
        && sound !== MS_BUZZ
        && sound !== MS_BURBLE
        && monsterHasHead({ mnum });
}

// C mondata.c:can_be_strangled(): headless bodies have no neck to squeeze,
// and a mindless body that does not breathe is not strangled by pressure.
// The hero cannot be mindless, but polymorphing into a mindless form still
// confers the protection.
export function heroCanBeStrangled(state = game) {
    if (heroHasNoHead(state)) return false;
    const form = state.u.umonnum;

    const mindless = monsterIsMindless(form ?? -1);
    return !mindless || !heroIsBreathless(state);
}

// C mondata.c:can_track().  u_wield_art(ART_EXCALIBUR) comes first: the
// artifact lets even eyeless monsters follow the hero's tracks.
export function canTrack(mnum: number, state: GameState = game): boolean {
    const weapon = state.uwep || state.u.uwep;
    if (artifactById(weapon?.oartifact, state)?.name === 'Excalibur') return true;
    return monsterHasEyes(mnum);
}

// Port only: MONSTER_NAME.indexOf for mondata.c:same_race()'s family
// tables, like symbol() below.
function species(name: string) {
    return MONSTER_NAME.indexOf(name);
}

// Port only: resolves a species' class symbol for the same_race tables.
function symbol(name: string) {
    return requireMonsterData(MONSTER_SYMBOL, species(name));
}
const GOLEM = symbol('stone golem');
const KOBOLD = symbol('kobold');
const IMP = symbol('imp');

const classFamilies = [symbol('ogre'), symbol('water nymph'),
    symbol('plains centaur'), symbol('red dragon'), symbol('red naga')];
const undeadFamilies = [symbol('human zombie'), symbol('human mummy'),
    symbol('vampire'), symbol('lich'), symbol('wraith'), symbol('ghost')];
const kobolds = new Set([species('kobold zombie'), species('kobold mummy')]);
const gargoyles = new Set([species('gargoyle'), species('winged gargoyle')]);
const bees = new Set([species('killer bee'), species('queen bee')]);
const longWorms = new Set([species('baby long worm'), species('long worm'),
    species('long worm tail')]);
const TENGU = species('tengu');

// C mondata.c:same_race():
export function sameMonsterRace(left: number, right: number): boolean {
    if (left === right) return true;
    const leftClass = requireMonsterData(MONSTER_SYMBOL, left);
    const rightClass = requireMonsterData(MONSTER_SYMBOL, right);
    if (monsterIsHuman(left)) return monsterIsHuman(right);
    if (is_elf(left)) return is_elf(right);
    if (is_dwarf(left)) return is_dwarf(right);
    if (is_gnome(left)) return is_gnome(right);
    if (is_orc(left)) return is_orc(right);
    if (monsterIsGiant(left)) return monsterIsGiant(right);
    if (leftClass === GOLEM) return rightClass === GOLEM;
    if (monsterIsMindFlayer(left)) return monsterIsMindFlayer(right);
    if (leftClass === KOBOLD || kobolds.has(left))
        return rightClass === KOBOLD || kobolds.has(right);
    if (classFamilies.includes(leftClass)) return leftClass === rightClass;
    if (monsterIsUnicorn(left)) return monsterIsUnicorn(right);
    if (monsterIsRider({ mnum: left })) return monsterIsRider({ mnum: right });
    if (is_minion(left)) return is_minion(right);
    if (left === TENGU || right === TENGU) return false;
    if (leftClass === IMP) return rightClass === IMP;
    if (rightClass === IMP) return false;
    if (monsterIsDemon(left)) return monsterIsDemon(right);
    if (monsterIsUndead(left)) {
        if (undeadFamilies.includes(leftClass)) return leftClass === rightClass;
    } else if (monsterIsUndead(right)) return false;
    if (leftClass === rightClass) {
        // left !== right here; test all smaller forms of left against right,
        // then all larger ones (mondata.c:same_race()).
        let current = left;
        for (;;) {
            const next = monsterYoungerForm(current);
            if (next === current) break;
            if (next === right) return true;
            current = next;
        }
        current = left;
        for (;;) {
            const next = monsterOlderForm(current);
            if (next === current) break;
            if (next === right) return true;
            current = next;
        }
    }
    if (gargoyles.has(left)) return gargoyles.has(right);
    if (bees.has(left)) return bees.has(right);
    if (longWorms.has(left)) return longWorms.has(right);
    return false;
}

// C mondata.c:locomotion() and stagger(). Describe the actual body, even
// when its name is hidden or hallucinated.
const M1_NOLIMBS = 0x00006000;

// C mondata.c:locomotion():
export function monsterLocomotion(mnum: number, fallback: string): string {
    let verb = fallback;
    if (monsterIsFloater(mnum)) verb = 'float';
    else if (monsterIsFlyer(mnum)) verb = 'fly';
    else if (monsterIsSlithy(mnum)) verb = 'slither';
    else if (monsterIsAmorphous({ mnum })) verb = 'ooze';
    else if (!MONSTER_MOVE[mnum]) verb = 'wiggle';
    else if (monsterHasNoLimbs(mnum)) verb = 'crawl';
    return fallback.charAt(0) === fallback.charAt(0).toUpperCase()
        ? verb.charAt(0).toUpperCase() + verb.slice(1) : verb;
}

// C mondata.c:stagger(): the faltering counterpart of locomotion().
export function monsterStagger(mnum: number, fallback: string): string {
    let verb = fallback;
    if (monsterIsFloater(mnum)) verb = 'wobble';
    else if (monsterIsFlyer(mnum)) verb = (MONSTER_SIZE[mnum] ?? 0) <= MZ_SMALL ? 'flutter' : 'stagger';
    else if (monsterIsSlithy(mnum)) verb = 'falter';
    else if (monsterIsAmorphous({ mnum })) verb = 'tremble';
    else if (!MONSTER_MOVE[mnum]) verb = 'pulsate';
    else if (monsterHasNoLimbs(mnum)) verb = 'falter';
    return fallback.charAt(0) === fallback.charAt(0).toUpperCase()
        ? verb.charAt(0).toUpperCase() + verb.slice(1) : verb;
}

// C mondata.c:on_fire(). The affected body determines what heat looks like.
export function monsterFireDescription(monster: Pick<Monster, 'mnum'>, method: AttackMethod): string {
    const species = requireMonsterData(MONSTER_NAME, monster.mnum);
    switch (species) {
    case 'flaming sphere': case 'fire vortex': case 'fire elemental': case 'salamander':
        return 'already on fire';
    case 'water elemental': case 'fog cloud': case 'steam vortex':
        return 'boiling';
    case 'ice vortex': case 'glass golem':
        return 'melting';
    case 'stone golem': case 'clay golem': case 'gold golem': case 'air elemental':
    case 'earth elemental': case 'dust vortex': case 'energy vortex':
        return 'heating up';
    default:
        return method === AT_HUGS ? 'being roasted' : 'on fire';
    }
}

// C mondata.c:msummon_environ(): the "appears in a <cloud> of <what>"
// description.
export function summonEnvironment(monster: Monster): string {
    if (MONSTER_SYMBOL[monster.mnum] === 27 || MONSTER_SYMBOL[monster.mnum] === 25)
        return 'flash of light';
    switch (MONSTER_NAME[monster.mnum] ?? '') {
    case 'water demon':
    case 'air elemental':
    case 'water elemental':
    case 'fog cloud':
    case 'ice vortex':
    case 'freezing sphere':
        return 'cloud of vapor';
    case 'steam vortex':
        return 'cloud of steam';
    case 'energy vortex':
    case 'shocking sphere':
        return 'shower of sparks';
    case 'earth elemental':
    case 'dust vortex':
        return 'cloud of dust';
    case 'fire elemental':
    case 'fire vortex':
    case 'flaming sphere':
        return 'ball of flame';
    default:
        return 'cloud of smoke';
    }
}

// The hero intrinsic to monster MR_* bit table (mondata.c:res_to_mr()).
const HERO_RESISTANCES = Object.freeze([
    ['fireResistance', 0x01],
    ['coldResistance', 0x02],
    ['sleepResistance', 0x04],
    ['disintegrationResistance', 0x08],
    ['shockResistance', 0x10],
    ['poisonResistance', 0x20],
    ['acidResistance', 0x40],
    ['stoneResistance', 0x80],
] as const);
// C mondata.c:give_u_to_m_resistances(): give monster mtmp the same
// intrinsics the hero has, as monster magic-resistance bits.
export function giveHeroResistancesToMonster(monster: Monster, state: GameState = game): number {
    let inherited = 0;
    for (const [property, bit] of HERO_RESISTANCES) {
        if (hasPermanentIntrinsicProperty(property, state)) inherited |= bit;
    }
    monster.mintrinsics = (monster.mintrinsics ?? 0) | inherited;
    return inherited;
}


// C mondata.c:olfaction().  This is a current-form sensory capability, not
// a blindness check: molds and several other body classes can sense smoke
// but cannot smell it, while an ordinary blind humanoid still has olfaction.
const OLFACTIONLESS_SYMBOLS = new Set([
    2,  // S_BLOB
    5,  // S_EYE
    10, // S_JELLY
    22, // S_VORTEX
    25, // S_LIGHT
    31, // S_ELEMENTAL
    32, // S_FUNGUS
    42, // S_PUDDING
    55, // S_GOLEM
]);

// C mondata.c:olfaction():
export function heroHasOlfaction(state = game) {
    const form = heroMonsterForm(state);
    if (form === null) return true;
    const symbol = MONSTER_SYMBOL[form];
    return symbol === undefined || !OLFACTIONLESS_SYMBOLS.has(symbol);
}

// C mondata.c:cvt_adtyp_to_mseenres(): these eight damage types and bits share an order.
export function seenResistanceForDamage(damageType: number): number {
    return damageType >= AD_MAGM && damageType <= AD_ACID
        ? M_SEEN_MAGR << (damageType - AD_MAGM) : M_SEEN_NOTHING;
}

// C mondata.c:cvt_prop_to_mseenres().  Worn items confer these nine
const M_SEEN_BY_PROPERTY: Partial<Record<PropertyName, number>> = {
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
export function seenResistanceForProperty(property: PropertyName): number {
    return M_SEEN_BY_PROPERTY[property] ?? M_SEEN_NOTHING;
}

// Part of C mondata.c:monstseesu(), mondata.c:monstunseesu(): the shared
// m_canseeu loop.
// monstseesu() and monstunseesu() share this loop: every living monster
// which could see the hero (m_canseeu) gets the resistance update.
function monstersThatCanSeeHero(state: GameState, canSeeHero: ((monster: Monster) => boolean) | null): Monster[] {
    if (state.u?.uswallow) return [];
    const seesHero = canSeeHero
        || ((monster: Monster) => monsterHasLineOfSightToHero(monster, state));
    return (state.level?.monsters || []).filter(monster =>
        monster && !monster.dead && (monster.mhp ?? 1) > 0
        && seesHero(monster));
}

// C mondata.c:monstseesu(). Monsters in line of sight remember hero resisting.
export function monstersObserveHeroResistance(
    resistance: number,
    state: GameState = game,
    canSeeHero: ((monster: Monster) => boolean) | null = null,
): number {
    if (!resistance || resistance === M_SEEN_NOTHING) return 0;
    const observers = monstersThatCanSeeHero(state, canSeeHero);
    for (const monster of observers) {
        monster.seen_resistance = (monster.seen_resistance ?? 0)
            | resistance;
    }
    return observers.length;
}

// C mondata.c:monstunseesu(). Monsters in line of sight forget hero resistance.
export function monstersForgetHeroResistance(
    resistance: number,
    state: GameState = game,
    canSeeHero: ((monster: Monster) => boolean) | null = null,
): number {
    if (!resistance || resistance === M_SEEN_NOTHING) return 0;
    const observers = monstersThatCanSeeHero(state, canSeeHero);
    for (const monster of observers) {
        monster.seen_resistance = (monster.seen_resistance ?? 0)
            & ~resistance;
    }
    return observers.length;
}

// C mondata.c:resist_conflict(). High-charisma heroes convince monsters
// bound by the ring of conflict's charm more easily; there is always a
// small chance at 19.
export function resistConflict(
    monster: Monster,
    state: PlayingGameState,
    rollOne: RollOne,
    calls: MonsterCallLog,
) {
    const charisma = currentAttribute(A_CHA, state);
    const monsterLevel = monster?.m_lev ?? MONSTER_LEVEL[monster?.mnum] ?? 0;
    const heroLevel = state?.u?.ulevel ?? 1;
    const resistChance = Math.min(19, charisma - monsterLevel + heroLevel);
    const roll = rollOne(20);
    calls.push('rnd(20)');
    return roll > resistChance;
}

// C mondata.c:dmgtype(AD_SEDU/AD_SSEX): seducers keep their powers when
// traits are saved and restored.
export function monsterHasSeductionAttack(mnum: number): boolean {
    return (MONSTER_ATTACKS[mnum] || []).some(
        ([, damageType]) => damageType === AD_SEDU
            || damageType === AD_SSEX,
    );
}

// Monster resistance checks shared by attacks and item effects.
// C refs: mondata.c Resists_Elem() and resists_*().
export type ResistantMonster = Pick<Monster, 'mnum'> & Partial<Pick<Monster,
    'cham' | 'minvent' | 'inventory' | 'mw' | 'mintrinsics' | 'mextrinsics'>>;

const MR_FIRE = 0x01;
const MR_COLD = 0x02;
const MR_SLEEP = 0x04;
const MR_DISINTEGRATION = 0x08;
const MR_ELECTRIC = 0x10;
const MR_ACID = 0x40;
const MR_POISON = 0x20;
const MR_STONE = 0x80;
const PM_BABY_GRAY_DRAGON = MONSTER_NAME.indexOf('baby gray dragon');
// The worn armor types whose oc_oprop is ANTIMAGIC.
const ANTIMAGIC_ARMOR = new Set([
    CLOAK_OF_MAGIC_RESISTANCE,
    GRAY_DRAGON_SCALE_MAIL,
    GRAY_DRAGON_SCALES,
]);
const M2_UNDEAD = 0x00000002;
const M2_WERE = 0x00000004;
const M2_DEMON = 0x00000100;
const M2_STALK = 0x01000000;
const PM_DEATH = 311;
const PM_BLACK_DRAGON = MONSTER_NAME.indexOf('black dragon');
const PM_GRAY_DRAGON = MONSTER_NAME.indexOf('gray dragon');
const PM_YELLOW_DRAGON = MONSTER_NAME.indexOf('yellow dragon');
const ARTIFACT_BY_ID = new Map(
    ARTIFACT_DATA.map(artifact => [artifact.id, artifact]),
);

// Port only: resolves an artifact by its id; C indexes artilist.
function artifactForObject(object: GameObject | null | undefined) {
    return object?.oartifact === undefined ? null : ARTIFACT_BY_ID.get(object.oartifact) || null;
}

// Port only: the minvent accessor.
function monsterInventory(monster: ResistantMonster | null | undefined): GameObject[] {
    return monster?.minvent || monster?.inventory || [];
}

// Port only: the wielded-weapon accessor; C uses MON_WEP.
function monsterWeapon(monster: ResistantMonster | null | undefined): GameObject | undefined {
    return monster?.mw || monsterInventory(monster).find(object =>
        object?.wielded || ((object?.owornmask ?? 0) & W_WEP));
}

// Port only: the worn-type test the resistance checks share.
function monsterWearsOneOf(monster: ResistantMonster | null | undefined, objectTypes: readonly number[], mask: number): boolean {
    return (monster?.minvent || monster?.inventory || []).some(object =>
        objectTypes.includes(object?.otyp)
        && !!((object?.owornmask ?? 0) & mask));
}

// Part of C mondata.c:Resists_Elem(): the combined resistance bits.
export function monsterResistanceBits(monster: ResistantMonster | null | undefined): number {
    if (!monster) return 0;
    return (MONSTER_RESISTS[monster.mnum] ?? 0)
        | (monster?.mextrinsics ?? 0) | (monster?.mintrinsics ?? 0);
}

// Part of C mondata.c:Resists_Elem(): the artifact defense halves.
function monsterArtifactDefends(monster: ResistantMonster | null | undefined, element: 'fire' | 'cold' | 'shock' | 'poison'): boolean {
    return artifactForObject(monsterWeapon(monster))?.defense === element
        || monsterInventory(monster).some(object =>
            artifactForObject(object)?.carriedDefense === element);
}

// C monst.h:resists_fire():
export function monsterHasFireResistance(monster: ResistantMonster | null | undefined): boolean {
    return !!(monsterResistanceBits(monster) & MR_FIRE)
        || monsterArtifactDefends(monster, 'fire');
}

// C monst.h:resists_cold():
export function monsterHasColdResistance(monster: ResistantMonster | null | undefined): boolean {
    return !!(monsterResistanceBits(monster) & MR_COLD)
        || monsterArtifactDefends(monster, 'cold');
}

// C monst.h:resists_elec():
export function monsterHasShockResistance(monster: ResistantMonster | null | undefined): boolean {
    return !!(monsterResistanceBits(monster) & MR_ELECTRIC)
        || monsterArtifactDefends(monster, 'shock');
}

// C monst.h:resists_disint():
export function monsterHasDisintegrationResistance(monster: ResistantMonster | null | undefined): boolean {
    return !!(monsterResistanceBits(monster) & MR_DISINTEGRATION)
        || monsterWearsOneOf(monster,
            [BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES], W_ARM);
}

// C mondata.c:resists_drli():
export function monsterHasDrainResistance(monster: ResistantMonster | null | undefined): boolean {
    if (!monster) return false;
    return (monsterIsUndead(monster.mnum) || is_were(monster.mnum) || monsterIsDemon(monster.mnum))
        || monster?.mnum === PM_DEATH
        || monsterIsVampireShifter(monster)
        || artifactForObject(monsterWeapon(monster))?.defense === 'life-drain'
        || (monster.mnum >= PM_GRAY_DRAGON && monster.mnum <= PM_YELLOW_DRAGON
            ? monster.mnum === PM_BLACK_DRAGON
            : monsterWearsOneOf(monster, [
                BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES,
            ], W_ARM));
}

// Part of C mondata.c:resists_drli(): the youmonst form.
// C resists_drli(&youmonst), not the broader Drain_resistance property.
// Direct divine level loss does not accept a shield or generic intrinsic.
export function heroResistsLifeDrain(state: GameState = game): boolean {
    const hero = state.u;
    const form: ResistantMonster = { mnum: heroSpecies(state) };
    if (hero.mcham !== undefined) form.cham = hero.mcham;
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

// C monst.h:resists_acid():
export function monsterHasAcidResistance(monster: ResistantMonster | null | undefined): boolean {
    return !!(monsterResistanceBits(monster) & MR_ACID);
}

// C monst.h:resists_poison():
export function monsterHasPoisonResistance(monster: ResistantMonster | null | undefined): boolean {
    return !!(monsterResistanceBits(monster) & MR_POISON)
        || monsterArtifactDefends(monster, 'poison');
}

// C monst.h:resists_ston():
export function monsterHasStoneResistance(monster: ResistantMonster | null | undefined): boolean {
    return !!(monsterResistanceBits(monster) & MR_STONE);
}

// C monst.h:resists_sleep():
// C include/monst.h:274 resists_sleep() over mondata.c Resists_Elem(),
// with the mondata.c:91 defended(mon, AD_SLEE) half of the caller checks.
export function monsterResistsSleep(monster: Monster): boolean {
    return !!(monsterResistanceBits(monster) & MR_SLEEP)
        || !!monster?.defendedSleep;
}

// C mondata.c:resists_magm(): magic (magic-missile) resistance for a
// monster — species breath (AD_MAGM or the Chromatic Dragon's AD_RBRE),
// baby gray dragons, a wielded artifact that defends against magic, worn
// armor with oc_oprop ANTIMAGIC, or a carried artifact's
// defends_when_carried() bonus. C's is_you branches serve no caller: every
// C call site passes a monster, not &youmonst (polyself.c only mentions
// resists_magm in a comment).
export function monsterHasMagicResistance(monster: ResistantMonster | null | undefined): boolean {
    if (
        monster?.mnum === PM_BABY_GRAY_DRAGON
        || (MONSTER_ATTACKS[monster?.mnum ?? -1] || []).some(
            ([, damageType]) => damageType === AD_MAGM || damageType === AD_RBRE,
        )
    ) {
        return true;
    }

    const weapon = monsterWeapon(monster);
    if (artifactById(weapon?.oartifact)?.defense === 'magic') return true;
    return monsterInventory(monster).some((object) => {
        if (artifactById(object?.oartifact)?.carriedDefense === 'magic') return true;
        return (
            ANTIMAGIC_ARMOR.has(object?.otyp)
            && !!((object?.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY | W_WEP))
        );
    });
}

// C monst.h:helpless():
// C include/monst.h:251 helpless().
export function monsterIsHelpless(monster: Monster): boolean {
    return !!(monster.msleeping
        || !monster.mcanmove || (monster.mfrozen ?? 0) > 0);
}

// C mondata.c:levl_follower(). Used by dog.c keepdogs() when the hero
// changes levels.
export function levelFollower(monster: Monster, state: GameState): boolean {
    if (monster === state.u.usteed) return true;
    if (monster.iswiz && monsterCarriesAmulet(monster)) return false;
    if (monster.mtame || monster.iswiz || monster.isshk && monster.eshk?.following)
        return true;
    return !!(questMonsterFlags2(monster.mnum, state) & M2_STALK)
        && (!monster.mflee || !!state.u.uhave?.amulet);
}


interface PronounOptions {
    state?: GameState;
    random?: (limit: number) => number;
    noIt?: boolean;
}

type PronounGender = 0 | 1 | 2 | 3;
const POSSESSIVE_PRONOUNS: readonly [string, string, string, string] = ['his', 'her', 'its', 'their'];
const SUBJECT_PRONOUNS: readonly [string, string, string, string] = ['he', 'she', 'it', 'they'];
const OBJECT_PRONOUNS: readonly [string, string, string, string] = ['him', 'her', 'it', 'them'];
const PRONOUN_G_UNIQ = 0x1000;

// Part of C you.h:mhis(): the possessive pronoun through pronoun_gender,
// like its mhe()/mhim() siblings below. Hallucination precedes visibility
// and sex and uses the core RNG.
export function monsterPossessive(monster: Monster, { state = game, random = rn2, noIt = false }: PronounOptions = {}): string {
    return POSSESSIVE_PRONOUNS[monsterPronounGender(monster, { state, random, noIt })];
}

// Part of C you.h:mhe(): the subject pronoun through pronoun_gender.
export function monsterSubjectPronoun(monster: Monster, { state = game, noIt = false }: Pick<PronounOptions, 'state' | 'noIt'> = {}): string {
    return SUBJECT_PRONOUNS[monsterPronounGender(monster, { state, noIt })];
}

// Part of C you.h:mhim(): the object pronoun through pronoun_gender.
// The same perceived gender, in the object case.
export function monsterObjectPronoun(monster: Monster, { state = game, random = rn2, noIt = false }: PronounOptions = {}): string {
    return OBJECT_PRONOUNS[monsterPronounGender(monster, { state, random, noIt })];
}

// C mondata.c:pronoun_gender():
export function monsterPronounGender(monster: Monster, { state = game, random = rn2, noIt = false }: PronounOptions = {}): PronounGender {
    requireLiveGame(state);
    if (heroIsHallucinating(state)) {
        const gender = random(4);
        if (gender === 0 || gender === 1 || gender === 2 || gender === 3) return gender;
        throw new RangeError(`Invalid hallucinated pronoun gender: ${gender}`);
    }
    if ((!noIt && !canSpotMonster(monster)) || is_neuter(monster.mnum))
        return 2;
    return monsterIsHumanoid(monster.mnum)
        || ((MONSTER_GENO[monster.mnum] ?? 0) & PRONOUN_G_UNIQ)
        || monsterHasProperName(monster.mnum)
        ? monster.female ? 1 : 0 : 2;
}

// C mondata.c:set_mon_data(). Change a monster's species without
// rebuilding the monster.
export function setMonsterSpecies(monster: Monster, mnum: number): Monster {
    const oldSpeed = MONSTER_MOVE[monster.mnum] ?? monster.mmove ?? 0;
    const newSpeed = MONSTER_MOVE[mnum] ?? monster.mmove ?? 0;
    if (monster.movement && newSpeed < oldSpeed && oldSpeed > 0) {
        monster.movement = Math.trunc(
            monster.movement * newSpeed / oldSpeed,
        );
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

// C mondata.c:mon_knows_traps():
export function monsterKnowsTrap(
    monster: Pick<Monster, 'mtrapseen'>, trap: Pick<Trap, 'ttyp'>,
): boolean {
    const known = monster.mtrapseen ?? 0;
    if (trap.ttyp === -1) return known !== 0;
    if (trap.ttyp === 0) return known === 0;
    return (known & (1 << (trap.ttyp - 1))) !== 0;
}

// C mondata.c:mon_learns_traps():
export function monsterLearnsTrap(monster: Pick<Monster, 'mtrapseen'>, trap: Pick<Trap, 'ttyp'> | null | undefined): void {
    if (!trap) return;
    if (trap.ttyp === -1) monster.mtrapseen = -1;
    else if (trap.ttyp === 0) monster.mtrapseen = 0;
    else monster.mtrapseen = (monster.mtrapseen ?? 0) | (1 << (trap.ttyp - 1));
}

// C mondata.c:mons_see_trap().  Trap knowledge belongs to each observer,
// rather than to the level or monster class.  An unlit trigger teaches only
// adjacent sighted, thinking monsters; a lit trigger can teach observers up
// to seven squares away when clear_path() succeeds.
export function monstersSeeTrap(state: GameState, trap: Pick<Trap, 'ttyp' | 'tx' | 'ty'> | null | undefined): void {
    if (!trap) return;
    const tile = state?.level?.at?.(trap.tx, trap.ty);
    const maxDistance = tile?.lit ? 49 : 2;
    for (const observer of state?.level?.monsters || []) {
        if (!observer || (observer.mhp ?? 1) <= 0) continue;

        if ((monsterIsAnimal({ mnum: observer.mnum }) || monsterIsMindless(observer.mnum) || !monsterHasEyes(observer.mnum))
            || observer.mcansee === false || observer.mcansee === 0) {
            continue;
        }
        if (dist2(observer.mx, observer.my, trap.tx, trap.ty) > maxDistance)
            continue;
        if (!clearPath(observer.mx, observer.my, trap.tx, trap.ty)) continue;
        monsterLearnsTrap(observer, trap);
    }
}

const S_RODENT = 18;
const PM_ROCK_MOLE = 92;
const PM_WOODCHUCK = 93;
const PM_PONY = 100;
const PM_HORSE = 104;
const PM_WARHORSE = 105;

// C mondata.c:cantvomit(). Rats and mice are incapable of vomiting;
// likewise with horses. The body decides for any monster species.
export function speciesCannotVomit(mnum: number): boolean {
    if (MONSTER_SYMBOL[mnum] === S_RODENT
        && mnum !== PM_ROCK_MOLE && mnum !== PM_WOODCHUCK) return true;
    return mnum === PM_PONY || mnum === PM_HORSE || mnum === PM_WARHORSE;
}

// Part of C mondata.c:cantvomit(): the youmonst form.
// mondata.c:cantvomit(gy.youmonst.data) for the hero's current form.
export function heroCannotVomit(state: GameState) {
    const form = heroMonsterForm(state);
    return form != null && speciesCannotVomit(form);
}
const PM_PAPER_GOLEM = MONSTER_NAME.indexOf('paper golem');
const PM_STRAW_GOLEM = MONSTER_NAME.indexOf('straw golem');
const PM_WOOD_GOLEM = MONSTER_NAME.indexOf('wood golem');
const PM_LEATHER_GOLEM = MONSTER_NAME.indexOf('leather golem');
const PM_IRON_GOLEM = MONSTER_NAME.indexOf('iron golem');

// C mondata.c:max_passive_dmg().  dog_move() uses the defender's maximum
// passive retaliation, multiplied by the attacker's number of contact
// attacks, as a deterministic safety gate before any melee to-hit roll.
export function maxPassiveMonsterDamage(defender: Monster, aggressor: Monster) {
    // each attack by the aggressor can result in passive damage
    const aggressorAttacks = MONSTER_ATTACKS[aggressor?.mnum] || [];
    let contactCount = 0;
    for (let i = 0; i < aggressorAttacks.length; i++) {
        const attack = aggressorAttacks[i];
        if (!attack) continue;
        switch (attack[0]) {
        case AT_CLAW:
        case AT_BITE:
        case AT_KICK:
        case AT_BUTT:
        case AT_TUCH:
        case AT_STNG:
        case AT_HUGS:
        case AT_ENGL:
        case AT_TENT:
        case AT_WEAP:
            contactCount++;
            break;
        case AT_NONE:
        case AT_SPIT:
        case AT_BREA:
        case AT_EXPL:
        case AT_BOOM:
        case AT_GAZE:
        case AT_MAGC:
        default:
            break;
        }
    }
    if (!contactCount) return 0;

    const defenderAttacks = MONSTER_ATTACKS[defender?.mnum] || [];
    for (let i = 0; i < defenderAttacks.length; i++) {
        const attack = defenderAttacks[i];
        if (!attack) continue;
        const [attackType, damageType, dice, sides] = attack;
        if (attackType !== AT_NONE && attackType !== AT_BOOM) continue;
        // These bodies are destroyed by contact regardless of resistance or
        // HP: mondata.h completelyburns/rots/rusts by species identity.
        if (damageType === AD_FIRE && (aggressor.mnum === PM_PAPER_GOLEM
            || aggressor.mnum === PM_STRAW_GOLEM)
            || damageType === AD_DCAY && (aggressor.mnum === PM_WOOD_GOLEM
                || aggressor.mnum === PM_LEATHER_GOLEM)
            || damageType === AD_RUST && aggressor.mnum === PM_IRON_GOLEM)
            return aggressor.mhp * contactCount;
        const resisted =
            (damageType === AD_FIRE && monsterHasFireResistance(aggressor)) ||
            (damageType === AD_COLD && monsterHasColdResistance(aggressor)) ||
            (damageType === AD_ELEC && monsterHasShockResistance(aggressor)) ||
            (damageType === AD_ACID && monsterHasAcidResistance(aggressor));
        if (resisted) return 0;
        if (![AD_PHYS, AD_FIRE, AD_COLD, AD_ELEC, AD_ACID].includes(damageType)) return 0;
        const count = dice || (MONSTER_LEVEL[defender.mnum] ?? 0) + 1;
        return count * sides * contactCount;
    }
    return 0;
}

const M1_HIDE = 0x00000100;

const M1_FLY = 0x00000001;

const M1_CLING = 0x00000010;

const S_MIMIC = 13;

const M2_HUMAN = 0x00000008;

const M2_ALWAYS_HOSTILE = 0x00100000;

const PM_ARCHEOLOGIST = MONSTER_NAME.indexOf('archeologist');

const PM_WIZARD = MONSTER_NAME.indexOf('wizard');

const PM_HUMAN = MONSTER_NAME.indexOf('human');

const MS_NEMESIS = 37;

const MS_GUARDIAN = 38;

const M1_NOHANDS = 0x00002000;

const MZ_MEDIUM = 2;

const MZ_LARGE = 3;

const S_EYE = 5;

const S_LIGHT = 25;

const M1_SWIM = 0x00000002;

const M1_AMPHIBIOUS = 0x00000200;

const M1_CONCEAL = 0x00000080;

const M1_SEE_INVIS = 0x01000000;

const M1_TPORT_CNTRL = 0x04000000;

const M1_TPORT = 0x02000000;

const S_GOLEM = 55;

const M2_PNAME = 0x00080000;

const M2_ROCKTHROW = 0x08000000;

const M2_GIANT = 0x00002000;

const M2_FEMALE = 0x00020000;

const M1_SLITHY = 0x00080000;

const S_CENTAUR = 29;

const S_KOP = 37;

const S_UNICORN = 21;

const M1_HUMANOID = 0x00020000;

const S_VORTEX = 22;

const S_ELEMENTAL = 31;

const PM_AIR_ELEMENTAL = 154;

const PM_HORNED_DEVIL = MONSTER_NAME.indexOf('horned devil');

const PM_MINOTAUR = MONSTER_NAME.indexOf('minotaur');

const PM_ASMODEUS = MONSTER_NAME.indexOf('Asmodeus');

const PM_BALROG = MONSTER_NAME.indexOf('balrog');

const PM_WHITE_UNICORN = MONSTER_NAME.indexOf('white unicorn');

const PM_GRAY_UNICORN = MONSTER_NAME.indexOf('gray unicorn');

const PM_BLACK_UNICORN = MONSTER_NAME.indexOf('black unicorn');

const PM_KI_RIN = MONSTER_NAME.indexOf('ki-rin');

const CORPSE_EATERS = new Set(['purple worm', 'baby purple worm', 'ghoul',
    'piranha'].map(name => MONSTER_NAME.indexOf(name)));

const PM_WINGED_GARGOYLE = MONSTER_NAME.indexOf('winged gargoyle');

const PM_MARILITH = MONSTER_NAME.indexOf('marilith');

const MZ_HUGE = 4;

const M2_JEWELS = 0x20000000;

const S_VAMPIRE = 48;

const PM_MIND_FLAYER = 48;

const PM_MASTER_MIND_FLAYER = 49;

const PM_FLOATING_EYE = 28;

const PM_SHADE = 288;

const S_IMP = 9;

const PM_TENGU = 55;

const M1_THICK_HIDE = 0x00200000;

const PM_GREMLIN = 40;

const RIDER_SPECIES = new Set([MONSTER_NAME.indexOf('Death'),
    MONSTER_NAME.indexOf('Famine'), MONSTER_NAME.indexOf('Pestilence')]);

const PM_MANES = 50;

// C mondata.h:ceiling_hider()
export function monsterSpeciesHidesOnCeiling(mnum: number): boolean {
    return monsterIsHider(mnum)
        && ((monsterIsClinger(mnum) && MONSTER_SYMBOL[mnum] !== S_MIMIC)
            || monsterIsFlyer(mnum));
}

// C mondata.h:is_undead()
export function monsterIsUndead(mnum: number) {
    return !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_UNDEAD);
}

// C mondata.h:is_human()
export function monsterIsHuman(mnum: number) {
    return !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_HUMAN);
}

// C mondata.h:always_hostile()
export function monsterIsAlwaysHostile(mnum: number, state: GameState = game) {
    return !!(questMonsterFlags2(mnum, state) & M2_ALWAYS_HOSTILE);
}

// C mondata.h:is_mplayer()
export function monsterIsPlayerMonster(mnum: number) {
    return mnum >= PM_ARCHEOLOGIST && mnum <= PM_WIZARD;
}

// C mondata.h:is_covetous()
export function monsterIsCovetous(monster: SpeciesReference, state: GameState = game) {
    return !!(questMonsterFlags3(monster.mnum, state) & 0x001f);
}

// Port only: the plain-human species test; C compares mons[PM_HUMAN] inline.
export function monsterIsPlainHuman(mnum: number) {
    return mnum === PM_HUMAN;
}

// Port only: the MS_NEMESIS test C callers apply inline.
export function monsterIsQuestNemesis(mnum: number) {
    return questMonsterSound(mnum) === MS_NEMESIS;
}

// Port only: the MS_GUARDIAN test C callers apply inline.
export function monsterIsQuestGuardian(mnum: number) {
    return MONSTER_SOUND[mnum] === MS_GUARDIAN;
}

// C mondata.h:is_displacer()
export function monsterIsDisplacer(mnum: number) {
    return !!((MONSTER_FLAGS3[mnum] ?? 0) & 0x0400);
}

// C mondata.h:mindless()
export function monsterIsMindless(mnum: number) {
    return !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_MINDLESS);
}

// C mondata.h:nolimbs()
export function monsterHasNoLimbs(mnum: number) {
    return ((MONSTER_FLAGS1[mnum] ?? 0) & M1_NOLIMBS) === M1_NOLIMBS;
}

// C mondata.h:nohands()
export function monsterHasNoHands(mnum: number) {
    return !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_NOHANDS);
}

// C mondata.h:verysmall()
export function monsterIsVerySmall(mnum: number) {
    return (MONSTER_SIZE[mnum] ?? MZ_SMALL) < MZ_SMALL;
}

// C mondata.h:bigmonst()
export function monsterIsBig(mnum: number) {
    return (MONSTER_SIZE[mnum] ?? MZ_MEDIUM) >= MZ_LARGE;
}

// C mondata.h:is_flyer()
export function monsterIsFlyer(mnum: number) {
    return !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_FLY);
}

// C mondata.h:is_floater()
export function monsterIsFloater(mnum: number) {
    return MONSTER_SYMBOL[mnum] === S_EYE || MONSTER_SYMBOL[mnum] === S_LIGHT;
}

// C mondata.h:is_clinger()
export function monsterIsClinger(mnum: number) {
    return !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_CLING);
}

// C mondata.h:is_hider()
export function monsterIsHider(mnum: number) {
    return !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_HIDE);
}

// C mondata.h:is_swimmer()
export function monsterIsSwimmer(mnum: number) {
    return !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_SWIM);
}

// C mondata.h:breathless()
export function monsterIsBreathless(mnum: number) {
    return !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_BREATHLESS);
}

// C mondata.h:amphibious()
export function monsterIsAmphibious(mnum: number) {
    return !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_AMPHIBIOUS);
}

// C mondata.h:passes_walls()
export function monsterPassesWalls(mnum: number) {
    return !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_WALLWALK);
}

// C mondata.h:haseyes()
export function monsterHasEyes(mnum: number) {
    return !((MONSTER_FLAGS1[mnum] ?? 0) & M1_NOEYES);
}

// C mondata.h:hides_under()
export function monsterHidesUnder(mnum: number) {
    return !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_CONCEAL);
}

// C mondata.h:perceives()
export function monsterPerceives(mnum: number) {
    return !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_SEE_INVIS);
}

// C mondata.h:control_teleport()
export function monsterControlsTeleport(mnum: number) {
    return !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_TPORT_CNTRL);
}

// C mondata.h:can_teleport()
export function monsterCanTeleport(mnum: number) {
    return !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_TPORT);
}

// C mondata.h:is_demon()
export function monsterIsDemon(mnum: number) {
    return !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_DEMON);
}

// C mondata.h:is_golem()
export function monsterIsGolem(mnum: number) {
    return MONSTER_SYMBOL[mnum] === S_GOLEM;
}

// C mondata.h:is_silent()
export function monsterIsSilent(mnum: number) {
    return MONSTER_SOUND[mnum] === MS_SILENT;
}

// C mondata.h:type_is_pname()
export function monsterHasProperName(mnum: number) {
    return !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_PNAME);
}

// C mondata.h:throws_rocks()
export function monsterThrowsRocks(mnum: number) {
    return !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_ROCKTHROW);
}

// C mondata.h:is_giant()
export function monsterIsGiant(mnum: number) {
    return !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_GIANT);
}

// C mondata.h:is_female()
export function monsterIsFemale(mnum: number) {
    return !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_FEMALE);
}

// C mondata.h:slithy()
export function monsterIsSlithy(mnum: number) {
    return !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_SLITHY);
}

// Port only: the S_CENTAUR test C callers apply inline.
export function monsterIsCentaur(mnum: number) {
    return MONSTER_SYMBOL[mnum] === S_CENTAUR;
}

// Port only: the S_KOP test C callers apply inline.
export function monsterIsKop(mnum: number) {
    return MONSTER_SYMBOL[mnum] === S_KOP;
}

// Port only: the S_EEL test C callers apply inline.
export function monsterIsEel(mnum: number) {
    return MONSTER_SYMBOL[mnum] === S_EEL;
}

// C mondata.c:num_horns()
export function monsterHornCount(mnum: number) {
    switch (mnum) {
    case PM_HORNED_DEVIL: /* ? "more than one" */
    case PM_MINOTAUR:
    case PM_ASMODEUS:
    case PM_BALROG:
        return 2;
    case PM_WHITE_UNICORN:
    case PM_GRAY_UNICORN:
    case PM_BLACK_UNICORN:
    case PM_KI_RIN:
        return 1;
    default:
        break;
    }
    return 0;
}

// C mondata.h:is_animal()
export function monsterIsAnimal(monster: SpeciesReference | null | undefined) {
    return !!((MONSTER_FLAGS1[monster?.mnum ?? -1] ?? 0) & M1_ANIMAL);
}

// C mondata.h:has_head()
export function monsterHasHead(monster: SpeciesReference | null | undefined) {
    return !((MONSTER_FLAGS1[monster?.mnum ?? -1] ?? 0) & M1_NOHEAD);
}

// C mondata.h:amorphous()
export function monsterIsAmorphous(monster: SpeciesReference | null | undefined) {
    return !!((MONSTER_FLAGS1[monster?.mnum ?? -1] ?? 0) & M1_AMORPHOUS);
}

// C mondata.h:noncorporeal()
export function monsterIsNoncorporeal(monster: SpeciesReference | null | undefined) {
    return MONSTER_SYMBOL[monster?.mnum ?? -1] === S_GHOST;
}

// C mondata.h:slimeproof()
export function monsterIsSlimeproof(monster: SpeciesReference | null | undefined) {
    return monster?.mnum === PM_GREEN_SLIME
        || (monster?.mnum !== undefined && FLAMING_SPECIES.has(monster.mnum))
        || monsterIsNoncorporeal(monster);
}

// C mondata.h:corpse_eater()
export function speciesEatsCorpses(species: number): boolean {
    return CORPSE_EATERS.has(species);
}

// C mondata.h:is_whirly()
export function monsterIsWhirly(monster: SpeciesReference | null | undefined) {
    return monster?.mnum === PM_AIR_ELEMENTAL
        || MONSTER_SYMBOL[monster?.mnum ?? -1] === S_VORTEX;
}

// C mondata.h:unsolid()
export function monsterIsUnsolid(monster: SpeciesReference | null | undefined) {
    return !!((MONSTER_FLAGS1[monster?.mnum ?? -1] ?? 0) & M1_UNSOLID);
}

// C mondata.c:sliparm()
export function monsterSlipsArmor(mnum: number) {
    const monster = { mnum };
    return monsterIsWhirly(monster)
        || monsterIsNoncorporeal(monster)
        || (MONSTER_SIZE[mnum] ?? 0) <= MZ_SMALL;
}

// C mondata.c:breakarm()
export function monsterBreaksArmor(mnum: number) {
    if (monsterSlipsArmor(mnum)) return false;
    const size = MONSTER_SIZE[mnum] ?? 0;
    return size >= MZ_LARGE
        || (size > MZ_SMALL && !monsterIsHumanoid(mnum))
        || mnum === PM_WINGED_GARGOYLE
        || mnum === PM_MARILITH;
}

// C mondata.h:humanoid()
export function monsterIsHumanoid(mnum: number) {
    return !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_HUMANOID);
}

// C obj.h:WrappingAllowed():
export function monsterWrappingAllowed(mnum: number) {
    const size = MONSTER_SIZE[mnum] ?? 0;
    return monsterIsHumanoid(mnum)
        && size >= MZ_SMALL && size <= MZ_HUGE
        && !monsterIsNoncorporeal({ mnum })
        && !monsterIsCentaur(mnum)
        && mnum !== PM_WINGED_GARGOYLE
        && mnum !== PM_MARILITH;
}

// C mondata.h:is_unicorn()
export function monsterIsUnicorn(mnum: number) {
    return MONSTER_SYMBOL[mnum] === S_UNICORN
        && likes_gems(mnum);
}

// C mondata.h:is_bat()
export function monsterIsBat(mnum: number) {
    return ['bat', 'giant bat', 'vampire bat'].includes(MONSTER_NAME[mnum] ?? '');
}

// C mondata.h:is_vampire()
export function monsterIsVampire(mnum: number) {
    return MONSTER_SYMBOL[mnum] === S_VAMPIRE;
}

// C mondata.h:is_mind_flayer()
export function monsterIsMindFlayer(mnum: number) {
    return mnum === PM_MIND_FLAYER || mnum === PM_MASTER_MIND_FLAYER;
}

// C mondata.h:telepathic()
export function monsterIsTelepathic(mnum: number) {
    return mnum === PM_FLOATING_EYE || monsterIsMindFlayer(mnum);
}

// C mondata.h:digests()
export function monsterDigests(monster: SpeciesReference | null | undefined) {
    return (MONSTER_ATTACKS[monster?.mnum ?? -1] || []).some(
        ([attackType, damageType]) =>
            attackType === AT_ENGL && damageType === AD_DGST,
    );
}

// C mondata.h:enfolds()
export function monsterEnfolds(monster: SpeciesReference) {
    return (MONSTER_ATTACKS[monster.mnum] || []).some(
        ([method, damage]) => method === AT_ENGL && damage === AD_WRAP,
    );
}

// C mondata.c:sticks()
export function monsterSpeciesSticks(mnum: number) {
    const attacks = MONSTER_ATTACKS[mnum] || [];
    const engulfs = attacks.some(([attackType]) => attackType === AT_ENGL);
    return attacks.some(([, damageType]) => damageType === AD_STCK)
        || (!engulfs && attacks.some(([, damageType]) => damageType === AD_WRAP))
        || attacks.some(([attackType]) => attackType === AT_HUGS);
}

// C mondata.c:attacktype(): does a monster type have a particular type of
// attack? (C attacktype_fordmg(ptr, atyp, AD_ANY) restricted to the attack
// type; the damage-type half is applied at the call sites that need it.)
export function monsterHasAttackType(mnum: number, atyp: AttackMethod): boolean {
    return (MONSTER_ATTACKS[mnum] || []).some(
        ([attackType]) => attackType === atyp,
    );
}

// Part of C mondata.c:attacktype(): the AT_ENGL test.
export function monsterCanEngulf(monster: SpeciesReference | null | undefined) {
    return monsterHasAttackType(monster?.mnum ?? -1, AT_ENGL);
}

// C monst.h:is_vampshifter():
export function monsterIsVampireShifter(monster: ShifterReference | null | undefined) {
    return monsterIsVampire(monster?.cham ?? -1);
}

// C mondata.c:mon_hates_blessings()
export function monsterHatesBlessings(monster: ShifterReference | null | undefined) {
    return monsterIsVampireShifter(monster)
        || (monsterIsUndead(monster?.mnum ?? -1) || monsterIsDemon(monster?.mnum ?? -1));
}

// C mondata.c:hates_silver()
export function monsterSpeciesHatesSilver(mnum: number) {
    const symbol = MONSTER_SYMBOL[mnum];
    return (is_were(mnum) || monsterIsDemon(mnum))
        || symbol === S_VAMPIRE || mnum === PM_SHADE
        || (symbol === S_IMP && mnum !== PM_TENGU);
}

// C mondata.c:mon_hates_silver()
export function monsterHatesSilver(monster: ShifterReference | null | undefined) {
    return monsterIsVampireShifter(monster)
        || monsterSpeciesHatesSilver(monster?.mnum ?? -1);
}

// C mondata.h:thick_skinned()
export function monsterIsThickSkinned(monster: SpeciesReference | null | undefined) {
    return !!((MONSTER_FLAGS1[monster?.mnum ?? -1] ?? 0) & M1_THICK_HIDE);
}

// C mondata.h:is_wooden()
export function monsterIsWooden(monster: SpeciesReference | null | undefined) {
    return monster?.mnum === PM_WOOD_GOLEM;
}

// C mondata.h:hates_light()
export function monsterHatesLight(monster: SpeciesReference | null | undefined) {
    return monster?.mnum === PM_GREMLIN;
}

// C mondata.h:is_rider(). Death, Pestilence and Famine never leave a
// revivable corpse behind for long. The species index may be missing on a
// corpse being restored or queried before its corpsenm is set.
export function monsterIsRider(monster: { mnum: number | undefined }) {
    return monster.mnum !== undefined && RIDER_SPECIES.has(monster.mnum);
}

// Port only: the PM_SHADE test C callers apply inline.
export function monsterIsShade(monster: SpeciesReference | null | undefined) {
    return monster?.mnum === PM_SHADE;
}

// C mondata.h:nonliving()
export function monsterIsNonliving(mnum: number) {
    return monsterIsUndead(mnum)
        || mnum === PM_MANES
        || monsterIsWeirdNonliving(mnum);
}

// C mondata.h:weirdnonliving()
export function monsterIsWeirdNonliving(mnum: number) {
    return MONSTER_SYMBOL[mnum] === S_VORTEX || monsterIsGolem(mnum);
}

// C mondata.c:little_to_big()
export function monsterOlderForm(mnum: number) {
    return MONSTER_GROWTH_TARGET[mnum] ?? mnum;
}

// C mondata.c:big_to_little()
export function monsterYoungerForm(mnum: number) {
    if (!Number.isInteger(mnum) || mnum < 0
        || mnum >= MONSTER_GROWTH_TARGET.length) return mnum;
    for (let candidate = 0; candidate < MONSTER_GROWTH_TARGET.length; candidate++) {
        const grown = MONSTER_GROWTH_TARGET[candidate];
        if (candidate !== mnum && grown === mnum) return candidate;
    }
    return mnum;
}

// C mondata.c:big_little_match()
export function monsterGrowthFamilyMatch(left: number, right: number) {
    if (!Number.isInteger(left) || !Number.isInteger(right)
        || left < 0 || right < 0
        || left >= MONSTER_GROWTH_TARGET.length
        || right >= MONSTER_GROWTH_TARGET.length) return false;
    if (left === right) return true;
    if (MONSTER_SYMBOL[left] !== MONSTER_SYMBOL[right]) return false;

    let current = left;
    for (;;) {
        const grown = monsterOlderForm(current);
        if (grown === current) break;
        if (grown === right) return true;
        current = grown;
    }
    current = right;
    for (;;) {
        const grown = monsterOlderForm(current);
        if (grown === current) break;
        if (grown === left) return true;
        current = grown;
    }
    return false;
}

// C mondata.c:noattacks()
export function monsterHasNoAttacks(mnum: number) {
    return !requireMonsterData(MONSTER_ATTACKS, mnum)
        .some(([type]) => type !== AT_NONE && type !== AT_BOOM);
}

const M1_TUNNEL = 0x00000020;

// C mondata.h:tunnels()
export function tunnels(mnum: number): boolean {
    return ((MONSTER_FLAGS1[mnum] ?? 0) & M1_TUNNEL) !== 0;
}

const M1_NEEDPICK = 0x00000040;

// C mondata.h:needspick()
export function needspick(mnum: number): boolean {
    return ((MONSTER_FLAGS1[mnum] ?? 0) & M1_NEEDPICK) !== 0;
}

const M1_NOTAKE = 0x00000800;

// C mondata.h:notake()
export function notake(mnum: number): boolean {
    return ((MONSTER_FLAGS1[mnum] ?? 0) & M1_NOTAKE) !== 0;
}

const M1_OVIPAROUS = 0x00400000;

// C mondata.h:lays_eggs()
export function lays_eggs(mnum: number): boolean {
    return ((MONSTER_FLAGS1[mnum] ?? 0) & M1_OVIPAROUS) !== 0;
}

const M1_REGEN = 0x00800000;

// C mondata.h:regenerates()
export function regenerates(mnum: number): boolean {
    return ((MONSTER_FLAGS1[mnum] ?? 0) & M1_REGEN) !== 0;
}

const M1_ACID = 0x08000000;

// C mondata.h:acidic()
export function acidic(mnum: number): boolean {
    return ((MONSTER_FLAGS1[mnum] ?? 0) & M1_ACID) !== 0;
}

const M1_POIS = 0x10000000;

// C mondata.h:poisonous()
export function poisonous(mnum: number): boolean {
    return ((MONSTER_FLAGS1[mnum] ?? 0) & M1_POIS) !== 0;
}

const M1_CARNIVORE = 0x20000000;

// C mondata.h:carnivorous()
export function carnivorous(mnum: number): boolean {
    return ((MONSTER_FLAGS1[mnum] ?? 0) & M1_CARNIVORE) !== 0;
}

const M1_HERBIVORE = 0x40000000;

// C mondata.h:herbivorous()
export function herbivorous(mnum: number): boolean {
    return ((MONSTER_FLAGS1[mnum] ?? 0) & M1_HERBIVORE) !== 0;
}

// C mondata.h:metallivorous()
export function metallivorous(mnum: number): boolean {
    return ((MONSTER_FLAGS1[mnum] ?? 0) & M1_METALLIVORE) !== 0;
}

const M2_NOPOLY = 0x00000001;

// C mondata.h:polyok()
export function polyok(mnum: number): boolean {
    return ((MONSTER_FLAGS2[mnum] ?? 0) & M2_NOPOLY) === 0;
}

const M2_SHAPESHIFTER = 0x00004000;

// C mondata.h:is_shapeshifter()
export function is_shapeshifter(mnum: number): boolean {
    return ((MONSTER_FLAGS2[mnum] ?? 0) & M2_SHAPESHIFTER) !== 0;
}

// C mondata.h:is_were()
export function is_were(mnum: number): boolean {
    return ((MONSTER_FLAGS2[mnum] ?? 0) & M2_WERE) !== 0;
}

const M2_ELF = 0x00000010;

// C mondata.h:is_elf()
export function is_elf(mnum: number): boolean {
    return ((MONSTER_FLAGS2[mnum] ?? 0) & M2_ELF) !== 0;
}

const M2_DWARF = 0x00000020;

// C mondata.h:is_dwarf()
export function is_dwarf(mnum: number): boolean {
    return ((MONSTER_FLAGS2[mnum] ?? 0) & M2_DWARF) !== 0;
}

const M2_GNOME = 0x00000040;

// C mondata.h:is_gnome()
export function is_gnome(mnum: number): boolean {
    return ((MONSTER_FLAGS2[mnum] ?? 0) & M2_GNOME) !== 0;
}

const M2_ORC = 0x00000080;

// C mondata.h:is_orc()
export function is_orc(mnum: number): boolean {
    return ((MONSTER_FLAGS2[mnum] ?? 0) & M2_ORC) !== 0;
}

const M2_DOMESTIC = 0x00400000;

// C mondata.h:is_domestic()
export function is_domestic(mnum: number): boolean {
    return ((MONSTER_FLAGS2[mnum] ?? 0) & M2_DOMESTIC) !== 0;
}

// C mondata.h:befriend_with_obj(): a monster reaches for a thrown object
// instead of being struck by it. Monkeys and apes take bananas; unicorns
// among the domestic species take only vegetarian food or a lichen corpse.
export function befriendWithObj(mnum: number, object: GameObject): boolean {
    if (mnum === PM_MONKEY || mnum === PM_APE)
        return object.otyp === BANANA;
    if (!is_domestic(mnum) || object.oclass !== FOOD_CLASS) return false;
    return MONSTER_SYMBOL[mnum] !== S_UNICORN
        || objectMaterial(object.otyp) === VEGGY
        || object.otyp === CORPSE && object.corpsenm === PM_LICHEN;
}

const PM_MONKEY = MONSTER_NAME.indexOf('monkey');
const PM_APE = MONSTER_NAME.indexOf('ape');
const PM_LICHEN = MONSTER_NAME.indexOf('lichen');

const VEGGY = 3;

const M2_MERC = 0x00000200;

// C mondata.h:is_mercenary()
export function is_mercenary(mnum: number): boolean {
    return ((MONSTER_FLAGS2[mnum] ?? 0) & M2_MERC) !== 0;
}

const M2_MALE = 0x00010000;

// C mondata.h:is_male()
export function is_male(mnum: number): boolean {
    return ((MONSTER_FLAGS2[mnum] ?? 0) & M2_MALE) !== 0;
}

const M2_NEUTER = 0x00040000;

// C mondata.h:is_neuter()
export function is_neuter(mnum: number): boolean {
    return ((MONSTER_FLAGS2[mnum] ?? 0) & M2_NEUTER) !== 0;
}

const M2_WANDER = 0x00800000;

// C mondata.h:is_wanderer()
export function is_wanderer(mnum: number): boolean {
    return ((MONSTER_FLAGS2[mnum] ?? 0) & M2_WANDER) !== 0;
}

const M2_PEACEFUL = 0x00200000;

// C mondata.h:always_peaceful()
export function always_peaceful(mnum: number, state: GameState = game): boolean {
    return (questMonsterFlags2(mnum, state) & M2_PEACEFUL) !== 0;
}

const M2_NASTY = 0x02000000;

// C mondata.h:extra_nasty()
export function extra_nasty(mnum: number, state: GameState = game): boolean {
    return (questMonsterFlags2(mnum, state) & M2_NASTY) !== 0;
}

const M2_STRONG = 0x04000000;

// C mondata.h:strongmonst()
export function strongmonst(mnum: number): boolean {
    return ((MONSTER_FLAGS2[mnum] ?? 0) & M2_STRONG) !== 0;
}

const M2_LORD = 0x00000400;

// C mondata.h:is_lord()
export function is_lord(mnum: number): boolean {
    return ((MONSTER_FLAGS2[mnum] ?? 0) & M2_LORD) !== 0;
}

const M2_PRINCE = 0x00000800;

// C mondata.h:is_prince()
export function is_prince(mnum: number): boolean {
    return ((MONSTER_FLAGS2[mnum] ?? 0) & M2_PRINCE) !== 0;
}

const M2_MINION = 0x00001000;

// C mondata.h:is_minion()
export function is_minion(mnum: number): boolean {
    return ((MONSTER_FLAGS2[mnum] ?? 0) & M2_MINION) !== 0;
}

const M2_GREEDY = 0x10000000;

// C mondata.h:likes_gold()
export function likes_gold(mnum: number): boolean {
    return ((MONSTER_FLAGS2[mnum] ?? 0) & M2_GREEDY) !== 0;
}

// C mondata.h:likes_gems()
export function likes_gems(mnum: number): boolean {
    return ((MONSTER_FLAGS2[mnum] ?? 0) & M2_JEWELS) !== 0;
}

const M2_MAGIC = 0x80000000;

// C mondata.h:likes_magic()
export function likes_magic(mnum: number): boolean {
    return ((MONSTER_FLAGS2[mnum] ?? 0) & M2_MAGIC) !== 0;
}

// C mondata.h:is_armed()
export function speciesHasWeaponAttack(mnum: number) {
    return (MONSTER_ATTACKS[mnum] || []).some(([attackType]) => attackType === AT_WEAP);
}

// C mondata.h:likes_objs()
export function likes_objs(mnum: number): boolean {
    return !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_COLLECT)
        || speciesHasWeaponAttack(mnum);
}

// C mondata.h:is_ndemon()
export function is_ndemon(mnum: number): boolean {
    return monsterIsDemon(mnum) && !is_lord(mnum) && !is_prince(mnum);
}

// C mondata.h:is_dlord()
export function is_dlord(mnum: number): boolean {
    return monsterIsDemon(mnum) && is_lord(mnum);
}

// C mondata.h:is_dprince()
export function is_dprince(mnum: number): boolean {
    return monsterIsDemon(mnum) && is_prince(mnum);
}

// C mondata.h:passes_rocks()
export function passes_rocks(mnum: number): boolean {
    return monsterPassesWalls(mnum) && !monsterIsUnsolid({ mnum });
}

// C mondata.h:eyecount()
export function eyecount(mnum: number): number {
    if (!monsterHasEyes(mnum)) return 0;
    return mnum === MONSTER_NAME.indexOf('Cyclops') || mnum === PM_FLOATING_EYE ? 1 : 2;
}

// C mondata.h:infravision()
export function infravision(mnum: number): number {
    return (MONSTER_FLAGS3[mnum] ?? 0) & 0x0100;
}

// C mondata.h:infravisible()
export function infravisible(mnum: number): number {
    return (MONSTER_FLAGS3[mnum] ?? 0) & 0x0200;
}

const M2_COLLECT = 0x40000000;

// C mondata.h:your_race()
export function your_race(mnum: number, state: GameState = game): boolean {
    return !!((MONSTER_FLAGS2[mnum] ?? 0) & (state.urace?.selfmask ?? 0));
}

// C mondata.h:race_hostile()
export function race_hostile(mnum: number, state: GameState = game): boolean {
    return !!((MONSTER_FLAGS2[mnum] ?? 0) & (state.urace?.hatemask ?? 0));
}

// C mondata.h:race_peaceful()
export function race_peaceful(mnum: number, state: GameState = game): boolean {
    return !!((MONSTER_FLAGS2[mnum] ?? 0) & (state.urace?.lovemask ?? 0));
}

// C mondata.h:grounded()
export function grounded(mnum: number, state: GameState = game): boolean {
    return !monsterIsFlyer(mnum) && !monsterIsFloater(mnum)
        && (!monsterIsClinger(mnum) || !levelHasCeiling(state));
}

// C mondata.h:cant_drown()
export function cant_drown(mnum: number): boolean {
    return monsterIsSwimmer(mnum) || monsterIsAmphibious(mnum) || monsterIsBreathless(mnum);
}

// C mondata.h:cantwield()
export function cantwield(mnum: number): boolean {
    return monsterHasNoHands(mnum) || monsterIsVerySmall(mnum);
}

// C mondata.h:cantweararm()
export function cantweararm(mnum: number): boolean {
    return monsterBreaksArmor(mnum) || monsterSlipsArmor(mnum);
}

// C mondata.h:could_twoweap()
export function could_twoweap(mnum: number): boolean {
    const attacks = MONSTER_ATTACKS[mnum];
    return Number(attacks?.[0]?.[0] === AT_WEAP)
        + Number(attacks?.[1]?.[0] === AT_WEAP)
        + Number(attacks?.[2]?.[0] === AT_WEAP) > 1;
}

// C mondata.h:eggs_in_water()
export function eggs_in_water(mnum: number): boolean {
    return lays_eggs(mnum) && MONSTER_SYMBOL[mnum] === S_EEL && monsterIsSwimmer(mnum);
}

const PM_CHICKATRICE = 9;

const PM_COCKATRICE = 10;

const PM_MEDUSA = 284;

export const PM_STONE_GOLEM = 257;

// C mondata.h:touch_petrifies():
export function touchPetrifies(mnum: number | undefined): mnum is typeof PM_CHICKATRICE | typeof PM_COCKATRICE {
    return mnum === PM_CHICKATRICE || mnum === PM_COCKATRICE;
}

// C mondata.h:flesh_petrifies():
export function fleshPetrifies(mnum: number | undefined): mnum is typeof PM_CHICKATRICE | typeof PM_COCKATRICE | typeof PM_MEDUSA {
    return touchPetrifies(mnum) || mnum === PM_MEDUSA;
}

// C youprop.h:Stone_resistance():
export function heroResistsStoning(state: GameState = game): boolean {
    return !!state.u?.stoneResistance;
}

// C mondata.c:poly_when_stoned(). Non-stone golems may change unless stone golems are genocided.
export function formCanBecomeStoneGolem(mnum: number | undefined, state: GameState = game): boolean {
    const stoneGolemGenocided = !!(
        (state.mvitals?.[PM_STONE_GOLEM]?.mvflags ?? 0) & G_GENOD
    );
    return mnum !== undefined && monsterIsGolem(mnum) && mnum !== PM_STONE_GOLEM
        && !stoneGolemGenocided;
}

// Part of C eat.c:cprefx(): the petrifying-meal gate for the hero.
export function heroWouldPetrifyFromFlesh(mnum: number | undefined, state: GameState = game): boolean {
    return fleshPetrifies(mnum)
        && !heroResistsStoning(state)
        && !(heroIsPolymorphed(state) && formCanBecomeStoneGolem(state.u?.umonnum, state));
}

// Port only: hero-versus-monster discriminator for shared combat code.
export function isHeroDefender(defender: Hero | Monster, state: GameState): defender is Hero {
    return defender === state.u;
}
