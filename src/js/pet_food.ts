// Pet food preferences and hazards. C refs: dog.c dogfood(), obj.h, mondata.h.
import { FOOD_CLASS, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS } from './objclass.js';
import { artifactById, artifactByName } from './artifacts.js';
import { G_GENOD, MAX_EGG_HATCH_TIME } from './const.js';
import { veganCorpse } from './food_traits.js';
import { requireGameLevel } from './gstate.js';
import { AD_POLY } from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import {
    AMULET_OF_STRANGULATION, APPLE, BANANA, CARROT, CLOVE_OF_GARLIC, CORPSE,
    EGG, ENORMOUS_MEATBALL, GLOB_OF_GREEN_SLIME, LUMP_OF_ROYAL_JELLY, MEATBALL,
    MEAT_RING, MEAT_STICK, RIN_SLOW_DIGESTION, SLIME_MOLD, TIN, TRIPE_RATION,
} from './object_data.js';
import { objectMaterial } from './o_init.js';
import { objectIsMetallic, objectIsOrganic, objectIsRustprone } from './object_properties.js';
import { objectResistsDestruction } from './zap.js';
import { fleshPetrifies } from './stoning.js';
import type { GameState } from './game_state.js';
import type { MonsterCallLog, RandomBelow } from './monster_action_types.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import {
    sameMonsterRace, monsterHasAcidResistance, monsterHasPoisonResistance, monsterHasStoneResistance,
    carnivorous, herbivorous, monsterHasEyes, metallivorous, acidic, poisonous, is_elf, is_shapeshifter,
    monsterHatesSilver, monsterIsHumanoid, monsterIsNoncorporeal, monsterIsRider, monsterIsUndead,
    monsterIsVampireShifter,
} from './mondata.js';

export const DOGFOOD = 0;
export const CADAVER = 1;
export const ACCFOOD = 2;
export const MANFOOD = 3;
export const APPORT = 4;
export const POISON = 5;
export const UNDEF = 6;
export const TABU = 7;
export type FoodQuality = typeof DOGFOOD | typeof CADAVER | typeof ACCFOOD
    | typeof MANFOOD | typeof APPORT | typeof POISON | typeof UNDEF | typeof TABU;

const SILVER = 14;

const S_KOBOLD = 11, S_ORC = 15, S_FUNGUS = 32, S_OGRE = 41, S_YETI = 51;
const PM_GHOUL = MONSTER_NAME.indexOf('ghoul');
const PM_KILLER_BEE = MONSTER_NAME.indexOf('killer bee');
const PM_QUEEN_BEE = MONSTER_NAME.indexOf('queen bee');
const PM_LIZARD = MONSTER_NAME.indexOf('lizard');
const PM_LICHEN = MONSTER_NAME.indexOf('lichen');
const PM_PYROLISK = MONSTER_NAME.indexOf('pyrolisk');
const PM_GREEN_SLIME = MONSTER_NAME.indexOf('green slime');
const PM_RUST_MONSTER = MONSTER_NAME.indexOf('rust monster');
const PM_GELATINOUS_CUBE = MONSTER_NAME.indexOf('gelatinous cube');
const FLAMING_SPECIES = new Set(['fire vortex', 'flaming sphere', 'fire elemental', 'salamander']
    .map(name => MONSTER_NAME.indexOf(name)));

// Lower ranks are preferred. TABU forbids eating or fetching; UNDEF is merely
// unsuitable. The object resistance check belongs here even for ordinary food.
export function dogFood(
    monster: Monster, object: GameObject, random: RandomBelow,
    calls: MonsterCallLog, state: GameState,
): FoodQuality {
    // C stores weapon poison and a container's trap in the same bit.
    if ((object.opoisoned || object.otrapped) && !monsterHasPoisonResistance(monster)) return POISON;
    const artifact = artifactById(object.oartifact, state);
    const questArtifact = artifactByName(state.urole?.artifactName, state);
    if ((artifact !== null && artifact.id === questArtifact?.id)
        || objectResistsDestruction(object, 0, 95, range => {
            calls.push(range);
            return random(range);
        })) return object.cursed ? TABU : APPORT;

    if (object.oclass === ROCK_CLASS) return UNDEF;

    if (object.oclass === FOOD_CLASS) return foodQuality(monster, object, state);
    return nonfoodQuality(monster, object, state);
}

