import test from 'node:test';
import assert from 'node:assert/strict';

import {
    artifactByName, initializeArtifacts, nameArtifact,
} from '../js/artifacts.js';
import { CORR, FOUNTAIN, G_EXTINCT, HOLE, PIT, SHOPBASE, STONE } from '../js/const.js';
import { map_location, map_object } from '../js/display.js';
import { mapLevel } from '../js/detect.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { gotoLevel } from '../js/level_change.js';
import { initRng } from '../js/rng.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { mklev, saveBonesLevel } from '../js/mklev.js';
import { linkObjectToMonsterInventory } from '../js/monster_inventory.js';
import {
    AMULET_OF_YENDOR, CHEST, CORPSE, DAGGER, FAKE_AMULET_OF_YENDOR,
    FOOD_RATION, POT_HEALING, ROCK, STATUE,
} from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { cansee, vision_recalc, vision_reset_new_level } from '../js/vision.js';
import { decodeSavedGraph, encodeSavedGraph, isSavedRecord } from '../js/saved_graph.js';
import { decodeBonesPayload } from '../js/bones_validation.js';
import type { StorageBackend } from '../js/storage.js';
import { knownObject } from './support/game-objects.js';
import { addTrap, floorObjects } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';

const PM_GHOST = 287;
const LEVEL = { dnum: 0, dlevel: 7 };

for (const hero of ['Ada-Cav', 'Ada-Cav-Hum', 'Ada-Cav-Hum-Fem', 'Ada-Cav-Hum-Fem-Cha']) {
    void test(`bones familiarity includes cemetery suffixes for ${hero}`, async () => {
        const storage = memoryStorage();
        freshBonesRoom(storage);
        requirePlayingGame(game);
        game.plname = 'Ada';
        game.flags.female = true;
        game.u.ualign.type = -1;
        requireGameLevel().requireAt(15, 10).typ = FOUNTAIN;
        assert.ok(saveBonesLevel());
        freshConnectedLevels({ destinationDepth: 7, generateDestination: true });
        game.plname = hero;
        game.storage = storage;
        game.flags.debug = true;
        initRng(3n);
        pushKeys('yn');

        await gotoLevel({ dlevel: 7 });

        assert.equal(requireGameLevel().requireAt(15, 10).typ, FOUNTAIN);
        const familiarity = /sense of deja vu|been here before|place .*familiar/;
        // bones_include_name() also requires a hyphen after the matched name.
        if (hero === 'Ada-Cav-Hum-Fem-Cha') assert.doesNotMatch(game._pending_message, familiarity);
        else assert.match(game._pending_message, familiarity);
    });
}

for (const hero of ['Ada', 'Ad']) {
    void test(`bones from Ada-Lovelace ${hero === 'Ada' ? 'are familiar to Ada' : 'are unfamiliar to Ad'}`, async () => {
        const storage = memoryStorage();
        freshBonesRoom(storage);
        game.plname = 'Ada-Lovelace';
        requireGameLevel().requireAt(15, 10).typ = FOUNTAIN;
        assert.ok(saveBonesLevel());
        freshConnectedLevels({ destinationDepth: 7, generateDestination: true });
        game.plname = hero;
        game.storage = storage;
        game.flags.debug = true;
        initRng(3n);
        pushKeys('yn');

        await gotoLevel({ dlevel: 7 });

        assert.equal(requireGameLevel().requireAt(15, 10).typ, FOUNTAIN);
        const familiarity = /sense of deja vu|been here before|place .*familiar/;
        if (hero === 'Ada') assert.match(game._pending_message, familiarity);
        else assert.doesNotMatch(game._pending_message, familiarity);
    });
}

void test('bones from another hero do not make a newly entered level familiar', async () => {
    const storage = memoryStorage();
    freshBonesRoom(storage);
    game.plname = 'Ancestor';
    requireGameLevel().requireAt(15, 10).typ = FOUNTAIN;
    assert.ok(saveBonesLevel());

    for (let seed = 1; seed <= 4; seed++) {
        freshConnectedLevels({ destinationDepth: 7, generateDestination: true });
        game.plname = 'Newcomer';
        game.storage = storage;
        game.flags.debug = true;
        initRng(BigInt(seed));
        pushKeys('yn');

        await gotoLevel({ dlevel: 7 });

        assert.equal(requireGameLevel().requireAt(15, 10).typ, FOUNTAIN,
            'the destination must contain the restored bones');
        assert.doesNotMatch(game._pending_message,
            /sense of deja vu|been here before|place .*familiar/,
            'a different hero must not recognize the ancestor level');
    }
});

