// Moving a monster after a forceful hit.
// C refs: dothrow.c:will_hurtle(), mhurtle(), and uhitm.c:mhurtle_to_doom().

import { game } from './gstate.js';
import {
    D_CLOSED, D_LOCKED, DOOR, IRONBARS, IS_OBSTRUCTED, IS_STWALL,
    W_NONPASSWALL, isok,
} from './const.js';
import { canSpotMonster, newsym } from './display.js';
import {
    MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_MOVE,
    MONSTER_SIZE, MONSTER_SYMBOL,
} from './monster_data.js';
import { BOULDER } from './object_data.js';
import { resolveMonsterLiquid } from './mon.js';
import { triggerImmediateMonsterTrap } from './monmove.js';
import { rnd } from './rng.js';

const M1_FLY = 0x00000001;
const M1_AMORPHOUS = 0x00000004;
const M1_WALLWALK = 0x00000008;
const M1_SLITHY = 0x00080000;
const M1_UNSOLID = 0x00100000;
const M1_THICK_HIDE = 0x00200000;
const M1_METALLIVORE = 0x80000000;
const M1_NOLIMBS = 0x00006000;
const M2_ROCKTHROW = 0x08000000;
const S_EYE = 5;
const S_LIGHT = 25;
const S_VORTEX = 22;
const PM_GRID_BUG = 116;
const AD_RUST = 24;
const AD_CORR = 42;

function monsterAt(state, x, y, ignoredMonster) {
    return state.level?.monsters?.find(monster =>
        monster !== ignoredMonster && !monster.dead
        && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}

function monsterPassesBars(monster) {
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const size = MONSTER_SIZE[monster.mnum] ?? 2;
    const corrodesBars = (MONSTER_ATTACKS[monster.mnum] || [])
        .some(([, damageType]) => damageType === AD_RUST
            || damageType === AD_CORR);
    return !!(flags & (M1_WALLWALK | M1_AMORPHOUS | M1_UNSOLID
        | M1_METALLIVORE))
        || MONSTER_SYMBOL[monster.mnum] === S_VORTEX
        || size === 0 || corrodesBars
        || !!(flags & M1_SLITHY) && size < 3;
}

function destinationIsOpen(monster, state, x, y) {
    if (!isok(x, y) || x === state.u?.ux && y === state.u?.uy)
        return false;
    if (monsterAt(state, x, y, monster)) return false;

    const location = state.level?.at?.(x, y);
    if (!location) return false;
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const passesWall = !!(flags & M1_WALLWALK)
        && !(IS_STWALL(location.typ)
            && ((location.wall_info ?? 0) & W_NONPASSWALL));
    if (IS_OBSTRUCTED(location.typ) && !passesWall) return false;
    if (location.typ === DOOR
        && ((location.doormask ?? 0) & (D_CLOSED | D_LOCKED))) return false;
    if (location.typ === IRONBARS && !monsterPassesBars(monster)) return false;

    const boulder = (state.level?.objects?.[x]?.[y] || [])
        .some(object => object.otyp === BOULDER);
    return !boulder || !!(flags & M1_WALLWALK)
        || !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_ROCKTHROW);
}

function staggerVerb(monster) {
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[monster.mnum];
    if (symbol === S_EYE || symbol === S_LIGHT) return 'wobbles';
    if (flags & M1_FLY)
        return (MONSTER_SIZE[monster.mnum] ?? 2) <= 1
            ? 'flutters' : 'staggers';
    if (flags & M1_SLITHY) return 'falters';
    if (flags & M1_AMORPHOUS) return 'trembles';
    if ((MONSTER_MOVE[monster.mnum] ?? 0) === 0) return 'pulsates';
    if ((flags & M1_NOLIMBS) === M1_NOLIMBS) return 'falters';
    return 'staggers';
}

async function hurtleOneSquare(monster, dx, dy, {
    state,
    announce,
    nameMonster,
    wakeMonster,
    finishLiquidDeath,
}) {
    await wakeMonster();
    monster.movement = 0;
    monster.mstun = 1;

    if ((MONSTER_SIZE[monster.mnum] ?? 2) >= 4
        || monster === state.u?.ustuck || monster.mtrapped) {
        if (canSpotMonster(monster, monster.mx, monster.my))
            await announce(`${nameMonster(monster)} doesn't budge!`);
        return { moved: false, dead: false };
    }

    dx = Math.sign(dx);
    dy = Math.sign(dy);
    if ((!dx && !dy) || (dx && dy && monster.mnum === PM_GRID_BUG))
        return { moved: false, dead: false };

    if (monster.mundetected) {
        monster.mundetected = 0;
        newsym(monster.mx, monster.my);
    }
    if (monster.m_ap_type) {
        monster.m_ap_type = 0;
        monster.mappearance = 0;
    }

    const oldX = monster.mx;
    const oldY = monster.my;
    const nextX = oldX + dx;
    const nextY = oldY + dy;
    if (!destinationIsOpen(monster, state, nextX, nextY)) {
        const occupant = monsterAt(state, nextX, nextY, monster);
        if (occupant && (canSpotMonster(monster, oldX, oldY)
            || canSpotMonster(occupant, nextX, nextY))) {
            const otherName = MONSTER_SYMBOL[occupant.mnum] == null
                ? 'a monster' : `a ${nameMonster(occupant)}`;
            await announce(`${nameMonster(monster)} bumps into ${otherName}.`);
        }
        if (occupant) occupant.msleeping = 0;
        return { moved: false, dead: false, occupant };
    }

    monster.mx = nextX;
    monster.my = nextY;
    newsym(oldX, oldY);
    newsym(nextX, nextY);

    const trap = triggerImmediateMonsterTrap(monster, state);
    if (trap.event) {
        return {
            moved: true,
            dead: (monster.mhp ?? 1) <= 0,
            trap: trap.event,
        };
    }

    const liquid = await resolveMonsterLiquid(monster, state, {
        announce,
        finishDeath: finishLiquidDeath,
        monsterMoving: false,
    });
    return {
        moved: true,
        dead: !!liquid?.dead || (monster.mhp ?? 1) <= 0,
        liquid,
    };
}

export async function tryUnarmedStagger(monster, {
    skill,
    damage,
    dx,
    dy,
    state = game,
    announce = async () => {},
    nameMonster = target => target?.name || 'monster',
    wakeMonster = async () => {
        monster.msleeping = 0;
    },
    finishLiquidDeath,
} = {}) {
    if (rnd(100) >= skill) return { staggered: false };
    if ((MONSTER_SIZE[monster.mnum] ?? 2) >= 3
        || ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_THICK_HIDE)) {
        return { staggered: false };
    }

    if (canSpotMonster(monster, monster.mx, monster.my)) {
        await announce(
            `${nameMonster(monster)} ${staggerVerb(monster)} from your powerful strike!`,
        );
    }
    if (damage >= (monster.mhp ?? 1)) return { staggered: true };

    const hurtle = await hurtleOneSquare(monster, dx, dy, {
        state,
        announce,
        nameMonster,
        wakeMonster,
        finishLiquidDeath,
    });
    return { staggered: true, ...hurtle };
}
