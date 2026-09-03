import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createBonesFromDeath, dropHeroInventoryForBones,
} from '../js/bones_death.js';
import {
    BURNING, LEAVESTATUE, ROOM, W_ARM, W_ARMC,
} from '../js/const.js';
import {
    setHeroRemainsFromDeath, setHeroRemainsFromMonster,
} from '../js/death_remains.js';
import { game } from '../js/gstate.js';
import { beginObjectBurn } from '../js/light.js';
import {
    CORPSE, DAGGER, LEATHER_ARMOR, MUMMY_WRAPPING, OIL_LAMP, STATUE,
} from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { races, roles } from '../js/roles.js';
import { objectWeight } from '../js/weight.js';
import { addInventoryObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';

const PM_GHOST = 287;
const PM_HUMAN_ARCHEOLOGIST = 331;
const PM_HUMAN_MUMMY = 192;

test('a nearby object-loving monster can inherit a dead hero item', async () => {
    freshPlayableRoom({ seed: 1n });
    const orc = await createMonsterAt('orc', 11, 10);
    const dagger = addInventoryObject(DAGGER, {
        worn: true,
        wielded: true,
        owornmask: 1,
    });
    initRng(7n);

    dropHeroInventoryForBones(10, 10);

    assert.deepEqual(game.inventory, []);
    assert.equal(orc.minvent.includes(dagger), true);
    assert.equal(dagger.where, 'minvent');
    assert.equal(dagger.carrierMid, orc.m_id);
    assert.equal(dagger.worn, false);
    assert.equal(dagger.wielded, false);
    assert.equal(dagger.owornmask, 0);
    assert.equal(game.level.objects[10]?.[10]?.includes(dagger) ?? false,
        false);
});

test('a hero burned in lava leaves dropped gear and a ghost but no body',
    async () => {
        freshPlayableRoom({
            seed: 31n,
            hero: { uz: { dnum: 0, dlevel: 9 } },
        });
        init_objects();
        game.storage = memoryStorage();
        game._canMakeBones = true;
        game.plname = 'Ember';
        const dagger = addInventoryObject(DAGGER);
        setHeroRemainsFromDeath(BURNING);

        assert.equal(await createBonesFromDeath(async () => 'y'), true);

        const remains = floorObjectsAt(game.level, 10, 10);
        assert.equal(remains.includes(dagger), true);
        assert.equal(remains.some(object => object.otyp === CORPSE), false);
        assert.equal(game.level.monsters.some(monster =>
            monster.mnum === PM_GHOST), true);
        assert.equal(game.level.at(10, 10).typ, ROOM);
    });

test('a mummy victim rises with their inventory and intrinsic resistances',
    async () => {
        freshPlayableRoom({
            seed: 21n,
            role: 'samurai',
            hero: {
                uz: { dnum: 0, dlevel: 8 },
                ulevel: 8,
                uhpmax: 37,
                uluck: -2,
                ualign: { type: 1, record: 10 },
                uevent: { udemigod: true, uhand_of_elbereth: true },
            },
        });
        init_objects();
        game.storage = memoryStorage();
        game._canMakeBones = true;
        game.plname = 'Kira';
        game.urole = roles[9];
        game.urace = races[0];
        game.flags.female = true;
        grantIntrinsicProperty('fireResistance', 'experience', game);
        grantIntrinsicProperty('poisonResistance', 'outside', game);
        const armor = addInventoryObject(LEATHER_ARMOR);
        const dagger = addInventoryObject(DAGGER);

        assert.equal(setHeroRemainsFromMonster({
            mnum: PM_HUMAN_MUMMY,
            mcan: 0,
        }), PM_HUMAN_MUMMY);
        assert.equal(await createBonesFromDeath(async () => 'y'), true);

        const mummy = game.level.monsters.find(monster =>
            monster.mnum === PM_HUMAN_MUMMY);
        assert.ok(mummy);
        const wrapping = mummy.minvent.find(object =>
            object.otyp === MUMMY_WRAPPING);
        assert.ok(wrapping);
        assert.equal(mummy.name, 'Kira');
        assert.equal(mummy.m_lev, 8);
        assert.equal(mummy.mhp, 37);
        assert.equal(mummy.mhpmax, 37);
        assert.equal(mummy.female, true);
        assert.equal(mummy.msleeping, 1);
        assert.equal(mummy.minvent.includes(armor), true);
        assert.equal(mummy.minvent.includes(dagger), true);
        assert.equal(armor.owornmask, W_ARM);
        assert.equal(wrapping.owornmask, W_ARMC);
        assert.equal(mummy.mintrinsics & 0x21, 0x21);
        assert.equal(game.inventory.length, 0);
        assert.deepEqual(floorObjectsAt(game.level, 10, 10), []);
    });

test('a stoned hero leaves a named statue containing their inventory',
    async () => {
        freshPlayableRoom({
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
        const dagger = addInventoryObject(DAGGER);
        const lamp = addInventoryObject(OIL_LAMP, { age: 100 });
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