void test('a hero recognizes their bones after a later ancestor has died on the level', async () => {
    const storage = memoryStorage();
    freshBonesRoom(storage);
    game.plname = 'First';
    assert.ok(saveBonesLevel());
    freshBonesRoom(storage);
    game.plname = 'Second';
    pushKeys('yn');
    await mklev();
    assert.ok(saveBonesLevel());
    freshConnectedLevels({ destinationDepth: 7, generateDestination: true });
    game.plname = 'First';
    game.storage = storage;
    game.flags.debug = true;
    initRng(3n);
    pushKeys('yn');

    await gotoLevel({ dlevel: 7 });

    assert.match(game._pending_message, /sense of deja vu|been here before|place .*familiar/);
});

function freshBonesRoom(storage: StorageBackend): void {
    freshPlayableRoom({
        seed: 8701n,
        hero: {
            uz: { ...LEVEL },
            ualign: { type: 1, record: 10 },
        },
    });
    requirePlayingGame(game);
    game.storage = storage;
    game.flags.debug = true;
    init_objects();
    initializeArtifacts(game);
}

function storedBones(storage: StorageBackend) {
    const key = storage.key(0);
    assert.ok(key, 'bones did not create a storage entry');
    const encoded = storage.getItem(key);
    assert.ok(encoded, 'bones storage entry is empty');
    const header = decodeSavedGraph(encoded);
    assert.ok(isSavedRecord(header) && typeof header.version === 'number',
        'bones did not retain their format version');
    return { key, payload: decodeBonesPayload(encoded, header.version) };
}

