import assert from 'node:assert/strict';
import test from 'node:test';
import { CORR, DOOR, IRONBARS, NO_MINVENT, W_NONDIGGABLE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { ACID_VENOM, ARROW, BLINDING_VENOM, DAGGER, LEATHER_GLOVES, MIRROR, OBJECT_NAMES, POT_ACID, POT_WATER, WAR_HAMMER, } from '../js/object_data.js';
import { projectileHitsIronBars } from '../js/projectile_bars.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { throwInventoryObject } from './support/commands.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
const KNIFE = OBJECT_NAMES.indexOf('knife');
const RUBBER_HOSE = OBJECT_NAMES.indexOf('rubber hose');
for (const { objectType, blocked } of [
    { objectType: ARROW, blocked: false },
    { objectType: KNIFE, blocked: false },
    { objectType: LEATHER_GLOVES, blocked: false },
    { objectType: DAGGER, blocked: true },
]) {
    void test(`iron bars ${blocked ? 'stop' : 'admit'} projectile type ${objectType}`, async () => {
        const level = freshObjectRoom();
        level.requireAt(12, 10).typ = IRONBARS;
        const object = await knownObject(objectType);
        const impact = await projectileHitsIronBars(object, {
            x: 11, y: 10, barsX: 12, barsY: 10,
            publish: () => { }, random: limit => limit - 1,
        });
        assert.equal(impact.blocked, blocked);
        assert.equal(impact.destroyed, false);
        assert.equal(object.where, 'free');
        assert.equal(level.requireAt(12, 10).typ, IRONBARS);
    });
}
for (const objectType of [BLINDING_VENOM, ACID_VENOM]) {
    void test(`venom type ${objectType} splashes away when its flight strikes a bar`, async () => {
        const level = freshObjectRoom();
        level.requireAt(12, 10).typ = IRONBARS;
        const venom = await knownObject(objectType);
        const messages = [];
        const impact = await projectileHitsIronBars(venom, {
            x: 11, y: 10, barsX: 12, barsY: 10, forceHit: true,
            publish: message => { messages.push(message); }, random: limit => limit - 1,
        });
        assert.equal(impact.blocked, true);
        assert.equal(impact.destroyed, true);
        assert.equal(venom.where, 'gone');
        assert.equal(level.requireAt(12, 10).typ, IRONBARS);
        assert.deepEqual(messages, ['Splash!']);
    });
}
for (const nondiggable of [false, true]) {
    void test(`an acid potion ${nondiggable ? 'cannot dissolve protected bars' : 'dissolves ordinary bars'}`, async () => {
        const level = freshObjectRoom({ right: 20 });
        const bars = level.requireAt(15, 10);
        bars.typ = IRONBARS;
        bars.edge = true;
        bars.wall_info = nondiggable ? W_NONDIGGABLE : 0;
        const acid = await knownObject(POT_ACID);
        const messages = [];
        const impact = await projectileHitsIronBars(acid, {
            x: 14, y: 10, barsX: 15, barsY: 10, forceHit: true,
            publish: message => { messages.push(message); }, random: limit => limit - 1,
        });
        assert.equal(impact.destroyed, true);
        assert.equal(acid.where, 'gone');
        assert.equal(bars.typ, nondiggable ? IRONBARS : DOOR);
        assert.match(messages.join('\n'), nondiggable ? /hissing noise/ : /iron bars are dissolved/);
    });
}
void test('a projectile impact wakes nearby sleepers even when the hero cannot hear it', async () => {
    const level = freshObjectRoom({ right: 20 });
    level.requireAt(12, 10).typ = IRONBARS;
    game.u.deafTurns = 10;
    const nearby = await createMonsterAt('goblin', 14, 10, NO_MINVENT);
    const distant = await createMonsterAt('goblin', 18, 10, NO_MINVENT);
    nearby.msleeping = distant.msleeping = 1;
    const dagger = await knownObject(DAGGER);
    const messages = [];
    await projectileHitsIronBars(dagger, {
        x: 11, y: 10, barsX: 12, barsY: 10,
        publish: message => { messages.push(message); }, random: limit => limit - 1,
    });
    assert.equal(nearby.msleeping, 0);
    assert.equal(distant.msleeping, 1);
    assert.equal(messages.length, 0);
});
void test('a flimsy projectile makes a soft impact and leaves sleepers alone', async () => {
    const level = freshObjectRoom();
    level.requireAt(12, 10).typ = IRONBARS;
    const sleeper = await createMonsterAt('goblin', 13, 10, NO_MINVENT);
    sleeper.msleeping = 1;
    const hose = await knownObject(RUBBER_HOSE, { spe: 1 });
    const messages = [];
    await projectileHitsIronBars(hose, {
        x: 11, y: 10, barsX: 12, barsY: 10,
        publish: message => { messages.push(message); }, random: limit => limit - 1,
    });
    assert.equal(sleeper.msleeping, 1);
    assert.deepEqual(messages, ['Flapp!']);
});
for (const heroCaused of [false, true]) {
    void test(`a ${heroCaused ? 'hero' : 'monster'} hammer impact ${heroCaused ? 'can break' : 'does not break'} the bars apart`, async () => {
        const level = freshObjectRoom();
        const bars = level.requireAt(12, 10);
        bars.typ = IRONBARS;
        const hammer = await knownObject(WAR_HAMMER);
        const impact = await projectileHitsIronBars(hammer, {
            x: 11, y: 10, barsX: 12, barsY: 10, heroCaused,
            publish: () => { }, random: () => 0,
        });
        assert.equal(impact.blocked, true);
        assert.equal(impact.destroyed, false);
        assert.equal(bars.typ, heroCaused ? CORR : IRONBARS);
    });
}
void test('a monster breaking a mirror on bars does not penalize hero luck', async () => {
    const level = freshObjectRoom();
    level.requireAt(12, 10).typ = IRONBARS;
    game.u.uluck = 4;
    const mirror = await knownObject(MIRROR);
    const impact = await projectileHitsIronBars(mirror, {
        x: 11, y: 10, barsX: 12, barsY: 10,
        publish: () => { }, random: limit => limit - 1,
    });
    assert.equal(impact.destroyed, true);
    assert.equal(game.u.uluck, 4);
});
void test('monster-caused breakage on shop bars does not charge or anger the shopkeeper', async () => {
    const level = freshObjectRoom({ right: 20 });
    const { shopkeeper } = await createStaffedShop({
        left: 12, right: 18, keeperX: 17, keeperY: 11,
    });
    level.requireAt(16, 10).typ = IRONBARS;
    const potion = await floorObject(POT_WATER, 15, 10, { no_charge: false });
    const impact = await projectileHitsIronBars(potion, {
        x: 15, y: 10, barsX: 16, barsY: 10, forceHit: true,
        publish: () => { }, random: limit => limit - 1,
    });
    assert.equal(impact.destroyed, true);
    assert.equal(potion.where, 'gone');
    assert.equal(shopkeeper.eshk.debit, 0);
    assert.equal(shopkeeper.eshk.robbed ?? 0, 0);
    assert.equal(!!shopkeeper.mpeaceful, true);
});
void test('a hero arrow still passes through adjacent bars and lands beyond them', async () => {
    const level = freshObjectRoom({ right: 20 });
    level.requireAt(11, 10).typ = IRONBARS;
    const arrow = await addInventoryObject(ARROW, { invlet: 'a' });
    await throwInventoryObject(arrow, 'l');
    assert.equal(arrow.where, 'floor');
    assert.ok(arrow.ox > 11);
    assert.equal(floorObjectsAt(level, arrow.ox, arrow.oy)[0], arrow);
});
//# sourceMappingURL=projectile_bars.test.js.map