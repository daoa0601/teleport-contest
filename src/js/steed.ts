// steed.js — Saddling, mounting, riding, and dismounting.
// C ref: steed.c.

import { monsterHasMapPosition, placeMonsterAt } from './monster_location.js';
import {
    RLOC_ERR, RLOC_NOMSG,
    ACCESSIBLE, D_CLOSED, D_LOCKED, DISMOUNT_BONES, DISMOUNT_BYCHOICE,
    DISMOUNT_ENGULFED, DISMOUNT_FELL, DISMOUNT_KNOCKED, DISMOUNT_POLY, DISMOUNT_THROWN,
    DOOR, DIRECTION_KEYS, IS_OBSTRUCTED, MGIVENNAME, M_AP_FURNITURE, M_AP_OBJECT,
    M_AP_TYPMASK, P_RIDING, A_CHA, A_DEX, A_WIS, P_BASIC, P_SKILLED, P_EXPERT,
    TRAP_EXPLANATIONS, TT_BEARTRAP, TT_PIT, TT_WEB, Upolyd, VIBRATING_SQUARE,
    W_SADDLE, isok,
} from './const.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { Position } from './map_types.js';
import type { MessagePublisher } from './display.js';
import type { DirectionVector } from './const.js';
import { levitationAtWill, refreshMovementProperties } from './properties.js';
import { floatHeroDown } from './terrain_movement.js';
import { canSpotMonster, newsym, pline, plineWithContinuation } from './display.js';
import { monsterSurvivesPool } from './mon.js';
import { finishMonsterKilled } from './monster_death.js';
import { AD_PHYS } from './monster_attack_types.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import {
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_MOVE, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL,
    monsterCanBeSaddled, monsterTypeName,
} from './monster_data.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import {
    releaseMonsterLeash, releaseMonsterLeashWithFeedback,
} from './monster_leash.js';
import { BOULDER, SADDLE, OBJECT_DESCRIPTIONS } from './object_data.js';
import { mksobj } from './mklev.js';
import { fullyIdentifyObject } from './invent.js';
import { applyMonsterEquipmentProperties } from './monster_equipment.js';
import { objectMaterial } from './object_material.js';
import { makePlural, withIndefiniteArticle } from './object_grammar.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName } from './monster_name.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { heroHandName } from './body_parts.js';
import { heroHasFreeHand } from './weapon_type.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { freeInventoryObject } from './hero_inventory.js';
import { propertyIsActive } from './properties.js';
import { rn1, rn2, rnd, rnl } from './rng.js';
import { useHeroSkill } from './skills.js';
import { moveHeroByTeleport, randomMonsterRelocation, relocateMonsterTo } from './teleport.js';
import { findNearbyMonsterPosition } from './teleport_rules.js';
import { promptDirection, readDirectionKey } from './tty_prompts.js';
import { promptYesNo } from './query.js';
import { vision_recalc } from './vision.js';
import { heroLegName } from './body_parts.js';
import { healHeroLegs, woundHeroLegs } from './hero_legs.js';
import { loseHeroHp } from './hero_damage.js';
import { resolveImmediatePetrification, touchPetrifies } from './stoning.js';
import { encumbranceLabel, encumbranceMessage, nearCapacity, SLT_ENCUMBER } from './weight.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { monsterIsHelpless } from './monster_sleep.js';
import {
    blocksDiagonalDoor, heroBadRock, heroTightDiagonalReason,
} from './hack.js';
import { applyHeroLocationEffects, heroCouldMoveOntoBoulder } from './cmd.js';
import { finishDestinationSpotEffects } from './location_effects.js';
import { adjustHeroAlignment } from './alignment.js';

import { resumeDeferredMonsterTrap, triggerImmediateMonsterTrap } from './monmove.js';
import { levelHasCeiling, isLavaAt, isPoolAt } from './terrain_properties.js';
import { isPolearm } from './weapon_type.js';

export type DismountReason = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface DismountHeroOptions {
    state?: GameState;
    random?: (range: number) => number;
    announce?: MessagePublisher;
}

export interface DismountMovement extends Position {
    oldx: number;
    oldy: number;
}

export interface DismountLanding {
    died?: boolean;
    moved?: boolean;
    dismounted?: boolean;
    shortCircuited?: boolean;
}

export type DismountHeroResult = {
    dismounted: false;
    died?: true;
} | {
    dismounted: true;
    steed: Monster;
    died?: boolean;
    movement?: DismountMovement | null;
    liquid?: { dead: boolean } | null;
    location?: DismountLanding | null;
};

export interface StrikeSteedOptions extends DismountHeroOptions {
    roll?: (sides: number) => number;
}

export type StrikeSteedResult = { struck: false } | {
    struck: true;
    helpless?: boolean;
    thrown?: boolean;
    galloped?: true;
};

const M1_FLY = 0x00000001;
const M1_CLING = 0x00000010;
const M1_SWIM = 0x00000002;
const M1_HUMANOID = 0x00020000;
const M1_SLITHY = 0x00080000;
const M1_AMORPHOUS = 0x00000004;
const M1_NOLIMBS = 0x00006000;
const M2_DOMESTIC = 0x00400000;
const M2_ROCKTHROW = 0x08000000;
const MZ_SMALL = 1;
const MZ_LARGE = 3;
const IRON = 11;
const MITHRIL = 17;
const S_EYE = 5;
const S_LIGHT = 25;

