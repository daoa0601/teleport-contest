// Monster-versus-hero engulf admission, capture, and per-slot effects.
// C mhitm.c:engulf_target() and mhitu.c:gulpmu().
import {
    A_CON, A_STR, DISMOUNT_ENGULFED, DOOR, D_CLOSED, D_LOCKED, IRONBARS,
    IS_OBSTRUCTED, IS_TREE, SICK_NONVOMITABLE, TT_WEB, is_pit,
} from './const.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { MapLocation } from './map_types.js';
import type { MessagePublisher } from './display.js';
import type { HeroContactAttack } from './monster_action_types.js';
import type { HeroMonsterKillOptions } from './hero_monster_death.js';
import type { finishMonsterAttackDeath } from './monster_attack_death.js';
import { heroIsBreathless, heroPassesWalls, heroSpecies } from './hero_species.js';
import {
    AD_ACID, AD_BLND, AD_COLD, AD_DGST, AD_DISE, AD_DREN, AD_ELEC,
    AD_FIRE, AD_PHYS,
} from './monster_attack_types.js';
import {
    MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SIZE,
    monsterDigests, monsterEnfolds, monsterIsAmorphous, monsterIsAnimal, monsterIsWhirly, monsterTypeName,
} from './monster_data.js';
import {
    BOULDER, BRASS_LANTERN, CANDELABRUM_OF_INVOCATION, LEASH,
    MAGIC_LAMP, OIL_LAMP, POT_OIL, TALLOW_CANDLE, WAX_CANDLE,
} from './object_data.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { moveSwallowedBallAndChain, placeBallAndChain } from './ball.js';
import { displayMessageWindow, newsym, plineWithContinuation, shieldeff, swallowed } from './display.js';
import { applyEngulfBlindness } from './engulf_blindness.js';
import { burnAwayHeroSlime } from './hack.js';
import { damageHeroFromMonster } from './hero_damage.js';
import { drainHeroEnergy } from './hero_energy.js';
import { expelHero } from './hero_expulsion.js';
import { startHeroSickness } from './hero_illness.js';
import { applyHeroGolemEffects } from './polyself.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { endObjectBurn } from './light.js';
import { releaseAllMonsterLeashes } from './monster_leash.js';
import { resetPick } from './lock_context.js';
import { monsterName } from './monster_name.js';
import { monsterHasStoneResistance } from './monster_resistance.js';
import { petrifyMonsterImmediately } from './monster_stoning.js';
import { ownedObjectName, objectNameIsPlural } from './objnam.js';
import { stopHeroOccupation } from './occupation.js';
import { rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { carriedObjectOwner } from './shk.js';
import { dismountHero } from './steed.js';
import { touchPetrifies } from './stoning.js';
import { resetHeroTrap } from './terrain_movement.js';
import { vision_recalc } from './vision.js';

export interface HeroEngulfOptions {
    state?: GameState;
    random?: (range: number) => number;
    rollOne?: (sides: number) => number;
    publish?: MessagePublisher;
    flushMessages?: () => unknown;
    die?: typeof finishMonsterAttackDeath;
}

export interface HeroEngulfCaptureResult {
    captured: boolean;
    died: boolean;
}

export interface HeroEngulfResult {
    hit: boolean;
    damage: number;
    died: boolean;
}

const MZ_HUGE = 4;
const M1_WALLWALK = 0x08;
const M1_UNSOLID = 0x00100000;

export function monsterCanEngulfHero(monster: Monster, state: GameState = game): boolean {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;
    const body = { mnum: heroSpecies(state) };
    const heroSize = MONSTER_SIZE[body.mnum];
    const monsterSize = MONSTER_SIZE[monster.mnum];
    if (heroSize === undefined || monsterSize === undefined) return false;
    if (heroSize >= MZ_HUGE
        || (monsterSize < heroSize && !monsterIsWhirly(monster)))
        return false;
    // A hero's u.utrap is released after capture; it is not mtrapped.
    if (monster.mtrapped) return false;
    if (!heroPassesWalls(state)
        && engulfSquareBlocked(state.level.at(hero.ux, hero.uy), monster))
        return false;
    if (!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_WALLWALK)
        && engulfSquareBlocked(state.level.at(monster.mx, monster.my), body))
        return false;

    const trap = state.level.traps.find(candidate =>
        candidate.tx === hero.ux && candidate.ty === hero.uy);
    const objects = state.level.objects[hero.ux]?.[hero.uy] || [];
    return !trap || !is_pit(trap.ttyp) || !objects.some(object => object.otyp === BOULDER);
}

