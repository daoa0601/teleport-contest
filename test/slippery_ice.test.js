import { monsterAtPosition } from '../js/monster_location.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { ICE, NO_MINVENT, PLNMSG_ONE_ITEM_HERE } from '../js/const.js';
import { slipOrTrip } from '../js/fumbling.js';
import { showFloorPile } from '../js/floor_object_display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, STATUE } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { floorObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';
void test('fumbling refers to the item just described on the floor by a pronoun', async () => {
    freshObjectRoom();
    const dagger = await floorObject(DAGGER, 10, 10);
    await showFloorPile([dagger]);
    const messages = [];
    await slipOrTrip(message => { messages.push(message); });
    assert.equal(messages[0], 'You trip over it.');
});
void test('walking from ice can cause a temporary slip and two helpless turns', async () => {
    let slips = 0;
    for (let seed = 1; seed <= 12; seed++) {
        const input = freshTurnRoom({ role: 'caveman' });
        const square = game.level?.at(game.u.ux, game.u.uy);
        assert.ok(square);
        square.typ = ICE;
        initRng(BigInt(seed));
        input.feed('l');
        await moveloop_core();
        if ((game.u.fumblingTurns ?? 0) !== 1)
            continue;
        await moveloop_core();
        slips++;
        assert.match(game._last_message ?? '', /You (?:slip|slide) off the ice\./);
        assert.equal(game.u.fumblingTurns, 0);
        assert.equal(game.u.fumbling, false);
        assert.ok((game._helplessTurns ?? 0) > 0, 'slipping leaves the hero unable to act');
    }
    assert.ok(slips > 0, 'ordinary footsteps sometimes slip on ice');
});
for (const property of ['levitation', 'flying']) {
    void test(`${property} prevents slipping on ice`, async () => {
        const input = freshTurnRoom({ role: 'caveman' });
        const square = game.level?.at(game.u.ux, game.u.uy);
        assert.ok(square);
        square.typ = ICE;
        grantIntrinsicProperty(property, 'outside');
        input.feed('l');
        await moveloop_core();
        assert.equal(game.u.fumblingTurns ?? 0, 0);
    });
}
void test('cold resistance prevents an unmounted hero from slipping on ice', async () => {
    for (let seed = 1; seed <= 12; seed++) {
        const input = freshTurnRoom({ role: 'caveman' });
        const square = game.level?.at(game.u.ux, game.u.uy);
        assert.ok(square);
        square.typ = ICE;
        grantIntrinsicProperty('coldResistance', 'outside');
        initRng(BigInt(seed));
        input.feed('l');
        await moveloop_core();
        assert.equal(game.u.fumblingTurns ?? 0, 0, `cold resistance protects the hero for seed ${seed}`);
    }
});
for (const onIce of [true, false]) {
    void test(`a saddled pony slipping ${onIce ? 'on' : 'off'} ice is named without its saddle`, async () => {
        const level = freshObjectRoom();
        if (onIce)
            level.requireAt(game.u.ux, game.u.uy).typ = ICE;
        const steed = await createSaddledSteed('pony', { saddle: { cursed: true } });
        game.u.usteed = steed;
        game.u.fumblingFromIce = true;
        game.u.ux0 = game.u.ux;
        game.u.uy0 = game.u.uy;
        const messages = [];
        await slipOrTrip(async (message) => { messages.push(message); });
        assert.equal(messages.length, 1);
        assert.match(messages[0] ?? '', onIce
            ? /^The pony (?:slips|slides) on the ice\.$/
            : /^The pony (?:slips|slides) off the ice\.$/);
        assert.equal(game.u.usteed, steed, 'the cursed saddle keeps the hero mounted');
    });
}
void test('a cockatrice-form hero slipping into an unarmored monster leaves its statue and earns kill credit', async () => {
    const level = freshObjectRoom();
    installPolymorphedHero('cockatrice');
    const orc = await createMonsterAt('orc', 9, 10, NO_MINVENT);
    game.u.fumblingFromIce = true;
    game.u.ux0 = 10;
    game.u.uy0 = 9;
    installPagerInput(resetInputState(), { expected: /slide|slip|bump|orc|stone/i, limit: 6 });
    initRng(70n);
    await slipOrTrip();
    assert.notEqual(monsterAtPosition(level, orc.mx, orc.my), orc, 'the collision completes the monster death');
    assert.ok(floorObjectsAt(level, 9, 10)
        .some(object => object.otyp === STATUE && object.corpsenm === orc.mnum));
    assert.equal(game.u.uconduct?.killer, 1, 'the collision counts as one hero kill');
    assert.ok((game.u.uexp ?? 0) > 0, 'the hero receives experience for the petrified monster');
    assert.equal(game.u.ux, 10, 'the monster stops the hurtle before the hero enters its square');
});
for (const blind of [false, true]) {
    void test(`a ${blind ? 'blind' : 'sighted'} Cleric learns a dagger's curse when naming it in a trip`, async () => {
        freshObjectRoom({ role: 'priest', hero: { blindTurns: blind ? 20 : 0 } });
        const dagger = await floorObject(DAGGER, 10, 10, {
            cursed: true, known: false, bknown: false, dknown: blind,
        });
        const messages = [];
        await slipOrTrip(async (message) => { messages.push(message); });
        assert.equal(dagger.bknown, true, 'naming teaches the Cleric the curse');
        assert.equal(dagger.dknown, true, 'the sighted Cleric observes the dagger');
        assert.equal(messages[0], 'You trip over a cursed dagger.');
    });
}
for (const description of ['it', 'something']) {
    void test(`tripping over ${description} leaves an unnamed dagger's curse unknown`, async () => {
        freshObjectRoom({ role: 'priest', hero: { blindTurns: description === 'something' ? 20 : 0 } });
        const dagger = await floorObject(DAGGER, 10, 10, {
            cursed: true, known: false, bknown: false, dknown: false,
        });
        if (description === 'it')
            game._lastPlineKind = PLNMSG_ONE_ITEM_HERE;
        const messages = [];
        await slipOrTrip(async (message) => { messages.push(message); });
        assert.equal(dagger.bknown, false, 'the trip does not name the dagger');
        assert.equal(dagger.dknown, false, 'the trip does not observe the dagger');
        assert.equal(messages[0], `You trip over ${description}.`);
    });
}
//# sourceMappingURL=slippery_ice.test.js.map