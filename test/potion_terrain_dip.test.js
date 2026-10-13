import test from 'node:test';
import assert from 'node:assert/strict';
import { POOL, SINK } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { POT_ACID, POT_WATER, SCR_BLANK_PAPER, SCR_IDENTIFY, TOWEL } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('dipping a scroll into a pool blanks it without using a potion', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    const scroll = await addInventoryObject(SCR_IDENTIFY);
    resetInputState();
    await runExtendedCommand('dip', scroll.invlet + 'y' + ' '.repeat(20));
    assert.equal(scroll.otyp, SCR_BLANK_PAPER);
    assert.equal(game.context.move, 1);
});
for (const level of ['air_level', 'water_level']) {
    void test(`levitating above a pool on the ${level} preserves the dipped scroll`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        game[level] = { ...game.u.uz, flags: { town: false }, alignment: null };
        game.level.requireAt(game.u.ux, game.u.uy).typ = POOL;
        grantIntrinsicProperty('levitation', 'outside');
        const scroll = await addInventoryObject(SCR_IDENTIFY, { pickup_prev: true });
        resetInputState();
        await runExtendedCommand('dip', scroll.invlet + 'y' + ' '.repeat(20));
        assert.equal(scroll.otyp, SCR_IDENTIFY);
        assert.equal(game.inventory.includes(scroll), true);
        assert.equal(scroll.pickup_prev, true);
        assert.equal(game.context.move, 1);
        assert.match(game._pending_message, /You are floating high above the pool of water\./);
    });
}
void test('washing bare hands in a pool removes slippery fingers', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    game.u.glibTurns = 12;
    resetInputState();
    await runExtendedCommand('dip', '-y' + ' '.repeat(20));
    assert.equal(game.u.glibTurns, 0);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /no longer slippery/);
});
void test('dipping acid into a sink pours away one bottle', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.level.requireAt(game.u.ux, game.u.uy).typ = SINK;
    const acid = await addInventoryObject(POT_ACID, { quan: 2 });
    resetInputState();
    initRng(123n);
    await runExtendedCommand('dip', acid.invlet + 'y' + ' '.repeat(20));
    assert.equal(acid.quan, 1);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /drain seems less clogged/);
});
void test('dipping a towel in water wets it before the potion is consumed', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const towel = await addInventoryObject(TOWEL, { spe: 0 });
    const water = await addInventoryObject(POT_WATER);
    resetInputState();
    await runExtendedCommand('dip', towel.invlet + water.invlet + ' '.repeat(20));
    assert.ok(towel.spe >= 1 && towel.spe <= 7);
    assert.equal(game.inventory.includes(water), false);
    assert.match(game._pending_message, /towel gets (damp|wet).*towel soaks/);
});
void test('dipping an acid stack in water destroys the entire stack', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const acid = await addInventoryObject(POT_ACID, { quan: 3 });
    const water = await addInventoryObject(POT_WATER);
    resetInputState();
    await runExtendedCommand('dip', acid.invlet + water.invlet + ' '.repeat(20));
    assert.equal(acid.where, 'gone');
    assert.equal(game.inventory.includes(acid), false);
    assert.equal(game.inventory.includes(water), false);
    assert.equal(game.u.uhp, 40);
});
//# sourceMappingURL=potion_terrain_dip.test.js.map