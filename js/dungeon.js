// dungeon.js — Dungeon graph and special-level placement.
// C ref: dungeon.c — init_dungeons(), init_level(), place_level().
// Data ref: dat/dungeon.lua.

import { game } from './gstate.js';
import { rn2 } from './rng.js';

// Runtime-safe transcription of NetHack 5.0's dungeon.lua.  The contest
// sandbox cannot read data files, so the compiled JS port carries this table.
const DUNGEON_DEFINITIONS = [
    {
        name: 'The Dungeons of Doom', base: 25, range: 5,
        levels: [
            { name: 'rogue', base: 15, range: 4 },
            { name: 'oracle', base: 5, range: 5 },
            { name: 'bigrm', base: 10, range: 3, chance: 40, variants: 13 },
            { name: 'medusa', base: -5, range: 4, variants: 4 },
            { name: 'castle', base: -1 },
        ],
        branches: [
            { name: 'The Gnomish Mines', base: 2, range: 3 },
            { name: 'Sokoban', chain: 'oracle', base: 1, up: true },
            {
                name: 'The Quest', chain: 'oracle', base: 6, range: 2,
                branchType: 'portal',
            },
            {
                name: 'Fort Ludios', base: 18, range: 4,
                branchType: 'portal',
            },
            {
                name: 'Gehennom', chain: 'castle', base: 0,
                branchType: 'no_down',
            },
            {
                name: 'The Elemental Planes', base: 1, up: true,
                branchType: 'no_down',
            },
        ],
    },
    {
        name: 'Gehennom', base: 20, range: 5, flags: { maze_like: true, hellish: true },
        levels: [
            { name: 'valley', base: 1 },
            { name: 'sanctum', base: -1 },
            { name: 'juiblex', base: 4, range: 4 },
            { name: 'baalz', base: 6, range: 4 },
            { name: 'asmodeus', base: 2, range: 6 },
            { name: 'wizard1', base: 11, range: 6 },
            { name: 'wizard2', chain: 'wizard1', base: 1 },
            { name: 'wizard3', chain: 'wizard1', base: 2 },
            { name: 'orcus', base: 10, range: 6 },
            { name: 'fakewiz1', base: -6, range: 4 },
            { name: 'fakewiz2', base: -6, range: 4 },
        ],
        branches: [{ name: "Vlad's Tower", base: 9, range: 5, up: true }],
    },
    {
        name: 'The Gnomish Mines', base: 8, range: 2,
        flags: { maze_like: true },
        levels: [
            { name: 'minetn', base: 3, range: 2, variants: 7 },
            { name: 'minend', base: -1, variants: 3 },
        ],
    },
    {
        name: 'The Quest', base: 5, range: 2,
        levels: [
            { name: 'x-strt', base: 1, range: 1 },
            { name: 'x-loca', base: 3, range: 1 },
            { name: 'x-goal', base: -1 },
        ],
    },
    {
        name: 'Sokoban', base: 4, entry: -1,
        flags: { maze_like: true },
        levels: [
            { name: 'soko1', base: 1, variants: 2 },
            { name: 'soko2', base: 2, variants: 2 },
            { name: 'soko3', base: 3, variants: 2 },
            { name: 'soko4', base: 4, variants: 2 },
        ],
    },
    {
        name: 'Fort Ludios', base: 1, flags: { maze_like: true },
        levels: [{ name: 'knox', base: -1 }],
    },
    {
        name: "Vlad's Tower", base: 3, entry: -1,
        flags: { maze_like: true },
        levels: [
            { name: 'tower1', base: 1 },
            { name: 'tower2', base: 2 },
            { name: 'tower3', base: 3 },
        ],
    },
    {
        name: 'The Elemental Planes', base: 6, entry: -2,
        flags: { maze_like: true },
        levels: [
            { name: 'astral', base: 1 },
            { name: 'water', base: 2 },
            { name: 'fire', base: 3 },
            { name: 'air', base: 4 },
            { name: 'earth', base: 5 },
            { name: 'dummy', base: 6 },
        ],
    },
    {
        name: 'The Tutorial', base: 2, unconnected: true,
        flags: { maze_like: true },
        levels: [
            { name: 'tut-1', base: 1 },
            { name: 'tut-2', base: 2 },
        ],
    },
];

function levelRange(dungeon, spec, finalByName) {
    let base = spec.base;
    if (spec.chain) {
        const chained = finalByName.get(spec.chain);
        if (!chained) throw new Error(`missing chained level ${spec.chain}`);
        base += chained.dlevel;
    } else if (base < 0) {
        base = dungeon.num_dunlevs + base + 1;
    }
    const range = spec.range ?? 0;
    const count = range === -1
        ? dungeon.num_dunlevs - base + 1
        : range
            ? Math.min(range, dungeon.num_dunlevs - base + 1)
            : 1;
    return { base, count };
}

function possiblePlaces(index, levels, dungeon, finalByName) {
    const level = levels[index];
    const { base, count: rawCount } = levelRange(dungeon, level.spec, finalByName);
    const places = [];
    for (let dlevel = base; dlevel < base + rawCount; dlevel++) places.push(dlevel);
    for (let earlier = 0; earlier < index; earlier++) {
        const occupied = levels[earlier]?.dlevel;
        if (occupied) {
            const position = places.indexOf(occupied);
            if (position >= 0) places.splice(position, 1);
        }
    }
    return places;
}

// Direct port of dungeon.c place_level(): recursively try placements and
// backtrack only when a later special level has no valid square.
function placeLevels(index, levels, dungeon, finalByName) {
    if (index === levels.length) return true;
    const level = levels[index];
    if (!level) return placeLevels(index + 1, levels, dungeon, finalByName);

    const places = possiblePlaces(index, levels, dungeon, finalByName);
    while (places.length) {
        const selected = rn2(places.length);
        level.dlevel = places[selected];
        if (placeLevels(index + 1, levels, dungeon, finalByName)) return true;
        places.splice(selected, 1);
    }
    level.dlevel = 0;
    return false;
}

