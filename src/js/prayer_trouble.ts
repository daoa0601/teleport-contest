// C pray.c:in_trouble(), worst_cursed_item(), and fix_worst_trouble().

import { reportHeroEncumbrance } from './encumbrance.js';
import { formatFeltMessage } from './hero_speech.js';
import { isPoolOrLavaAt } from './terrain_properties.js';
import { makeConfused, makeHallucinated, makeStunned } from './hero_mental_status.js';
import { ringRemovalObstacle } from './accessory.js';
import { simpleArmorName } from './armor.js';
import { heroEyeCount, heroEyeName, heroStomachName } from './body_parts.js';
import {
    A_STR, DISSOLVED, EXT_ENCUMBER, HUNGRY, HVY_ENCUMBER, IS_OBSTRUCTED,
    PLNMSG_OBJ_GLOWS, SCORR, SDOOR, TT_BURIEDBALL, TT_LAVA, Upolyd, WEAK, W_SADDLE, isok,
} from './const.js';
import { displayColorName, docrt, plineWithContinuation as pline } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { confersLuck } from './hero_inventory.js';
import { announceTerrainRescue } from './hack.js';
import { adjustObjectLightAfterBlessing, objectLightRadius } from './light.js';
import { cureHeroSickness, heroIsSick } from './hero_illness.js';
import { healHeroLegs } from './hero_legs.js';
import { clearHeroStrangulation, heroIsStrangled } from './hero_strangulation.js';
import { clearHeroTrap, freeHeroFromBuriedBall } from './hero_traps.js';
import { currentHungerState, restoreHeroNutrition } from './hunger.js';
import { consumeInventoryItem } from './invent.js';
import { AD_BLND, AT_ENGL } from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS2, requireMonsterData } from './monster_data.js';
import {
    AMULET_OF_STRANGULATION, AMULET_OF_UNCHANGING, BOULDER, FUMBLE_BOOTS,
    GAUNTLETS_OF_FUMBLING, HELM_OF_OPPOSITE_ALIGNMENT, LEVITATION_BOOTS,
    LOADSTONE, OBJECT_BIMANUAL, OBJECT_NAMES,
} from './object_data.js';
import { makePlural } from './object_grammar.js';
import { ownedObjectAction } from './objnam.js';
import { uncurseObjectState } from './object_state.js';
import { heroHasNoHands, heroIsUnchanging, returnHeroToHumanForm } from './polyself.js';
import { hasIntrinsicProperty, refreshProperty } from './properties.js';
import { unpunishHero } from './punishment.js';
import { heroIsInDangerousRegion, rescueHeroFromRegion } from './regions.js';
import { d, rnd } from './rng.js';
import {
    blindfolded, heroIsBlind, heroIsBlinded, heroIsDeaf, heroIsHallucinating,
    permanentBlind, setHeroBlindnessTurns, syncDeafness,
} from './senses.js';
import { clearHeroSliming, heroIsSliming } from './slime.js';
import { clearHeroPetrification, heroIsPetrifying } from './stoning.js';
import { teleportHeroSafely } from './teleport.js';
import { isWeldedPrimary } from './weapon_slots.js';
import { heroHasFreeHand } from './weapon_type.js';
import { nearCapacity } from './weight.js';
import { purifyHeroLycanthropy } from './were.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { AttributeIndex } from './attrib.js';

const attributeIndices: readonly AttributeIndex[] = [0, 1, 2, 3, 4, 5];

// Positive values are urgent. The order below follows in_trouble().
export const Trouble = {
    STONED: 14, SLIMED: 13, STRANGLED: 12, LAVA: 11, SICK: 10,
    STARVING: 9, REGION: 8, HIT: 7, LYCANTHROPE: 6, COLLAPSING: 5,
    WALL: 4, LEVITATION: 3, HANDS: 2, BLINDFOLD: 1,
    PUNISHED: -1, FUMBLING: -2, CURSED_ITEM: -3, SADDLE: -4, BLIND: -5,
    POISONED: -6, LEGS: -7, HUNGRY: -8, STUNNED: -9, CONFUSED: -10,
    HALLUCINATING: -11,
} as const;
export type PrayerTrouble = typeof Trouble[keyof typeof Trouble] | 0;
const RIN_LEVITATION = OBJECT_NAMES.indexOf('levitation');
const RIN_SUSTAIN_ABILITY = OBJECT_NAMES.indexOf('sustain ability');
const M2_ROCKTHROW = 0x08000000;

