// C dothrow.c:gem_accept()'s luck ladder (dothrow.c:2326-2369): a
// co-aligned unicorn's reward tracks how well the hero knows the gem —
// identified +5, guessed (named) +2, unknown +1 — while worthless glass is
// taken "graciously" without touching Luck.
import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { freeInventoryObject } from '../js/invent.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { DIAMOND, WORTHLESS_PIECE_OF_WHITE_GLASS } from '../js/object_data.js';
import { offerUnicornGem } from '../js/dothrow.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function alignedUnicornWith(otyp, luck = 0) {
    const level = await freshObjectRoom({ hero: { uluck: luck } });
    level.flags.noteleport = true;
    const unicorn = await createMonsterAt('gray unicorn', 14, 10);
    unicorn.mpeaceful = 0;
    const gem = await addInventoryObject(otyp);
    return { unicorn, gem };
}
void test('an identified aligned gem rewards five luck points and joins the unicorn', async () => {
    const { unicorn, gem } = await alignedUnicornWith(DIAMOND);
    game._knownObjectTypes = new Set([DIAMOND]);
    const state = game;
    requirePlayingGame(state);
    const messages = [];
    resetInputState().beforeRead = () => { messages.push(game._pending_message); };
    pushKeys(' '.repeat(4));
    await freeInventoryObject(gem, state);
    const accepted = await offerUnicornGem(unicorn, gem, state);
    assert.equal(accepted, true);
    assert.equal(game.u.uluck, 5);
    assert.equal(gem.where, 'minvent');
    assert.equal(gem.ocarry, unicorn);
    assert.match(messages.join('\n') + game._pending_message, /gratefully accepts your gift\./);
});
void test('a gem the hero only guessed rewards two luck points', async () => {
    const { unicorn, gem } = await alignedUnicornWith(DIAMOND);
    game._knownObjectTypes = new Set();
    game._objectCallNames = { [DIAMOND]: 'rock' };
    const state = game;
    requirePlayingGame(state);
    const messages = [];
    resetInputState().beforeRead = () => { messages.push(game._pending_message); };
    pushKeys(' '.repeat(4));
    await freeInventoryObject(gem, state);
    const accepted = await offerUnicornGem(unicorn, gem, state);
    assert.equal(accepted, true);
    assert.equal(game.u.uluck, 2);
    assert.equal(gem.ocarry, unicorn);
});
void test('a completely unknown gem still rewards one luck point', async () => {
    const { unicorn, gem } = await alignedUnicornWith(DIAMOND);
    game._knownObjectTypes = new Set();
    const state = game;
    requirePlayingGame(state);
    const messages = [];
    resetInputState().beforeRead = () => { messages.push(game._pending_message); };
    pushKeys(' '.repeat(4));
    await freeInventoryObject(gem, state);
    const accepted = await offerUnicornGem(unicorn, gem, state);
    assert.equal(accepted, true);
    assert.equal(game.u.uluck, 1);
    assert.equal(gem.ocarry, unicorn);
});
void test('unknown worthless glass is taken graciously without changing luck', async () => {
    const { unicorn, gem } = await alignedUnicornWith(WORTHLESS_PIECE_OF_WHITE_GLASS);
    game._knownObjectTypes = new Set();
    const state = game;
    requirePlayingGame(state);
    const messages = [];
    resetInputState().beforeRead = () => { messages.push(game._pending_message); };
    pushKeys(' '.repeat(4));
    await freeInventoryObject(gem, state);
    const accepted = await offerUnicornGem(unicorn, gem, state);
    assert.equal(accepted, true);
    assert.equal(game.u.uluck, 0);
    assert.equal(gem.ocarry, unicorn);
    assert.match(messages.join('\n') + game._pending_message, /graciously accepts your gift\./);
});
void test('an identified gem for a misaligned unicorn changes luck by a random draw', async () => {
    const level = await freshObjectRoom({ hero: { uluck: 0, ualign: { type: 1, record: 0 } } });
    level.flags.noteleport = true;
    const unicorn = await createMonsterAt('gray unicorn', 14, 10);
    unicorn.mpeaceful = 0;
    const gem = await addInventoryObject(DIAMOND);
    game._knownObjectTypes = new Set([DIAMOND]);
    const state = game;
    requirePlayingGame(state);
    const messages = [];
    resetInputState().beforeRead = () => { messages.push(game._pending_message); };
    pushKeys(' '.repeat(4));
    await freeInventoryObject(gem, state);
    const accepted = await offerUnicornGem(unicorn, gem, state);
    assert.equal(accepted, true);
    // change_luck(rn2(7) - 3) keeps the draw inside [-3, +3].
    const luck = game.u.uluck ?? 0;
    assert.ok(luck >= -3 && luck <= 3, `luck ${luck} outside the draw`);
    assert.equal(gem.ocarry, unicorn);
    assert.match(messages.join('\n') + game._pending_message, /hesitatingly accepts your gift\./);
});
//# sourceMappingURL=unicorn_gem_luck.test.js.map