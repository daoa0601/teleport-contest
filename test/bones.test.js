import test from 'node:test';
import assert from 'node:assert/strict';

import {
    artifactByName, initializeArtifacts, nameArtifact,
} from '../js/artifacts.js';
import { G_EXTINCT, HOLE, PIT, SHOPBASE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { place_object } from '../js/floor_object.js';
import { mklev, saveBonesLevel } from '../js/mklev.js';
import { linkObjectToMonsterInventory } from '../js/monster_inventory.js';
import {
    AMULET_OF_YENDOR, CHEST, CORPSE, DAGGER, FAKE_AMULET_OF_YENDOR,
    FOOD_RATION, ROCK, STATUE,
} from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { knownObject } from './support/game-objects.js';
import { floorObjects } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { addMonster } from './support/monsters.js';
import { freshCommandRoom } from './support/playable-room.js';
import { addStaffedShop } from './support/shop.js';

const PM_GHOST = 287;
const LEVEL = { dnum: 0, dlevel: 7 };

function freshBonesRoom(storage) {
    freshCommandRoom({
        seed: 8701n,
        hero: {
            uz: { ...LEVEL },
            ualign: { type: 1, record: 10 },
        },
    });
    game.storage = storage;
    game.flags.debug = true;
    init_objects();
    initializeArtifacts(game);
}

test('bones restore resets old hero state and repairs entity links',
    async () => {
        const storage = memoryStorage();
        freshBonesRoom(storage);

        const ghost = addMonster({
            m_id: 7101,
            mnum: PM_GHOST,
            x: 12,
            y: 10,
        });
        const dagger = knownObject(DAGGER, {
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
        linkObjectToMonsterInventory(ghost, dagger);

        const corpse = knownObject(CORPSE, {
            corpsenm: 260,
            oextra: { omid: ghost.m_id },
        });
        place_object(corpse, 12, 10);

        const chest = knownObject(CHEST);
        const rock = knownObject(ROCK, {
            where: 'contained',
            container: chest,
        });
        chest.contents = [rock];
        place_object(chest, 13, 10);

        const amulet = knownObject(AMULET_OF_YENDOR);
        place_object(amulet, 14, 10);
        place_object(knownObject(FOOD_RATION, { in_use: true }), 15, 10);
        const grayswandir = artifactByName('Grayswandir');
        const bonesArtifact = knownObject(grayswandir.baseType);
        assert.equal(nameArtifact(bonesArtifact, grayswandir), true);
        place_object(bonesArtifact, 18, 10);
        const statue = knownObject(STATUE, {
            oname: 'old\u0001name',
            oextra: { oname: 'old\u0001name' },
        });
        place_object(statue, 19, 10);
        game.level.traps.push(
            { ttyp: HOLE, tx: 16, ty: 10, tseen: false, madeby_u: true },
            { ttyp: PIT, tx: 17, ty: 10, tseen: true, madeby_u: true },
        );

        assert.equal(saveBonesLevel(), true);

        freshBonesRoom(storage);
        const currentArtifact = knownObject(grayswandir.baseType);
        assert.equal(nameArtifact(currentArtifact, grayswandir), true);
        currentArtifact.where = 'inventory';
        game.inventory.push(currentArtifact);
        pushKeys('yn');
        await mklev();

        const restoredGhost = game.level.monsters.find(monster =>
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
        const restoredDagger = restoredGhost.minvent[0];
        const restoredRock = restoredChest.contents[0];
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
        const restoredHole = game.level.traps.find(trap =>
            trap.ttyp === HOLE);
        const restoredPit = game.level.traps.find(trap =>
            trap.ttyp === PIT);
        assert.equal(restoredHole.tseen, true);
        assert.equal(restoredHole.madeby_u, 0);
        assert.equal(restoredPit.tseen, false);
        assert.equal(restoredPit.madeby_u, 0);
    });

test('bones keep partly eaten food free in its staffed shop', async () => {
    const storage = memoryStorage();
    freshBonesRoom(storage);
    addStaffedShop({ shopType: SHOPBASE + 5 });
    const chest = knownObject(CHEST);
    const ration = knownObject(FOOD_RATION, {
        where: 'contained',
        container: chest,
        oeaten: 400,
    });
    chest.contents = [ration];
    place_object(chest, 12, 10);
    assert.equal(saveBonesLevel(), true);

    freshBonesRoom(storage);
    pushKeys('yn');
    await mklev();

    const restoredChest = floorObjects(game.level).find(object =>
        object.otyp === CHEST);
    assert.equal(restoredChest.contents[0].no_charge, true);
});

test('bones clean monster names and remove extinct species', async () => {
    const storage = memoryStorage();
    freshBonesRoom(storage);
    addMonster({
        mnum: PM_GHOST,
        x: 12,
        y: 10,
        name: 'old\u0001ghost',
        mgivenname: 'old\u0001ghost',
        mextra: { mgivenname: 'old\u0001ghost' },
    });
    const troll = addMonster({
        mnum: 220,
        x: 13,
        y: 10,
    });
    const questArtifact = artifactByName('The Orb of Detection');
    const orb = knownObject(questArtifact.baseType);
    assert.equal(nameArtifact(orb, questArtifact), true);
    linkObjectToMonsterInventory(troll, orb);
    linkObjectToMonsterInventory(troll, knownObject(DAGGER));
    assert.equal(saveBonesLevel(), true);

    freshBonesRoom(storage);
    game.mvitals = [];
    game.mvitals[220] = { mvflags: G_EXTINCT };
    pushKeys('yn');
    await mklev();

    const restoredGhost = game.level.monsters.find(monster =>
        monster.mnum === PM_GHOST);
    assert.equal(restoredGhost.name, 'old.ghost');
    assert.equal(game.level.monsters.some(monster => monster.mnum === 220),
        false);
    const restoredObjects = floorObjects(game.level);
    const restoredOrb = restoredObjects.find(object =>
        object.otyp === questArtifact.baseType);
    assert.equal(restoredOrb.oartifact, 0);
    assert.equal(restoredObjects.some(object => object.otyp === DAGGER), false);
});
