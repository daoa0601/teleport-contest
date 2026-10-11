// C monmove.c:mon_would_take_item() and muse.c:searches_for_item().
// Wanting an item is separate from can_carry()/can_touch_safely(): callers
// must still check whether the monster can reach, touch, and carry it.
import { MFAST, W_ARMG, ismnum } from './const.js';
import type { PlayingGameState } from './game_state.js';
import { speciesCanBlow } from './monster_anatomy.js';
import { AT_GAZE } from './monster_attack_types.js';
import type { MonsterCallLog, RandomBelow } from './monster_action_types.js';
import { currentMonsterLoad, maxMonsterLoad } from './monster_carry.js';
import {
    MONSTER_ATTACKS, MONSTER_DIFFICULTY, MONSTER_FLAGS1, MONSTER_FLAGS2,
    MONSTER_HAS_WEAPON_ATTACK, MONSTER_NAME, MONSTER_SYMBOL,
    monsterIsAnimal, monsterIsMindless, monsterIsNonliving,
    monsterIsUnicorn, monsterIsVampireShifter,
} from './monster_data.js';
import { monsterIsScaredAt } from './monster_fear.js';
import { monsterHasStoneResistance } from './monster_resistance.js';
import { curesStoning, monsterCanOpenTin } from './monster_stoning_cure.js';
import type { Monster } from './monster_types.js';
import {
    AMULET_OF_GUARDING, AMULET_OF_LIFE_SAVING, AMULET_OF_REFLECTION,
    BAG_OF_HOLDING, BAG_OF_TRICKS, BOULDER, CORPSE, EGG, EXPENSIVE_CAMERA,
    FIRE_HORN, FROST_HORN, GOLD_PIECE, LARGE_BOX, OBJECT_DIR, PICK_AXE,
    POT_ACID, POT_BLINDNESS, POT_CONFUSION, POT_EXTRA_HEALING, POT_FULL_HEALING,
    POT_GAIN_LEVEL, POT_HEALING, POT_INVISIBILITY, POT_PARALYSIS, POT_POLYMORPH,
    POT_SLEEPING, POT_SPEED, SCR_CREATE_MONSTER, SCR_EARTH, SCR_FIRE,
    SCR_TELEPORTATION, TIN, UNICORN_HORN, WAN_CREATE_MONSTER, WAN_DIGGING,
    WAN_MAKE_INVISIBLE, WAN_POLYMORPH, WAN_SPEED_MONSTER, WAN_STRIKING,
    WAN_TELEPORTATION, WAN_UNDEAD_TURNING,
} from './object_data.js';
import { objectMaterial } from './object_material.js';
import type { GameObject } from './object_types.js';
import { ACCFOOD, MANFOOD, dogFood } from './pet_food.js';
import { touchPetrifies } from './stoning.js';

const WEAPON_CLASS = 2, ARMOR_CLASS = 3, RING_CLASS = 4, AMULET_CLASS = 5;
const TOOL_CLASS = 6, FOOD_CLASS = 7, POTION_CLASS = 8, SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10, WAND_CLASS = 11, GEM_CLASS = 13, ROCK_CLASS = 14, BALL_CLASS = 15;
const GEMSTONE = 20, MINERAL = 21, RAY = 3;
const M1_NEEDPICK = 0x40;
const M2_ROCKTHROW = 0x08000000, M2_GREEDY = 0x10000000;
const M2_JEWELS = 0x20000000, M2_COLLECT = 0x40000000, M2_MAGIC = 0x80000000;
const S_EYE = 5, S_LIGHT = 25;
const PM_GHOST = MONSTER_NAME.indexOf('ghost');
const PM_KI_RIN = MONSTER_NAME.indexOf('ki-rin');
const PM_GELATINOUS_CUBE = MONSTER_NAME.indexOf('gelatinous cube');
const CORPSE_EATERS = new Set(['purple worm', 'baby purple worm', 'ghoul', 'piranha']
    .map(name => MONSTER_NAME.indexOf(name)));

export function speciesEatsCorpses(species: number): boolean {
    return CORPSE_EATERS.has(species);
}

export function monsterWantsFloorObject(
    monster: Monster, object: GameObject, state: PlayingGameState,
): boolean {
    const loadPercent = Math.trunc(currentMonsterLoad(monster) * 100 / maxMonsterLoad(monster));
    if (object === state.uball || object === state.uchain) return false;
    if (monster.mtame && object.cursed) return false;
    const material = objectMaterial(object, state);
    if (monsterIsUnicorn(monster.mnum) && material !== GEMSTONE) return false;
    if (!monsterIsMindless(monster.mnum) && !monsterIsAnimal(monster)
        && loadPercent < 75 && monsterSearchesForItem(monster, object, state)) return true;

    const flags = MONSTER_FLAGS2[monster.mnum] ?? 0;
    if ((flags & M2_GREEDY) && object.otyp === GOLD_PIECE && loadPercent < 95) return true;
    if ((flags & M2_JEWELS) && object.oclass === GEM_CLASS
        && material !== MINERAL && loadPercent < 85) return true;
    if (((flags & M2_COLLECT) || MONSTER_HAS_WEAPON_ATTACK.has(monster.mnum))
        && [WEAPON_CLASS, ARMOR_CLASS, GEM_CLASS, FOOD_CLASS].includes(object.oclass)
        && loadPercent < 75) return true;
    if ((flags & M2_MAGIC)
        && [AMULET_CLASS, POTION_CLASS, SCROLL_CLASS, WAND_CLASS, RING_CLASS, SPBOOK_CLASS].includes(object.oclass)
        && loadPercent < 85) return true;
    if ((flags & M2_ROCKTHROW) && object.otyp === BOULDER
        && loadPercent < 50 && !state.level.flags.sokoban_rules) return true;
    return monster.mnum === PM_GELATINOUS_CUBE && object.oclass !== ROCK_CLASS
        && object.oclass !== BALL_CLASS
        && !(object.otyp === CORPSE && touchPetrifies(object.corpsenm));
}