export function steedIsGrounded(steed: Monster, state: GameState = game): boolean {
    const flags = MONSTER_FLAGS1[steed?.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[steed?.mnum];
    if ((flags & M1_FLY) || symbol === S_EYE || symbol === S_LIGHT)
        return false;
    return !(flags & M1_CLING) || !levelHasCeiling(state);
}

export function monsterSaddle(monster: Monster | null | undefined): GameObject | null {
    if (monster?.saddle) return monster.saddle;
    return (monster?.minvent || monster?.inventory || []).find(object =>
        (object.owornmask ?? 0) & W_SADDLE) ?? null;
}

export async function doride() {
    const hero = game.u;
    if (hero?.usteed) {
        await dismountHero(DISMOUNT_BYCHOICE);
        game.context.move = 1;
        return;
    }

    const direction = await promptDirection();
    if (!direction || direction.dz || (!direction.dx && !direction.dy)) {
        game.context.move = 0;
        return;
    }
    const { dx, dy } = direction;
    const vector: [number, number] = [dx, dy];
    const x = hero.ux + dx;
    const y = hero.uy + dy;
    if (!isok(x, y)) {
        game.context.move = 0;
        return;
    }
    const force = !!game.flags.debug
        && await promptYesNo('Force the mount to succeed?') === 'y';
    const steed = game.level?.monsters?.find(monster => monsterHasMapPosition(monster, game) &&
        (monster.mx === x && monster.my === y)
        || monster.wormSegments?.some(segment => segment.x === x && segment.y === y));
    game.context.move = await mountSteed(steed, force, vector) ? 1 : 0;
}

export function heroCanRideSteed(steed: Monster, state: GameState = game): boolean {
    const mnum = state.u.umonnum;
    if (mnum === undefined) return false;
    const size = MONSTER_SIZE[mnum];
    return !!steed.mtame && !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_HUMANOID)
        && size !== undefined && size >= MZ_SMALL && size < MZ_LARGE
        && (!state.u.uinwater || !!((MONSTER_FLAGS1[steed.mnum] ?? 0) & M1_SWIM));
}

export async function handleRidingAfterFormChange() {
    const steed = game.u.usteed;
    if (!steed) return { died: false };
    if (touchPetrifies(steed.mnum) && !game.u.stoneResistance && rnl(3)) {
        await plineWithContinuation(`No longer petrify-resistant, you touch ${steedName(steed)}.`);
        const species = monsterTypeName(steed.mnum, !!steed.female);
        const article = /^[aeiou]/i.test(species) ? 'an' : 'a';
        const result = await resolveImmediatePetrification({
            killer: `riding ${article} ${species}`,
        });
        if (result.died) return result;
    }
    if (game.u.usteed && !heroCanRideSteed(game.u.usteed))
        return dismountHero(DISMOUNT_POLY);
    return { died: false };
}

export async function adjustRiderAfterSteedPolymorph(
    steed: Monster, oldMnum: number, state: GameState = game,
    publish: MessagePublisher = plineWithContinuation,
): Promise<DismountHeroResult> {
    if (!monsterCanBeSaddled(steed) || !heroCanRideSteed(steed, state))
        return dismountHero(DISMOUNT_FELL, { state, announce: publish });
    const givenName = MGIVENNAME(steed);
    const name = givenName || `your ${oldMnum !== steed.mnum ? 'new ' : ''}${
        monsterTypeName(steed.mnum, !!steed.female)
    }`;
    await publish(`You adjust yourself in the saddle on ${name}.`);
    refreshMovementProperties(state);
    return { dismounted: false };
}

export async function ridingPreventsMovement() {
    const steed = game.u.usteed;
    if (!steed || !monsterIsHelpless(steed)) return false;
    const name = MGIVENNAME(steed) || `your ${monsterTypeName(steed.mnum, !!steed.female)}`;
    await plineWithContinuation(`${name.charAt(0).toUpperCase()}${name.slice(1)} won't move!`);
    return true;
}

// C hack.c moves the steed with the hero before resolving displacement.
export async function moveSteedWithHero() {
    const hero = game.u;
    if (!hero.usteed) return;
    hero.usteed.mx = hero.ux;
    hero.usteed.my = hero.uy;
    hero.urideturns = (hero.urideturns || 0) + 1;
    if (hero.urideturns >= 100) {
        hero.urideturns = 0;
        await useHeroSkill(P_RIDING);
    }
}

function steedName(steed: Monster) {
    const species = monsterTypeName(steed.mnum, !!steed.female);
    return MGIVENNAME(steed) || `the ${monsterSaddle(steed) ? 'saddled ' : ''}${species}`;
}

function steedSubject(steed: Monster) {
    const name = steedName(steed);
    return name.charAt(0).toUpperCase() + name.slice(1);
}

function ridingStepIsClear(state: PlayingGameState, x: number, y: number) {
    const hero = state.u;
    const location = state.level.at(x, y);
    if (!location || IS_OBSTRUCTED(location.typ)
        || (location.typ === DOOR && (location.doormask & (D_CLOSED | D_LOCKED))))
        return false;
    if (x !== hero.ux && y !== hero.uy) {
        if (blocksDiagonalDoor(state.level.at(hero.ux, hero.uy), location)) return false;
        if (heroBadRock(state, hero.ux, y) && heroBadRock(state, x, hero.uy)
            && heroTightDiagonalReason(state)) return false;
    }
    return !(state.level.objects[x]?.[y] || []).some(object => object.otyp === BOULDER)
        || heroCouldMoveOntoBoulder(x, y, state);
}