function foodQuality(monster: Monster, object: GameObject, state: GameState): FoodQuality {
    const carni = carnivorous(monster.mnum), herbi = herbivorous(monster.mnum);
    const flesh = [CORPSE, TIN, EGG].includes(object.otyp) ? object.corpsenm : undefined;
    if (object.otyp === CORPSE && flesh !== undefined && monsterIsRider({ mnum: flesh }))
        return TABU;
    if ((object.otyp === CORPSE || object.otyp === EGG)
        && fleshPetrifies(flesh) && !monsterHasStoneResistance(monster)) return POISON;
    if (object.otyp === LUMP_OF_ROYAL_JELLY && monster.mnum === PM_KILLER_BEE) {
        const queenGenocided = !!((state.mvitals?.[PM_QUEEN_BEE]?.mvflags ?? 0) & G_GENOD);
        const queenPresent = !queenGenocided && requireGameLevel(state).monsters.some(
            other => other.mnum === PM_QUEEN_BEE && other.mhp > 0);
        return queenPresent ? TABU : DOGFOOD;
    }
    if (!carni && !herbi) return object.cursed ? UNDEF : APPORT;
    const starving = !!(monster.mtame && !monster.isminion && monster.edog?.mhpmax_penalty);
    const blindWithEyes = !monster.mcansee && monsterHasEyes(monster.mnum);
    if (monster.mnum === PM_GHOUL) return ghoulFood(object, flesh, starving, state);

    switch (object.otyp) {
    case TRIPE_RATION:
    case MEATBALL:
    case MEAT_RING:
    case MEAT_STICK:
    case ENORMOUS_MEATBALL:
        return carni ? DOGFOOD : MANFOOD;
    case EGG:
        if (flesh === PM_PYROLISK && !FLAMING_SPECIES.has(monster.mnum)) return POISON;
        return carni ? CADAVER : MANFOOD;
    case CORPSE:
        return corpseQuality(monster, object, flesh, starving, carni, herbi, state);
    case GLOB_OF_GREEN_SLIME:
        return starving || monster.mnum === PM_GREEN_SLIME
            || FLAMING_SPECIES.has(monster.mnum) || monsterIsNoncorporeal(monster)
            ? ACCFOOD : POISON;
    case CLOVE_OF_GARLIC:
        if (monsterIsUndead(monster.mnum) || monsterIsVampireShifter(monster)) return TABU;
        return herbi || starving ? ACCFOOD : MANFOOD;
    case TIN:
        return metallivorous(monster.mnum) ? ACCFOOD : MANFOOD;
    case APPLE:
        return herbi ? DOGFOOD : starving ? ACCFOOD : MANFOOD;
    case CARROT:
        return herbi || blindWithEyes ? DOGFOOD : starving ? ACCFOOD : MANFOOD;
    case BANANA:
        if (MONSTER_SYMBOL[monster.mnum] === S_YETI && herbi) return DOGFOOD;
        return herbi || starving ? ACCFOOD : MANFOOD;
    default:
        if (starving) return ACCFOOD;
        return object.otyp > SLIME_MOLD
            ? carni ? ACCFOOD : MANFOOD
            : herbi ? ACCFOOD : MANFOOD;
    }
}

function ghoulFood(object: GameObject, flesh: number | undefined, starving: boolean, state: GameState): FoodQuality {
    if (object.otyp === CORPSE) {
        if (oldCorpse(object, state)) return DOGFOOD;
        return starving && !veganCorpse(flesh) ? ACCFOOD : POISON;
    }
    if (object.otyp === EGG) {
        if (state.moves - object.age > 2 * MAX_EGG_HATCH_TIME) return CADAVER;
        return starving ? ACCFOOD : POISON;
    }
    return TABU;
}

function corpseQuality(
    monster: Monster, object: GameObject, flesh: number | undefined,
    starving: boolean, carni: boolean, herbi: boolean, state: GameState,
): FoodQuality {
    if ((oldCorpse(object, state) && MONSTER_SYMBOL[monster.mnum] !== S_FUNGUS)
        || (acidic(flesh ?? -1) && !monsterHasAcidResistance(monster))
        || (poisonous(flesh ?? -1) && !monsterHasPoisonResistance(monster))) return POISON;
    if (flesh !== undefined && (monster.mtame ?? 0) > 1 && !starving
        && (is_shapeshifter(flesh)
            || MONSTER_ATTACKS[flesh]?.some(([, damage]) => damage === AD_POLY))) return MANFOOD;
    if (veganCorpse(flesh)) return herbi ? CADAVER : MANFOOD;
    if (flesh !== undefined && MONSTER_FLAGS1[flesh] !== undefined
        && monsterIsHumanoid(monster.mnum) && sameMonsterRace(monster.mnum, flesh)
        && !monsterIsUndead(monster.mnum)
        && ![S_KOBOLD, S_ORC, S_OGRE].includes(MONSTER_SYMBOL[flesh] ?? 0)) {
        const elf = is_elf(monster.mnum);
        return starving && carni && !elf ? ACCFOOD : TABU;
    }
    return carni ? CADAVER : MANFOOD;
}

function oldCorpse(object: GameObject, state: GameState): boolean {
    // Ice slows decay without changing the object's timers or stored age.
    const age = object.on_ice
        ? object.age + Math.trunc((state.moves - object.age) / 2) : object.age;
    return age + 50 <= state.moves
        && object.corpsenm !== PM_LIZARD && object.corpsenm !== PM_LICHEN;
}

function nonfoodQuality(monster: Monster, object: GameObject, state: GameState): FoodQuality {
    if (object.otyp === AMULET_OF_STRANGULATION || object.otyp === RIN_SLOW_DIGESTION) return TABU;
    const material = objectMaterial(object, state);
    if (monsterHatesSilver(monster) && material === SILVER) return TABU;
    if (monster.mnum === PM_GELATINOUS_CUBE && objectIsOrganic(object, state)) return ACCFOOD;
    if (metallivorous(monster.mnum) && objectIsMetallic(object, state)
        && (objectIsRustprone(object, state) || monster.mnum !== PM_RUST_MONSTER)) {
        return objectIsRustprone(object, state) && !object.oerodeproof ? DOGFOOD : ACCFOOD;
    }
    return !object.cursed && object.oclass !== BALL_CLASS && object.oclass !== CHAIN_CLASS
        ? APPORT : UNDEF;
}