function engulfSquareBlocked(location: MapLocation | null, otherBody: Pick<Monster, 'mnum'>): boolean {
    if (!location) return true;
    const closedDoor = location.typ === DOOR
        && !!((location.doormask ?? location.flags ?? 0) & (D_CLOSED | D_LOCKED));
    return IS_OBSTRUCTED(location.typ) || closedDoor || IS_TREE(location.typ)
        || (location.typ === IRONBARS && !monsterIsWhirly(otherBody));
}


// C gulpmu(): capture has moved the attacker, but the hero is not swallowed
// until dismounting, releases and contact petrification have completed.
export async function beginHeroEngulf(monster: Monster, attack: HeroContactAttack, {
    state = game, random = rn2, rollOne = rnd, publish = plineWithContinuation,
    flushMessages = displayMessageWindow,
}: HeroEngulfOptions = {}): Promise<HeroEngulfCaptureResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;
    newsym(monster.mx, monster.my);
    if (hero.usteed) {
        const steedName = monsterName(hero.usteed, { state });
        const subject = monsterName(monster, { state, capitalized: true, augmentIt: true });
        const verb = monsterIsAnimal(monster) ? 'lunges'
            : monsterIsWhirly(monster) ? 'whirls'
            : (MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_UNSOLID ? 'flows'
            : monsterIsAmorphous(monster) ? 'oozes' : 'surges';
        await publish(`${subject} ${verb} forward and plucks you off ${steedName}!`,
            { urgent: true });
        const dismount = await dismountHero(DISMOUNT_ENGULFED,
            { state, random, announce: publish });
        if (dismount.died || state.program_state.gameover)
            return { captured: false, died: true };
    } else {
        const subject = monsterName(monster, { state, capitalized: true });
        const verb = monsterDigests(monster) ? 'swallows you whole'
            : monsterEnfolds(monster) ? 'folds itself around you' : 'engulfs you';
        await publish(`${subject} ${verb}!`, { urgent: true });
    }
    await stopHeroOccupation(state, publish);
    resetPick(state); // gulpmu() resets occupations as if the hero had moved.
    if (state.program_state.gameover) return { captured: false, died: true };

    if (hero.utrap) {
        await publish(`You are released from the ${hero.utraptype === TT_WEB ? 'web' : 'trap'}!`);
        await resetHeroTrap(false, state);
    }
    const leashes = state.inventory.filter(object => object.otyp === LEASH && object.leashmon).length;
    if (leashes) {
        await publish(leashes > 1 ? 'The leashes snap loose.' : 'The leash snaps loose.');
        releaseAllMonsterLeashes(state);
    }
    if (touchPetrifies(heroSpecies(state)) && !monsterHasStoneResistance(monster)) {
        if (attack.engulfOldX === undefined || attack.engulfOldY === undefined)
            throw new Error("Engulf capture is missing the attacker's original position.");
        monster.mx = attack.engulfOldX;
        monster.my = attack.engulfOldY;
        const petrification = await petrifyMonsterImmediately(monster, {
            creditHero: true, publish,
            finishDeath: (target: Monster, death: HeroMonsterKillOptions = {}) => finishHeroMonsterKill(target, target.mx, target.my, {
                ...death, showKillMessage: false, recordConduct: false,
            }),
        });
        if (petrification.heroDied || state.program_state.gameover)
            return { captured: false, died: true };
        if (state.uball) await placeBallAndChain(state, publish);
        hero.ustuck = null;
        return { captured: false, died: false };
    }

    await flushMessages();
    vision_recalc(2);
    hero.uswallow = 1;
    const level = monster.m_lev;
    let duration;
    if (attack.damageType === AD_DGST) {
        const endurance = Math.max(0, currentAttribute(A_CON, state) + 10 - hero.uac + random(20));
        duration = Math.trunc(endurance / level) + 3;
    } else duration = rollOne(level + 5);
    hero.uswldtim = Math.max(2, duration);
    swallowed(true);
    if (!FLAMING_SPECIES.has(monster.mnum)) await snuffEngulfedLights(state, publish);
    return { captured: true, died: false };
}

