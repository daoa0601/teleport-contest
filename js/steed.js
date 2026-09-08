// steed.js — Saddling, mounting, riding, and dismounting.
// C ref: steed.c.

import {
    ACCESSIBLE, D_CLOSED, D_LOCKED, DISMOUNT_BYCHOICE, DISMOUNT_THROWN,
    DOOR, IS_OBSTRUCTED, IS_POOL, MGIVENNAME, M_AP_FURNITURE, M_AP_OBJECT,
    M_AP_TYPMASK,
    TRAP_EXPLANATIONS, Upolyd, W_SADDLE, isok,
} from './const.js';
import { game } from './gstate.js';
import { levitationAtWill, refreshMovementProperties } from './properties.js';
import { newsym, pline, plineWithContinuation } from './display.js';
import { levelHasCeiling, resolveMonsterLiquid } from './mon.js';
import { finishMonsterLiquidDeath } from './monster_death.js';
import {
    MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL,
    monsterCanBeSaddled, monsterTypeName,
} from './monster_data.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { releaseMonsterLeash } from './monster_leash.js';
import { BOULDER } from './object_data.js';
import { objectMaterial } from './object_material.js';
import { makePlural } from './object_grammar.js';
import { rn1, rn2, rnd } from './rng.js';
import { moveHeroByTeleport } from './teleport.js';
import { promptKey } from './tty_prompts.js';
import { promptYesNo } from './query.js';
import { vision_recalc } from './vision.js';
import { heroLegName } from './body_parts.js';
import { healHeroLegs } from './hero_legs.js';
import { loseHeroHp } from './hero_damage.js';
import { resolveImmediatePetrification, touchPetrifies } from './stoning.js';
import { nearCapacity, SLT_ENCUMBER } from './weight.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { monsterIsHelpless } from './monster_sleep.js';
import {
    blocksDiagonalDoor, heroBadRock, heroTightDiagonalReason,
} from './hack.js';
import { applyHeroLocationEffects, heroCouldMoveOntoBoulder } from './cmd.js';

const M1_FLY = 0x00000001;
const M1_CLING = 0x00000010;
const M1_SWIM = 0x00000002;
const M1_HUMANOID = 0x00020000;
const M1_SLITHY = 0x00080000;
const MZ_SMALL = 1;
const MZ_LARGE = 3;
const IRON = 11;
const MITHRIL = 17;
const S_EYE = 5;
const S_LIGHT = 25;
const DIRECTION_X = { h: -1, l: 1, j: 0, k: 0, y: -1, u: 1, b: -1, n: 1 };
const DIRECTION_Y = { h: 0, l: 0, j: 1, k: -1, y: -1, u: -1, b: 1, n: 1 };