function findParent(childName, loaded) {
    for (let dnum = 0; dnum < loaded.length; dnum++) {
        const branch = loaded[dnum].definition.branches?.find(candidate => candidate.name === childName);
        if (branch) return { dnum, branch };
    }
    return null;
}

function branchLevel(parent, branch, branches) {
    const { base, count } = levelRange(parent.dungeon, branch, parent.finalByName);
    let start = rn2(count);
    let candidate = start;
    do {
        candidate += 1;
        if (candidate >= count) candidate = 0;
        const dlevel = base + candidate;
        const occupied = branches.some(existing =>
            (existing.end1.dnum === parent.dnum && existing.end1.dlevel === dlevel)
            || (existing.end2.dnum === parent.dnum && existing.end2.dlevel === dlevel));
        if (!occupied) return dlevel;
    } while (candidate !== start);
    return base + candidate;
}

function entryLevel(definition, count) {
    const entry = definition.entry || 0;
    if (entry < 0) return Math.max(1, count + entry + 1);
    if (entry > 0) return Math.min(entry, count);
    return 1;
}

// C dungeon.c:correct_branch_type().  Retain the corrected branch kind on
// the live graph so traversal, level menus, and #wizwhere all project the
// same Lua-owned branch semantics.
function correctedBranchType(spec) {
    if (spec.branchType === 'portal') return 'portal';
    if (spec.branchType === 'no_up')
        return spec.up ? 'no_end1' : 'no_end2';
    if (spec.branchType === 'no_down')
        return spec.up ? 'no_end2' : 'no_end1';
    return 'stair';
}

function exposeSpecialLevels(loaded) {
    const all = new Map();
    for (const entry of loaded) {
        for (const level of entry.levels) {
            if (level) all.set(level.name, { dnum: entry.dnum, dlevel: level.dlevel });
        }
    }
    game.specialLevels = all;
    game.oracle_level = all.get('oracle');
    game.medusa_level = all.get('medusa');
    game.knox_level = all.get('knox');
    game.stronghold_level = all.get('castle');
    game.valley_level = all.get('valley');
    game.sanctum_level = all.get('sanctum');
    game.astral_level = all.get('astral');
    game.water_level = all.get('water');
    game.fire_level = all.get('fire');
    game.air_level = all.get('air');
    game.earth_level = all.get('earth');
}

export function init_dungeons() {
    const loaded = [];
    const branches = [];

    for (const definition of DUNGEON_DEFINITIONS) {
        const chance = definition.chance ?? 100;
        if (!game.flags?.debug && chance && chance <= rn2(100)) continue;

        const dnum = loaded.length;
        const num_dunlevs = definition.range
            ? definition.base + rn2(definition.range)
            : definition.base;
        const dungeon = {
            dname: definition.name,
            num_dunlevs,
            entry_lev: entryLevel(definition, num_dunlevs),
            depth_start: dnum === 0 || definition.unconnected ? 1 : 0,
            flags: { ...(definition.flags || {}) },
        };
        if (!definition.unconnected && dnum > 0) {
            const parentInfo = findParent(definition.name, loaded);
            if (!parentInfo) throw new Error(`missing parent branch for ${definition.name}`);
            const parent = loaded[parentInfo.dnum];
            const parentLevel = branchLevel(parent, parentInfo.branch, branches);
            const branch = {
                end1: { dnum: parentInfo.dnum, dlevel: parentLevel },
                end2: { dnum, dlevel: dungeon.entry_lev },
                end1_up: !!parentInfo.branch.up,
                type: correctedBranchType(parentInfo.branch),
                portal: parentInfo.branch.branchType === 'portal',
            };
            branches.push(branch);
            const parentDepth = parent.dungeon.depth_start + parentLevel - 1;
            dungeon.depth_start = parentDepth
                + (branch.portal ? 0 : branch.end1_up ? -1 : 1)
                - (dungeon.entry_lev - 1);
        }

        // C initializes the parent branch before rolling whether each special
        // level exists, so parent_dlevel()'s RNG call precedes init_level().
        const finalByName = new Map();
        const levels = (definition.levels || []).map(spec => {
            const levelChance = spec.chance ?? 100;
            if (!game.flags?.debug && levelChance <= rn2(100)) return null;
            const level = { name: spec.name, spec, dlevel: 0, variants: spec.variants || 1 };
            finalByName.set(spec.name, level);
            return level;
        });
        const entry = { dnum, definition, dungeon, levels, finalByName };

        if (!placeLevels(0, levels, dungeon, finalByName)) {
            throw new Error(`could not place special levels in ${definition.name}`);
        }
        loaded.push(entry);
    }

    const castleTune = [];
    for (let i = 0; i < 5; i++)
        castleTune.push(String.fromCharCode('A'.charCodeAt(0) + rn2(7)));
    game.castleTune = castleTune.join(''); // init_castle_tune()

    game.dungeons = loaded.map(entry => entry.dungeon);
    game.branches = branches;
    exposeSpecialLevels(loaded);
    // C dungeon.c:fixup_level_locations() leaves Fort Ludios floating by
    // replacing its source dungeon with the out-of-range n_dgns sentinel.
    // mk_knox_portal() resolves that endpoint only after an eligible deep
    // vault is generated.
    const knoxBranch = branches.find(branch =>
        game.dungeons?.[branch.end2?.dnum]?.dname === 'Fort Ludios');
    if (knoxBranch) knoxBranch.end1.dnum = loaded.length;
}

export { DUNGEON_DEFINITIONS };