// C gulpmu(): every engulf slot, including reblinding, shares this body.
export async function resolveHeroEngulf(monster: Monster, damageType: number, damage: number, {
    state = game, publish = plineWithContinuation,
    random = rn2, rollOne = rnd, die,
}: HeroEngulfOptions = {}): Promise<HeroEngulfResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;
    if (monster !== hero.ustuck) return { hit: false, damage: 0, died: false };
    moveSwallowedBallAndChain(monster, state);
    if (hero.uswldtim !== undefined && hero.uswldtim > 0) hero.uswldtim--;

    let physical = false;
    switch (damageType) {
    case AD_DGST:
        physical = true;
        if (hero.slowDigestion) {
            hero.uswldtim = 0;
            damage = 0;
        } else if (!hero.uswldtim) {
            await publish(`${monsterName(monster, { state, capitalized: true })} totally digests you!`);
            damage = hero.uhp * (hero.halfPhysicalDamage ? 2 : 1);
        } else {
            const degree = hero.uswldtim === 2 ? ' thoroughly'
                : hero.uswldtim === 1 ? ' utterly' : '';
            await publish(`${monsterName(monster, { state, capitalized: true })}${degree} digests you!`);
            await exerciseAttribute(A_STR, false, state);
        }
        break;
    case AD_PHYS:
        physical = true;
        if (monster.mnum === MONSTER_NAME.indexOf('fog cloud')) {
            const flaming = FLAMING_SPECIES.has(heroSpecies(state));
            const amphibious = !!((MONSTER_FLAGS1[heroSpecies(state)] ?? 0) & 0x200);
            const breathless = heroIsBreathless(state);
            const effect = flaming ? 'are smoldering out!'
                : breathless ? 'find it mildly uncomfortable.'
                    : amphibious ? 'feel comforted.' : 'can barely breathe!';
            await publish(`You are laden with moisture and ${effect}`);
            if (!flaming && (amphibious || hero.magicalBreathing || breathless)) damage = 0;
        } else {
            await publish(`You are ${monsterEnfolds(monster)
                ? 'being squashed' : 'pummeled with debris'}!`);
            await exerciseAttribute(A_STR, false, state);
        }
        break;
    case AD_ACID:
        if (hero.acidResistance) {
            await publish('You are covered with a seemingly harmless goo.');
            damage = 0;
        } else {
            await publish(heroIsHallucinating(state)
                ? "Ouch!  You've been slimed!" : 'You are covered in slime!  It burns!');
            await exerciseAttribute(A_STR, false, state);
        }
        break;
    case AD_BLND:
        await applyEngulfBlindness(damage, { state, publish });
        damage = 0;
        break;
    case AD_ELEC:
    case AD_COLD:
    case AD_FIRE:
        if (monster.mcan || !random(2)) {
            damage = 0;
            break;
        }
        if (damageType === AD_ELEC) {
            await publish('The air around you crackles with electricity.');
            if (hero.shockResistance) {
                await shieldeff(hero.ux, hero.uy, state);
                await publish('You seem unhurt.');
                await applyHeroGolemEffects(damageType, damage, { state, publish });
                damage = 0;
            }
        } else {
            const fire = damageType === AD_FIRE;
            if (fire ? hero.fireResistance : hero.coldResistance) {
                await shieldeff(hero.ux, hero.uy, state);
                await publish(fire ? 'You feel mildly hot.' : 'You feel mildly chilly.');
                await applyHeroGolemEffects(damageType, damage, { state, publish });
                damage = 0;
            } else {
                await publish(fire ? 'You are burning to a crisp!' : 'You are freezing to death!');
            }
            if (fire) await burnAwayHeroSlime(state, publish);
        }
        break;
    case AD_DISE:
        if (hero.sicknessResistance) {
            await publish('You feel a slight illness.');
            damage = 0;
        } else {
            const turns = hero.sickTurns
                ? Math.trunc(hero.sickTurns / 3) + 1
                : random(currentAttribute(A_CON, state)) + 20;
            await startHeroSickness({
                state, turns, cause: monsterTypeName(monster.mnum),
                type: SICK_NONVOMITABLE, publish,
            });
        }
        break;
    case AD_DREN:
        if (!monster.mcan && random(4)) {
            await publish(drainHeroEnergy(state, damage, { rollOne }));
        }
        damage = 0;
        break;
    default:
        physical = true;
        damage = 0;
        break;
    }

    if (physical) {
        if (hero.uac < 0) damage -= rollOne(-hero.uac);
        if (damage < 0) damage = 1;
        if (hero.halfPhysicalDamage) damage = Math.trunc((damage + 1) / 2);
    }
    // corpse_chance() uses this engulfer during damage. Native unstuck()
    // clears it before expulsion's landing effects, which happen on the map.
    const previousSwallower = state._monsterSwallower;
    state._monsterSwallower = monster;
    let died;
    try {
        died = await damageHeroFromMonster(monster, damage, {
            state, publish, ...(die ? { die } : {}),
        });
    } finally {
        state._monsterSwallower = previousSwallower ?? null;
    }
    if (died || state.program_state.gameover) return { hit: true, damage, died: true };
    if (damage) await stopHeroOccupation(state, publish);
    if (state.program_state.gameover) return { hit: true, damage, died: true };
    if (!hero.uswallow) return { hit: true, damage, died: false };

    const petrifies = touchPetrifies(heroSpecies(state))
        && !monsterHasStoneResistance(monster);
    const size = MONSTER_SIZE[heroSpecies(state)];
    const tooLarge = size !== undefined && size >= MZ_HUGE;
    if (petrifies || !hero.uswldtim || tooLarge) {
        const digests = monsterDigests(monster);
        const enfolds = monsterEnfolds(monster);
        if (petrifies) {
            const verb = digests ? 'regurgitates' : enfolds ? 'releases' : 'expels';
            await publish(`${monsterName(monster, { state, capitalized: true })} very hurriedly ${verb} you!`);
        } else {
            await publish(`You get ${digests ? 'regurgitated' : enfolds ? 'released' : 'expelled'}!`);
            if (state.flags.verbose && digests && hero.slowDigestion) {
                await publish(`Obviously ${monsterName(monster, { state })} doesn't like your taste.`);
            }
        }
        const release = await expelHero(monster, {
            state, publish, message: false, random, rollOne,
        });
        if (release.died) return { hit: true, damage, died: true };
    }
    return { hit: true, damage, died: false };
}

