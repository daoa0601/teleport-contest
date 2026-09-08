// dungeon.js — Dungeon graph and special-level placement.
// C ref: dungeon.c — init_dungeons(), init_level(), place_level().
// Data ref: dat/dungeon.lua.

import { game } from './gstate.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { rn2 } from './rng.js';
import {
    ALTAR, COLNO, FOUNTAIN, GRAVE, In_endgame, ROOMOFFSET, ROWNO,
    SHOPBASE, SINK, THRONE, TREE,
} from './const.js';
import { depth } from './hacklib.js';

const WIZARD_TOWER_LEVELS = new Set(['wizard1', 'wizard2', 'wizard3']);

// The teleport exclusions in the three Wizard levels mark the tower walls.
// C dungeon.c exposes the same area as In_W_tower().
export function insideWizardTower(x, y, state = game) {
    const specialLevel = state._activeSpecialLevel;
    if (!WIZARD_TOWER_LEVELS.has(specialLevel?.prototype)) return false;
    const boundary = specialLevel.downTeleportExclude
        || specialLevel.upTeleportExclude;
    return !!boundary
        && x >= boundary.lx && x <= boundary.hx
        && y >= boundary.ly && y <= boundary.hy;
}

// Upward-building branches are harder than their displayed local depth because
// the hero must descend to the branch entrance before climbing back up.
export function level_difficulty() {
    const uz = game.u?.uz;
    if (In_endgame(uz)) {
        return depth(game.sanctum_level)
            + Math.trunc((game.u?.ulevel || 1) / 2);
    }
    if (game.u?.uhave?.amulet) {
        let deepest = depth(uz);
        for (const key of game._levelCache?.keys?.() || []) {
            const [dnum, dlevel] = String(key).split(':').map(Number);
            if (!Number.isInteger(dnum) || !Number.isInteger(dlevel))
                continue;
            deepest = Math.max(deepest, depth({ dnum, dlevel }));
        }
        return deepest;
    }
    let difficulty = depth(uz);
    const dungeon = game.dungeons?.[uz?.dnum ?? 0];
    if ((dungeon?.entry_lev ?? 1) > 1) {
        difficulty += 2 * (dungeon.entry_lev - (uz?.dlevel ?? 1) + 1);
    }
    return difficulty;
}

// C dungeon.c:recalc_mapseen().  The overview records what the hero has
// learned about the current level, not every feature in the live map.
export function recordMappedOverviewState({ mapped = false } = {}) {
    const level = game.level;
    const dnum = game.u?.uz?.dnum ?? 0;
    const dlevel = game.u?.uz?.dlevel ?? 1;
    const cap3 = count => Math.min(3, count);
    const countTerrain = typ => {
        let count = 0;
        for (let x = 1; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++) {
                const loc = level?.at(x, y);
                if (loc?.typ !== typ) continue;
                if (loc.seenv || (x === game.u?.ux && y === game.u?.uy))
                    count++;
            }
        }
        return cap3(count);
    };
    const heroRoom = level?.at(game.u?.ux, game.u?.uy)?.roomno;
    const shops = (level?.rooms || [])
        .slice(0, level?.nroom ?? 0)
        .filter((room, index) => (room?.rtype ?? 0) >= SHOPBASE
            && (mapped || heroRoom === (
                room.roomnoidx ?? index
            ) + ROOMOFFSET));
    const sourceBranch = game.branches?.find(candidate =>
        candidate.end1?.dnum === dnum
        && candidate.end1?.dlevel === dlevel);
    const prior = game._overviewRecords?.get?.(`${dnum}:${dlevel}`);
    const branch = mapped && sourceBranch ? {
        up: !!sourceBranch.end1_up,
        dnum: sourceBranch.end2.dnum,
        dlevel: sourceBranch.end2.dlevel,
    } : prior?.branch || null;
    if (!game._overviewRecords) game._overviewRecords = new Map();
    game._overviewRecords.set(`${dnum}:${dlevel}`, {
        features: {
            nshop: mapped ? cap3(shops.length)
                : Math.max(prior?.features?.nshop || 0, cap3(shops.length)),
            shoptype: shops.length === 1 ? shops[0].rtype
                : prior?.features?.shoptype || 0,
            nfount: countTerrain(FOUNTAIN),
            nsink: countTerrain(SINK),
            naltar: countTerrain(ALTAR),
            nthrone: countTerrain(THRONE),
            ngrave: countTerrain(GRAVE),
            ntree: countTerrain(TREE),
        },
        branch,
    });
}

// The Lua runtime supplies the data. This module owns dungeon.c's placement
// and branch construction rules.
function flagNames(flags) {
    if (!flags) return [];
    return Array.isArray(flags) ? flags : [flags];
}
function levelDefinition(source) {
    return {
        name: source.name,
        base: source.base,
        range: source.range,
        chance: source.chance,
        chain: source.chainlevel,
        variants: source.nlevels || 1,
        alignment: source.alignment,
        flags: flagNames(source.flags),
        bonetag: source.bonetag,
    };
}

function dungeonDefinition(source) {
    const flags = flagNames(source.flags);
    return {
        name: source.name,
        base: source.base,
        range: source.range,
        chance: source.chance,
        entry: source.entry,
        alignment: source.alignment,
        bonetag: source.bonetag,
        protofile: source.protofile,
        levelFill: source.lvlfill,
        themeRooms: source.themerooms,
        unconnected: flags.includes('unconnected'),
        flags: {
            maze_like: flags.includes('mazelike'),
            hellish: flags.includes('hellish'),
            alignment: source.alignment,
        },
        branches: (source.branches || []).map(branch => ({
            name: branch.name,
            base: branch.base,
            range: branch.range,
            chain: branch.chainlevel,
            up: branch.direction === 'up',
            branchType: branch.branchtype,
        })),
        levels: (source.levels || []).map(levelDefinition),
    };
}

export function loadDungeonDefinitions() {
    const definitions = currentLuaLifecycle().loadData(
        game, 'dungeon.lua', 'dungeon',
    );
    if (!Array.isArray(definitions))
        throw new Error('dungeon.lua did not define a dungeon array');
    return definitions.map(dungeonDefinition);
}

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

    const definitions = loadDungeonDefinitions();
    for (const definition of definitions) {
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
            bonetag: definition.bonetag,
            protofile: definition.protofile,
            levelFill: definition.levelFill,
            themeRooms: definition.themeRooms,
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

export function specialDisplayName(name) {
    if (name.startsWith('x-')) {
        const code = game.urole?.filecode || 'Wiz';
        return `${code}-${name.slice(2)}`;
    }
    return name;
}

export function specialPrototypeAt(dnum, dlevel) {
    for (const [name, level] of game.specialLevels || []) {
        if (level.dnum === dnum && level.dlevel === dlevel)
            return specialDisplayName(name);
    }

    // C mklev.c:makelevel() sends otherwise ordinary Quest depths through
    // the selected role's room-form filler.  The locate level is the split:
    // shallower homes use <role>-fila, deeper homes use <role>-filb.  Named
    // start/locate/goal levels won above and retain their own prototypes.
    if (game.dungeons?.[dnum]?.dname === 'The Quest') {
        const code = game.urole?.filecode;
        const locate = Array.from(game.specialLevels || [])
            .find(([name, level]) => level.dnum === dnum
                && specialDisplayName(name) === `${code}-loca`);
        if (code && locate)
            return `${code}-fil${dlevel < locate[1].dlevel ? 'a' : 'b'}`;
    }
    return null;
}