void test('bones restore resets old hero state and repairs entity links',
    async () => {
        const storage = memoryStorage();
        freshBonesRoom(storage);
        requirePlayingGame(game);

        const ghost = await createMonsterAt(PM_GHOST, 12, 10);
        const dagger = await knownObject(DAGGER, {
            invlet: 'a',
            lknown: true,
            cknown: true,
            tknown: true,
            rknown: true,
            no_charge: true,
            how_lost: 4,
            pickup_prev: true,
            oname: 'old hero dagger',
            oextra: { oname: 'old hero dagger' },
        });
        await linkObjectToMonsterInventory(ghost, dagger);

        const corpse = await knownObject(CORPSE, {
            corpsenm: 260,
            oextra: { omid: ghost.m_id },
        });
        placeCreatedObject(corpse, 12, 10);

        const chest = await knownObject(CHEST);
        const rock = await knownObject(ROCK, {
            where: 'contained',
            container: chest,
        });
        chest.contents = [rock];
        placeCreatedObject(chest, 13, 10);

        const amulet = await knownObject(AMULET_OF_YENDOR);
        placeCreatedObject(amulet, 14, 10);
        placeCreatedObject(await knownObject(FOOD_RATION, { in_use: true }), 15, 10);
        const grayswandir = artifactByName('Grayswandir');
        assert.ok(grayswandir);
        const bonesArtifact = await knownObject(grayswandir.baseType);
        assert.equal(nameArtifact(bonesArtifact, grayswandir), true);
        placeCreatedObject(bonesArtifact, 18, 10);
        const statue = await knownObject(STATUE, {
            oname: 'old\u0001name',
            oextra: { oname: 'old\u0001name' },
        });
        placeCreatedObject(statue, 19, 10);
        addTrap(game.level, HOLE, 16, 10, { tseen: false, madeby_u: true });
        addTrap(game.level, PIT, 17, 10, { tseen: true, madeby_u: true });

        assert.equal(saveBonesLevel(), true);

        freshBonesRoom(storage);
        requirePlayingGame(game);
        const currentArtifact = await knownObject(grayswandir.baseType);
        assert.equal(nameArtifact(currentArtifact, grayswandir), true);
        currentArtifact.where = 'inventory';
        game.inventory.push(currentArtifact);
        pushKeys('yn');
        await mklev();

        const restoredGhost = requireGameLevel().monsters.find(monster =>
            monster.mnum === PM_GHOST);
        const restoredObjects = floorObjects(game.level);
        const restoredCorpse = restoredObjects.find(object =>
            object.otyp === CORPSE);
        const restoredChest = restoredObjects.find(object =>
            object.otyp === CHEST);
        const restoredAmulet = restoredObjects.find(object =>
            object.otyp === FAKE_AMULET_OF_YENDOR);
        const restoredArtifact = restoredObjects.find(object =>
            object.otyp === grayswandir.baseType);
        const restoredStatue = restoredObjects.find(object =>
            object.otyp === STATUE);
        assert.ok(restoredGhost, 'bones lost their ghost');
        assert.ok(restoredCorpse, 'bones lost the linked corpse');
        assert.ok(restoredChest, 'bones lost the chest');
        assert.ok(restoredAmulet, 'bones did not replace the Amulet');
        assert.ok(restoredArtifact, 'bones lost the duplicate artifact object');
        assert.ok(restoredStatue, 'bones lost the named statue');
        const restoredDagger = restoredGhost.minvent?.[0];
        const restoredRock = restoredChest.contents?.[0];
        assert.ok(restoredDagger, 'bones lost the ghost inventory');
        assert.ok(restoredRock, 'bones lost the chest contents');
        assert.ok(restoredCorpse.oextra, 'corpse lost its linked-monster record');
        assert.ok(restoredDagger.oextra, 'dagger lost its extra record');
        assert.ok(restoredArtifact.oextra, 'artifact lost its extra record');
        assert.ok(restoredStatue.oextra, 'statue lost its extra record');
        const newIds = [
            restoredGhost.m_id,
            restoredDagger.o_id,
            restoredCorpse.o_id,
            restoredChest.o_id,
            restoredRock.o_id,
        ];

        assert.equal(new Set(newIds).size, newIds.length);
        assert.equal(newIds.every(id => id > 0), true);
        assert.equal(restoredCorpse.oextra.omid, restoredGhost.m_id);
        assert.equal(restoredGhost.inventory, restoredGhost.minvent);
        assert.equal(restoredDagger.carrierMid, restoredGhost.m_id);
        assert.equal(restoredRock.container, restoredChest);
        assert.equal(restoredDagger.known, false);
        assert.equal(restoredDagger.dknown, false);
        assert.equal(restoredDagger.bknown, false);
        assert.equal(restoredDagger.rknown, false);
        assert.equal(restoredDagger.invlet, null);
        assert.equal(restoredDagger.no_charge, false);
        assert.equal(restoredDagger.how_lost, 0);
        assert.equal(restoredDagger.pickup_prev, false);
        assert.equal(restoredDagger.oname, undefined);
        assert.equal(restoredDagger.oextra.oname, undefined);
        assert.equal(restoredDagger.ghostly, true);
        assert.equal(!!restoredRock.ghostly, false);
        assert.equal(restoredAmulet.cursed, true);
        assert.equal(restoredAmulet.bknown, false);
        assert.equal(restoredAmulet.buc, undefined);
        assert.equal(restoredArtifact.oartifact, 0);
        assert.equal(restoredArtifact.artifact, false);
        assert.equal(restoredArtifact.oextra.oname, undefined);
        assert.equal(restoredStatue.oname, 'old.name');
        assert.equal(restoredStatue.oextra.oname, 'old.name');
        assert.equal(restoredObjects.some(object =>
            object.otyp === FOOD_RATION), false);
        const restoredHole = requireGameLevel().traps.find(trap =>
            trap.ttyp === HOLE);
        const restoredPit = requireGameLevel().traps.find(trap =>
            trap.ttyp === PIT);
        assert.ok(restoredHole, 'bones lost the hole');
        assert.ok(restoredPit, 'bones lost the pit');
        assert.equal(restoredHole.tseen, true);
        assert.equal(restoredHole.madeby_u, 0);
        assert.equal(restoredPit.tseen, false);
        assert.equal(restoredPit.madeby_u, 0);
    });

void test('bones keep partly eaten food free in its staffed shop', async () => {
    const storage = memoryStorage();
    freshBonesRoom(storage);
    requirePlayingGame(game);
    await createStaffedShop({ shopType: SHOPBASE + 5 });
    const chest = await knownObject(CHEST);
    const ration = await knownObject(FOOD_RATION, {
        where: 'contained',
        container: chest,
        oeaten: 400,
    });
    chest.contents = [ration];
    placeCreatedObject(chest, 12, 10);
    assert.equal(saveBonesLevel(), true);

    freshBonesRoom(storage);
    requirePlayingGame(game);
    pushKeys('yn');
    await mklev();

    const restoredChest = floorObjects(game.level).find(object =>
        object.otyp === CHEST);
    const restoredRation = restoredChest?.contents?.[0];
    assert.ok(restoredRation, 'bones lost the partly eaten ration');
    assert.equal(restoredRation.no_charge, true);
});

