// stairs.js — the per-level stairway chain: lookup, hero placement on
// arrival, and stair descriptions.
// C ref: stairs.c — stairway_add, stairway_free_all, stairway_at,
// stairway_find, stairway_find_from, stairway_find_dir, stairway_find_type_dir,
// stairway_find_special_dir, u_on_sstairs, u_on_upstairs, u_on_dnstairs,
// On_stairs, On_ladder, On_stairs_up, On_stairs_dn, known_branch_stairs,
// stairs_description.
import { game } from './gstate.js';
import { dungeonDepth, placeHeroOnLevel, u_on_rndspot } from './dungeon.js';
// C stairs.c:stairway_add()
export function stairway_add(x, y, up, isladder, dest) {
    const node = {
        sx: x, sy: y, up, isladder, tolev: { ...dest },
        u_traversed: false,
        next: game.stairs,
    };
    game.stairs = node;
}
// C stairs.c:stairway_free_all(). The chain is garbage-collected, so freeing
// every node is just dropping the head.
export function stairway_free_all() {
    game.stairs = null;
}
// C stairs.c:stairway_at(). Walks the per-game stairway chain; callers that
// only need the square test wrap this in a truthiness check (On_stairs()).
export function stairwayAt(state, x, y) {
    for (let stair = state.stairs; stair; stair = stair.next) {
        if (stair.sx === x && stair.sy === y)
            return stair;
    }
    return null;
}
// C stairs.c:stairway_find()
export function stairway_find(state, fromdlev) {
    for (let stair = state.stairs; stair; stair = stair.next) {
        if (sameLevel(stair.tolev, fromdlev))
            return stair;
    }
    return null;
}
// C stairs.c:stairway_find_from()
export function stairway_find_from(state, fromdlev, isladder) {
    for (let stair = state.stairs; stair; stair = stair.next) {
        if (sameLevel(stair.tolev, fromdlev) && stair.isladder === isladder)
            return stair;
    }
    return null;
}
// C stairs.c:stairway_find_dir()
export function stairway_find_dir(up) {
    for (let s = game.stairs; s; s = s.next)
        if (s.up === up)
            return s;
    return null;
}
// C stairs.c:stairway_find_type_dir()
export function stairway_find_type_dir(state, isladder, up) {
    for (let s = state.stairs; s; s = s.next)
        if (s.isladder === isladder && s.up === up)
            return s;
    return null;
}
// C stairs.c:stairway_find_special_dir()
function stairway_find_special_dir(up) {
    for (let s = game.stairs; s; s = s.next)
        if (s.tolev.dnum !== (game.u?.uz?.dnum ?? 0) && s.up !== up)
            return s;
    return null;
}
// C stairs.c:u_on_sstairs()
// place the hero on the special (branch)
// staircase, falling back to a random arrival spot.
export async function u_on_sstairs(upflag) {
    const stway = stairway_find_special_dir(!!(upflag & 1));
    if (stway) {
        await placeHeroOnLevel(stway.sx, stway.sy);
        return;
    }
    await u_on_rndspot(!!(upflag & 1)
        ? game.level?.upTeleportRegion : game.level?.downTeleportRegion, !!(upflag & 1));
}
// C stairs.c:u_on_upstairs()
// place you on upstairs (or special
// equivalent).
export async function u_on_upstairs() {
    const stway = stairway_find_dir(true);
    if (stway) {
        await placeHeroOnLevel(stway.sx, stway.sy);
        return;
    }
    await u_on_sstairs(0); /* destination upstairs implies moving down */
}
// C stairs.c:u_on_dnstairs()
// place you on dnstairs (or special
// equivalent).
export async function u_on_downstairs() {
    const stway = stairway_find_dir(false);
    if (stway) {
        await placeHeroOnLevel(stway.sx, stway.sy);
        return;
    }
    await u_on_sstairs(1); /* destination dnstairs implies moving up */
}
// C stairs.c:On_stairs()
export function On_stairs(state, x, y) {
    return stairwayAt(state, x, y) !== null;
}
// C stairs.c:On_ladder()
export function On_ladder(state, x, y) {
    const stway = stairwayAt(state, x, y);
    return stway !== null && stway.isladder;
}
// C stairs.c:On_stairs_up()
export function On_stairs_up(state, x, y) {
    const stway = stairwayAt(state, x, y);
    return stway !== null && stway.up;
}
// C stairs.c:On_stairs_dn()
export function On_stairs_dn(state, x, y) {
    const stway = stairwayAt(state, x, y);
    return stway !== null && !stway.up;
}
// C stairs.c:known_branch_stairs(). True when 'sway' is a branch staircase
// and the hero has used these stairs to visit the branch.
export function known_branch_stairs(sway, state) {
    return sway !== null && sway.tolev.dnum !== (state.u.uz?.dnum ?? 0)
        && sway.u_traversed;
}
function sameLevel(left, right) {
    return !!right && left.dnum === right.dnum && left.dlevel === right.dlevel;
}
// C stairs.c:stairs_description(). Describes staircase 'sway' based on
// whether the hero knows the destination.
export function stairwayDescription(stairway, state) {
    const noun = stairway.isladder ? 'ladder' : 'staircase';
    const direction = stairway.up ? 'up' : 'down';
    const here = state.u.uz;
    if (!here)
        throw new Error('Stair description requires the hero dungeon position');
    const destination = stairway.tolev;
    if (!known_branch_stairs(stairway, state)) {
        /* ordinary stairs or branch stairs to not-yet-visited branch */
        if (!stairway.u_traversed)
            return `${noun} ${direction}`;
        const localDepth = destination.dnum === state.quest_dnum
            || sameLevel(destination, state.knox_level);
        const depth = localDepth ? destination.dlevel
            : dungeonDepth(destination.dnum, destination.dlevel, state.dungeons);
        return `${noun} ${direction} to level ${depth}`;
    }
    if (here.dnum === 0 && here.dlevel === 1 && stairway.up) {
        if (!state.u.uhave?.amulet)
            return `${noun} up out of the dungeon`;
        const elemental = [state.earth_level, state.air_level, state.fire_level, state.water_level]
            .some(level => sameLevel(destination, level));
        return `branch ${noun} up to ${elemental ? 'the Elemental Planes' : 'the end game'}`;
    }
    const descriptor = state.dungeons[destination.dnum];
    if (!descriptor)
        throw new Error(`Stair destination dungeon ${destination.dnum} does not exist`);
    const dungeon = descriptor.dname.replace(/^The /, 'the ');
    return `branch ${noun} ${direction} to ${dungeon}`;
}
//# sourceMappingURL=stairs.js.map