// bones.js — bones levels: savebones() and getbones() with their object,
// monster, timer and connection resets.
// C refs: bones.c savebones()/getbones()/resetobjs(); the restore.c getlev()
// adaptations used only by bones (restobjchn timers, region identity repair,
// branch connection repair) and files.c set_bonesfile_name(). Admission and
// death policy live in bones_admission.ts / bones_death.ts; payload
// validation lives in bones_validation.ts.
import { recorderLocalEpochSeconds, recorderTimestamp } from './calendar.js';
import { rn2 } from './rng.js';
import { COLNO, HOLE, In_quest, MAGIC_PORTAL, ROWNO, STONE, TRICKED, } from './const.js';
import { GameMap } from './game.js';
import { game } from './gstate.js';
import { pline } from './pline.js';
import { flush_screen } from './display.js';
import { nhgetch } from './input.js';
import { impossible } from './diagnostics.js';
import { PanicTermination } from './panic_termination.js';
import { finishHeroDeath, scoreDeathCause } from './end.js';
import { levelAllowsBones } from './bones_admission.js';
import { prepareBonesObjectForRestore, prepareBonesObjectForSave, } from './bones_object.js';
import { restoreBonesMonsters } from './bones_monster.js';
import { decodeBonesPayload } from './bones_validation.js';
import { encodeSavedGraph } from './saved_graph.js';
import { purgeDeadMonsters } from './monster_level_departure.js';
import { restoreLevelChains } from './level_restore.js';
import { restoreLevelPetHistory } from './monster_restore.js';
import { restoreLevelTimers } from './object_timers.js';
import { restoreLevelRegions } from './regions.js';
import { fixShopDamage } from './shop_damage.js';
import { restoreEngravings, sanitizeEngravings } from './engrave.js';
import { deleteTrap } from './trap_lifecycle.js';
import { nextIdent } from './ident.js';
import { addFruit } from './fruit.js';
import { restoreMonsterWormHeads, validMonsterWormBodies, } from './monster_worm.js';
import { restoreMonsterInventoryOwnership } from './monster_inventory.js';
import { ageStoresFuel } from './container.js';
import { specialLevelAt } from './dungeon.js';
import { ICE_BOX, SLIME_MOLD } from './object_data.js';
const BONES_VERSION = 20;
// C files.c:set_bonesfile_name(): special levels keep their identity when
// dungeon generation changes their depth; quest bones also belong to a role.
function bonesLevelId(location = game.u.uz) {
    if (!location)
        throw new Error('Bones require an initialized dungeon location');
    const tag = game.dungeons[location.dnum]?.bonetag;
    if (!tag)
        return '';
    const role = In_quest(location) ? game.urole?.filecode : '0';
    if (role === undefined)
        throw new Error('Quest bones require an initialized role');
    const special = specialLevelAt(location);
    return `${tag}${role}.${special ? special.bonetag ?? '' : location.dlevel}`;
}
function bonesStorageKey(level = game.u.uz) {
    return `teleport-bones:${bonesLevelId(level)}`;
}
export function bonesLevelExists(level = game.u.uz) {
    return game.storage?.getItem(bonesStorageKey(level)) != null;
}
export function deleteBonesLevel() {
    const storage = game.storage;
    if (!storage)
        return false;
    try {
        const key = bonesStorageKey();
        // Native unlink fails if another game has already consumed these bones.
        if (storage.getItem(key) === null)
            return false;
        storage.removeItem(key);
        return storage.getItem(key) === null;
    }
    catch (_error) {
        return false;
    }
}
async function bonesPrompt(message, displayLevel = null) {
    await pline(message);
    const restoredLevel = game.level;
    if (displayLevel)
        game.level = displayLevel;
    await flush_screen(1);
    if (displayLevel)
        game.level = restoredLevel;
    game.nhDisplay?.setCursor(message.length, 0);
    return String.fromCharCode(await nhgetch()).toLowerCase();
}
function eachTopLevelBonesObject(level, visit) {
    for (const monster of [...level.monsters].reverse()) {
        for (const object of monster.minvent || monster.inventory || [])
            visit(object);
    }
    for (const object of bonesFloorObjects(level))
        visit(object);
    for (const object of level?.buriedObjects || [])
        visit(object);
}
function bonesFloorObjects(level) {
    const objects = [];
    for (const column of level.objects)
        for (const pile of column ?? [])
            objects.push(...(pile ?? []));
    return objects.sort((left, right) => (right._fobjOrder ?? 0) - (left._fobjOrder ?? 0));
}
function eachObjectInBonesGraph(level, visit) {
    const walk = (object) => {
        if (!object)
            return;
        visit(object);
        for (const content of object.contents || [])
            walk(content);
    };
    eachTopLevelBonesObject(level, walk);
}
function resetBonesObjectList(objects, mode, ghostly = mode === 'save') {
    const kept = [];
    for (const object of objects || []) {
        object.contents = resetBonesObjectList(object.contents, mode, false);
        for (const content of object.contents)
            content.container = object;
        if (object.in_use)
            continue;
        if (ghostly)
            object.ghostly = true;
        kept.push(mode === 'save'
            ? prepareBonesObjectForSave(object) : prepareBonesObjectForRestore(object));
    }
    return kept;
}
function resetBonesObjects(level, mode) {
    for (const monster of [...level.monsters].reverse()) {
        const inventory = resetBonesObjectList(monster.minvent || monster.inventory, mode);
        monster.minvent = monster.inventory = inventory;
        monster.hasInventory = inventory.length > 0;
    }
    const retained = new Set(resetBonesObjectList(bonesFloorObjects(level), mode));
    for (const column of level.objects) {
        if (!column)
            continue;
        for (let y = 0; y < column.length; y++)
            column[y] = (column[y] ?? []).filter(object => retained.has(object));
    }
    level.buriedObjects = resetBonesObjectList(level?.buriedObjects, mode);
}
// C refs: bones.c savebones()/resetobjs(FALSE). The persistent payload owns
// the level graph only. The saved-graph codec retains entity aliases and
// container back-pointers; getbones() restores the GameMap prototype.
export function saveBonesLevel(deathCause = '', when = recorderLocalEpochSeconds(game.datetime) || Date.now() / 1000) {
    const storage = game.storage;
    const location = game.u.uz;
    if (!storage || !game.level || !location || !game.urole || !game.urace
        || !game.u.ualign)
        return false;
    purgeDeadMonsters(game.level);
    let payload;
    try {
        payload = decodeBonesPayload(encodeSavedGraph({
            version: BONES_VERSION,
            bonesId: bonesLevelId(),
            savedAt: game.moves,
            level: game.level,
            stairs: game.stairs || null,
            heroTrack: (game._heroTrack || []).map(point => ({
                x: point.x, y: point.y,
            })),
            fruits: [],
        }), BONES_VERSION);
    }
    catch (_error) {
        return false;
    }
    // savebones() records the final role, race, gender, and alignment in
    // cemetery.who. These suffixes also participate in bones_include_name().
    const alignment = game.u.ualign.type === 1 ? 'Law'
        : game.u.ualign.type === -1 ? 'Cha' : 'Neu';
    const who = [
        game.plname || 'player', game.urole.filecode.slice(0, 3),
        game.urace.filecode.slice(0, 3), game.flags.female ? 'Fem' : 'Mal', alignment,
    ].join('-');
    payload.level.bonesInfo = [
        { who, how: scoreDeathCause(deathCause, null), when: recorderTimestamp(when),
            frpx: game.u.ux, frpy: game.u.uy, bonesknown: false },
        ...(payload.level.bonesInfo ?? []),
    ];
    if (game.flags.debug)
        payload.level.flags.wizard_bones = true;
    for (const monster of payload.level.monsters || []) {
        monster.mlstmv = 0;
        if (!Number.isFinite(monster.mux))
            monster.mux = game.u?.ux ?? 0;
        if (!Number.isFinite(monster.muy))
            monster.muy = game.u?.uy ?? 0;
        if (monster.mtame || monster.pet) {
            monster.mtame = 0;
            monster.mpeaceful = 0;
            monster.pet = false;
        }
        monster.seen_resistance = 0;
    }
    for (const trap of payload.level.traps || []) {
        trap.madeby_u = 0;
        trap.tseen = trap.ttyp === HOLE;
    }
    resetBonesObjects(payload.level, 'save');
    const fruitIds = new Set();
    eachObjectInBonesGraph(payload.level, object => {
        if (object.otyp === SLIME_MOLD)
            fruitIds.add(object.spe);
    });
    payload.fruits = (game.fruits || []).filter(fruit => fruitIds.has(fruit.fid))
        .map(fruit => ({ ...fruit }));
    // savebones() removes the dead hero and all of their remembered glyphs
    // before savelev(). Terrain lighting itself remains part of the level.
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const location = payload.level.locations?.[x]?.[y];
            if (!location)
                continue;
            location.seenv = 0;
            location.waslit = false;
            location.lastseentyp = STONE;
            location.disp_ch = ' ';
            location.disp_color = 0;
            location.disp_decgfx = false;
            location.disp_attr = 0;
            location.glyph_symidx = -1;
            delete location.disp_glyph;
            delete location.remembered_glyph;
        }
    }
    try {
        shiftBonesDestinations(payload, location, -location.dlevel);
        storage.setItem(bonesStorageKey(), encodeSavedGraph(payload));
        return true;
    }
    catch (_error) {
        return false;
    }
}
// C save_stairs()/savetrapchn() store same-dungeon destinations relative
// to the saved level. rest_stairs()/getlev() add the receiving level's depth.
// Only the bones copy is shifted; live and cached maps retain absolute depths.
function shiftBonesDestinations(payload, location, adjustment) {
    for (let stair = payload.stairs; stair; stair = stair.next) {
        if (stair.tolev.dnum === location.dnum)
            stair.tolev = { ...stair.tolev, dlevel: stair.tolev.dlevel + adjustment };
    }
    for (const trap of payload.level.traps) {
        const destination = trap.dst;
        if (destination?.dnum === location.dnum)
            trap.dst = { ...destination, dlevel: destination.dlevel + adjustment };
    }
}
function remappedMonsterId(oldId, monsterIds) {
    return oldId !== undefined && Number.isInteger(oldId) ? monsterIds.get(oldId) : undefined;
}
function repairContainedObjects(container) {
    for (const object of container.contents || []) {
        object.container = container;
        object.where = 'contained';
        delete object.carrierMid;
        repairContainedObjects(object);
    }
}
function repairObjectMonsterIds(object, monsterIds) {
    const extra = object.oextra;
    const omid = extra?.omid;
    if (omid && extra) {
        const newId = remappedMonsterId(omid, monsterIds);
        if (newId)
            extra.omid = newId;
        else
            delete extra.omid;
    }
    if (object.omid) {
        const newId = remappedMonsterId(object.omid, monsterIds);
        if (newId)
            object.omid = newId;
        else
            delete object.omid;
    }
    if (object.leashmon) {
        object.leashmon = remappedMonsterId(object.leashmon, monsterIds) || 0;
    }
    if (object.oextra?.omonst) {
        object.oextra.omonst.m_id = 0;
        object.oextra.omonst.mpeaceful = 0;
        object.oextra.omonst.mtame = 0;
    }
}
function repairMonsterExtensions(monster) {
    const edog = monster.edog || monster.mextra?.edog;
    if (edog) {
        edog.parentmid = monster.m_id;
        monster.edog = edog;
        monster.mextra = { ...(monster.mextra || {}), edog };
    }
    const shopkeeper = monster.eshk || monster.mextra?.eshk;
    if (shopkeeper) {
        shopkeeper.parentmid = monster.m_id;
        monster.eshk = shopkeeper;
        if (monster.mextra?.eshk)
            monster.mextra.eshk = shopkeeper;
    }
    const priest = monster.epri || monster.mextra?.epri;
    if (priest) {
        priest.parentmid = monster.m_id;
        monster.epri = priest;
        if (monster.mextra?.epri)
            monster.mextra.epri = priest;
    }
    const minion = monster.emin || monster.mextra?.emin;
    if (minion) {
        minion.parentmid = monster.m_id;
        monster.emin = minion;
        if (monster.mextra?.emin)
            monster.mextra.emin = minion;
    }
    if (monster.mextra?.ebones)
        monster.mextra.ebones.parentmid = monster.m_id;
}
async function renewBonesIdentities(level, fruits) {
    // restmonchn() assigns every monster a fresh id; each monster inventory
    // is restored immediately afterward. getlev() then restores floor and
    // buried object chains. All three paths share next_ident().
    const monsterIds = new Map();
    const renewObject = async (object) => {
        if (!object)
            return;
        object.o_id = nextIdent();
        if (object.otyp === SLIME_MOLD) {
            const oldFruit = fruits.find(fruit => fruit.fid === object.spe);
            if (oldFruit)
                object.spe = addFruit(oldFruit.fname);
            else
                await impossible('no old fruit?');
        }
        for (const content of object.contents || [])
            await renewObject(content);
    };
    for (const monster of [...level.monsters].reverse()) {
        const oldId = monster.m_id;
        monster.m_id = nextIdent();
        if (Number.isInteger(oldId) && oldId > 0)
            monsterIds.set(oldId, monster.m_id);
        for (const object of monster.minvent || monster.inventory || [])
            await renewObject(object);
    }
    for (const object of bonesFloorObjects(level))
        await renewObject(object);
    for (const object of level?.buriedObjects || [])
        await renewObject(object);
    for (const monster of level?.monsters || []) {
        repairMonsterExtensions(monster);
        const inventory = monster.minvent || monster.inventory || [];
        monster.minvent = inventory;
        monster.inventory = inventory;
        monster.hasInventory = inventory.length > 0;
        for (const object of inventory) {
            object.where = 'minvent';
        }
        restoreMonsterInventoryOwnership(monster);
    }
    eachObjectInBonesGraph(level, object => repairObjectMonsterIds(object, monsterIds));
    eachTopLevelBonesObject(level, repairContainedObjects);
    // C region.c:reset_region_mids(). Missing identities are removed by
    // replacing their slot with the last member, as during region turns.
    for (const region of level.regions) {
        region.heroFault = false;
        region.heroInside = false;
        let index = 0;
        while (index < region.monsterIds.length) {
            const mapped = remappedMonsterId(region.monsterIds[index], monsterIds);
            if (mapped !== undefined) {
                region.monsterIds[index++] = mapped;
            }
            else {
                const last = region.monsterIds.pop();
                if (last !== undefined && index < region.monsterIds.length)
                    region.monsterIds[index] = last;
            }
        }
    }
}
function restoreBonesFloorOrder(level) {
    let newestOrder = game._fobjSerial ?? 0;
    eachObjectInBonesGraph(level, object => {
        newestOrder = Math.max(newestOrder, object._fobjOrder ?? 0);
    });
    // C getlev() restores fobj before restore_cham() can drop equipment.
    // Those drops must precede every object already in the bones chain.
    game._fobjSerial = newestOrder;
}
// C restore.c:restobjchn()/getlev() and timeout.c:restore_timers(). Bones
// arrive immediately after the old hero's death, on the new hero's clock.
function restoreBonesClock(level, savedAt) {
    const adjustment = game.moves - savedAt;
    restoreLevelPetHistory(level, adjustment);
    const restoreObjectClock = (object, frozen = false) => {
        if (!frozen && !object.ageRelative && !ageStoresFuel(object))
            object.age += adjustment;
        for (const timer of object.objectTimers ?? [])
            timer.deadline += adjustment;
        for (const content of object.contents ?? [])
            restoreObjectClock(content, object.otyp === ICE_BOX);
    };
    eachTopLevelBonesObject(level, restoreObjectClock);
    for (const timer of level.levelTimers)
        timer.deadline += adjustment;
    for (const damage of level.damagelist ?? [])
        damage.when += adjustment;
    if (level.flags.stasis_until !== undefined)
        level.flags.stasis_until += adjustment;
}
// C restore.c:getlev(): branch entrances can move between games.
function repairBonesConnections(level, location) {
    const here = (end) => end.dnum === location.dnum && end.dlevel === location.dlevel;
    const branch = game.branches.find(candidate => here(candidate.end1) || here(candidate.end2));
    if (!branch) {
        for (const trap of [...level.traps])
            if (trap.ttyp === MAGIC_PORTAL)
                deleteTrap(trap);
        return;
    }
    if (location.dlevel !== 1)
        return;
    const destination = here(branch.end1) ? branch.end2 : branch.end1;
    if (branch.type === 'portal') {
        const portal = level.traps.find(trap => trap.ttyp === MAGIC_PORTAL);
        if (!portal)
            throw new PanicTermination('getlev: need portal but none found');
        portal.dst = { ...destination };
        return;
    }
    for (let stair = game.stairs; stair; stair = stair.next) {
        if (stair.tolev.dnum === location.dnum)
            continue;
        stair.tolev = { ...destination };
        break;
    }
}
// C refs: bones.c:getbones() and restore.c:getlev(ghostly).
export async function getbones() {
    const flags = game.flags || {};
    if (game.discover || flags.explore)
        return false;
    if (flags.bones === false)
        return false;
    if (rn2(3) && !game.flags?.debug)
        return false;
    const location = game.u.uz;
    if (!location || !levelAllowsBones(location))
        return false;
    const encoded = game.storage?.getItem(bonesStorageKey());
    if (!encoded)
        return false;
    let payload = null;
    try {
        payload = decodeBonesPayload(encoded, BONES_VERSION);
        if (!validMonsterWormBodies(payload.level))
            payload = null;
    }
    catch (_error) {
        payload = null;
    }
    if (!payload) {
        if (!game.flags.debug)
            await pline('Discarding unusable bones; no need to panic...');
        await finishBonesRestore();
        return false;
    }
    if (game.flags.debug
        && await bonesPrompt('Get bones? [yn] (n) ') !== 'y')
        return false;
    if (payload.bonesId.length >= 40)
        return false;
    const expectedId = bonesLevelId();
    if (payload.bonesId !== expectedId) {
        if (game.flags.debug)
            await pline(`This is bones level '${payload.bonesId}', not '${expectedId}'!`);
        await pline('Strange, this map is not as I remember it.');
        await pline('Somebody is trying some trickery here...');
        await pline('This game is void.');
        if (await finishHeroDeath({ killer: '', deathType: TRICKED }))
            return false;
        await finishBonesRestore();
        return false;
    }
    restoreMonsterWormHeads(payload.level);
    restoreEngravings(payload.level);
    const sourceDisplayLevel = game.level;
    game.level = payload.level;
    shiftBonesDestinations(payload, location, location.dlevel);
    game.stairs = restoreLevelChains(game.level, payload.stairs || null);
    game._heroTrack = (payload.heroTrack || []).map(point => ({
        x: point.x, y: point.y,
    }));
    restoreBonesClock(game.level, payload.savedAt);
    await renewBonesIdentities(game.level, payload.fruits);
    restoreBonesFloorOrder(game.level);
    restoreLevelTimers(game);
    await restoreBonesMonsters(game.level, game);
    await restoreLevelRegions(game, 0);
    repairBonesConnections(game.level, location);
    resetBonesObjects(game.level, 'restore');
    await fixShopDamage(game);
    // Failed loads still reference the level being left; sanitize loaded bones only.
    sanitizeEngravings(payload.level);
    game.fmon = game.level.monsters?.[0] || null;
    game._restoredBones = await finishBonesRestore(sourceDisplayLevel);
    return game._restoredBones;
}
async function finishBonesRestore(displayLevel = null) {
    const roleplay = game.u.uroleplay;
    if (!roleplay)
        throw new Error('Bones restoration requires initialized roleplay counters');
    roleplay.numbones++;
    if (game.flags.debug) {
        const unlink = await bonesPrompt('Unlink bones? [yn] (n) ', displayLevel);
        if (unlink !== 'y')
            return true;
    }
    return deleteBonesLevel();
}
//# sourceMappingURL=bones.js.map