export function worstPrayerTrouble(state: GameState = game): PrayerTrouble {
    requirePlayingGame(state);
    const hero = state.u;
    if (heroIsPetrifying(state)) return Trouble.STONED;
    if (heroIsSliming(state)) return Trouble.SLIMED;
    if (heroIsStrangled(state)) return Trouble.STRANGLED;
    if (hero.utrap && hero.utraptype === TT_LAVA) return Trouble.LAVA;
    if (heroIsSick(state)) return Trouble.SICK;
    const hunger = currentHungerState(state);
    if (hunger >= WEAK) return Trouble.STARVING;
    if (heroIsInDangerousRegion(state)) return Trouble.REGION;
    if ((!Upolyd(hero) || heroIsUnchanging(state)) && criticallyLowHp(false, state))
        return Trouble.HIT;
    if (Number.isInteger(hero.ulycn) && hero.ulycn >= 0) return Trouble.LYCANTHROPE;
    if (nearCapacity(state) >= EXT_ENCUMBER
        && hero.amax.a[A_STR] - hero.acurr.a[A_STR] > 3) return Trouble.COLLAPSING;
    if (heroIsSurroundedByRock(state)) return Trouble.WALL;
    if (cursedType(state.uarmf, LEVITATION_BOOTS)
        || ringRemovalObstacle(state.uleft, RIN_LEVITATION, state)
        || ringRemovalObstacle(state.uright, RIN_LEVITATION, state)) return Trouble.LEVITATION;
    if (heroHasNoHands(state) || !heroHasFreeHand(state)) {
        if (isWeldedPrimary(state.uwep, state)) return Trouble.HANDS;
        if (Upolyd(hero) && heroHasNoHands(state)
            && (!heroIsUnchanging(state)
                || cursedType(state.uamul, AMULET_OF_UNCHANGING))) return Trouble.HANDS;
    }
    if (blindfolded(state) && state.ublindf?.cursed) return Trouble.BLINDFOLD;
    if (state.uball || hero.utrap && hero.utraptype === TT_BURIEDBALL) return Trouble.PUNISHED;
    if (cursedType(state.uarmg, GAUNTLETS_OF_FUMBLING)
        || cursedType(state.uarmf, FUMBLE_BOOTS)) return Trouble.FUMBLING;
    if (worstCursedItem(state)) return Trouble.CURSED_ITEM;
    if (saddle(state)?.cursed) return Trouble.SADDLE;
    const swallower = hero.ustuck;
    if (hero.uswallow && !swallower) throw new Error('A swallowed hero has no swallowing monster');
    const blindingSwallower = hero.uswallow && swallower && (MONSTER_ATTACKS[swallower.mnum] || [])
        .some(([attack, damage]) => attack === AT_ENGL && damage === AD_BLND);
    if ((hero.blindTurns ?? 0) > 1 && !permanentBlind(state)
        && !hasIntrinsicProperty('blinded', null, state) && !blindingSwallower
        || (hero.deafTurns ?? 0) > 1) return Trouble.BLIND;
    if (attributeIndices.some(index => hero.acurr.a[index] < hero.amax.a[index])) return Trouble.POISONED;
    if ((hero._woundedLegTurns ?? 0) > 0 && !hero.usteed) return Trouble.LEGS;
    if (hunger >= HUNGRY) return Trouble.HUNGRY;
    if ((hero.stunnedTurns ?? 0) > 0) return Trouble.STUNNED;
    if ((hero.confusionTurns ?? 0) > 0) return Trouble.CONFUSED;
    if ((hero.hallucinationTurns ?? 0) > 0) return Trouble.HALLUCINATING;
    return 0;
}

