import test from 'node:test';
import assert from 'node:assert/strict';
import { gameLogEvents } from '../js/gamelog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AXE, DAGGER, POT_POLYMORPH } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const female of [false, true]) {
    void test(`polymorph dipping chronicles ${female ? 'her' : 'his'} first item only once`, async () => {
        freshObjectRoom({ flags: { female } });
        requirePlayingGame(game);
        const dagger = await addInventoryObject(DAGGER);
        const axe = await addInventoryObject(AXE);
        const potion = await addInventoryObject(POT_POLYMORPH, { quan: 2 });
        resetInputState();
        initRng(123n);

        await runExtendedCommand('dip', dagger.invlet + potion.invlet + ' '.repeat(20));

        const event = `polymorphed ${female ? 'her' : 'his'} first item`;
        assert.equal(game.u.uconduct?.polypiles, 1);
        assert.equal(gameLogEvents().filter(entry => entry.text === event).length, 1);

        await runExtendedCommand('dip', axe.invlet + potion.invlet + ' '.repeat(20));

        assert.equal(game.u.uconduct?.polypiles, 2);
        assert.equal(gameLogEvents().filter(entry => entry.text === event).length, 1);
    });
}

void test('an immune polymorph dip preserves conduct and adds no chronicle event', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const potion = await addInventoryObject(POT_POLYMORPH, { quan: 2 });
    resetInputState();

    await runExtendedCommand('dip', potion.invlet + potion.invlet + ' '.repeat(20));

    assert.equal(game.u.uconduct?.polypiles ?? 0, 0);
    assert.equal(gameLogEvents().length, 0);
    assert.equal(potion.quan, 2);
    assert.match(game._pending_message, /Nothing happens\./);
});
