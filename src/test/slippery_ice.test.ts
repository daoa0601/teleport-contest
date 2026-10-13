import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { ICE, NO_MINVENT } from '../js/const.js';
import { slipOrTrip } from '../js/fumbling.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { STATUE } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';

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
        if ((game.u.fumblingTurns ?? 0) !== 1) continue;
        await moveloop_core();

        slips++;
        assert.match(game._last_message ?? '', /You (?:slip|slide) off the ice\./);
        assert.equal(game.u.fumblingTurns, 0);
        assert.equal(game.u.fumbling, false);
        assert.ok((game._helplessTurns ?? 0) > 0, 'slipping leaves the hero unable to act');
    }
    assert.ok(slips > 0, 'ordinary footsteps sometimes slip on ice');
});

for (const property of ['levitation', 'flying'] as const) {
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
        if (onIce) level.requireAt(game.u.ux, game.u.uy).typ = ICE;
        const steed = await createSaddledSteed('pony', { saddle: { cursed: true } });
        game.u.usteed = steed;
        game.u.fumblingFromIce = true;
        game.u.ux0 = game.u.ux;
        game.u.uy0 = game.u.uy;
        const messages: string[] = [];

        await slipOrTrip(async message => { messages.push(message); });

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

    assert.equal(level.monsters.includes(orc), false, 'the collision completes the monster death');
    assert.ok(floorObjectsAt(level, 9, 10)
        .some(object => object.otyp === STATUE && object.corpsenm === orc.mnum));
    assert.equal(game.u.uconduct?.killer, 1, 'the collision counts as one hero kill');
    assert.ok((game.u.uexp ?? 0) > 0, 'the hero receives experience for the petrified monster');
    assert.equal(game.u.ux, 10, 'the monster stops the hurtle before the hero enters its square');
});
