import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { mklev, place_object, saveBonesLevel } from '../js/mklev.js';
import { linkObjectToMonsterInventory } from '../js/monster_inventory.js';
import {
    CHEST, CORPSE, DAGGER, ROCK,
} from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { knownObject } from './support/game-objects.js';
import { floorObjects } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { addMonster } from './support/monsters.js';
import { freshCommandRoom } from './support/playable-room.js';

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
}

test('bones restore gives entities fresh ids and preserves their links',
    async () => {
        const storage = memoryStorage();
        freshBonesRoom(storage);

        const ghost = addMonster({
            m_id: 7101,
            mnum: PM_GHOST,
            x: 12,
            y: 10,
        });
        const dagger = knownObject(DAGGER);
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

        assert.equal(saveBonesLevel(), true);

        freshBonesRoom(storage);
        pushKeys('yn');
        await mklev();

        const restoredGhost = game.level.monsters.find(monster =>
            monster.mnum === PM_GHOST);
        const restoredObjects = floorObjects(game.level);
        const restoredCorpse = restoredObjects.find(object =>
            object.otyp === CORPSE);
        const restoredChest = restoredObjects.find(object =>
            object.otyp === CHEST);
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
    });
