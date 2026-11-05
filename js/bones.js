// bones.ts — bones.c in one module, ordered by the C lifecycle:
// no_bones_level()/can_make_bones() admission, the savebones() death flow
// (drop_upon_death(), give_to_nearby_mon()), its monster fixups
// (fixuporacle(), remove_mon_from_bones(), the restmonchn() adaptation),
// then the bones payload save/load with its object, timer and connection
// resets.
// C refs: bones.c savebones()/getbones()/resetobjs(); the restore.c getlev()
// adaptations used only by bones (restobjchn timers, region identity repair,
// branch connection repair) and files.c set_bonesfile_name(). Payload
// validation lives in bones_validation.ts and name sanitization in
// bones_name.ts.
import { recorderLocalEpochSeconds, recorderTimestamp } from './calendar.js';
import { rn2 } from './rng.js';
import { BUFSZ, COLNO, CORPSTAT_INIT, DEFUNCT_MONSTER, DELPHI, DISMOUNT_BONES, G_NOCORPSE, GRAVE, HEADSTONE, HOLE, In_quest, Invocation_lev, Is_oracle_level, LEAVESTATUE, MAGIC_PORTAL, MM_NONAME, MON_FLOOR, NON_PM, NO_MINVENT, PARANOID_BONES, PL_NSIZ, RLOC_NOMSG, ROOM, ROWNO, STONE, TRICKED, Upolyd, } from './const.js';
import { GameMap } from './game.js';
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import { pline, plineWithContinuation } from './pline.js';
import { flush_screen, newsym } from './display.js';
import { nhgetch } from './input.js';
import { impossible } from './diagnostics.js';
import { PanicTermination } from './panic_termination.js';
import { finishHeroDeath } from './end.js';
import { DTHSZ, formatKiller } from './topten.js';
import { prepareBonesObjectForRestore, prepareBonesObjectForSave } from './bones_object.js';
import { sanitizeBonesName } from './bones_name.js';
import { decodeBonesPayload } from './bones_validation.js';
import { encodeSavedGraph } from './saved_graph.js';
import { hideMonsterUnder, monsterCanCarryObject, purgeDeadMonsters, removeMonsterFromGame, restoreMonsterShape, restoreMonsterInventoryOwnership } from './mon.js';
import { restoreLevelChains } from './level_restore.js';
import { hideMonsterOnRestore, restoreLevelPetHistory, restoreMonsterWormHeads, validMonsterWormBodies } from './save.js';
import { endObjectBurn, restoreLevelTimers } from './timeout.js';
import { restoreLevelRegions } from './region.js';
import { fixShopDamage, pacifyShopkeeper, setShopResidency } from './shk.js';
import { forgetEngravings, makeEngravingAt, restoreEngravings, sanitizeEngravings } from './engrave.js';
import { deleteTrap } from './trap.js';
import { addFruit } from './options.js';
import { addObjectToContainer, curseObjectState, linkObjectToMonsterInventory, mkcorpstat, mksobj, objectWeight, nextIdent, placeObjectSynchronously } from './mkobj.js';
import { ageStoresFuel } from './pickup.js';
import { specialLevelAt } from './dungeon.js';
import { CORPSE, ICE_BOX, MUMMY_WRAPPING, SLIME_MOLD, STATUE } from './object_data.js';
import { clearBypasses } from './worn.js';
import { isok, paranoidQuery } from './cmd.js';
import { dismountHero, monsterHasMapPosition } from './steed.js';
import { artifactEmitsLight } from './artifact.js';
import { setTwoWeaponCombat } from './wield.js';
import { makemonAt, peaceMinded, propagateMonsterSpecies, setMonsterMalign } from './makemon.js';
import { initializeMonsterArmor } from './worn.js';
import { releaseAllMonsterLeashes } from './apply.js';
import { setMonsterGivenName } from './do_name.js';
import { MONSTER_ALIGNMENT, MONSTER_GENO, MONSTER_NAME, MONSTER_SOUND, MONSTER_SYMBOL, SPECIAL_PM } from './monster_data.js';
import { objectNoLongerHeldSynchronously } from './do.js';
import { unpunishHero } from './read.js';
import { depth, ledgerNo, maxLedgerNo } from './dungeon.js';
import { isRoom } from './map_types.js';
import { hasPermanentIntrinsicProperty } from './properties.js';
import { races, roles } from './role.js';
import { relocateMonsterTo, enexto } from './teleport.js';
import { hasShopkeeperData } from './shop_types.js';
import { roomForRoomno } from './hack.js';
import { likes_gold, likes_gems, likes_objs, likes_magic, monsterHidesUnder, monsterIsUndead } from './mondata.js';
// C bones.c:can_make_bones()/no_bones_level(). Dungeon topology owns which
// levels can leave bones; the depth trial still runs in wizard and explore mode.
export function canMakeBones(state = game, random = rn2) {
    requirePlayingGame(state);
    if (state.flags.bones === false)
        return false;
    const location = state.u.uz;
    const ledger = ledgerNo(location, state);
    if (ledger <= 0 || ledger > maxLedgerNo(state))
        return false;
    const branchLevel = isBranchLevel(location, state);
    if (!levelAllowsBones(location, state))
        return false;
    if (state.u.uswallow)
        return false;
    if (!branchLevel && state.level.traps.some(trap => trap.ttyp === MAGIC_PORTAL))
        return false;
    const dungeonDepth = depth(location, state.dungeons);
    if (dungeonDepth <= 0)
        return false;
    if (random(1 + (dungeonDepth >> 2)) === 0 && !state.flags.debug)
        return false;
    return !state.discover && !state.flags.explore;
}
export function levelAllowsBones(location, state = game) {
    const dungeon = state.dungeons[location.dnum];
    if (!dungeon?.bonetag)
        return false;
    const special = specialLevelAt(location, state);
    if (special && !special.bonetag)
        return false;
    if (location.dlevel === dungeon.num_dunlevs)
        return false;
    if (isBranchLevel(location, state) && location.dlevel > 1)
        return false;
    return !Invocation_lev(location, state);
}
function isBranchLevel(location, state) {
    const here = (end) => end.dnum === location.dnum
        && end.dlevel === location.dlevel;
    return state.branches.some(branch => here(branch.end1) || here(branch.end2));
}
// C refs: bones.c:savebones(), drop_upon_death(), and give_to_nearby_mon().
const PM_HUMAN = 260;
const PM_GHOST = 287;
const S_MUMMY = 39;
function clearHeroCarriedState(object) {
    object.owornmask = 0;
    object.worn = false;
    object.wornSlot = null;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
}
function monsterAt(x, y) {
    return (game.level?.monsters || []).find(monster => monsterHasMapPosition(monster, game) &&
        !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}
// C bones.c:give_to_nearby_mon() takes from a monster with any of the
// likes_gold()/likes_gems()/likes_objs()/likes_magic() appetites
// (mondata.h macros), with no check that the object matches.
export function monsterLikesObjects(monster) {
    return likes_gold(monster.mnum) || likes_gems(monster.mnum)
        || likes_objs(monster.mnum) || likes_magic(monster.mnum);
}
// C bones.c:give_to_nearby_mon(): reservoir sampling over the 3x3
// neighborhood picks the taker.
function nearbyMonsterForDeathDrop(x, y) {
    let selected = null;
    let candidateCount = 0;
    for (let nearbyX = x - 1; nearbyX <= x + 1; nearbyX++) {
        for (let nearbyY = y - 1; nearbyY <= y + 1; nearbyY++) {
            if (!isok(nearbyX, nearbyY)
                || nearbyX === game.u.ux && nearbyY === game.u.uy)
                continue;
            const monster = monsterAt(nearbyX, nearbyY);
            if (!monster || !monsterLikesObjects(monster))
                continue;
            candidateCount++;
            if (rn2(candidateCount) === 0)
                selected = monster;
        }
    }
    return selected;
}
async function giveDeathDropToNearbyMonster(object, x, y) {
    const monster = nearbyMonsterForDeathDrop(x, y);
    if (!monster || !monsterCanCarryObject(monster, object, game))
        return false;
    await linkObjectToMonsterInventory(monster, object);
    return true;
}
export async function dropHeroInventoryForBones(x, y, { carrier = null, container = null } = {}) {
    setTwoWeaponCombat(false);
    while ((game.inventory || []).length) {
        const object = game.inventory.shift();
        if (!object)
            break;
        object.where = 'free';
        if (!carrier || monsterIsUndead(carrier.mnum))
            objectNoLongerHeldSynchronously(object, game);
        if ((container || artifactEmitsLight(object)) && object.lamplit)
            endObjectBurn(object, game, game.moves ?? 0);
        clearHeroCarriedState(object);
        if (rn2(5))
            curseObjectState(object);
        if (carrier) {
            await linkObjectToMonsterInventory(carrier, object);
            continue;
        }
        if (container) {
            await addObjectToContainer(container, object, game);
            continue;
        }
        if (rn2(8) === 0 && await giveDeathDropToNearbyMonster(object, x, y))
            continue;
        placeObjectSynchronously(object, x, y);
    }
    if (container)
        container.owt = objectWeight(container);
}
async function makeBonesMonster(mnum, x, y, flags) {
    game.in_mklev = true;
    try {
        return await makemonAt(mnum, x, y, flags);
    }
    finally {
        game.in_mklev = false;
    }
}
async function addMummyWrapping(monster) {
    if (MONSTER_SYMBOL[monster.mnum] !== S_MUMMY
        || (monster.minvent ?? []).some(object => object.otyp === MUMMY_WRAPPING)) {
        return;
    }
    await linkObjectToMonsterInventory(monster, await mksobj(MUMMY_WRAPPING, true, false));
}
// The dead hero leaves C mkobj.c:mk_named_object()'s named corpse or
// statue; mkobj.c:obj_attach_mid() ties the ghost's id to it.
export async function createBonesFromDeath(deathCause, promptDeathQuestion, when) {
    if (!game._canMakeBones)
        return false;
    const level = requireGameLevel();
    const x = game.u?.ux ?? 0;
    const y = game.u?.uy ?? 0;
    const arise = game.u?.ugrave_arise ?? NON_PM;
    let corpse = null;
    const heroForm = game.u.umonnum;
    if (heroForm === undefined)
        throw new Error('Death remains require an initialized hero species');
    const formFlags = game.mvitals?.[heroForm]?.mvflags ?? MONSTER_GENO[heroForm] ?? 0;
    if (arise === NON_PM && !(formFlags & G_NOCORPSE)) {
        const species = Upolyd(game.u) ? heroForm : game.urace?.mnum ?? PM_HUMAN;
        corpse = await mkcorpstat(CORPSE, null, species, x, y, CORPSTAT_INIT);
        corpse.name = `${game.plname || 'player'} corpse`;
        corpse.oname = game.plname || 'player';
        const deathSquare = level.at(x, y);
        const trapped = level.traps.some(trap => trap.tx === x && trap.ty === y);
        if (deathSquare && (deathSquare.typ === ROOM || deathSquare.typ === GRAVE) && !trapped) {
            const wasGrave = deathSquare.typ === GRAVE;
            deathSquare.typ = GRAVE;
            if (!wasGrave)
                deathSquare.emptygrave = 1;
            // C end.c:1316-1318 prefixes the player name and formats the
            // rest with the remaining buffer: formatkiller(eos(pbuf),
            // BUFSZ - strlen(pbuf), how, TRUE).
            const name = game.plname || 'player';
            makeEngravingAt(x, y, `${name}, ${formatKiller(deathCause, BUFSZ - (name.length + 2), true)}`, null, 0, HEADSTONE);
        }
    }
    if (game.flags?.debug) {
        // end.c:1366 asks paranoid_query(ParanoidBones, "Save bones?");
        // its non-paranoid branch is yn_function(prompt, ynchars, 'n', FALSE)
        // (cmd.c:5645), which neither pops nor feeds the command queue.
        if (!await paranoidQuery(!!((game.flags.paranoia_bits ?? 0) & PARANOID_BONES), 'Save bones?'))
            return false;
    }
    clearBypasses();
    if (bonesLevelExists()) {
        if (!game.flags?.debug)
            return false;
        const replace = await promptDeathQuestion('Bones file already exists.  Replace it?');
        if (replace !== 'y')
            return false;
        if (!deleteBonesLevel()) {
            await plineWithContinuation('Cannot unlink old bones.');
            return false;
        }
    }
    releaseAllMonsterLeashes();
    if (game.u.punished)
        await unpunishHero();
    if (game.u.usteed)
        await dismountHero(DISMOUNT_BONES);
    await prepareBonesMonstersForSave();
    forgetEngravings(level);
    for (const object of game.inventory)
        object.ghostly = true;
    if (arise === LEAVESTATUE) {
        const form = game.u?.umonnum ?? game.urace?.mnum ?? PM_HUMAN;
        // C mkobj.c:mk_named_object(): corpse or statue named after the hero.
        const statue = await mkcorpstat(STATUE, null, form, x, y, 0);
        statue.oname = game.plname || 'player';
        await dropHeroInventoryForBones(x, y, { container: statue });
        game._bonesSaved = saveBonesLevel(deathCause, when);
        return game._bonesSaved;
    }
    if (arise >= 0) {
        const monster = await makeBonesMonster(arise, x, y, NO_MINVENT);
        if (!monster) {
            await dropHeroInventoryForBones(x, y);
            game.u.ugrave_arise = NON_PM;
            game._bonesSaved = false;
            return false;
        }
        giveHeroResistancesToMonster(monster, game);
        setMonsterGivenName(monster, game.plname || 'player');
        await newsym(x, y);
        await dropHeroInventoryForBones(x, y, { carrier: monster });
        await addMummyWrapping(monster);
        await initializeMonsterArmor(monster);
        completeBonesMonster(monster, game);
        game._bonesSaved = saveBonesLevel(deathCause, when);
        return game._bonesSaved;
    }
    await dropHeroInventoryForBones(x, y);
    const ghost = await makeBonesMonster(PM_GHOST, x, y, MM_NONAME);
    if (!ghost) {
        game._bonesSaved = false;
        return false;
    }
    setMonsterGivenName(ghost, game.plname || 'player');
    completeBonesMonster(ghost, game);
    if (corpse) {
        // C mkobj.c:obj_attach_mid(): the ghost's id rides on the corpse.
        corpse.oextra = { ...(corpse.oextra || {}), omid: ghost.m_id };
    }
    game._bonesSaved = saveBonesLevel(deathCause, when);
    return game._bonesSaved;
}
// Monster state saved in bones levels.
// C refs: bones.c:savebones()/getbones().
const PM_MEDUSA = MONSTER_NAME.indexOf('Medusa');
const PM_VLAD = MONSTER_NAME.indexOf('Vlad the Impaler');
const PM_ORACLE = MONSTER_NAME.indexOf('Oracle');
const MS_LEADER = 36;
const MS_NEMESIS = 37;
// Also C bones.c:remove_mon_from_bones(): inlined here in the monster purge loop.
export async function prepareBonesMonstersForSave() {
    const level = requireGameLevel();
    for (const monster of [...level.monsters].reverse()) {
        if (monster.mhp < 1 || (monster.mstate ?? MON_FLOOR) !== MON_FLOOR)
            continue;
        const sound = MONSTER_SOUND[monster.mnum];
        if (monster.iswiz || monster.mnum === PM_MEDUSA
            || sound === MS_LEADER || sound === MS_NEMESIS
            || monster.mnum === PM_VLAD || monster.cham === PM_VLAD
            || monster.mnum === PM_ORACLE && !await fixupOracle(monster))
            await removeMonsterFromGame(monster);
    }
    purgeDeadMonsters(level);
}
async function fixupOracle(oracle) {
    if (!Is_oracle_level(game.u.uz))
        return false;
    const level = requireGameLevel();
    oracle.mpeaceful = 1;
    const currentRoom = () => roomForRoomno(level, level.at(oracle.mx, oracle.my)?.roomno ?? 0);
    if (currentRoom()?.rtype === DELPHI)
        return true;
    const chamber = level.rooms.find(room => isRoom(room) && room.orig_rtype === DELPHI);
    if (!isRoom(chamber))
        return true;
    if (currentRoom() !== chamber) {
        const x = Math.trunc((chamber.lx + chamber.hx) / 2);
        const y = Math.trunc((chamber.ly + chamber.hy) / 2);
        const destination = enexto(oracle.mnum, x, y);
        if (destination)
            await relocateMonsterTo(oracle, destination.x, destination.y, { flags: RLOC_NOMSG });
    }
    if (currentRoom() === chamber)
        chamber.rtype = DELPHI;
    return true;
}
function sanitizeMonsterName(monster) {
    const name = monster?.mextra?.mgivenname
        || monster?.mgivenname
        || monster?.name;
    if (!name)
        return;
    const sanitized = sanitizeBonesName(name);
    setMonsterGivenName(monster, sanitized);
}
const HERO_RESISTANCES = Object.freeze([
    ['fireResistance', 0x01],
    ['coldResistance', 0x02],
    ['sleepResistance', 0x04],
    ['disintegrationResistance', 0x08],
    ['shockResistance', 0x10],
    ['poisonResistance', 0x20],
    ['acidResistance', 0x40],
    ['stoneResistance', 0x80],
]);
function roleIndex(state) {
    const index = roles.findIndex(role => role.key === state.urole?.key);
    return index < 0 ? 0 : index;
}
function raceIndex(state) {
    const index = races.findIndex(race => race.noun === state.urace?.noun);
    return index < 0 ? 0 : index;
}
export function giveHeroResistancesToMonster(monster, state = game) {
    let inherited = 0;
    for (const [property, bit] of HERO_RESISTANCES) {
        if (hasPermanentIntrinsicProperty(property, state))
            inherited |= bit;
    }
    monster.mintrinsics = (monster.mintrinsics ?? 0) | inherited;
    return inherited;
}
export function completeBonesMonster(monster, state = game) {
    requirePlayingGame(state);
    const finalRole = roleIndex(state);
    const finalRace = raceIndex(state);
    const ebones = {
        parentmid: monster.m_id,
        role: finalRole,
        race: finalRace,
        oldalign: {
            type: state.u.ualign.type,
            record: state.u.ualign.record,
            abuse: state.u.ualign.abuse ?? 0,
        },
        deathlevel: state.u?.ulevel ?? 0,
        luck: state.u?.uluck ?? 0,
        mnum: SPECIAL_PM + 1 + finalRole,
        female: !!state.flags?.female,
        demigod: !!state.u?.uevent?.udemigod,
        crowned: !!state.u?.uevent?.uhand_of_elbereth,
    };
    monster.m_lev = state.u?.ulevel || 1;
    monster.mhp = monster.mhpmax = state.u?.uhpmax || 1;
    monster.female = !!state.flags?.female;
    monster.msleeping = 1;
    monster.mextra ??= {};
    monster.mextra.ebones = ebones;
    return monster;
}
export async function restoreBonesMonsters(level, state) {
    // C restmonchn() admits the complete chain before getbones() starts
    // purging it. Inventory drops during purge must not affect admission
    // of an actor later in that chain.
    // Births append here; native fmon starts with the newest monster.
    const monsters = [...level.monsters].reverse();
    for (const monster of monsters) {
        if (monster.isshk && state.u.uz?.dlevel) {
            if (!hasShopkeeperData(monster))
                throw new Error(`Bones shopkeeper ${monster.m_id} has no shop record.`);
            monster.eshk.shoplevel = { ...state.u.uz };
            const customer = (monster.eshk.customer ?? '').slice(0, PL_NSIZ).toLowerCase();
            if (!monster.mpeaceful && customer !== state.plname.slice(0, PL_NSIZ).toLowerCase())
                pacifyShopkeeper(monster, true);
        }
        // C priest.c:restpriest(): bones belong to the receiving level.
        if (monster.ispriest && state.u.uz?.dlevel) {
            const shrine = monster.epri ?? monster.mextra?.epri;
            if (!shrine)
                throw new Error(`Bones priest ${monster.m_id} has no shrine record.`);
            shrine.shrlevel = { ...state.u.uz };
        }
        const species = typeof monster.cham === 'number' && Number.isInteger(monster.cham) && monster.cham >= 0
            ? monster.cham : monster.mnum;
        if (!propagateMonsterSpecies(species, true, true, state))
            monster.mhpmax = DEFUNCT_MONSTER;
    }
    for (const monster of monsters) {
        setShopResidency(monster, false, state);
        if (monster.mundetected && monsterHidesUnder(monster.mnum))
            await hideMonsterUnder(monster, state);
        if (!monster.isshk) {
            const alignment = MONSTER_ALIGNMENT[monster.mnum] ?? 0;
            const isUnicorn = monster.mnum >= 101 && monster.mnum <= 103;
            const coalignedUnicorn = isUnicorn
                && Math.sign(state.u.ualign?.type ?? 0) === Math.sign(alignment);
            monster.mpeaceful = coalignedUnicorn || peaceMinded(monster.mnum) ? 1 : 0;
        }
        setMonsterMalign(monster, state);
        await restoreMonsterShape(monster, state);
        await hideMonsterOnRestore(monster, state);
    }
    for (const monster of monsters) {
        sanitizeMonsterName(monster);
        if (monster.mhpmax !== DEFUNCT_MONSTER)
            continue;
        await removeMonsterFromGame(monster);
    }
}
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
// The resetobjs() pass over one object chain (monster invent, floor,
// buried) for bones save and restore.
// Also C bones.c:set_ghostly_objlist(): inlined here (the ghostly flag);
// the hero invent marking in createBonesFromDeath() is the same helper.
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
// Also C bones.c:goodfruit(): inlined here — only fruits referenced by a
// slime mold in the graph stay existing in the payload.
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
        // C bones.c:585 formats cemetery.how with formatkiller(
        // newbones->how, sizeof == DTHSZ + 1, how, TRUE).
        { who, how: formatKiller(deathCause, DTHSZ + 1, true), when: recorderTimestamp(when),
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
// C region.c:reset_region_mids(): bones region membership is remapped to
// the renewed monster ids; a missing id drops out by slot swap.
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