export function criticallyLowHp(onlyIfInjured = false, state: GameState = game) {
    requirePlayingGame(state);
    const hero = state.u;
    const hp = Upolyd(hero) ? hero.mh : hero.uhp;
    let maximum = Upolyd(hero) ? hero.mhmax : hero.uhpmax;
    if (onlyIfInjured && hp >= maximum) return false;
    maximum = Math.min(maximum, 15 * hero.ulevel);
    const level = hero.ulevel;
    const divisor = level <= 5 ? 5 : level <= 13 ? 6 : level <= 21 ? 7 : level <= 29 ? 8 : 9;
    return hp <= 5 || hp * divisor <= maximum;
}

export function worstCursedItem(state: GameState = game): GameObject | null {
    requirePlayingGame(state);
    if (nearCapacity(state) >= HVY_ENCUMBER) {
        const stone = state.inventory.find(object => cursedType(object, LOADSTONE));
        if (stone) return stone;
    }
    const weapon = state.uwep;
    const welded = weapon && isWeldedPrimary(weapon, state) ? weapon : null;
    if (welded && (state.uright || OBJECT_BIMANUAL[welded.otyp])) return welded;
    for (const slot of ['uarmg', 'uarms', 'uarmc', 'uarm', 'uarmh', 'uarmf',
        'uarmu', 'uamul', 'uleft', 'uright', 'ublindf'] as const) {
        const object = state[slot];
        if (object?.cursed && !(slot === 'uarmh' && object.otyp === HELM_OF_OPPOSITE_ALIGNMENT))
            return object;
    }
    if (welded) return welded;
    if (state.u.twoweap && state.uswapwep?.cursed) return state.uswapwep;
    return state.inventory.find(object => object.cursed
        && (object.otyp === LOADSTONE || confersLuck(object, state))) || null;
}

export function heroIsSurroundedByRock(state: GameState = game) {
    requirePlayingGame(state);
    if (state.u.passesWalls) return false;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (!dx && !dy) continue;
            const x = state.u.ux + dx, y = state.u.uy + dy;
            if (!isok(x, y)) continue;
            const type = state.level.requireAt(x, y).typ;
            if (IS_OBSTRUCTED(type) && type !== SDOOR && type !== SCORR) continue;
            if (blockedByBoulders(dx, dy, state)
                && !(requireMonsterData(MONSTER_FLAGS2, state.u.umonnum) & M2_ROCKTHROW)) continue;
            return false;
        }
    }
    return true;
}

function blockedByBoulders(dx: number, dy: number, state: PlayingGameState) {
    const hero = state.u;
    const bouldersAt = (x: number, y: number) => (state.level.objects[x]?.[y] || [])
        .filter(object => object.otyp === BOULDER)
        .reduce((count, object) => count + object.quan, 0);
    const count = bouldersAt(hero.ux + dx, hero.uy + dy);
    if (!count) return false;
    const x = hero.ux + 2 * dx, y = hero.uy + 2 * dy;
    const type = isok(x, y) ? state.level.requireAt(x, y).typ : null;
    if (count > 1 && !(count === 2 && type !== null && isPoolOrLavaAt(x, y, state))) return true;
    if (dx && dy && state.level.flags.sokoban_rules) return true;
    return type === null || IS_OBSTRUCTED(type) || bouldersAt(x, y) > 0;
}

function cursedType(object: GameObject | null | undefined, type: number): boolean {
    return object?.otyp === type && !!object.cursed;
}

function saddle(state: GameState) {
    return state.u.usteed?.minvent?.find(object => (object.owornmask ?? 0) & W_SADDLE);
}