// Eating a floor object does not require room to carry it. The final safe
// touch check remains the caller's responsibility, including for Rider corpses.
export function monsterWouldConsumeItem(
    monster: Monster, object: GameObject, state: PlayingGameState,
    random: RandomBelow, calls: MonsterCallLog = [],
): boolean {
    if (object.otyp === CORPSE && !touchPetrifies(object.corpsenm)
        && speciesEatsCorpses(monster.mnum)) return true;
    const pet = monster.edog ?? monster.mextra?.edog;
    if (!monster.mtame || !pet) return false;
    const food = dogFood(monster, object, random, calls, state);
    return food < MANFOOD && (food < ACCFOOD || pet.hungrytime <= state.moves);
}

export function monsterSearchesForItem(
    monster: Monster, object: GameObject, state: PlayingGameState,
): boolean {
    if (object.where === 'floor' && object.ox === monster.mx && object.oy === monster.my
        && monsterIsScaredAt(monster, state, object.ox, object.oy)) return false;
    if (monsterIsAnimal(monster) || monsterIsMindless(monster.mnum) || monster.mnum === PM_GHOST)
        return false;

    const type = object.otyp;
    const gaze = (MONSTER_ATTACKS[monster.mnum] ?? []).some(attack => attack[0] === AT_GAZE);
    // These two decisions precede the charged-wand check in native code.
    if (type === WAN_MAKE_INVISIBLE || type === POT_INVISIBILITY)
        return !monster.minvis && !monster.invis_blkd && !gaze;
    if (type === WAN_SPEED_MONSTER || type === POT_SPEED) return monster.mspeed !== MFAST;

    switch (object.oclass) {
    case WAND_CLASS:
        if (object.spe <= 0) return false;
        if (type === WAN_DIGGING)
            return MONSTER_SYMBOL[monster.mnum] !== S_EYE && MONSTER_SYMBOL[monster.mnum] !== S_LIGHT;
        if (type === WAN_POLYMORPH) return (MONSTER_DIFFICULTY[monster.mnum] ?? 0) < 6;
        return OBJECT_DIR[type] === RAY || type === WAN_STRIKING || type === WAN_UNDEAD_TURNING
            || type === WAN_TELEPORTATION || type === WAN_CREATE_MONSTER;
    case POTION_CLASS:
        return [POT_HEALING, POT_EXTRA_HEALING, POT_FULL_HEALING, POT_POLYMORPH, POT_GAIN_LEVEL,
            POT_PARALYSIS, POT_SLEEPING, POT_ACID, POT_CONFUSION].includes(type)
            || (type === POT_BLINDNESS && !gaze);
    case SCROLL_CLASS:
        return [SCR_TELEPORTATION, SCR_CREATE_MONSTER, SCR_EARTH, SCR_FIRE].includes(type);
    case AMULET_CLASS:
        if (type === AMULET_OF_LIFE_SAVING)
            return !monsterIsNonliving(monster.mnum) && !monsterIsVampireShifter(monster);
        return type === AMULET_OF_REFLECTION || type === AMULET_OF_GUARDING;
    case TOOL_CLASS:
        if (type === PICK_AXE) return !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NEEDPICK);
        if (type === UNICORN_HORN)
            return !object.cursed && !monsterIsUnicorn(monster.mnum) && monster.mnum !== PM_KI_RIN;
        if (type === FROST_HORN || type === FIRE_HORN) return object.spe > 0 && speciesCanBlow(monster.mnum);
        // Is_container includes the bag of tricks even though it cannot be
        // opened by the hero's ordinary container interaction.
        if (type >= LARGE_BOX && type <= BAG_OF_TRICKS)
            return !object.olocked && !((type === BAG_OF_HOLDING || type === BAG_OF_TRICKS) && object.cursed);
        return type === EXPENSIVE_CAMERA && object.spe > 0;
    case FOOD_CLASS:
        if (type === CORPSE)
            return (!!((monster.misc_worn_check ?? 0) & W_ARMG) && touchPetrifies(object.corpsenm))
                || (!monsterHasStoneResistance(monster) && curesStoning(monster, object, false));
        if (type === TIN)
            return monsterCanOpenTin(monster) && !monsterHasStoneResistance(monster)
                && curesStoning(monster, object, true);
        return type === EGG && object.corpsenm !== undefined && ismnum(object.corpsenm)
            && touchPetrifies(object.corpsenm);
    default:
        return false;
    }
}