async function mountSteed(steed: Monster | undefined, force: boolean, [dx, dy]: DirectionVector): Promise<boolean> {
    requirePlayingGame(game);
    const hero = game.u;
    if (heroIsHallucinating() && !force) {
        await pline('Maybe you should find a designated driver.');
        return false;
    }
    if ((hero._woundedLegTurns ?? 0) > 0) {
        const both = hero._woundedLegSide === 'both';
        const leg = both ? makePlural(heroLegName())
            : `${hero._woundedLegSide} ${heroLegName()}`;
        await pline(`Your ${leg} ${both ? 'are' : 'is'} in no shape for riding.`);
        if (force && game.flags.debug
            && await promptYesNo(`Heal your leg${both ? 's' : ''}?`) === 'y') {
            await healHeroLegs();
        } else return false;
    }
    const bodyFlags = MONSTER_FLAGS1[hero.umonnum] ?? 0;
    const bodySize = MONSTER_SIZE[hero.umonnum];
    if (Upolyd(hero) && (!(bodyFlags & M1_HUMANOID)
        || bodySize === undefined || bodySize < MZ_SMALL || bodySize >= MZ_LARGE || (bodyFlags & M1_SLITHY))) {
        await pline("You won't fit on a saddle.");
        return false;
    }
    if (!force && nearCapacity(game) > SLT_ENCUMBER) {
        await pline("You can't do that while carrying so much stuff.");
        return false;
    }
    if (!steed || (!force && ((heroIsBlind() && !hero.telepathy)
        || steed.mundetected
        || [M_AP_FURNITURE, M_AP_OBJECT].includes((steed.m_ap_type ?? 0) & M_AP_TYPMASK)))) {
        await pline('I see nobody there.');
        return false;
    }
    if (MONSTER_NAME[steed.mnum] === 'long worm'
        && (hero.ux + dx !== steed.mx || hero.uy + dy !== steed.my)) {
        await pline("You couldn't ride a long worm, let alone its tail.");
        return false;
    }
    const punished = game.uball || hero.uball;
    if (hero.uswallow || hero.ustuck || hero.utrap || punished
        || !ridingStepIsClear(game, steed.mx, steed.my)) {
        await pline(punished || !(hero.uswallow || hero.ustuck || hero.utrap)
            ? `You are unable to swing your ${heroLegName()} over.`
            : 'You are stuck here for now.');
        return false;
    }
    const saddle = monsterSaddle(steed);
    if (!saddle) {
        await pline(`${steedSubject(steed)} is not saddled.`);
        return false;
    }
    if (touchPetrifies(steed.mnum) && !hero.stoneResistance) {
        await plineWithContinuation(`You touch ${steedName(steed)}.`);
        const result = await resolveImmediatePetrification({
            killer: `attempting to ride a ${monsterTypeName(steed.mnum, !!steed.female)}`,
        });
        if (result.died) return false;
    }
    if (!steed.mtame || steed.isminion) {
        await pline(`I think ${steedName(steed)} would mind.`);
        return false;
    }
    if (steed.mtrapped) {
        const trap = game.level.traps.find(trap =>
            trap.tx === steed.mx && trap.ty === steed.my);
        const trapName = trap ? TRAP_EXPLANATIONS[trap.ttyp] : undefined;
        if (!trapName) throw new Error('A trapped steed has no trap at its position.');
        const article = /^[aeiou]/i.test(trapName) ? 'an' : 'a';
        await pline(`You can't mount ${steedName(steed)} while it's trapped in ${article} ${trapName}.`);
        return false;
    }
    if (!force && game.urole.key !== 'knight') {
        steed.mtame--;
        steed.pet = steed.mtame > 0;
        if (!steed.mtame) {
            newsym(steed.mx, steed.my);
            const leash = steed.mleashed ? ' and its leash comes off' : '';
            await pline(`${steedSubject(steed)} resists${leash}!`);
            if (steed.mleashed) releaseMonsterLeash(steed, game);
            return false;
        }
    }
    if (!force && hero.uinwater && !((MONSTER_FLAGS1[steed.mnum] ?? 0) & M1_SWIM)) {
        await pline("You can't ride that creature while under water.");
        return false;
    }
    if (!monsterCanBeSaddled(steed) || !heroCanRideSteed(steed)) {
        await pline("You can't ride such a creature.");
        return false;
    }
    const steedFlags = MONSTER_FLAGS1[steed.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[steed.mnum];
    const floats = symbol === S_EYE || symbol === S_LIGHT;
    const flies = !!(steedFlags & M1_FLY);
    if (!force && !floats && !flies && hero.levitation && !levitationAtWill()) {
        await pline(`You cannot reach ${steedName(steed)}.`);
        return false;
    }
    const armor = game.uarm || hero.uarm;
    const material = armor && objectMaterial(armor);
    if (!force && armor && typeof material === 'number' && material >= IRON && material <= MITHRIL
        && (armor.oeroded || armor.oeroded2)) {
        const damage = armor.oeroded ? 'rusty' : 'corroded';
        await pline(`Your ${damage} armor is too stiff to be able to mount ${steedName(steed)}.`);
        return false;
    }
    if (!force && ((hero.confusionTurns ?? 0) > 0 || hero.fumbling || (hero.fumblingTurns ?? 0) > 0
        || (hero.glibTurns ?? 0) > 0
        || hero.glib || saddle.cursed || saddle.greased
        || hero.ulevel + steed.mtame < rnd(20))) {
        if (hero.levitation) {
            await pline(`${steedSubject(steed)} slips away from you.`);
            return false;
        }
        await plineWithContinuation(`You slip while trying to get on ${steedName(steed)}.`);
        let damage = rn1(5, 10);
        if (hero.halfPhysicalDamage) damage = Math.trunc((damage + 1) / 2);
        let name = `a saddled ${monsterTypeName(steed.mnum, !!steed.female)}`;
        if (MGIVENNAME(steed)) name += ` called ${MGIVENNAME(steed)}`;
        await loseHeroHp(damage, `slipped while mounting ${name}`);
        return false;
    }
    await wakeSteedForRiding(steed);
    if (!force) {
        if (hero.levitation && !floats && !flies)
            await plineWithContinuation(`${steedSubject(steed)} magically floats up!`);
        await plineWithContinuation(`You mount ${steedName(steed)}.`);
        if (hero.flying)
            await plineWithContinuation(`You and ${steedName(steed)} take flight together.`);
    }
    if (isPolearm(game.uwep || hero.uwep)) game._unweapon = false;
    const wasStealthy = hero.stealth;
    hero.usteed = steed;
    refreshMovementProperties(game);
    if (wasStealthy && !hero.stealth)
        await plineWithContinuation("You aren't stealthy anymore.");
    const movement = await moveHeroByTeleport(steed.mx, steed.my, game);
    newsym(movement.oldx, movement.oldy);
    vision_recalc(1);
    await applyHeroLocationEffects();
    game.context.botl = true;
    return true;
}

async function wakeSteedForRiding(steed: Monster) {
    const wasHelpless = monsterIsHelpless(steed);
    steed.msleeping = 0;
    if (steed.mfrozen) {
        const remaining = Math.trunc((steed.mfrozen + 1) / 2);
        if (rn2(remaining) === 0) {
            steed.mfrozen = 0;
            steed.mcanmove = 1;
        } else steed.mfrozen = remaining;
    }
    if (wasHelpless && !monsterIsHelpless(steed))
        await plineWithContinuation(`${steedSubject(steed)} wakes up.`);
    steed.meating = 0;
    if (((steed.m_ap_type ?? 0) & M_AP_TYPMASK) && MONSTER_SYMBOL[steed.mnum] !== 13) {
        steed.m_ap_type = 0;
        steed.mappearance = 0;
        newsym(steed.mx, steed.my);
    }
}

// C steed.c:use_saddle(). The command owns selection and the success roll;
// putSaddleOnMonster owns the monster's inventory and equipment links.
export async function useSaddle(saddle: GameObject): Promise<boolean> {
    requirePlayingGame(game);
    const hero = game.u;
    if (!heroHasFreeHand(game)) {
        await plineWithContinuation(`You have no free ${heroHandName(game)}.`);
        return false;
    }
    if (hero.uswallow || hero.uinwater || game.underwater) {
        await plineWithContinuation('Never mind.');
        return false;
    }
    const direction = await promptDirection();
    if (!direction) {
        await plineWithContinuation('Never mind.');
        return false;
    }
    if (!direction.dx && !direction.dy) {
        await plineWithContinuation('Saddle yourself?  Very funny...');
        return false;
    }
    const monster = monsterAtPosition(game.level, hero.ux + direction.dx, hero.uy + direction.dy);
    if (!monster || !canSpotMonster(monster)) {
        await plineWithContinuation('I see nobody there.');
        return true;
    }
    const name = () => monsterName(monster, { capitalized: true });
    if ((monster.misc_worn_check ?? 0) & W_SADDLE || monsterSaddle(monster)) {
        await plineWithContinuation(`${name()} doesn't need another one.`);
        return true;
    }
    if (touchPetrifies(monster.mnum) && !game.uarmg && !propertyIsActive('stoneResistance', game)) {
        await plineWithContinuation(`You touch ${monsterName(monster)}.`);
        await resolveImmediatePetrification({
            killer: `attempting to saddle ${withIndefiniteArticle(monsterTypeName(monster.mnum, monster.female))}`,
        });
        if (game.program_state.gameover) return true;
    }
    if (MONSTER_NAME[monster.mnum] === 'amorous demon') {
        await plineWithContinuation('Shame on you!');
        await exerciseAttribute(A_WIS, false);
        return true;
    }
    if (monster.isminion || monster.isshk || monster.ispriest || monster.isgd || monster.iswiz) {
        await plineWithContinuation(`I think ${monsterName(monster)} would mind.`);
        return true;
    }
    if (!monsterCanBeSaddled(monster)) {
        await plineWithContinuation("You can't saddle such a creature.");
        return true;
    }
    const tameness = monster.mtame ?? 0;
    let chance = currentAttribute(A_DEX, game) + Math.trunc(currentAttribute(A_CHA, game) / 2)
        + 2 * tameness + hero.ulevel * (tameness ? 20 : 5);
    if (!monster.mtame) chance -= 10 * monster.m_lev;
    if (game.urole.key === 'knight') chance += 20;
    const skill = hero.weaponSkills?.[P_RIDING]?.skill ?? 0;
    chance += skill === P_EXPERT ? 30 : skill === P_SKILLED ? 15 : skill === P_BASIC ? 0 : -20;
    const description = (object: GameObject | null | undefined) => object
        ? game.objectDescriptions?.[object.otyp] ?? OBJECT_DESCRIPTIONS[object.otyp] : null;
    if (hero.confused || (hero.confusionTurns ?? 0) > 0 || propertyIsActive('fumbling', game)
        || hero.glib || (hero.glibTurns ?? 0) > 0) chance -= 20;
    else if (description(game.uarmg) === 'riding gloves' || description(game.uarmf) === 'riding boots') chance += 10;
    if (saddle.cursed) chance -= 50;
    await wakeSteedForRiding(monster);
    if (rn2(100) < chance) {
        await plineWithContinuation(`You put the saddle on ${monsterName(monster)}.`);
        if (saddle.owornmask) await removeWornHeroItem(saddle, game);
        if (game.program_state.gameover) return true;
        await freeInventoryObject(saddle, game);
        if (game.program_state.gameover) return true;
        await putSaddleOnMonster(saddle, monster);
    } else await plineWithContinuation(`${name()} resists!`);
    return true;
}

export async function putSaddleOnMonster(saddle: GameObject | null, monster: Monster): Promise<GameObject | null> {
    if (!monsterCanBeSaddled(monster) || monsterSaddle(monster)) return null;
    if (!saddle) {
        saddle = await mksobj(SADDLE, true, false);
        fullyIdentifyObject(saddle);
    }
    const carriedSaddle = await addObjectToMonsterInventory(monster, saddle);
    if (!carriedSaddle) throw new Error('The saddle did not enter the monster inventory.');
    carriedSaddle.owornmask = W_SADDLE;
    carriedSaddle.leashmon = monster.m_id;
    monster.misc_worn_check = (monster.misc_worn_check ?? 0) | W_SADDLE;
    monster.saddled = true;
    monster.saddle = carriedSaddle;
    applyMonsterEquipmentProperties(monster, carriedSaddle, true);
    return carriedSaddle;
}

// C makemon(): the roll precedes species and equipment eligibility checks.
export async function maybeGiveDomesticSaddle(monster: Monster): Promise<GameObject | null> {
    if (!rn2(100) && ((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_DOMESTIC))
        return await putSaddleOnMonster(null, monster);
    return null;
}

const DISMOUNT_DIRECTIONS: readonly DirectionVector[] = [
    [-1, 0], [-1, -1], [0, -1], [1, -1],
    [1, 0], [1, 1], [0, 1], [-1, 1],
];

function openLandingSquare(state: PlayingGameState, x: number, y: number, steed: Monster) {
    if (!isok(x, y)) return false;
    const location = state.level?.at?.(x, y);
    if (!location || !ACCESSIBLE(location.typ)) return false;
    if (!ridingStepIsClear(state, x, y)) return false;
    return !(state.level?.monsters || []).some(monster => monsterHasMapPosition(monster, state) && monster !== steed
        && !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y);
}

function landingSpot(
    state: PlayingGameState, steed: Monster, reason: DismountReason,
    random: (range: number) => number, force = false,
): Position | null {
    const avoidHazards = reason === DISMOUNT_BYCHOICE
        && !(state.u.stunned || (state.u.stunnedTurns ?? 0) > 0
            || (state.u.confusionTurns ?? 0) > 0 || state.u.fumbling || (state.u.fumblingTurns ?? 0) > 0);
    const firstPass = avoidHazards ? 0
        : reason === DISMOUNT_BYCHOICE || reason === DISMOUNT_KNOCKED ? 1 : 2;
    let viable = 0;
    let directions = DISMOUNT_DIRECTIONS;
    let preferred = false;
    const facing = directions.findIndex(([dx, dy]) => dx === state.u.dx && dy === state.u.dy);
    if (reason === DISMOUNT_KNOCKED && facing >= 0) {
        const clockwise = (facing + 1) % 8;
        const counterclockwise = (facing + 7) % 8;
        const next = random(2) ? [counterclockwise, clockwise] : [clockwise, counterclockwise];
        const indices = [facing, ...next];
        const preferredDirections = indices.map(index => {
            const direction = DISMOUNT_DIRECTIONS[index];
            if (!direction) throw new Error(`Unknown dismount direction ${index}.`);
            return direction;
        });
        directions = [...preferredDirections,
            ...DISMOUNT_DIRECTIONS.filter((_, index) => !indices.includes(index))];
        preferred = true;
    }

    for (let pass = firstPass; pass <= 2; pass++) {
        let selected = null;
        let shortest = Infinity;
        for (const [index, [dx, dy]] of directions.entries()) {
            const x = state.u.ux + dx;
            const y = state.u.uy + dy;
            if (!openLandingSquare(state, x, y, steed)) continue;
            viable++;

            const distance = dx * dx + dy * dy;
            if (shortest === Infinity || (preferred ? index < 3 : distance < shortest)
                || (distance === shortest && random(viable) === 0)) {
                const knownTrap = pass === 0
                    && state.level.traps.some(trap => trap.tseen && trap.ttyp !== VIBRATING_SQUARE
                        && trap.tx === x && trap.ty === y);
                const boulder = pass <= 1
                    && !((MONSTER_FLAGS2[state.u.umonnum] ?? 0) & M2_ROCKTHROW)
                    && (state.level.objects[x]?.[y] || []).some(object => object.otyp === BOULDER);
                if (knownTrap || boulder) continue;
                selected = { x, y };
                shortest = distance;
                if (preferred && index < 3) break;
            }
        }
        if (selected) return selected;
    }
    return force ? findNearbyMonsterPosition(
        state.u.umonnum, state.u.ux, state.u.uy, { state, random },
    ) : null;
}

async function moveSteedOffHero(state: PlayingGameState, steed: Monster, random: (range: number) => number) {
    const point = findNearbyMonsterPosition(
        steed.mnum, state.u.ux, state.u.uy, { state, random },
    );
    if (!point) return false;
    await relocateMonsterTo(steed, point.x, point.y, { state, random });
    newsym(point.x, point.y);
    return true;
}

// C YMonnam(steed): the given name when the steed has one, otherwise
// "your [saddled] <species>".
function yourSteedSubject(steed: Monster) {
    const name = MGIVENNAME(steed);
    if (name) return name;
    const species = monsterTypeName(steed.mnum, !!steed.female);
    return `Your ${monsterSaddle(steed) ? 'saddled ' : ''}${species}`;
}

// C steed.c:875-895 stucksteed().  Decides whether the hero's steed is able
// to move; holding traps are not checked here (those affect the hero
// directly).  Announces the reason and returns true, or returns false for a
// mobile steed; no other state changes.
export async function stuckSteed(checkFeeding = true, state: GameState = game): Promise<boolean> {
    const steed = state.u?.usteed;
    if (!steed) return false;
    if (monsterIsHelpless(steed)) {
        await plineWithContinuation(`${yourSteedSubject(steed)} won't move!`);
        return true;
    }
    if (checkFeeding && steed.meating) {
        await plineWithContinuation(
            `${yourSteedSubject(steed)} is still eating.`);
        return true;
    }
    return false;
}

function unnamedSteedMessage(steed: Monster) {
    const name = monsterTypeName(steed.mnum, !!steed.female);
    const article = /^[aeiou]/i.test(name) ? 'an' : 'a';
    return `You've been through the dungeon on ${article} ${name} with no name.`;
}

export async function dismountHero(
    reason: DismountReason,
    {
        state = game,
        random = rn2,
        announce = plineWithContinuation,
    }: DismountHeroOptions = {},
): Promise<DismountHeroResult> {
    // Dismounting mutates the world (hero move, spot effects, the descent
    // itself); it only runs on the live singleton.
    requireLiveGame(state);
    const steed = state.u.usteed;
    if (!steed) return { dismounted: false };
    requirePlayingGame(state);
    const hero = state.u;

    // Fallback baseline only: the tail encumbrance normally compares
    // against the level the descent already stored; this covers a
    // dismount whose float_down returned early without settling.
    const previousCapacity = nearCapacity(state);
    const wasTrapped = !!hero.utrap;
    let repairLegs = (hero._woundedLegTurns ?? 0) > 0;
    let landing = landingSpot(state, steed, reason, random);
    hero.usteed = null;
    refreshMovementProperties(state);
    const inAir = hero.levitation || hero.flying;
    const fallingVerb = dismountFallVerb(state);
    hero.usteed = steed;
    refreshMovementProperties(state);

    if ([DISMOUNT_THROWN, DISMOUNT_KNOCKED, DISMOUNT_FELL].includes(reason)) {
        const verb = reason === DISMOUNT_THROWN ? 'are thrown' : fallingVerb;
        await announce(`You ${verb} off of ${steedName(steed)}!`);
        landing ||= landingSpot(state, steed, reason, random, true);
        if (!inAir) {
            let damage = rn1(10, 10);
            if (hero.halfPhysicalDamage) damage = Math.trunc((damage + 1) / 2);
            if (await loseHeroHp(damage, 'riding accident', { state, publish: announce }))
                return { dismounted: false, died: true };
            await woundHeroLegs('both', (hero._woundedLegTurns || 0) + rn1(5, 5), state, { publish: announce });
            repairLegs = false;
        }
    } else if (reason === DISMOUNT_POLY) {
        await announce(`You can no longer ride ${steedName(steed)}.`);
        landing ||= landingSpot(state, steed, reason, random, true);
    }

    if (reason === DISMOUNT_BYCHOICE) {
        const saddle = monsterSaddle(steed);
        if (saddle?.cursed) {
            const known = saddle.bknown;
            saddle.bknown = true;
            await announce(`You can't.  The saddle ${
                known ? 'is' : 'seems to be'
            } cursed.`);
            return { dismounted: false };
        }
    }

    if (reason === DISMOUNT_BYCHOICE && !landing) {
        await announce("You can't.  There isn't anywhere for you to stand.");
        return { dismounted: false };
    }
    if (reason === DISMOUNT_BYCHOICE) {
        const givenName = MGIVENNAME(steed);
        await announce(givenName
            ? `You dismount ${givenName}.`
            : unnamedSteedMessage(steed));
        if (!givenName && heroIsHallucinating(state))
            await announce('It felt good to get out of the rain.');
    }

    if (repairLegs) await healHeroLegs(state, { cause: 'dismounting', publish: announce });

    const oldx = hero.ux;
    const oldy = hero.uy;
    const wasStealthy = hero.stealth;
    hero.usteed = null;
    refreshMovementProperties(state);
    if (!wasStealthy && hero.stealth) await announce('You seem less noisy now.');
    hero.ugallop = 0;
    if (hero.utraptype !== undefined && [TT_BEARTRAP, TT_PIT, TT_WEB].includes(hero.utraptype)) steed.mtrapped = 1;
    let steedPosition = { x: oldx, y: oldy };
    if (state.level.monsters.some(monster => monsterHasMapPosition(monster, state) && monster !== steed && !monster.dead
        && monster.mx === oldx && monster.my === oldy)) {
        steedPosition = findNearbyMonsterPosition(steed.mnum, oldx, oldy, { state, random })
            || findNearbyMonsterPosition(MONSTER_NAME.indexOf('bat'), oldx, oldy, { state, random })
            || findNearbyMonsterPosition(MONSTER_NAME.indexOf('ghost'), oldx, oldy, { state, random })
            || steedPosition;
    }
    let liquid = null;
    let movement = null;
    let location = null;
    if (!steed.dead && steed.mhp > 0) {
        placeMonsterAt(steed, steedPosition.x, steedPosition.y);
        if (reason === DISMOUNT_BONES) {
            if (!(await moveSteedOffHero(state, steed, random)))
                await randomMonsterRelocation(steed, {
                    state, flags: RLOC_ERR | RLOC_NOMSG,
                });
            return { dismounted: true, steed };
        }
        if (!hero.uswallow && !hero.ustuck && landing) {
            if (steedIsGrounded(steed, state)) {
                liquid = await dropSteedIntoLiquid(steed, state, announce);
            }
            if (!steed.dead && steed.mhp > 0) {
                // C steed.c:764-772 raises in_steed_dismounting around
                // teleds(); teleport.c:536-568 renders the moved hero
                // (newsym/vision/newsym) before spoteffects, whose
                // liquids/terrain/rooms/sink run while deferring
                // trap/timeout-1/pickup (hack.c:3355); sokoban_guilt()
                // follows; the steed's trap fires only after the flag
                // drops, exactly like C's mintrap (771).  A hero who died
                // in the spot effects returns from inside the try so the
                // finally still lowers the flag; guilt, the steed trap,
                // and the tail display are never reached.
                state._steedDismounting = true;
                try {
                    movement = await moveHeroByTeleport(landing.x, landing.y, state);
                    newsym(oldx, oldy);
                    vision_recalc(0);
                    // C teleport.c:536-568: the moved hero renders, then
                    // spoteffects runs with the move's real old/new
                    // coordinates (liquids/terrain/rooms/sink live,
                    // trap/timeout-1/pickup deferred while dismounting).
                    location = await finishDestinationSpotEffects({
                        oldx: movement.oldx, oldy: movement.oldy,
                        newx: movement.x, newy: movement.y,
                        explicitAttempt: false, publish: announce,
                    });
                    if (location?.died || state.program_state?.gameover)
                        return {
                            dismounted: true, steed, movement, liquid,
                            location, died: true,
                        };
                    if (state.level.flags.sokoban_rules
                        && (state.level.objects[landing.x]?.[landing.y] || [])
                            .some(object => object.otyp === BOULDER)) {
                        hero.uconduct ||= {};
                        hero.uconduct.sokocheat = (hero.uconduct.sokocheat || 0) + 1;
                        hero.uluck = Math.max(-13, (hero.uluck || 0) - 1);
                    }
                } finally {
                    state._steedDismounting = false;
                }
                if (wasTrapped) {
                    const action = await triggerImmediateMonsterTrap(steed, state);
                    await resumeDeferredMonsterTrap(action, state, {
                        publish: announce, describeMonster: steedSubject,
                    });
                }
            }
        } else if (!(await moveSteedOffHero(state, steed, random))) {
            if (reason === DISMOUNT_BYCHOICE) {
                await finishHeroMonsterKill(steed, steed.mx, steed.my);
                adjustHeroAlignment(-1, state);
            } else {
                steed.mhp = 0;
                await finishMonsterKilled(steed, state, {
                    damageType: AD_PHYS, publish: announce, random,
                });
            }
        }
    }
    if (reason !== DISMOUNT_ENGULFED && reason !== DISMOUNT_BONES) {
        // No teleds display here: an actually moved hero was rendered
        // inside the teleds window above (teleport.c:536-568 order), and an
        // unmoved hero gets no teleds at all in C.
        //
        // C steed.c:808-815: usually return the hero to the surface.  When
        // the hero never moved (the steed died in the drop, or no landing
        // spot existed), C runs no teleds spot effects (the inner
        // !DEADMONSTER at 760 skips teleds) and this tail float_down alone
        // owns the descent: nomul, punished ball, flight, the liquid entry
        // (trap.c:4104-4110), trap activation, and pickup, in that order,
        // with the shared production owners.  W_SADDLE suppresses the
        // landing message because this dismount already announced the fall.
        // A hero who died in the spot effects above does not descend.
        if (!location?.died && !state.program_state?.gameover) {
            state._steedDismounting = true;
            try {
                await floatHeroDown(0, W_SADDLE, state);
            } finally {
                state._steedDismounting = false;
            }
        }
        // A hero who died in the descent itself gets no further tail work.
        if (state.program_state?.gameover)
            return {
                dismounted: true, steed, movement, liquid, location,
                died: true,
            };
        // C's tail encumber_msg() (steed.c:814) is normally silent because
        // float_down already settled the stored level; compare against that
        // stored level so a settled descent reports nothing new.  It still
        // settles here when float_down returned early (a remaining
        // levitation source skips its encumbrance work entirely); the entry
        // baseline is only the fallback when nothing was stored.
        const baseline = state._encumbranceLevel ?? previousCapacity;
        const capacity = nearCapacity(state);
        state._encumbranceLevel = capacity;
        hero._encumbrance = encumbranceLabel(capacity);
        const capacityMessage = encumbranceMessage(baseline, capacity);
        state.context.botl = true;
        if (capacityMessage) await announce(capacityMessage);
        state.vision_full_recalc = 1;
    } else state.context.botl = true;
    if (isPolearm(state.uwep || hero.uwep)) state._unweapon = true;
    return {
        dismounted: true,
        steed,
        movement,
        liquid,
        location,
        died: !!location?.died || !!state.program_state?.gameover,
    };
}

function dismountFallVerb(state: PlayingGameState) {
    const hero = state.u;
    const flags = MONSTER_FLAGS1[hero.umonnum] ?? 0;
    const symbol = MONSTER_SYMBOL[hero.umonnum];
    if (hero.levitation || symbol === S_EYE || symbol === S_LIGHT) return 'float';
    if (hero.flying || (flags & M1_FLY)) return 'fly';
    if (flags & M1_SLITHY) return 'slither';
    if (flags & M1_AMORPHOUS) return 'ooze';
    if (!MONSTER_MOVE[hero.umonnum]) return 'wiggle';
    if ((flags & M1_NOLIMBS) === M1_NOLIMBS) return 'crawl';
    return 'fall';
}

async function dropSteedIntoLiquid(
    steed: Monster, state: PlayingGameState, announce: MessagePublisher,
): Promise<{ dead: boolean } | null> {
    const { ux: x, uy: y } = state.u;
    let fatal = false;
    if (isPoolAt(x, y, state)) {
        if (!state.u.uinwater) await announce(`${steedSubject(steed)} falls into the water!`);
        fatal = !monsterSurvivesPool(steed);
    } else if (isLavaAt(x, y, state)) {
        await announce(`${steedSubject(steed)} is pulled into the lava!`);
        fatal = !['fire elemental', 'salamander'].includes(MONSTER_NAME[steed.mnum] ?? '');
    } else return null;
    if (!fatal) return { dead: false };
    await finishHeroMonsterKill(steed, steed.mx, steed.my);
    adjustHeroAlignment(-1, state);
    return { dead: steed.dead || steed.mhp <= 0 };
}

// Kicks and bullwhips share steed.c:kick_steed().  The caller prints the
// initial hit; this function owns the steed's response and riding state.
export async function strikeSteed({
    state = game,
    random = rn2,
    roll = rnd,
    announce = async () => {},
}: StrikeSteedOptions = {}): Promise<StrikeSteedResult> {
    const hero = state.u;
    const steed = hero?.usteed;
    if (!steed) return { struck: false };

    const helpless = !!(steed.msleeping || steed.mcanmove === 0
        || (steed.mfrozen ?? 0) > 0);
    if (helpless) {
        const canRecover = steed.mcanmove !== 0 || (steed.mfrozen ?? 0) > 0;
        const stirred = canRecover && random(2) === 0;
        if (!stirred) {
            await announce('It does not respond.');
            return { struck: true, helpless: true };
        }
        if (steed.mcanmove !== 0) steed.msleeping = 0;
        else if (steed.mfrozen !== undefined && steed.mfrozen > 2) steed.mfrozen -= 2;
        else {
            steed.mfrozen = 0;
            steed.mcanmove = 1;
        }
        const remainsHelpless = !!(steed.msleeping || steed.mcanmove === 0
            || (steed.mfrozen ?? 0) > 0);
        await announce(remainsHelpless ? 'It stirs.' : 'It rouses itself!');
        return { struck: true, helpless: remainsHelpless };
    }

    if (steed.mtame !== undefined && steed.mtame > 0) steed.mtame--;
    const tameness = steed.mtame ?? 0;
    steed.pet = tameness > 0;
    if (!steed.mtame && steed.mleashed)
        await releaseMonsterLeashWithFeedback(steed, { state, publish: announce });
    const resisted = tameness > 0
        && (hero.ulevel ?? 1) + tameness >= roll(20);
    if (!resisted) {
        newsym(steed.mx, steed.my);
        const dismount = await dismountHero(DISMOUNT_THROWN, {
            state,
            random,
            announce,
        });
        return { struck: true, thrown: dismount.dismounted };
    }

    const name = steed.name || `The ${monsterTypeName(
        steed.mnum, !!steed.female,
    )}`;
    await announce(`${name} gallops!`);
    hero.ugallop = (hero.ugallop ?? 0) + random(20) + 30;
    return { struck: true, galloped: true };
}
