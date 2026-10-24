import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN, SQKY_BOARD } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { APPLE, ARROW, BOW, DAGGER, EGG, GOLD_PIECE } from '../js/object_data.js';
import { addInventoryObject, addInventoryWeapon } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
import { requireScreenRow } from './support/screen.js';
function topline() {
    return requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
}
// Start a command, record its first getobj() question, and cancel it.
async function firstQuestion(command, extended = false) {
    const input = resetInputState();
    if (extended)
        input.feed(`${command}\n`);
    const running = rhack((extended ? '#' : command).charCodeAt(0));
    await input.waitUntilBlocked();
    const question = topline();
    input.feed('\x1b');
    await running;
    return question;
}
void test('drop compacts its suggested letters together with carried gold', async () => {
    freshObjectRoom();
    await addInventoryObject(GOLD_PIECE, { quan: 20 });
    for (const [otyp, invlet] of [[DAGGER, 'a'], [BOW, 'b'], [ARROW, 'c'], [APPLE, 'd'], [EGG, 'e']])
        await addInventoryObject(otyp, { invlet });
    // getobj() compactifies once more than five letters are suggested,
    // counting the '$' slot.
    assert.equal(await firstQuestion('d'), 'What do you want to drop? [$a-e or ?*]');
});
void test('drop asks for an object even when the pack is empty', async () => {
    freshObjectRoom();
    game.inventory.length = 0;
    // GETOBJ_PROMPT keeps the question instead of reporting nothing to drop.
    assert.equal(await firstQuestion('d'), 'What do you want to drop? [*]');
    assert.equal(game.context.move, 0);
});
void test('untrapping a squeaky board prompts even without grease or potions', async (t) => {
    const level = freshObjectRoom();
    addTrap(level, SQKY_BOARD, game.u.ux + 1, game.u.uy, { tseen: true });
    await addInventoryWeapon(DAGGER, { invlet: 'a' });
    const input = resetInputState();
    input.feed('untrap\nl');
    // unsqueak_ok() excludes the dagger, but GETOBJ_PROMPT still asks.
    planInput(input, t, [{ prompt: /What do you want to untrap with\? \[\*\]/, keys: 'a' }]);
    await rhack('#'.charCodeAt(0));
    await flush_screen(1);
    assert.equal(topline(), 'That is a silly thing to untrap with.');
    assert.equal(game.context.move, 0);
});
void test('declining fountain dipping names the dipped object when no potion remains', async (t) => {
    const level = freshObjectRoom({ flags: { verbose: true } });
    const here = level.at(game.u.ux, game.u.uy);
    assert.ok(here);
    here.typ = FOUNTAIN;
    const dagger = await addInventoryWeapon(DAGGER, { invlet: 'a' });
    const input = resetInputState();
    input.feed('dip\n');
    planInput(input, t, [
        { prompt: /What do you want to dip\?/, keys: dagger.invlet },
        { prompt: /Dip .*dagger into the fountain\?/, keys: 'n' },
    ]);
    await rhack('#'.charCodeAt(0));
    await flush_screen(1);
    // The getobj() verb is "dip <object> into", so its empty-inventory
    // feedback includes the object description.
    assert.match(topline(), /^You don't have anything else to dip .*dagger into\.$/);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=getobj_callers.test.js.map