export async function uncursePrayerObject(object: GameObject, label: string | null = null, state: GameState = game) {
    requirePlayingGame(state);
    if (object === state.uarmg && (state.u.glibTurns ?? 0) > 0) {
        state.u.glibTurns = 0;
        refreshProperty('glib', state);
        await pline(`Your ${simpleArmorName(object, 'uarmg', state)} are no longer slippery.`);
        if (!object.cursed) return;
    }
    const blindfoldOnly = object === state.ublindf && blindfolded(state)
        && !heroIsBlinded(state);
    if (!heroIsBlind(state) || blindfoldOnly) {
        const subject = label || ownedObjectAction(object, 'softly glow', state);
        await pline(`${subject} ${displayColorName('amber')}.`);
        state._lastPlineKind = PLNMSG_OBJ_GLOWS;
        object.bknown = !heroIsHallucinating(state);
    }
    const oldLight = objectLightRadius(object, state);
    uncurseObjectState(object, state);
    await adjustObjectLightAfterBlessing(object, oldLight, state);
}

export async function fixPrayerTrouble(trouble: PrayerTrouble, state: GameState = game) {
    requirePlayingGame(state);
    const hero = state.u;
    let object: GameObject | null | undefined;
    switch (trouble) {
    case 0: return;
    case Trouble.STONED:
        clearHeroPetrification(state);
        await pline('You feel more limber.');
        return;
    case Trouble.SLIMED:
        clearHeroSliming(state);
        await pline('The slime disappears.');
        return;
    case Trouble.STRANGLED:
        if (state.uamul?.otyp === AMULET_OF_STRANGULATION) {
            await pline('Your amulet vanishes!');
            await consumeInventoryItem(state.uamul, state);
        }
        await pline('You can breathe again.');
        clearHeroStrangulation(state);
        return;
    case Trouble.LAVA:
        if (!await teleportHeroSafely()) clearHeroTrap(state);
        await announceTerrainRescue(DISSOLVED, state);
        return;
    case Trouble.STARVING:
    case Trouble.HUNGRY:
        await pline(`Your ${heroStomachName(state)} feels content.`);
        await restoreHeroNutrition(state, pline);
        state.context.botl = true;
        return;
    case Trouble.SICK:
        await pline(formatFeltMessage('better.', state));
        cureHeroSickness(state);
        return;
    case Trouble.REGION:
        await rescueHeroFromRegion(state);
        return;
    case Trouble.HIT:
        await pline(formatFeltMessage('much better.', state));
        if (Upolyd(hero)) {
            hero.mhmax = Math.max(6, hero.mhmax + rnd(5));
            hero.mh = hero.mhmax;
        }
        if (hero.uhpmax < hero.ulevel * 5 + 11) hero.uhpmax += rnd(5);
        hero.uhpmax = Math.max(6, hero.uhpmax);
        hero.uhppeak = Math.max(hero.uhppeak || 0, hero.uhpmax);
        hero.uhp = hero.uhpmax;
        state.context.botl = true;
        return;
    case Trouble.COLLAPSING:
        await pline(formatFeltMessage(`${hero.amax.a[A_STR] - hero.acurr.a[A_STR] > 6 ? 'much ' : ''}stronger.`, state));
        hero.acurr.a[A_STR] = hero.amax.a[A_STR];
        state.context.botl = true;
        object = ringRemovalObstacle(state.uleft, RIN_SUSTAIN_ABILITY, state)
            || ringRemovalObstacle(state.uright, RIN_SUSTAIN_ABILITY, state);
        if (object) await uncursePrayerObject(requirePrayerObject(object), ringGlow(object, state), state);
        return;
    case Trouble.WALL:
        if (await teleportHeroSafely()) await pline('Your surroundings change.');
        else {
            hero.passesWallsTurns = d(4, 4) + 4;
            refreshProperty('passesWalls', state);
            await pline(formatFeltMessage('much slimmer.', state));
        }
        return;
    case Trouble.LEVITATION:
        object = cursedType(state.uarmf, LEVITATION_BOOTS) ? state.uarmf
            : ringRemovalObstacle(state.uleft, RIN_LEVITATION, state)
                || ringRemovalObstacle(state.uright, RIN_LEVITATION, state);
        await uncursePrayerObject(requirePrayerObject(object), ringGlow(object, state), state);
        return;
    case Trouble.HANDS:
        if (isWeldedPrimary(state.uwep, state)) await uncursePrayerObject(requirePrayerObject(state.uwep), null, state);
        else if (heroIsUnchanging(state)) await uncursePrayerObject(requirePrayerObject(state.uamul), null, state);
        else {
            await pline('Your shape becomes uncertain.');
            await returnHeroToHumanForm(state);
        }
        return;
    case Trouble.BLINDFOLD:
        await uncursePrayerObject(requirePrayerObject(state.ublindf), null, state);
        return;
    case Trouble.LYCANTHROPE:
        await purifyHeroLycanthropy({ state });
        return;
    case Trouble.PUNISHED:
        await pline('Your chain disappears.');
        if (hero.utrap && hero.utraptype === TT_BURIEDBALL) await freeHeroFromBuriedBall(state);
        else await unpunishHero(state);
        return;
    case Trouble.FUMBLING:
        object = cursedType(state.uarmg, GAUNTLETS_OF_FUMBLING) ? state.uarmg : state.uarmf;
        await uncursePrayerObject(requirePrayerObject(object), null, state);
        return;
    case Trouble.CURSED_ITEM:
        object = worstCursedItem(state);
        await uncursePrayerObject(requirePrayerObject(object), ringGlow(object, state), state);
        return;
    case Trouble.POISONED: {
        await pline(heroIsHallucinating(state) ? "There's a tiger in your tank." : formatFeltMessage('in good health again.', state));
        for (const index of attributeIndices)
            hero.acurr.a[index] = Math.max(hero.acurr.a[index], hero.amax.a[index]);
        state.context.botl = true;
        await reportHeroEncumbrance(state, pline);
        return;
    }
    case Trouble.BLIND: {
        let message = '';
        // C tests Blinded (any non-blocked blindness, not just its timeout)
        // when reporting that the eyes recover alongside cured deafness.
        if (heroIsBlinded(state)) {
            state.context.botl = true;
            const singleEye = heroEyeCount(state) === 1;
            const eyes = singleEye ? heroEyeName(state) : makePlural(heroEyeName(state));
            message = `Your ${eyes} feel${singleEye ? 's' : ''} better`;
            hero.ucreamed = 0;
            setHeroBlindnessTurns(0, state);
        }
        if ((hero.deafTurns ?? 0) > 0) {
            state.context.botl = true;
            hero.deafTurns = 0;
            syncDeafness(state);
            if (!heroIsDeaf(state)) message += message ? ' and you can hear again' : 'You can hear again';
        }
        if (message) await pline(`${message}.`);
        return;
    }
    case Trouble.LEGS:
        await healHeroLegs(state, { publish: pline });
        return;
    case Trouble.STUNNED:
        await makeStunned(0, { state, publish: pline });
        return;
    case Trouble.CONFUSED:
        await makeConfused(0, { state, publish: pline });
        return;
    case Trouble.HALLUCINATING:
        await pline('Looks like you are back in Kansas.');
        await makeHallucinated(0, { state, talk: false, publish: pline });
        return;
    case Trouble.SADDLE:
        object = requirePrayerObject(saddle(state));
        if (!heroIsBlind(state)) {
            await pline(`${ownedObjectAction(object, 'softly glow', state)} ${displayColorName('amber')}.`);
            state._lastPlineKind = PLNMSG_OBJ_GLOWS;
            object.bknown = true;
        }
        uncurseObjectState(object, state);
    }
}

function ringGlow(object: GameObject | null | undefined, state: GameState) {
    return object === state.uleft ? 'Your left ring softly glows'
        : object === state.uright ? 'Your right ring softly glows' : null;
}

function requirePrayerObject(object: GameObject | null | undefined): GameObject {
    if (!object) throw new Error('Prayer selected an item trouble without an affected object');
    return object;
}
