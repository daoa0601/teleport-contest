// monmove.js — movement-ration state and the RNG-free movemon scan.
// C refs: allmain.c moveloop_core(), mon.c mcalcmove()/movemon().

import { rn2 } from './rng.js';
import { MONSTER_MOVE } from './monster_data.js';
import { IS_ROOM } from './const.js';

export const NORMAL_SPEED = 12;
export const MSLOW = 1;
export const MFAST = 2;

export function naturalMonsterSpeed(monster) {
    if (Number.isFinite(monster?.mmove)) return monster.mmove;
    return MONSTER_MOVE[monster?.mnum] ?? 0;
}

export function initializeMonsterMovement(monster) {
    if (!monster) return monster;
    if (!Number.isFinite(monster.movement)) monster.movement = 0;
    if (!Number.isFinite(monster.mmove))
        monster.mmove = naturalMonsterSpeed(monster);
    if (!Number.isFinite(monster.mspeed)) monster.mspeed = 0;
    return monster;
}

// JS stores monsters in creation order by appending to level.monsters.
// C's makemon() prepends to fmon, so all scheduler traversals are reversed.
export function monstersInFmonOrder(monsters = []) {
    return Array.from(monsters).reverse();
}

// C ref: mon.c mcalcmove(). `random` is injectable for deterministic unit
// tests; production always uses the core PRNG wrapper.
export function mcalcmove(monster, moving = true, random = rn2) {
    initializeMonsterMovement(monster);
    let mmove = naturalMonsterSpeed(monster);

    if (monster.mspeed === MSLOW) {
        mmove = mmove < NORMAL_SPEED
            ? Math.trunc((2 * mmove + 1) / 3)
            : 4 + Math.trunc(mmove / 3);
    } else if (monster.mspeed === MFAST) {
        mmove = Math.trunc((4 * mmove + 2) / 3);
    }

    if (moving) {
        const adjustment = mmove % NORMAL_SPEED;
        mmove -= adjustment;
        // NetHack performs this draw even when adjustment is zero.
        if (random(NORMAL_SPEED) < adjustment) mmove += NORMAL_SPEED;
    }
    return mmove;
}

export function allocateMonsterMovement(monsters = [], random = rn2) {
    const allocations = [];
    for (const monster of monstersInFmonOrder(monsters)) {
        const amount = mcalcmove(monster, true, random);
        monster.movement += amount;
        allocations.push({ monster, amount, movement: monster.movement });
    }
    return allocations;
}

function schedulable(monster) {
    return monster && (monster.mhp ?? 1) > 0
        && monster.mx !== 0 && monster.my !== 0;
}

// The quiet part of mon.c:movemon(): scan in fmon order, debit one ration
// from every eligible actor, and repeat only while an actor retained another
// full ration. Actor behavior is deliberately left to dochug()/dog_move().
export function scanMonsterMovement(monsters = [], options = {}) {
    const heroMovement = options.heroMovement ?? 0;
    const rounds = [];
    let somebodyCanMove;

    do {
        somebodyCanMove = false;
        const actors = [];
        for (const monster of monstersInFmonOrder(monsters)) {
            initializeMonsterMovement(monster);
            if (!schedulable(monster) || monster.movement < NORMAL_SPEED)
                continue;
            monster.movement -= NORMAL_SPEED;
            actors.push(monster);
            if (monster.movement >= NORMAL_SPEED) somebodyCanMove = true;
        }
        rounds.push(actors);
        if (heroMovement >= NORMAL_SPEED) break;
    } while (somebodyCanMove);

    return {
        rounds,
        actors: rounds.flat(),
        somebodyCanMove,
    };
}

// First non-combat slice of monmove.c:dochug() and dogmove.c:dog_goal().
// distfleeck() always draws the brave-gremlin roll. On the clean starting
// levels covered here, m_move()/dog_move() completes without extra item,
// attack, trap, or species RNG and dochug() recalculates distance afterward.
// Position selection is intentionally not claimed here; that is the next
// mfndpos()/dog_move() slice.
export function quietMonsterActionRng(monster, state, random = rn2) {
    const calls = [5];
    random(5); // distfleeck() before movement

    if (monster?.pet) {
        const ux = state?.u?.ux ?? 0;
        const uy = state?.u?.uy ?? 0;
        const dx = (monster.mx ?? 0) - ux;
        const dy = (monster.my ?? 0) - uy;
        const udist = dx * dx + dy * dy;
        const heroTile = state?.level?.at?.(ux, uy);
        // dog_goal(): following the hero from a non-adjacent starting square.
        if (udist > 1 && IS_ROOM(heroTile?.typ ?? 0)) {
            random(4);
            calls.push(4);
        }
    }

    random(5); // distfleeck() after m_move()/dog_move()
    calls.push(5);
    return calls;
}

export function runQuietMonsterActions(actors, state, random = rn2) {
    return actors.map(monster => ({
        monster,
        calls: quietMonsterActionRng(monster, state, random),
    }));
}
