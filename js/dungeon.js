// dungeon.js — Dungeon graph and special-level placement.
// C ref: dungeon.c — init_dungeons(), init_level(), place_level().
// Data ref: dat/dungeon.lua.
import { game } from './gstate.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { rn2 } from './rng.js';
import { ALTAR, AM_MASK, Amask2align, COLNO, D_ALIGN_CHAOTIC, D_ALIGN_LAWFUL, D_ALIGN_MASK, D_ALIGN_NEUTRAL, FOUNTAIN, GRAVE, HELLISH, In_endgame, MAZELIKE, ROGUELIKE, ROOMOFFSET, ROWNO, SHOPBASE, SINK, THRONE, In_sokoban, TOWN, TREE, UNCONNECTED, TEMPLE, Is_astralevel, M_AP_TYPE, M_AP_FURNITURE, DELPHI, DOOR, DBWALL, DRAWBRIDGE_DOWN, Invocation_lev, VIBRATING_SQUARE, } from './const.js';
import { deepestLevelReached, depth, ledgerNo } from './hacklib.js';
import { updateLastSeenTerrain } from './display.js';
import { hasCarriedProperty, hasInvokedProperty, hasWornProperty, propertyIsActive } from './properties.js';
import { roomForIndex } from './room.js';
import { shopResident, shopkeeperInOwnShop } from './shk.js';
import { monsterAtPosition } from './monster_location.js';
import { CmapSymbol } from './glyph_numbers.js';
import { findDrawbridgeAt } from './dbridge.js';
import { heroIsBlind } from './senses.js';
const WIZARD_TOWER_LEVELS = new Set(['wizard1', 'wizard2', 'wizard3']);
const DUNGEON_FLAG_BITS = {
    town: TOWN, hellish: HELLISH, mazelike: MAZELIKE,
    roguelike: ROGUELIKE, unconnected: UNCONNECTED,
};
const DUNGEON_ALIGNMENT_BITS = {
    lawful: D_ALIGN_LAWFUL, neutral: D_ALIGN_NEUTRAL, chaotic: D_ALIGN_CHAOTIC,
    unaligned: 0, noalign: 0,
};
function packedDungeonFlags(flags) {
    return flags.reduce((bits, name) => bits | DUNGEON_FLAG_BITS[name], 0);
}
function packedDungeonAlignment(alignment) {
    return DUNGEON_ALIGNMENT_BITS[alignment];
}
function alignmentType(mask) {
    return mask ? Amask2align(mask) : null;
}
function currentDungeonLocation(state = game) {
    const location = state.u.uz;
    if (!location)
        throw new Error('Dungeon traversal requires the hero dungeon location.');
    return location;
}
// C Is_special(): the dungeon graph, rather than a generation script,
// determines whether the current depth has a special-level descriptor.
export function specialLevelAt(location = currentDungeonLocation(), state = game) {
    for (const level of state.specialLevels?.values() || []) {
        if (level.dnum === location.dnum && level.dlevel === location.dlevel)
            return level;
    }
    return null;
}
// C dungeon.c:induced_align(). Prefer a fixed level or dungeon alignment
// according to the requested percentage, then choose any ordinary alignment.
export function inducedAlignment(percent) {
    const specialAlignment = specialLevelAt()?.alignment;
    if (specialAlignment != null && rn2(100) < percent)
        return specialAlignment;
    const dungeonAlignment = game.dungeons?.[game.u?.uz?.dnum ?? 0]?.flags?.alignment;
    if (dungeonAlignment != null && rn2(100) < percent)
        return dungeonAlignment;
    return rn2(3) - 1;
}
export function levelIsWizardTower(state = game) {
    const prototype = state._activeSpecialLevel?.prototype;
    return prototype !== undefined && WIZARD_TOWER_LEVELS.has(prototype);
}
// The teleport exclusions in the three Wizard levels mark the tower walls.
// C dungeon.c exposes the same area as In_W_tower().
export function insideWizardTower(x, y, state = game) {
    const specialLevel = state._activeSpecialLevel;
    if (!specialLevel || !levelIsWizardTower(state))
        return false;
    const boundary = specialLevel.downTeleportExclude
        || specialLevel.upTeleportExclude;
    return !!boundary
        && x >= boundary.lx && x <= boundary.hx
        && y >= boundary.ly && y <= boundary.hy;
}
// C dungeon.c:builds_up(): a branch can enter at its bottom level.
export function dungeonBuildsUp(level = currentDungeonLocation(), state = game) {
    const dungeon = requireDungeon(state.dungeons, level.dnum);
    if (dungeon.num_dunlevs > 1)
        return dungeon.entry_lev === dungeon.num_dunlevs;
    const branch = state.branches?.find(branch => branch.end2.dnum === level.dnum && branch.end2.dlevel === level.dlevel);
    return !!branch?.end1_up;
}
// C dungeon.c:Can_rise_up(). Branch-top ascent requires its real up stair.
export function canHeroRiseUp(x, y, { state = game } = {}) {
    const level = currentDungeonLocation(state);
    if (In_endgame(level) || In_sokoban(level)
        || (state._activeSpecialLevel?.prototype === 'wizard1'
            && insideWizardTower(x, y, state)))
        return false;
    if (level.dlevel > 1)
        return true;
    let specialStair = state.stairs;
    while (specialStair && !(specialStair.tolev.dnum !== level.dnum
        && specialStair.up))
        specialStair = specialStair.next;
    return requireDungeon(state.dungeons, level.dnum).entry_lev === 1
        && ledgerNo(level) !== 1 && !!specialStair;
}
// C dungeon.c:get_level(): climb the actual parent graph when a depth is
// above this branch. Missing parents are invalid dungeon state.
export function levelAtDepth(requestedDepth, { state = game } = {}) {
    const location = currentDungeonLocation(state);
    let dnum = location.dnum;
    let dlevel;
    let dungeon = requireDungeon(state.dungeons, dnum);
    if (requestedDepth <= 0)
        dlevel = location.dlevel;
    else if (requestedDepth > dungeon.depth_start + dungeon.num_dunlevs - 1)
        dlevel = dungeon.num_dunlevs;
    else {
        while (requestedDepth < dungeon.depth_start) {
            const parent = state.branches.find(branch => branch.end2.dnum === dnum);
            if (!parent)
                throw new Error(`get_level: can't find parent dungeon ${dnum}`);
            dnum = parent.end1.dnum;
            dungeon = requireDungeon(state.dungeons, dnum);
        }
        dlevel = requestedDepth - dungeon.depth_start + 1;
    }
    return { dnum, dlevel };
}
export function level_difficulty() {
    const uz = game.u?.uz;
    let difficulty;
    if (In_endgame(uz)) {
        difficulty = depth(game.sanctum_level)
            + Math.trunc((game.u?.ulevel || 1) / 2);
    }
    else if (game.u?.uhave?.amulet) {
        difficulty = deepestLevelReached();
    }
    else {
        difficulty = depth(uz);
        const dungeon = game.dungeons?.[uz?.dnum ?? 0];
        // Reaching an upward branch requires descending to its entrance first.
        if (dungeon && dungeonBuildsUp(uz)) {
            difficulty += 2 * (dungeon.entry_lev - (uz?.dlevel ?? 1) + 1);
        }
    }
    if (hasWornProperty('aggravateMonster') || hasCarriedProperty('aggravateMonster')
        || hasInvokedProperty('aggravateMonster'))
        difficulty = difficulty > 25 ? 50 : difficulty * 2;
    return difficulty;
}
// C dungeon.c:recalc_mapseen().  The overview records what the hero has
// learned about the current level, not every feature in the live map.
export function recordMappedOverviewState({ discoveredRoom = null, state = game } = {}) {
    const level = state.level;
    if (!level)
        throw new Error('Overview knowledge requires the current map.');
    const { dnum, dlevel } = currentDungeonLocation(state);
    const prior = state._overviewRecords?.get(`${dnum}:${dlevel}`);
    const flags = currentOverviewFlags(prior, state);
    const seenRooms = new Set(prior?.seenRooms || []);
    const untendedRooms = new Set(prior?.untendedRooms || []);
    if (discoveredRoom != null)
        seenRooms.add(discoveredRoom);
    const cap3 = (count) => Math.min(3, count);
    if (!propertyIsActive('levitation', state))
        updateLastSeenTerrain(state.u.ux, state.u.uy);
    const countTerrain = (typ) => {
        let count = 0;
        for (let x = 1; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++) {
                const loc = level?.at(x, y);
                if (loc?.lastseentyp === typ)
                    count++;
            }
        }
        return cap3(count);
    };
    for (const roomno of state.u.urooms || []) {
        const index = roomno - ROOMOFFSET;
        seenRooms.add(index);
        const room = roomForIndex(level, index);
        if (room && room.rtype >= SHOPBASE) {
            if (shopkeeperInOwnShop(shopResident(roomno, state), state))
                untendedRooms.delete(index);
            else
                untendedRooms.add(index);
        }
    }
    let nshop = 0, shoptype = 0, ntemple = 0;
    for (const index of [...seenRooms].sort((a, b) => a - b)) {
        const room = roomForIndex(level, index);
        if (!room)
            continue;
        if (room.rtype >= SHOPBASE) {
            if (untendedRooms.has(index))
                shoptype = SHOPBASE - 1;
            else if (!nshop)
                shoptype = room.rtype;
            else if (shoptype !== room.rtype)
                shoptype = 0;
            nshop = cap3(nshop + 1);
        }
        else if (room.rtype === TEMPLE)
            ntemple = cap3(ntemple + 1);
        else if (room.orig_rtype === DELPHI)
            flags.oracle = true;
    }
    let naltar = 0, altarAlignment = null;
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const location = level.requireAt(x, y);
            learnOverviewStructure(flags, x, y, state);
            if (location.lastseentyp !== ALTAR)
                continue;
            const monster = monsterAtPosition(level, x, y);
            const mask = monster && M_AP_TYPE(monster) === M_AP_FURNITURE
                && monster.mappearance === CmapSymbol.altar
                ? monster.mcorpsenm ?? monster.mextra?.mcorpsenm ?? 0
                : location.typ === ALTAR ? location.altarmask ?? location.flags : 0;
            const alignment = Is_astralevel(state.u.uz) && location.seenv !== 255
                || !(mask & AM_MASK) ? null : Amask2align(mask & AM_MASK);
            if (!naltar)
                altarAlignment = alignment;
            else if (altarAlignment !== alignment)
                altarAlignment = null;
            naltar = cap3(naltar + 1);
        }
    }
    if (!state._overviewRecords)
        state._overviewRecords = new Map();
    updateSanctumOverview(flags, naltar, state);
    state._overviewRecords.set(`${dnum}:${dlevel}`, {
        flags,
        features: {
            nshop, shoptype, ntemple, naltar, altarAlignment,
            nfount: countTerrain(FOUNTAIN),
            nsink: countTerrain(SINK),
            nthrone: countTerrain(THRONE),
            ngrave: countTerrain(GRAVE),
            ntree: countTerrain(TREE),
        },
        branch: prior?.branch || null,
        seenRooms: [...seenRooms],
        untendedRooms: [...untendedRooms],
    });
}
export function sameDungeonLevel(left, right) {
    return !!left && !!right && left.dnum === right.dnum && left.dlevel === right.dlevel;
}
function currentOverviewFlags(prior, state) {
    const here = currentDungeonLocation(state);
    const atSpecial = (name) => sameDungeonLevel(here, state.specialLevels?.get(name));
    const questEntrance = state.branches.find(branch => branch.end2.dnum === state.quest_dnum);
    const event = state.u.uevent;
    if (prior?.flags.notreachable && here.dnum === state.quest_dnum) {
        for (const [key, record] of state._overviewRecords || []) {
            if (Number(key.split(':')[0]) === state.quest_dnum)
                record.flags.notreachable = false;
        }
    }
    return {
        notreachable: false, forgot: false,
        sokosolved: here.dnum === state.sokoban_dnum && !state.level?.flags.sokoban_rules,
        bigroom: heroIsBlind(state) ? !!prior?.flags.bigroom && !prior.flags.forgot : atSpecial('bigrm'),
        roguelevel: sameDungeonLevel(here, state.rogue_level),
        oracle: false, castle: prior?.flags.castle ?? false, castletune: false,
        ludios: prior?.flags.ludios ?? false, valley: prior?.flags.valley ?? false,
        msanctum: prior?.flags.msanctum ?? false,
        vibrating_square: prior?.flags.vibrating_square ?? false,
        quest_summons: sameDungeonLevel(here, questEntrance?.end1) && !!event?.qcalled
            && !event.qcompleted && !event.qexpelled && !state.quest_status?.leader_is_dead,
        questing: atSpecial('x-strt') && !!state.quest_status?.got_quest,
    };
}
function learnOverviewStructure(flags, x, y, state) {
    const level = state.level;
    const typ = level?.at(x, y)?.lastseentyp;
    if (typ === DOOR && sameDungeonLevel(state.u.uz, state.knox_level)) {
        if ([-1, 0, 1].some(dy => level?.at(x - 4, y + dy)?.typ === THRONE))
            flags.ludios = true;
    }
    else if (sameDungeonLevel(state.u.uz, state.stronghold_level)
        && (typ === DBWALL || typ === DRAWBRIDGE_DOWN || typ === DOOR && findDrawbridgeAt(x, y, state))) {
        flags.castle = true;
        flags.castletune = true;
    }
}
function updateSanctumOverview(flags, altars, state) {
    if (sameDungeonLevel(state.u.uz, state.valley_level)) {
        if (altars)
            flags.valley = true;
    }
    else if (sameDungeonLevel(state.u.uz, state.sanctum_level)) {
        if (altars)
            flags.msanctum = true;
        if (flags.msanctum) {
            const here = currentDungeonLocation(state);
            const gateway = state._overviewRecords?.get(`${here.dnum}:${here.dlevel - 1}`);
            if (gateway)
                gateway.flags.vibrating_square = false;
        }
    }
    else if (Invocation_lev(state.u.uz, state)) {
        const trap = state.level?.traps.find(trap => trap.ttyp === VIBRATING_SQUARE);
        const sanctum = state.sanctum_level;
        const sanctumRecord = sanctum && state._overviewRecords?.get(`${sanctum.dnum}:${sanctum.dlevel}`);
        flags.vibrating_square = trap ? !!trap.tseen : !sanctumRecord?.flags.msanctum;
    }
}
// C mapseen_temple(): entering an attended temple identifies these levels,
// even if blindness prevents the hero from discovering the altar.
export function recordTempleOverview(state = game) {
    const here = currentDungeonLocation(state);
    if (!state._overviewRecords?.has(`${here.dnum}:${here.dlevel}`))
        recordMappedOverviewState({ state });
    const record = state._overviewRecords?.get(`${here.dnum}:${here.dlevel}`);
    if (!record)
        return;
    if (sameDungeonLevel(here, state.valley_level))
        record.flags.valley = true;
    else if (sameDungeonLevel(here, state.sanctum_level))
        record.flags.msanctum = true;
}
// C recbranch_mapseen(): only traversal from the parent endpoint teaches a
// connection. Level teleport and artifact travel do not call this function.
export function recordOverviewBranch(source, destination, state = game) {
    if (source.dnum === destination.dnum)
        return;
    const branch = state.branches.find(branch => sameDungeonLevel(source, branch.end1)
        && sameDungeonLevel(destination, branch.end2));
    const record = state._overviewRecords?.get(`${source.dnum}:${source.dlevel}`);
    if (branch && record)
        record.branch = { ...branch.end2, up: branch.end1_up, type: branch.type };
}
// C remdun_mapseen(): keep knowledge for disclosure and possible reentry.
export function markOverviewUnreachable(dnum, state = game) {
    for (const [key, record] of state._overviewRecords || []) {
        if (Number(key.split(':')[0]) === dnum)
            record.flags.notreachable = true;
    }
}
// C dungeon.c:room_discovered(). Recalculation occurs once per newly seen room.
export function recordDiscoveredRoom(roomIndex, { state = game } = {}) {
    const level = currentDungeonLocation(state);
    const prior = state._overviewRecords?.get?.(`${level.dnum}:${level.dlevel}`);
    if (prior?.seenRooms?.includes(roomIndex))
        return false;
    recordMappedOverviewState({ discoveredRoom: roomIndex, state });
    return true;
}
// The Lua runtime supplies the data. This module owns dungeon.c's placement
// and branch construction rules.
function definitionRecord(value, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new TypeError(`${path} must be a Lua table with named fields`);
    return Object.fromEntries(Object.entries(value));
}
function definitionArray(value, path) {
    if (value === undefined || value === null)
        return [];
    if (!Array.isArray(value))
        throw new TypeError(`${path} must be a Lua array`);
    return value;
}
function definitionString(value, path) {
    if (typeof value !== 'string')
        throw new TypeError(`${path} must be a string`);
    return value;
}
function optionalDefinitionString(value, path) {
    return value == null ? undefined : definitionString(value, path);
}
function definitionInteger(value, path, fallback) {
    if (value == null && fallback !== undefined)
        return fallback;
    if (typeof value !== 'number' || !Number.isSafeInteger(value))
        throw new TypeError(`${path} must be an integer`);
    return value;
}
function definitionFlag(value, path) {
    switch (value) {
        case 'town':
        case 'hellish':
        case 'mazelike':
        case 'roguelike':
        case 'unconnected':
            return value;
        default: throw new TypeError(`${path} is not a dungeon flag`);
    }
}
function definitionFlags(value, path) {
    if (value == null)
        return [];
    if (typeof value === 'string')
        return [definitionFlag(value, path)];
    return definitionArray(value, path)
        .map((flag, index) => definitionFlag(flag, `${path}[${index + 1}]`));
}
function definitionAlignment(value, path) {
    if (value == null)
        return 'unaligned';
    if (typeof value !== 'string')
        throw new TypeError(`${path} must be an alignment name`);
    switch (value) {
        case 'lawful':
        case 'neutral':
        case 'chaotic':
        case 'unaligned':
        case 'noalign':
            return value;
        default: throw new TypeError(`${path} is not a dungeon alignment`);
    }
}
function definitionBranchType(value, path) {
    if (value == null)
        return 'stair';
    if (typeof value !== 'string')
        throw new TypeError(`${path} must be a branch type name`);
    switch (value) {
        case 'stair':
        case 'portal':
        case 'no_up':
        case 'no_down': return value;
        default: throw new TypeError(`${path} is not a dungeon branch type`);
    }
}
function definitionBranchUp(value, path) {
    if (value == null || value === 'down')
        return false;
    if (value === 'up')
        return true;
    throw new TypeError(`${path} must be up or down`);
}
function branchDefinition(value, path) {
    const source = definitionRecord(value, path);
    return {
        name: definitionString(source.name, `${path}.name`),
        base: definitionInteger(source.base, `${path}.base`),
        range: definitionInteger(source.range, `${path}.range`, 0),
        chain: optionalDefinitionString(source.chainlevel, `${path}.chainlevel`),
        up: definitionBranchUp(source.direction, `${path}.direction`),
        branchType: definitionBranchType(source.branchtype, `${path}.branchtype`),
    };
}
function levelDefinition(value, path) {
    const source = definitionRecord(value, path);
    const flags = definitionFlags(source.flags, `${path}.flags`);
    const alignment = definitionAlignment(source.alignment, `${path}.alignment`);
    return {
        name: definitionString(source.name, `${path}.name`),
        base: definitionInteger(source.base, `${path}.base`),
        range: definitionInteger(source.range, `${path}.range`, 0),
        chance: definitionInteger(source.chance, `${path}.chance`, 100),
        chain: optionalDefinitionString(source.chainlevel, `${path}.chainlevel`),
        variants: definitionInteger(source.nlevels, `${path}.nlevels`, 0) || 1,
        alignment: alignmentType(((packedDungeonFlags(flags)
            | packedDungeonAlignment(alignment)) & D_ALIGN_MASK) >> 4),
        flags,
        bonetag: optionalDefinitionString(source.bonetag, `${path}.bonetag`),
    };
}
function dungeonDefinition(value, path) {
    const source = definitionRecord(value, path);
    const flags = definitionFlags(source.flags, `${path}.flags`);
    const alignment = definitionAlignment(source.alignment, `${path}.alignment`);
    return {
        name: definitionString(source.name, `${path}.name`),
        base: definitionInteger(source.base, `${path}.base`),
        range: definitionInteger(source.range, `${path}.range`, 0),
        chance: definitionInteger(source.chance, `${path}.chance`, 100),
        entry: definitionInteger(source.entry, `${path}.entry`, 0),
        packedFlags: packedDungeonFlags(flags),
        bonetag: optionalDefinitionString(source.bonetag, `${path}.bonetag`),
        protofile: optionalDefinitionString(source.protofile, `${path}.protofile`),
        levelFill: optionalDefinitionString(source.lvlfill, `${path}.lvlfill`),
        themeRooms: optionalDefinitionString(source.themerooms, `${path}.themerooms`),
        unconnected: flags.includes('unconnected'),
        flags: {
            maze_like: flags.includes('mazelike'),
            hellish: flags.includes('hellish'),
            unconnected: flags.includes('unconnected'),
            // The pinned loader assigns packed D_ALIGN_* directly to this
            // three-bit field, so its high alignment bits are truncated.
            alignment: alignmentType(packedDungeonAlignment(alignment) & AM_MASK),
        },
        branches: definitionArray(source.branches, `${path}.branches`)
            .map((branch, index) => branchDefinition(branch, `${path}.branches[${index + 1}]`)),
        levels: definitionArray(source.levels, `${path}.levels`)
            .map((level, index) => levelDefinition(level, `${path}.levels[${index + 1}]`)),
    };
}
export async function loadDungeonDefinitions() {
    const definitions = await currentLuaLifecycle().loadData(game, 'dungeon.lua', 'dungeon');
    if (!Array.isArray(definitions))
        throw new Error('dungeon.lua did not define a dungeon array');
    return definitions.map((definition, index) => dungeonDefinition(definition, `dungeon[${index + 1}]`));
}
function requireDungeon(dungeons, dnum) {
    const dungeon = dungeons[dnum];
    if (!dungeon)
        throw new Error(`Missing dungeon ${dnum}`);
    return dungeon;
}
function levelRange(dungeon, spec, finalByName) {
    let base = spec.base;
    if (spec.chain) {
        const chained = finalByName.get(spec.chain);
        if (!chained)
            throw new Error(`missing chained level ${spec.chain}`);
        base += chained.dlevel;
    }
    else if (base < 0) {
        base = dungeon.num_dunlevs + base + 1;
    }
    const range = spec.range;
    const count = range === -1
        ? dungeon.num_dunlevs - base + 1
        : range
            ? Math.min(range, dungeon.num_dunlevs - base + 1)
            : 1;
    return { base, count };
}
function possiblePlaces(index, levels, dungeon, finalByName) {
    const level = levels[index];
    if (!level)
        throw new Error(`Missing special level at placement index ${index}`);
    const { base, count: rawCount } = levelRange(dungeon, level.spec, finalByName);
    const places = [];
    for (let dlevel = base; dlevel < base + rawCount; dlevel++)
        places.push(dlevel);
    for (let earlier = 0; earlier < index; earlier++) {
        const occupied = levels[earlier]?.dlevel;
        if (occupied) {
            const position = places.indexOf(occupied);
            if (position >= 0)
                places.splice(position, 1);
        }
    }
    return places;
}
// Direct port of dungeon.c place_level(): recursively try placements and
// backtrack only when a later special level has no valid square.
function placeLevels(index, levels, dungeon, finalByName) {
    if (index === levels.length)
        return true;
    const level = levels[index];
    if (!level)
        return placeLevels(index + 1, levels, dungeon, finalByName);
    const places = possiblePlaces(index, levels, dungeon, finalByName);
    while (places.length) {
        const selected = rn2(places.length);
        const position = places[selected];
        if (position === undefined)
            throw new RangeError(`Invalid special-level placement index ${selected}`);
        level.dlevel = position;
        if (placeLevels(index + 1, levels, dungeon, finalByName))
            return true;
        places.splice(selected, 1);
    }
    level.dlevel = 0;
    return false;
}
function findParent(childName, loaded) {
    for (const parent of loaded) {
        const branch = parent.definition.branches.find(candidate => candidate.name === childName);
        if (branch)
            return { parent, branch };
    }
    return null;
}
function branchLevel(parent, branch, branches) {
    const { base, count } = levelRange(parent.dungeon, branch, parent.finalByName);
    const start = rn2(count);
    let candidate = start;
    do {
        candidate += 1;
        if (candidate >= count)
            candidate = 0;
        const dlevel = base + candidate;
        const occupied = branches.some(existing => (existing.end1.dnum === parent.dnum && existing.end1.dlevel === dlevel)
            || (existing.end2.dnum === parent.dnum && existing.end2.dlevel === dlevel));
        if (!occupied)
            return dlevel;
    } while (candidate !== start);
    return base + candidate;
}
function entryLevel(definition, count) {
    const entry = definition.entry || 0;
    if (entry < 0)
        return Math.max(1, count + entry + 1);
    if (entry > 0)
        return Math.min(entry, count);
    return 1;
}
// C dungeon.c:correct_branch_type().  Retain the corrected branch kind on
// the live graph so traversal, level menus, and #wizwhere all project the
// same Lua-owned branch semantics.
function correctedBranchType(spec) {
    if (spec.branchType === 'portal')
        return 'portal';
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
            if (level)
                all.set(level.name, {
                    dnum: entry.dnum,
                    dlevel: level.dlevel,
                    flags: { town: level.spec.flags.includes('town') },
                    ...(level.spec.bonetag === undefined ? {} : { bonetag: level.spec.bonetag }),
                    // C init_level() inherits the packed flags, without the
                    // separate dungeon alignment. UNCONNECTED overlaps the
                    // chaotic bit and therefore aligns Tutorial levels.
                    alignment: level.spec.alignment
                        ?? alignmentType((entry.definition.packedFlags & D_ALIGN_MASK) >> 4),
                });
        }
    }
    game.specialLevels = all;
    game.oracle_level = all.get('oracle');
    game.medusa_level = all.get('medusa');
    game.juiblex_level = all.get('juiblex');
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
// C fixup_level_locations(): these identities are derived from the dungeon
// graph, both after generation and after restoring the saved graph.
export function resolveDungeonIdentities(state = game) {
    const dungeons = state.dungeons ?? [];
    state.quest_dnum = dungeons.findIndex(dungeon => dungeon.dname === 'The Quest');
    state.sokoban_dnum = dungeons.findIndex(dungeon => dungeon.dname === 'Sokoban');
    state.mines_dnum = dungeons.findIndex(dungeon => dungeon.dname === 'The Gnomish Mines');
    state.tower_dnum = dungeons.findIndex(dungeon => dungeon.dname === "Vlad's Tower");
}
export async function init_dungeons() {
    const loaded = [];
    const branches = [];
    const definitions = await loadDungeonDefinitions();
    for (const definition of definitions) {
        const chance = definition.chance;
        if (!game.flags?.debug && chance && chance <= rn2(100))
            continue;
        const dnum = loaded.length;
        const num_dunlevs = definition.range
            ? definition.base + rn2(definition.range)
            : definition.base;
        const dungeon = {
            dname: definition.name,
            num_dunlevs,
            entry_lev: entryLevel(definition, num_dunlevs),
            dunlev_ureached: dnum === 0 ? 1 : 0,
            depth_start: dnum === 0 || definition.unconnected ? 1 : 0,
            flags: { ...definition.flags },
            bonetag: definition.bonetag,
            protofile: definition.protofile,
            levelFill: definition.levelFill,
            themeRooms: definition.themeRooms,
        };
        if (!definition.unconnected && dnum > 0) {
            const parentInfo = findParent(definition.name, loaded);
            if (!parentInfo)
                throw new Error(`missing parent branch for ${definition.name}`);
            const parent = parentInfo.parent;
            const parentLevel = branchLevel(parent, parentInfo.branch, branches);
            const branch = {
                end1: { dnum: parent.dnum, dlevel: parentLevel },
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
        const levels = definition.levels.map(spec => {
            const levelChance = spec.chance;
            if (!game.flags?.debug && levelChance <= rn2(100))
                return null;
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
    resolveDungeonIdentities(game);
    game.branches = branches;
    exposeSpecialLevels(loaded);
    // C dungeon.c:fixup_level_locations() leaves Fort Ludios floating by
    // replacing its source dungeon with the out-of-range n_dgns sentinel.
    // mk_knox_portal() resolves that endpoint only after an eligible deep
    // vault is generated.
    const knoxBranch = branches.find(branch => game.dungeons?.[branch.end2?.dnum]?.dname === 'Fort Ludios');
    if (knoxBranch)
        knoxBranch.end1.dnum = loaded.length;
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
//# sourceMappingURL=dungeon.js.map