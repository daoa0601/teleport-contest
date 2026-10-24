import assert from 'node:assert/strict';
import test from 'node:test';
import { lookaroundRun, rhack } from '../js/cmd.js';
import { CORR, POOL, STONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { heroLiquidEffects } from '../js/hack.js';
import { hurtleHero } from '../js/hero_hurtle.js';
import { resetInputState } from '../js/input.js';
import { PICK_AXE, TOWEL } from '../js/object_data.js';
import { initRng, rn2, rnd } from '../js/rng.js';
import { startRun } from '../js/runmode.js';
import { moveHeroByTeleport } from '../js/teleport.js';
import { promptDirection } from '../js/tty_prompts.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('swimming within a pool checks inventory only on the one-in-five water roll', async () => {
    let wet = 0;
    let dry = 0;
    for (let seed = 1n; seed <= 20n; seed++) {
        const level = freshObjectRoom({
            heroX: 11,
            hero: { swimming: true, breathless: true, uinwater: 1,
                ux0: 10, uy0: 10, dx: 1, dy: 0 },
        });
        level.requireAt(10, 10).typ = level.requireAt(11, 10).typ = POOL;
        const towel = await addInventoryObject(TOWEL, { spe: 0 });
        initRng(seed);
        const inventoryGetsWet = rn2(5) === 0;
        const expectedWetness = inventoryGetsWet ? rnd(7) : 0;
        const followingRoll = rn2(1000);
        initRng(seed);
        const messages: string[] = [];

        await heroLiquidEffects({ publish: async message => { messages.push(message); } });

        assert.equal(towel.spe, expectedWetness, `towel wetness for seed ${seed}`);
        assert.equal(messages.some(message => /towel gets/.test(message)), inventoryGetsWet);
        assert.equal(messages.some(message => /touch bottom|aren't drowning/.test(message)), false);
        assert.equal(rn2(1000), followingRoll, `following roll for seed ${seed}`);
        if (inventoryGetsWet) wet++;
        else dry++;
    }
    assert.ok(wet > 0 && dry > 0, 'exercise both inventory damage and the early return');
});

for (const relocation of ['teleport', 'hurtle'] as const) {
    void test(`${relocation} from another pool retains the direction used by the next drowning check`, async () => {
        const level = freshObjectRoom({
            hero: { swimming: true, breathless: true, uinwater: 1,
                ux0: 10, uy0: 10, dx: 0, dy: -1 },
        });
        level.requireAt(10, 10).typ = level.requireAt(14, 10).typ = POOL;
        // The move is east, but the retained direction points north. Its
        // square behind the landing is dry, unlike the old pool at ux0/uy0.
        if (relocation === 'teleport') await moveHeroByTeleport(14, 10);
        else await hurtleHero(1, 0, 4);
        initRng(31n);
        const followingRoll = rn2(1000);
        initRng(31n);
        const messages: string[] = [];

        await heroLiquidEffects({ publish: async message => { messages.push(message); } });

        assert.equal(game.u.ux, 14);
        assert.ok(messages.includes('You touch bottom.'),
            `Expected the fresh immersion message; received ${JSON.stringify(messages)}`);
        assert.equal(messages.some(message => /fall|plunge/.test(message)), false);
        assert.equal(rn2(1000), followingRoll, 'separate pools do not consume the continuity roll');
    });
}

for (const direction of ['.', '<', '>'] as const) {
    void test(`a ${direction} direction after entering water checks the current pool itself`, async () => {
        const level = freshObjectRoom({
            hero: { swimming: true, breathless: true, uinwater: 1,
                ux0: 9, uy0: 10, dx: 1, dy: 0 },
        });
        level.requireAt(10, 10).typ = POOL;
        resetInputState().feed(direction);
        assert.ok(await promptDirection());
        initRng(31n);
        rn2(5);
        const followingRoll = rn2(1000);
        initRng(31n);
        const messages: string[] = [];

        await heroLiquidEffects({ publish: async message => { messages.push(message); } });

        assert.equal(messages.length, 0, messages.join('\n'));
        assert.equal(rn2(1000), followingRoll, 'zero horizontal direction consumes the continuity roll');
    });
}

void test('a direction prompt can make a different pool count as continuous after teleporting', async () => {
    const level = freshObjectRoom({ hero: { swimming: true, breathless: true, uinwater: 1 } });
    level.requireAt(10, 10).typ = POOL;
    level.requireAt(14, 10).typ = level.requireAt(14, 11).typ = POOL;
    resetInputState().feed('k');
    assert.ok(await promptDirection());
    await moveHeroByTeleport(14, 10);
    initRng(31n);
    rn2(5);
    const followingRoll = rn2(1000);
    initRng(31n);
    const messages: string[] = [];

    await heroLiquidEffects({ publish: async message => { messages.push(message); } });

    assert.equal(messages.length, 0, messages.join('\n'));
    assert.equal(rn2(1000), followingRoll);
});

void test('turning a run stores its new direction before another pool check', async () => {
    const level = freshObjectRoom({
        hero: { swimming: true, breathless: true, uinwater: 1,
            ux0: 9, uy0: 10, dx: 1, dy: 0 },
    });
    for (let x = 9; x <= 11; x++)
        for (let y = 9; y <= 11; y++) level.requireAt(x, y).typ = STONE;
    level.requireAt(10, 10).typ = level.requireAt(10, 11).typ = POOL;
    level.requireAt(9, 10).typ = level.requireAt(10, 9).typ = CORR;
    assert.equal(await lookaroundRun(startRun(1, 0)), true);
    initRng(31n);
    rn2(5);
    const followingRoll = rn2(1000);
    initRng(31n);
    const messages: string[] = [];

    await heroLiquidEffects({ publish: async message => { messages.push(message); } });

    assert.equal(messages.length, 0, messages.join('\n'));
    assert.equal(rn2(1000), followingRoll);
});

void test('a blocked travel guess clears the stale direction for the next pool check', async () => {
    const level = freshObjectRoom({
        hero: { swimming: true, breathless: true, uinwater: 1,
            ux0: 9, uy0: 10, dx: 1, dy: 0 },
    });
    for (let x = 9; x <= 11; x++)
        for (let y = 9; y <= 11; y++) level.requireAt(x, y).typ = STONE;
    level.requireAt(10, 10).typ = POOL;
    game._travelTarget = { x: 14, y: 10 };
    await rhack(31); // #retravel
    initRng(31n);
    rn2(5);
    const followingRoll = rn2(1000);
    initRng(31n);
    const messages: string[] = [];

    await heroLiquidEffects({ publish: async message => { messages.push(message); } });

    assert.equal(game.u.ux, 10);
    assert.equal(messages.length, 0, messages.join('\n'));
    assert.equal(rn2(1000), followingRoll);
});

void test('cancelling a pick-axe direction retains the zero vector left by its direction hints', async () => {
    const level = freshObjectRoom({
        hero: { swimming: true, breathless: true, uinwater: 1,
            ux0: 9, uy0: 10, dx: 1, dy: 0 },
    });
    level.requireAt(10, 10).typ = POOL;
    const pick = await addInventoryObject(PICK_AXE);
    game.uwep = game.u.uwep = pick;
    resetInputState().feed(`${pick.invlet}\x1b`);
    await rhack('a'.charCodeAt(0));
    initRng(31n);
    rn2(5);
    const followingRoll = rn2(1000);
    initRng(31n);
    const messages: string[] = [];

    await heroLiquidEffects({ publish: async message => { messages.push(message); } });

    assert.equal(game.context.move, 0, 'cancelling the pick must not spend a turn');
    assert.equal(messages.length, 0, messages.join('\n'));
    assert.equal(rn2(1000), followingRoll);
});