void test('bones clean monster names and remove extinct species', async () => {
    const storage = memoryStorage();
    freshBonesRoom(storage);
    requirePlayingGame(game);
    const ghost = await createMonsterAt(PM_GHOST, 12, 10);
    ghost.name = 'old\u0001ghost';
    ghost.mgivenname = 'old\u0001ghost';
    ghost.mextra = { mgivenname: 'old\u0001ghost' };
    const troll = await createMonsterAt('troll', 13, 10);
    const questArtifact = artifactByName(game.urole.artifactName);
    assert.ok(questArtifact);
    const orb = await knownObject(questArtifact.baseType);
    assert.equal(nameArtifact(orb, questArtifact), true);
    await linkObjectToMonsterInventory(troll, orb);
    await linkObjectToMonsterInventory(troll, await knownObject(DAGGER));
    assert.equal(saveBonesLevel(), true);

    freshBonesRoom(storage);
    requirePlayingGame(game);
    game.mvitals = [];
    game.mvitals[220] = { born: 0, died: 0, mvflags: G_EXTINCT  };
    pushKeys('yn');
    await mklev();

    const restoredGhost = requireGameLevel().monsters.find(monster =>
        monster.mnum === PM_GHOST);
    assert.ok(restoredGhost, 'bones lost the named ghost');
    assert.equal(restoredGhost.name, 'old.ghost');
    assert.equal(requireGameLevel().monsters.some(monster => monster.mnum === 220),
        false);
    const restoredObjects = floorObjects(game.level);
    const restoredOrb = restoredObjects.find(object =>
        object.otyp === questArtifact.baseType);
    assert.ok(restoredOrb, 'bones lost the stripped quest artifact');
    assert.equal(restoredOrb.oartifact, 0);
    assert.equal(restoredObjects.some(object => object.otyp === DAGGER), false);
});

for (const version of [null, 2, 3, 4, 5, 6, 7, 8]) {
    void test(version === null ? 'current named bones remain usable'
        : `incompatible bones version ${version} is rejected`, async () => {
        const storage = memoryStorage();
        freshBonesRoom(storage);
        requirePlayingGame(game);
        game.plname = 'Previous adventurer';
        await createMonsterAt(PM_GHOST, 12, 10);
        placeCreatedObject(await knownObject(STATUE, {
            oname: 'unreadable heirloom',
            oextra: { oname: 'unreadable heirloom' },
        }), 13, 10);
        assert.equal(saveBonesLevel(), true);
        if (version !== null) {
            const { key, payload } = storedBones(storage);
            payload.version = version;
            storage.setItem(key, encodeSavedGraph(payload));
        }
        freshBonesRoom(storage);
        requirePlayingGame(game);
        pushKeys('yn');

        await mklev();

        const heirloom = floorObjects(game.level).find(object =>
            (object.oextra?.oname || object.oname) === 'unreadable heirloom');
        assert.equal(!!heirloom, version === null);
    });
}

void test("bones retain physical terrain but not the dead adventurer's terrain memory", async () => {
    const storage = memoryStorage();
    freshBonesRoom(storage);
    requirePlayingGame(game);
    const location = requireGameLevel().requireAt(30, 10);
    location.typ = FOUNTAIN;
    map_location(30, 10, false);
    assert.equal(location.lastseentyp, FOUNTAIN);
    assert.equal(saveBonesLevel(), true);

    freshBonesRoom(storage);
    requirePlayingGame(game);
    pushKeys('yn');
    await mklev();

    assert.equal(requireGameLevel().requireAt(30, 10).typ, FOUNTAIN);
    assert.equal(requireGameLevel().requireAt(30, 10).lastseentyp, STONE);
    assert.equal(requireGameLevel().requireAt(30, 10).remembered_glyph, undefined);
});

void test("magic mapping bones does not recover the old adventurer's unseen object markers", async () => {
    const storage = memoryStorage();
    freshBonesRoom(storage);
    requirePlayingGame(game);
    requireGameLevel().requireAt(30, 10).typ = CORR;
    const potion = await knownObject(POT_HEALING);
    placeCreatedObject(potion, 30, 10);
    map_object(potion, true);
    assert.equal(requireGameLevel().requireAt(30, 10).disp_ch, '!');
    assert.equal(saveBonesLevel(), true);
    const { payload: saved } = storedBones(storage);
    assert.equal(saved.level.requireAt(30, 10).disp_glyph, undefined);

    freshBonesRoom(storage);
    requirePlayingGame(game);
    pushKeys('yn');
    await mklev();
    vision_reset_new_level();
    vision_recalc(0);
    assert.equal(cansee(30, 10), false);
    mapLevel();

    assert.equal(requireGameLevel().requireAt(30, 10).disp_ch, '#');
    const remembered = requireGameLevel().requireAt(30, 10).remembered_glyph;
    assert.ok(remembered, 'mapping did not remember the corridor');
    assert.notEqual(remembered.kind, 'object');
});
