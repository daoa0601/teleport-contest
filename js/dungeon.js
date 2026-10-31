// dungeon.js — Dungeon graph and special-level placement.
// C ref: dungeon.c — init_dungeons(), init_level(), place_level().
// Data ref: dat/dungeon.lua.
import { game, requirePlayingGame } from './gstate.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { rn2 } from './rng.js';
import { ALTAR, AM_MASK, Amask2align, COLNO, D_ALIGN_CHAOTIC, D_ALIGN_LAWFUL, D_ALIGN_MASK, D_ALIGN_NEUTRAL, FOUNTAIN, GRAVE, HELLISH, In_endgame, MAZELIKE, ROGUELIKE, ROOMOFFSET, ROWNO, SHOPBASE, SINK, THRONE, In_sokoban, TOWN, TREE, UNCONNECTED, TEMPLE, Is_astralevel, M_AP_TYPE, M_AP_FURNITURE, DELPHI, DOOR, DBWALL, DRAWBRIDGE_DOWN, Invocation_lev, VIBRATING_SQUARE, MENU_ITEMFLAGS_SKIPMENUCOLORS, NHW_MENU, PICK_NONE, PICK_ONE, } from './const.js';
import { deepestLevelReached, depth, dungeonDepth, endgameLevelName, ledgerNo } from './hacklib.js';
import { getLine } from './query.js';
import { SHOP_TYPES } from './shop_data.js';
import { deityName } from './alignment.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { questLeaderName } from './quest_pager.js';
import { addMenuHeading } from './windows.js';
import { tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow, tty_end_menu, tty_select_menu, tty_start_menu, } from './tty_menu.js';
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
// C dungeon.c:On_W_tower_level(): the destination form of the tower test.
export function wizardTowerLevelAt(dnum, dlevel) {
    const prototype = specialPrototypeAt(dnum, dlevel);
    return prototype !== null && WIZARD_TOWER_LEVELS.has(prototype);
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
// C dungeon.c:init_mapseen(): generating a level for the first time
// creates its overview record before the hero learns anything about it.
// mklev() owns the call in C; the JS level-transition owners call this at
// the same boundary so bones levels are covered as well.
export function initOverviewRecord(location, state = game) {
    const key = `${location.dnum}:${location.dlevel}`;
    if (state._overviewRecords?.has(key))
        return;
    if (!state._overviewRecords)
        state._overviewRecords = new Map();
    state._overviewRecords.set(key, {
        flags: {
            notreachable: false, forgot: false, sokosolved: false, bigroom: false,
            roguelevel: false, oracle: false, castle: false, castletune: false,
            ludios: false, valley: false, msanctum: false, vibrating_square: false,
            quest_summons: false, questing: false,
        },
        features: {
            nshop: 0, shoptype: 0, nfount: 0, nsink: 0, naltar: 0,
            altarAlignment: null, ntemple: 0, nthrone: 0, ngrave: 0, ntree: 0,
        },
        branch: null,
        seenRooms: [],
        untendedRooms: [],
    });
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
                : location.typ === ALTAR ? location.flags : 0;
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
    // C recalc_mapseen() owns a copy so ancestor knowledge survives leaving
    // the level. A grave or ghost is not required; mapping the square suffices.
    const finalRestingPlaces = (prior?.finalRestingPlaces ?? level.bonesInfo ?? [])
        .map(entry => ({ ...entry,
        bonesknown: entry.bonesknown || !!level.at(entry.frpx, entry.frpy)?.lastseentyp,
    }));
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
        finalRestingPlaces,
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
    // C fixup_level_locations(): the dummy surface shifts the Planes up
    // one floor, placing Earth at depth -1 instead of zero.
    const dummy = game.specialLevels?.get('dummy');
    if (dummy) {
        const dungeon = requireDungeon(game.dungeons, dummy.dnum);
        if (dungeon.num_dunlevs > 1 - dungeon.depth_start)
            dungeon.depth_start--;
    }
}
export function specialDisplayName(name, state = game) {
    if (name.startsWith('x-')) {
        const code = state.urole?.filecode || 'Wiz';
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
// C dungeon.c:query_annotation(): empty input and Escape preserve the
// existing value; space-only input removes it after mungspaces().
function setLevelAnnotation(level, value) {
    if (value === null || value === '')
        return;
    const annotation = value.replace(/\t/g, ' ').replace(/ +/g, ' ').replace(/^ | $/g, '');
    const key = `${level.dnum}:${level.dlevel}`;
    if (!game._levelAnnotations)
        game._levelAnnotations = new Map();
    if (annotation)
        game._levelAnnotations.set(key, annotation);
    else
        game._levelAnnotations.delete(key);
}
function annotationLevelDescription(level) {
    if (sameDungeonLevel(level, game.u.uz))
        return 'this dungeon level';
    const otherBranch = level.dnum !== game.u.uz?.dnum;
    const dungeon = game.dungeons[level.dnum];
    if (!dungeon)
        throw new Error(`Annotation has no dungeon ${level.dnum}`);
    if (sameDungeonLevel(level, game.knox_level))
        return dungeon.dname;
    if (In_endgame(level)) {
        const name = endgameLevelName(level);
        return otherBranch ? name : name.replace('Plane of ', '');
    }
    const tutorial = game.specialLevels?.get('tut-1')?.dnum;
    const description = level.dnum === game.quest_dnum ? `Home ${level.dlevel}`
        : level.dnum === tutorial && !otherBranch ? `Tutorial:${dungeonDepth(level.dnum, level.dlevel)}`
            : `level ${dungeonDepth(level.dnum, level.dlevel)}`;
    return otherBranch ? `${description}, ${dungeon.dname.replace('The ', 'the ')}` : description;
}
export async function queryLevelAnnotation(level = null, inMenu = false) {
    requirePlayingGame(game);
    const location = level ?? game.u.uz;
    const prior = game._levelAnnotations?.get(`${location.dnum}:${location.dlevel}`);
    const prompt = prior ? `Replace annotation "${prior.slice(0, 30)}${prior.length > 30 ? '...' : ''}" with?`
        : `What do you want to call ${annotationLevelDescription(location)}?`;
    const value = await getLine(prompt, () => true, { inMenu });
    setLevelAnnotation(location, value);
}
// C dungeon.c:doannotate().
export async function doannotate() {
    if (game.iflags.menu_requested) {
        await doDungeonOverview();
        return;
    }
    await queryLevelAnnotation();
    game.context.move = 0;
}
function visitedDungeonLevels() {
    const byDungeon = new Map();
    const remember = (dnum, dlevel) => {
        if (dnum === undefined || dlevel === undefined
            || !Number.isInteger(dnum) || !Number.isInteger(dlevel))
            return;
        const levels = byDungeon.get(dnum) ?? new Set();
        levels.add(dlevel);
        byDungeon.set(dnum, levels);
    };
    remember(game.u?.uz?.dnum ?? 0, game.u?.uz?.dlevel ?? 1);
    for (const key of game._overviewRecords?.keys() || []) {
        const [dnum, dlevel] = String(key).split(':').map(Number);
        remember(dnum, dlevel);
    }
    return byDungeon;
}
function overviewDepth(dnum, dlevel) {
    return dnum === game.quest_dnum || dnum === game.knox_level?.dnum
        ? dlevel : dungeonDepth(dnum, dlevel);
}
function dungeonOverviewHeading(dnum) {
    const dungeon = game.dungeons?.[dnum];
    if (!dungeon)
        throw new Error(`Overview has no dungeon ${dnum}`);
    const reached = dungeon.dunlev_ureached;
    if (reached === dungeon.entry_lev || In_endgame({ dnum, dlevel: 1 }))
        return `${dungeon?.dname || 'Dungeon'}:`;
    const range = dungeonBuildsUp({ dnum, dlevel: 1 })
        ? `levels ${overviewDepth(dnum, dungeon.entry_lev)} up to ${overviewDepth(dnum, reached)}`
        : `levels ${overviewDepth(dnum, 1)} to ${overviewDepth(dnum, reached)}`;
    return `${dungeon?.dname || 'Dungeon'}: ${range}`;
}
function overviewLevelIsInteresting(dnum, dlevel) {
    const location = { dnum, dlevel };
    if (sameDungeonLevel(location, game.u.uz))
        return true;
    const annotation = game._levelAnnotations?.get?.(`${dnum}:${dlevel}`);
    const record = game._overviewRecords?.get?.(`${dnum}:${dlevel}`);
    const flags = record?.flags;
    if (flags?.notreachable || flags?.forgot)
        return false;
    const tutorial = game.specialLevels?.get('tut-1')?.dnum;
    if (tutorial !== undefined && game.u.uz?.dnum === tutorial)
        return dnum === tutorial;
    if (tutorial !== undefined && dnum === tutorial)
        return false;
    if (flags && (flags.oracle || flags.bigroom || flags.roguelevel || flags.castle
        || flags.valley || flags.msanctum || flags.vibrating_square
        || flags.quest_summons || flags.questing))
        return true;
    if (dnum === game.sokoban_dnum
        && (game.u.uz?.dnum === game.sokoban_dnum || !flags?.sokosolved))
        return true;
    if (In_endgame(game.u.uz))
        return In_endgame(location);
    return !!annotation || !!record?.branch || !!overviewFeatureLine(record?.features)
        || !!record?.finalRestingPlaces?.some(entry => entry.bonesknown || game.flags.debug)
        || dlevel === game.dungeons[dnum]?.dunlev_ureached;
}
// C dungeon.c:print_mapseen(): the current hero precedes ancestors, and only
// the last entry ends in a period. Final disclosure reveals every ancestor.
function overviewRestingPlaceLines(record, final, currentDeath = null) {
    const entries = (record?.finalRestingPlaces ?? [])
        .filter(entry => final || game.flags.debug || entry.bonesknown)
        .map(entry => `${entry.who}, ${entry.how}`);
    if (currentDeath !== null)
        entries.unshift(`you, ${overviewYouCause(currentDeath)}`);
    if (!entries.length)
        return [];
    return ['      Final resting place for', ...entries.map((entry, index) => `         ${entry}${index === entries.length - 1 ? '.' : ','}`)];
}
function overviewCountPhrase(count, noun) {
    if (count === 1)
        return `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
    if (count === 2)
        return `some ${noun}s`;
    return `many ${noun}s`;
}
function overviewFeatureLine(features) {
    const phrases = [];
    if (features?.nshop) {
        if (features.nshop === 1) {
            const shop = SHOP_TYPES[(features.shoptype ?? SHOPBASE) - SHOPBASE];
            const type = features.shoptype < SHOPBASE ? 'untended shop'
                : shop?.annotation || shop?.name || 'shop?';
            phrases.push(withIndefiniteArticle(type));
        }
        else {
            phrases.push(overviewCountPhrase(features.nshop, 'shop'));
        }
    }
    const temples = features?.ntemple ?? 0;
    const altars = features?.naltar ?? 0;
    if (temples || altars) {
        let phrase = [temples ? overviewCountPhrase(temples, 'temple') : '',
            altars ? overviewCountPhrase(altars, 'altar') : ''].filter(Boolean).join(' and ');
        const alignment = game.u.ualign?.type;
        if (alignment !== undefined && features?.altarAlignment === alignment)
            phrase += ` to ${deityName(alignment)}`;
        phrases.push(phrase);
    }
    for (const [countKey, noun] of [
        ['nthrone', 'throne'],
        ['nfount', 'fountain'], ['nsink', 'sink'],
        ['ngrave', 'grave'], ['ntree', 'tree'],
    ]) {
        const count = features?.[countKey] ?? 0;
        if (count)
            phrases.push(overviewCountPhrase(count, noun));
    }
    if (!phrases.length)
        return null;
    const text = phrases.join(', ');
    return `      ${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}
function overviewAutomaticNote(dnum, dlevel, record) {
    const flags = record?.flags;
    const here = { dnum, dlevel };
    if (flags?.oracle)
        return 'Oracle of Delphi.';
    if (dnum === game.sokoban_dnum)
        return flags?.sokosolved ? 'Solved.' : 'Unsolved.';
    if (flags?.bigroom)
        return 'A very big room.';
    if (flags?.roguelevel)
        return 'A primitive area.';
    if (sameDungeonLevel(here, game.specialLevels?.get('x-strt'))) {
        if (game.u.uevent?.qcompleted)
            return `Completed quest for ${questLeaderName()}.`;
        if (flags?.questing)
            return `Given quest by ${questLeaderName()}.`;
        return `Home${flags?.notreachable ? ' (no way back...)' : ''}.`;
    }
    if (flags?.ludios)
        return 'Fort Ludios.';
    if (flags?.castle) {
        const knowledge = game.u.uevent?.uheard_tune;
        const tune = knowledge === 2 ? `notes "${game.castleTune || ''}"` : '5-note tune';
        return `The castle${flags.castletune && knowledge
            ? ` (play ${tune} to open or close drawbridge)` : ''}.`;
    }
    if (flags?.valley)
        return 'Valley of the Dead.';
    if (flags?.vibrating_square)
        return "Gateway to Moloch's Sanctum.";
    if (flags?.msanctum)
        return "Moloch's Sanctum.";
    return null;
}
// C dungeon.c print_mapseen() branch note (br_string2 plus the upward
// destination depth): shared by the live #overview and the final disclosure.
function overviewBranchLine(branch) {
    if (!branch)
        return null;
    const target = game.dungeons?.[branch.dnum]?.dname || 'another dungeon';
    const direction = branch.up ? 'up' : 'down';
    const description = branch.type === 'portal'
        ? branch.dnum === game.quest_dnum && game.u.uevent?.qexpelled ? 'Sealed portal' : 'Portal'
        : branch.type === 'no_end1' ? 'Connection'
            : branch.type === 'no_end2' ? `One way stairs ${direction}` : `Stairs ${direction}`;
    const targetLevel = branch.up && !In_endgame(branch)
        ? `, level ${dungeonDepth(branch.dnum, branch.dlevel)}` : '';
    return `      ${description} to ${target}${targetLevel}.`;
}
// C dungeon.c print_mapseen() rephrases the hero's own death reason so the
// "Final resting place for you, ..." line reads in the second person.  Each
// strsubst() swaps only the first match (hacklib.c), not every occurrence.
function overviewYouCause(cause) {
    return cause.replace(' himself', ' yourself')
        .replace(' herself', ' yourself')
        .replace(' his ', ' your ')
        .replace(' her ', ' your ');
}
// C dungeon.c show_overview() with why > 0: the end-of-game disclosure
// bypasses the interesting-level filter and prints every visited level in
// every dungeon with its full mapseen projection.  Endgame levels print
// first when the game ends in the Planes.
export function dungeonOverviewDisclosure(ending, cause) {
    // show_overview() lazily recalculates the current level before building
    // the window.
    recordMappedOverviewState();
    const hereVerb = ending === 'ascended' ? 'are'
        : ending === 'escaped' ? 'left from' : 'were';
    const visited = [...visitedDungeonLevels().entries()]
        .sort(([left], [right]) => left - right);
    const endgame = ([dnum]) => In_endgame({ dnum, dlevel: 1 });
    const ordered = In_endgame(game.u.uz)
        ? [...visited.filter(endgame), ...visited.filter(entry => !endgame(entry))]
        : visited.filter(entry => !endgame(entry));
    const lines = [];
    for (const [dnum, levelSet] of ordered) {
        if (!game.dungeons?.[dnum])
            continue;
        lines.push({ text: dungeonOverviewHeading(dnum),
            itemflags: MENU_ITEMFLAGS_SKIPMENUCOLORS });
        for (const dlevel of [...levelSet].sort((left, right) => left - right)) {
            lines.push(...overviewDisclosureLevel(dnum, dlevel, ending, hereVerb, cause));
        }
    }
    return lines;
}
function overviewDisclosureLevel(dnum, dlevel, ending, hereVerb, cause) {
    const record = game._overviewRecords?.get?.(`${dnum}:${dlevel}`);
    const annotation = game._levelAnnotations?.get?.(`${dnum}:${dlevel}`);
    const current = (game.u?.uz?.dnum ?? 0) === dnum
        && (game.u?.uz?.dlevel ?? 1) === dlevel;
    const prototype = game.flags?.debug && specialLevelAt({ dnum, dlevel })
        ? specialPrototypeAt(dnum, dlevel) : null;
    const title = In_endgame({ dnum, dlevel })
        ? endgameLevelName({ dnum, dlevel })
        : `Level ${overviewDepth(dnum, dlevel)}`;
    const lines = [`   ${title}:${prototype ? ` [${prototype}]` : ''}${annotation ? ` "${annotation}"` : ''}${current ? ` <- You ${hereVerb} here.` : ''}`];
    if (record?.flags.forgot)
        return lines;
    const featureLine = overviewFeatureLine(record?.features);
    if (featureLine)
        lines.push(featureLine);
    const automaticNote = overviewAutomaticNote(dnum, dlevel, record);
    if (automaticNote)
        lines.push(`      ${automaticNote}`);
    if (record?.flags.quest_summons)
        lines.push(`      Summoned by ${questLeaderName()}.`);
    const branchLine = overviewBranchLine(record?.branch ?? null);
    if (branchLine)
        lines.push(branchLine);
    // died_here: the current hero's own resting place is disclosed before
    // bones are created, so it never reveals whether bones are produced.
    lines.push(...overviewRestingPlaceLines(record, true, !ending && current ? cause : null));
    return lines;
}
// C ref: dungeon.c dooverview()/show_overview().  This is dungeon-history
// projection over mapseen/cache state; it is distinct from Delete's
// known-terrain browser, which enters a getpos-style cursor transaction.
export async function doDungeonOverview() {
    // The C command lazily calls recalc_mapseen() before rendering.  Refresh
    // the current level from remembered/underfoot terrain at that same
    // boundary; do not infer features from unseen live squares.
    recordMappedOverviewState();
    const annotate = game.iflags.menu_requested;
    game.iflags.menu_requested = false;
    const window = tty_create_nhwindow(NHW_MENU);
    const addLine = (text, location = null) => tty_add_menu(window, { text, identifier: location });
    try {
        await tty_start_menu(window);
        const visited = [...visitedDungeonLevels().entries()]
            .sort(([left], [right]) => left - right);
        for (const [dnum, levelSet] of visited) {
            if (In_endgame(game.u.uz) && !In_endgame({ dnum, dlevel: 1 }))
                continue;
            const levels = [...levelSet].sort((a, b) => a - b)
                .filter(dlevel => annotate || overviewLevelIsInteresting(dnum, dlevel));
            if (!levels.length || !game.dungeons?.[dnum])
                continue;
            addMenuHeading(window, dungeonOverviewHeading(dnum));
            for (const dlevel of levels) {
                const annotation = game._levelAnnotations?.get?.(`${dnum}:${dlevel}`);
                const record = game._overviewRecords?.get?.(`${dnum}:${dlevel}`);
                const current = (game.u?.uz?.dnum ?? 0) === dnum
                    && (game.u?.uz?.dlevel ?? 1) === dlevel;
                const prototype = game.flags?.debug && specialLevelAt({ dnum, dlevel })
                    ? specialPrototypeAt(dnum, dlevel) : null;
                const special = prototype ? ` [${prototype}]` : '';
                const suffix = annotation ? ` "${annotation}"` : '';
                const title = In_endgame({ dnum, dlevel }) ? endgameLevelName({ dnum, dlevel })
                    : `Level ${overviewDepth(dnum, dlevel)}`;
                addLine(`${annotate ? '' : '   '}${title}:${special}${suffix}${current ? ' <- You are here.' : ''}`, annotate ? { dnum, dlevel } : null);
                if (record?.flags.forgot)
                    continue;
                const featureLine = overviewFeatureLine(record?.features);
                if (featureLine)
                    addLine(featureLine);
                const automaticNote = overviewAutomaticNote(dnum, dlevel, record);
                if (automaticNote)
                    addLine(`      ${automaticNote}`);
                if (record?.flags.quest_summons)
                    addLine(`      Summoned by ${questLeaderName()}.`);
                const branchLine = overviewBranchLine(record?.branch ?? null);
                if (branchLine)
                    addLine(branchLine);
                for (const line of overviewRestingPlaceLines(record, false))
                    addLine(line);
            }
        }
        tty_end_menu(window);
        const selection = await tty_select_menu(window, annotate ? PICK_ONE : PICK_NONE);
        const target = selection.selections[0]?.identifier;
        if (target)
            await queryLevelAnnotation(target, true);
    }
    finally {
        await tty_destroy_nhwindow(window);
    }
    game._pending_message = '';
    game.context.move = 0;
}
//# sourceMappingURL=dungeon.js.map