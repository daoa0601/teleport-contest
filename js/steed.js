// steed.js — Saddling, mounting, riding, and dismounting.
// C ref: steed.c.

import {
    ACCESSIBLE, D_CLOSED, D_LOCKED, DISMOUNT_BYCHOICE, DISMOUNT_THROWN,
    DOOR, IS_POOL, MGIVENNAME, W_SADDLE, isok,
} from './const.js';
import { game } from './gstate.js';
import { newsym, pline } from './display.js';
import { levelHasCeiling, resolveMonsterLiquid } from './mon.js';
import { finishMonsterLiquidDeath } from './monmove.js';
import {
    MONSTER_FLAGS1, MONSTER_SIZE, MONSTER_SYMBOL, monsterTypeName,
} from './monster_data.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { releaseMonsterLeash } from './monster_leash.js';
import { BOULDER } from './object_data.js';
import { rn2, rnd } from './rng.js';
import { moveHeroByTeleport } from './teleport.js';
import { promptKey } from './tty_prompts.js';
import { vision_recalc } from './vision.js';

const M1_FLY = 0x00000001;
const M1_AMORPHOUS = 0x00000004;
const M1_CLING = 0x00000010;
const M1_HUMANOID = 0x00020000;
const M1_UNSOLID = 0x00100000;
const MZ_MEDIUM = 2;
const S_EYE = 5;
const S_QUADRUPED = 17;
const S_UNICORN = 21;
const S_VORTEX = 22;
const S_LIGHT = 25;
const S_ANGEL = 27;
const S_CENTAUR = 29;
const S_DRAGON = 30;
const S_ELEMENTAL = 31;
const S_JABBERWOCK = 36;
const S_GHOST = 54;
const PM_AIR_ELEMENTAL = 154;
const SADDLE_CLASSES = new Set([
    S_QUADRUPED,
    S_UNICORN,
    S_ANGEL,
    S_CENTAUR,
    S_DRAGON,
    S_JABBERWOCK,
]);
const DIRECTION_X = { h: -1, l: 1, j: 0, k: 0, y: -1, u: 1, b: -1, n: 1 };
const DIRECTION_Y = { h: 0, l: 0, j: 1, k: -1, y: -1, u: -1, b: 1, n: 1 };

export function canSaddleMonster(monster) {
    if (!Number.isInteger(monster?.mnum)) return false;
    const monsterClass = MONSTER_SYMBOL[monster.mnum];
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    return SADDLE_CLASSES.has(monsterClass)
        && (MONSTER_SIZE[monster.mnum] ?? 0) >= MZ_MEDIUM
        && (!(flags & M1_HUMANOID) || monsterClass === S_CENTAUR)
        && !(flags & (M1_AMORPHOUS | M1_UNSOLID))
        && monsterClass !== S_GHOST
        && monsterClass !== S_VORTEX
        && !(monsterClass === S_ELEMENTAL
            && monster.mnum === PM_AIR_ELEMENTAL);
}

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
    const x = hero.ux + DIRECTION_X[direction];
    const y = hero.uy + DIRECTION_Y[direction];
    const steed = game.level?.monsters?.find(monster =>
        monster.mx === x && monster.my === y);
    if (!steed) {
        await pline('I see nobody there.');
        game.context.move = 0;
        return;
    }
    const steedName = steed.name || monsterTypeName(
        steed.mnum, !!steed.female,
    );
    if (!steed.saddled && !monsterSaddle(steed)) {
        await pline(`The ${steedName} is not saddled.`);
        game.context.move = 0;
        return;
    }
    if (!(steed.mtame > 0) || steed.isminion) {
        await pline(`I think the ${steedName} would mind.`);
        game.context.move = 0;
        return;
    }
    if (hero.ulevel + steed.mtame < rnd(20)) {
        const damage = 10 + rn2(5);
        hero.uhp = Math.max(0, (hero.uhp || 0) - damage);
        await pline(
            `You slip while trying to get on the saddled ${steedName}.`,
        );
        game.context.move = 0;
        return;
    }

    await pline(`You mount the saddled ${steedName}.`);
    game.level.monsters = game.level.monsters.filter(
        monster => monster !== steed,
    );
    hero.ux0 = hero.ux;
    hero.uy0 = hero.uy;
    hero.ux = steed.mx;
    hero.uy = steed.my;
    hero.usteed = steed;
    newsym(hero.ux0, hero.uy0);
    vision_recalc(1);
    newsym(hero.ux, hero.uy);
    game.context.move = 1;
}

export function putSaddleOnMonster(saddle, monster) {
    if (!saddle || !canSaddleMonster(monster) || monsterSaddle(monster))
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