const FLAMING_SPECIES = new Set([
    'fire vortex', 'flaming sphere', 'fire elemental', 'salamander',
].map(name => MONSTER_NAME.indexOf(name)));

// C snuff_lit()/snuff_candle(), here called only for the hero's inventory.
async function snuffEngulfedLights(state: PlayingGameState, publish: MessagePublisher): Promise<void> {
    for (const object of [...state.inventory]) {
        if (!object.lamplit) continue;
        if ([OIL_LAMP, MAGIC_LAMP, BRASS_LANTERN, POT_OIL].includes(object.otyp)) {
            if (!heroIsBlind(state)) {
                await publish(`${ownedObjectName(object, state)} ${
                    objectNameIsPlural(object, state) ? 'go' : 'goes'} out!`);
            }
        } else if ([TALLOW_CANDLE, WAX_CANDLE, CANDELABRUM_OF_INVOCATION].includes(object.otyp)) {
            if (!heroIsBlind(state)) {
                const candelabrum = object.otyp === CANDELABRUM_OF_INVOCATION;
                const many = candelabrum ? object.spe > 1 : object.quan > 1;
                await publish(`${carriedObjectOwner(object, state)} ${
                    candelabrum ? "candelabrum's " : ''}candle${
                    many ? "s' flames are" : "'s flame is"} extinguished.`);
            }
        } else continue;
        endObjectBurn(object, state);
    }
}