export function steedIsGrounded(steed, state = game) {
    const flags = MONSTER_FLAGS1[steed?.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[steed?.mnum];
    if ((flags & M1_FLY) || symbol === S_EYE || symbol === S_LIGHT)
        return false;
    return !(flags & M1_CLING) || !levelHasCeiling(state);
}

export function monsterSaddle(monster) {
    if (monster?.saddle) return monster.saddle;
    return (monster?.minvent || monster?.inventory || []).find(object =>
        (object.owornmask ?? 0) & W_SADDLE) ?? null;
}

export async function doride() {
    const hero = game.u;
    if (hero?.usteed) {
        const oldx = hero.ux;
        const oldy = hero.uy;
        const result = await dismountHero(DISMOUNT_BYCHOICE, {
            state: game,
            random: rn2,
            announce: pline,
        });
        if (result.movement) {
            newsym(oldx, oldy);
            vision_recalc(1);
            newsym(hero.ux, hero.uy);
        }
        game.context.move = 1;
        return;
    }

    const direction = String.fromCharCode(
        await promptKey('In what direction? '),
    ).toLowerCase();
    if (!Object.hasOwn(DIRECTION_X, direction)) {
        game._pending_message = '';
        game.context.move = 0;
        return;
    }
    hero.dx = DIRECTION_X[direction];
    hero.dy = DIRECTION_Y[direction];
    const x = hero.ux + hero.dx;
    const y = hero.uy + hero.dy;
    if (!isok(x, y)) {
        game.context.move = 0;
        return;
    }
    const force = !!game.flags.debug
        && await promptYesNo('Force the mount to succeed? [yn] (n) ') === 'y';
    const steed = game.level?.monsters?.find(monster =>
        (monster.mx === x && monster.my === y)
        || monster.wormSegments?.some(segment => segment.x === x && segment.y === y));
    game.context.move = await mountSteed(steed, force) ? 1 : 0;
}

export function heroCanRideSteed(steed, state = game) {
    const mnum = state.u.umonnum;
    return !!steed.mtame && !!(MONSTER_FLAGS1[mnum] & M1_HUMANOID)
        && MONSTER_SIZE[mnum] >= MZ_SMALL && MONSTER_SIZE[mnum] < MZ_LARGE
        && (!state.u.uinwater || !!(MONSTER_FLAGS1[steed.mnum] & M1_SWIM));
}

function steedName(steed) {
    const species = monsterTypeName(steed.mnum, !!steed.female);
    return MGIVENNAME(steed) || `the ${monsterSaddle(steed) ? 'saddled ' : ''}${species}`;
}

function steedSubject(steed) {
    const name = steedName(steed);
    return name.charAt(0).toUpperCase() + name.slice(1);
}

function ridingStepIsClear(state, x, y) {
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

async function mountSteed(steed, force) {
    const hero = game.u;
    if (heroIsHallucinating() && !force) {
        await pline('Maybe you should find a designated driver.');
        return false;
    }
    if (hero._woundedLegTurns > 0) {
        const both = hero._woundedLegSide === 'both';
        const leg = both ? makePlural(heroLegName())
            : `${hero._woundedLegSide} ${heroLegName()}`;
        await pline(`Your ${leg} ${both ? 'are' : 'is'} in no shape for riding.`);
        if (force && game.flags.debug
            && await promptYesNo(`Heal your leg${both ? 's' : ''}? [yn] (n) `) === 'y') {
            for (const message of healHeroLegs().messages)
                await plineWithContinuation(message);
        } else return false;
    }
    const bodyFlags = MONSTER_FLAGS1[hero.umonnum];
    const bodySize = MONSTER_SIZE[hero.umonnum];
    if (Upolyd(hero) && (!(bodyFlags & M1_HUMANOID)
        || bodySize < MZ_SMALL || bodySize >= MZ_LARGE || (bodyFlags & M1_SLITHY))) {
        await pline("You won't fit on a saddle.");
        return false;
    }
    if (!force && nearCapacity(game) > SLT_ENCUMBER) {
        await pline("You can't do that while carrying so much stuff.");
        return false;
    }
    if (!steed || (!force && ((heroIsBlind() && !hero.telepathy)
        || steed.mundetected
        || [M_AP_FURNITURE, M_AP_OBJECT].includes(steed.m_ap_type & M_AP_TYPMASK)))) {
        await pline('I see nobody there.');
        return false;
    }
    if (MONSTER_NAME[steed.mnum] === 'long worm'
        && (hero.ux + hero.dx !== steed.mx || hero.uy + hero.dy !== steed.my)) {
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
        const trapName = TRAP_EXPLANATIONS[trap.ttyp];
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
    if (!force && hero.uinwater && !(MONSTER_FLAGS1[steed.mnum] & M1_SWIM)) {
        await pline("You can't ride that creature while under water.");
        return false;
    }
    if (!monsterCanBeSaddled(steed) || !heroCanRideSteed(steed)) {
        await pline("You can't ride such a creature.");
        return false;
    }
    const steedFlags = MONSTER_FLAGS1[steed.mnum];
    const floats = [S_EYE, S_LIGHT].includes(MONSTER_SYMBOL[steed.mnum]);
    const flies = !!(steedFlags & M1_FLY);
    if (!force && !floats && !flies && hero.levitation && !levitationAtWill()) {
        await pline(`You cannot reach ${steedName(steed)}.`);
        return false;
    }
    const armor = game.uarm || hero.uarm;
    const material = armor && objectMaterial(armor);
    if (!force && armor && material >= IRON && material <= MITHRIL
        && (armor.oeroded || armor.oeroded2)) {
        const damage = armor.oeroded ? 'rusty' : 'corroded';
        await pline(`Your ${damage} armor is too stiff to be able to mount ${steedName(steed)}.`);
        return false;
    }
    if (!force && (hero.confusionTurns > 0 || hero.fumbling || hero.fumblingTurns > 0
        || hero.glibTurns > 0
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
    const wasStealthy = hero.stealth;
    hero.usteed = steed;
    refreshMovementProperties(game);
    if (wasStealthy && !hero.stealth)
        await plineWithContinuation("You aren't stealthy anymore.");
    game.level.monsters = game.level.monsters.filter(monster => monster !== steed);
    const movement = moveHeroByTeleport(steed.mx, steed.my, game);
    newsym(movement.oldx, movement.oldy);
    vision_recalc(1);
    newsym(hero.ux, hero.uy);
    await applyHeroLocationEffects();
    return true;
}

async function wakeSteedForRiding(steed) {
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
    if ((steed.m_ap_type & M_AP_TYPMASK) && MONSTER_SYMBOL[steed.mnum] !== 13) {
        steed.m_ap_type = 0;
        steed.mappearance = 0;
        newsym(steed.mx, steed.my);
    }
}

export function putSaddleOnMonster(saddle, monster) {
    if (!saddle || !monsterCanBeSaddled(monster) || monsterSaddle(monster))
        return null;
    const carriedSaddle = addObjectToMonsterInventory(monster, saddle);
    carriedSaddle.owornmask = W_SADDLE;
    carriedSaddle.leashmon = monster.m_id;
    monster.misc_worn_check = (monster.misc_worn_check ?? 0) | W_SADDLE;
    monster.saddled = true;
    monster.saddle = carriedSaddle;
    return carriedSaddle;
}

const DISMOUNT_DIRECTIONS = [
    [-1, 0], [-1, -1], [0, -1], [1, -1],
    [1, 0], [1, 1], [0, 1], [-1, 1],
];

function openLandingSquare(state, x, y, steed) {
    if (!isok(x, y)) return false;
    const location = state.level?.at?.(x, y);
    if (!location || !ACCESSIBLE(location.typ)) return false;
    if (location.typ === DOOR
        && (location.doormask & (D_CLOSED | D_LOCKED))) return false;
    return !(state.level?.monsters || []).some(monster => monster !== steed
        && !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y);
}

function landingSpot(state, steed, reason, random) {
    const avoidHazards = reason === DISMOUNT_BYCHOICE
        && !(state.u?.stunned || state.u?.confused || state.u?.fumbling);
    const firstPass = avoidHazards ? 0
        : reason === DISMOUNT_BYCHOICE ? 1 : 2;
    let viable = 0;

    for (let pass = firstPass; pass <= 2; pass++) {
        let selected = null;
        let shortest = Infinity;
        for (const [dx, dy] of DISMOUNT_DIRECTIONS) {
            const x = state.u.ux + dx;
            const y = state.u.uy + dy;
            if (!openLandingSquare(state, x, y, steed)) continue;
            viable++;

            const knownTrap = pass === 0
                && state.level?.traps?.some(trap => trap.tseen
                    && (trap.tx ?? trap.x) === x
                    && (trap.ty ?? trap.y) === y);
            const boulder = pass <= 1
                && (state.level?.objects?.[x]?.[y] || []).some(object =>
                    object.otyp === BOULDER);
            if (knownTrap || boulder) continue;

            const distance = dx * dx + dy * dy;
            if (distance < shortest
                || (distance === shortest && random(viable) === 0)) {
                selected = { x, y };
                shortest = distance;
            }
        }
        if (selected) return selected;
    }
    return null;
}

function moveSteedOffHero(state, steed, random) {
    const candidates = DISMOUNT_DIRECTIONS
        .map(([dx, dy]) => ({ x: state.u.ux + dx, y: state.u.uy + dy }))
        .filter(point => openLandingSquare(
            state, point.x, point.y, steed,
        ));
    if (!candidates.length) return false;
    const point = candidates[random(candidates.length)];
    steed.mx = point.x;
    steed.my = point.y;
    return true;
}

function unnamedSteedMessage(steed) {
    const name = monsterTypeName(steed.mnum, !!steed.female);
    const article = /^[aeiou]/i.test(name) ? 'an' : 'a';
    return `You've been through the dungeon on ${article} ${name} with no name.`;
}

async function releaseSteedLeash(steed, state, announce) {
    if (!steed.mleashed) return;
    releaseMonsterLeash(steed, state);

    const name = steed.name || `The ${monsterTypeName(
        steed.mnum, !!steed.female,
    )}`;
    const pronoun = steed.female ? 'her' : 'its';
    await announce(`${name} pulls free of ${pronoun} leash!`);
}

export async function dismountHero(
    reason,
    {
        state = game,
        random = rn2,
        announce = async () => {},
    } = {},
) {
    const hero = state.u;
    const steed = hero?.usteed;
    if (!steed) return { dismounted: false };

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

    const landing = landingSpot(state, steed, reason, random);
    if (reason === DISMOUNT_BYCHOICE && !landing) {
        await announce("You can't.  There isn't anywhere for you to stand.");
        return { dismounted: false };
    }
    if (reason === DISMOUNT_BYCHOICE) {
        const givenName = MGIVENNAME(steed);
        await announce(givenName
            ? `You dismount ${givenName}.`
            : unnamedSteedMessage(steed));
    }

    const oldx = hero.ux;
    const oldy = hero.uy;
    hero.usteed = null;
    refreshMovementProperties(state);
    hero.ugallop = 0;
    steed.mx = oldx;
    steed.my = oldy;
    if (!state.level.monsters) state.level.monsters = [];
    if (!state.level.monsters.includes(steed))
        state.level.monsters.push(steed);

    let liquid = null;
    if (landing && IS_POOL(state.level?.at?.(oldx, oldy)?.typ)) {
        liquid = await resolveMonsterLiquid(steed, state, {
            announce,
            finishDeath: finishMonsterLiquidDeath,
            monsterMoving: false,
            random,
        });
        if (liquid?.dead && hero.ualign)
            hero.ualign.record = (hero.ualign.record ?? 0) - 1;
    }

    const steedLives = !steed.dead && (steed.mhp ?? 1) > 0;
    let movement = null;
    if (landing && steedLives) {
        movement = moveHeroByTeleport(landing.x, landing.y, state);
    } else if (steedLives) {
        moveSteedOffHero(state, steed, random);
    }

    return {
        dismounted: true,
        steed,
        movement,
        liquid,
    };
}

// Kicks and bullwhips share steed.c:kick_steed().  The caller prints the
// initial hit; this function owns the steed's response and riding state.
export async function strikeSteed({
    state = game,
    random = rn2,
    roll = rnd,
    announce = async () => {},
} = {}) {
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
        else if (steed.mfrozen > 2) steed.mfrozen -= 2;
        else {
            steed.mfrozen = 0;
            steed.mcanmove = 1;
        }
        const remainsHelpless = !!(steed.msleeping || steed.mcanmove === 0
            || (steed.mfrozen ?? 0) > 0);
        await announce(remainsHelpless ? 'It stirs.' : 'It rouses itself!');
        return { struck: true, helpless: remainsHelpless };
    }

    if (steed.mtame > 0) steed.mtame--;
    steed.pet = steed.mtame > 0;
    if (!steed.mtame) await releaseSteedLeash(steed, state, announce);
    const resisted = steed.mtame > 0
        && (hero.ulevel ?? 1) + steed.mtame >= roll(20);
    if (!resisted) {
        const oldx = hero.ux;
        const oldy = hero.uy;
        newsym(steed.mx, steed.my);
        const dismount = await dismountHero(DISMOUNT_THROWN, {
            state,
            random,
            announce,
        });
        if (dismount.movement) {
            newsym(oldx, oldy);
            vision_recalc(1);
            newsym(hero.ux, hero.uy);
        }
        return { struck: true, thrown: dismount.dismounted };
    }

    const name = steed.name || `The ${monsterTypeName(
        steed.mnum, !!steed.female,
    )}`;
    await announce(`${name} gallops!`);
    hero.ugallop = (hero.ugallop ?? 0) + random(20) + 30;
    return { struck: true, galloped: true };
}
