import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createBonesFromDeath, dropHeroInventoryForBones,
} from '../js/bones_death.js';
import { LEAVESTATUE, ROOM } from '../js/const.js';
import { game } from '../js/gstate.js';
import { beginObjectBurn } from '../js/light.js';
import { DAGGER, OIL_LAMP, STATUE } from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { objectWeight } from '../js/weight.js';
import { knownInventoryObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { addMonster } from './support/monsters.js';
import { freshCommandRoom } from './support/playable-room.js';

const PM_GHOST = 287;
const PM_HUMAN_ARCHEOLOGIST = 331;

test('a nearby object-loving monster can inherit a dead hero item', () => {
    freshCommandRoom({ seed: 1n });
    const dwarf = addMonster({
        mnum: 44,
        x: 11,
        y: 10,
        hitPoints: 20,
    });
    const dagger = knownInventoryObject(DAGGER, {
        worn: true,
        wielded: true,
        owornmask: 1,
    });
    initRng(7n);

    dropHeroInventoryForBones(10, 10);

    assert.deepEqual(game.inventory, []);
    assert.equal(dwarf.minvent.includes(dagger), true);
    assert.equal(dagger.where, 'minvent');
    assert.equal(dagger.carrierMid, dwarf.m_id);
    assert.equal(dagger.worn, false);
    assert.equal(dagger.wielded, false);
    assert.equal(dagger.owornmask, 0);
    assert.equal(game.level.objects[10]?.[10]?.includes(dagger) ?? false,
        false);
});

test('a stoned hero leaves a named statue containing their inventory',
    async () => {
        freshCommandRoom({
            seed: 11n,
            hero: {
                uz: { dnum: 0, dlevel: 7 },
                umonnum: PM_HUMAN_ARCHEOLOGIST,
            },
        });
        init_objects();
        game.storage = memoryStorage();
        game._canMakeBones = true;
        game.plname = 'Ada';
        game.u.ugrave_arise = LEAVESTATUE;
        const dagger = knownInventoryObject(DAGGER);
        const lamp = knownInventoryObject(OIL_LAMP, { age: 100 });
        beginObjectBurn(lamp, game, game.moves);

        assert.equal(await createBonesFromDeath(async () => 'y'), true);

        const remains = floorObjectsAt(game.level, 10, 10);
        const statue = remains.find(object => object.otyp === STATUE);
        assert.ok(statue);
        assert.equal(statue.oname, 'Ada');
        assert.equal(statue.corpsenm, PM_HUMAN_ARCHEOLOGIST);
        assert.equal(statue.contents.includes(dagger), true);
        assert.equal(statue.contents.includes(lamp), true);
        assert.equal(dagger.where, 'contained');
        assert.equal(dagger.container, statue);
        assert.equal(lamp.lamplit, false);
        assert.equal(lamp.age, 100);
        assert.equal(statue.owt, objectWeight(statue));
        assert.equal(game.inventory.length, 0);
        assert.equal(game.level.monsters.some(monster =>
            monster.mnum === PM_GHOST), false);
        assert.equal(game.level.at(10, 10).typ, ROOM);
    });
