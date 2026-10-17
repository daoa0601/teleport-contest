import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { reportHeroEncumbrance } from '../js/encumbrance.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { GAUNTLETS_OF_POWER, ROCK } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('losing gauntlets of power immediately reports the increased carrying burden', async () => {
    freshObjectRoom();
    const gloves = await addInventoryObject(GAUNTLETS_OF_POWER, { known: false });
    game._moveloopStarted = true;
    game.u.umovement = 12;
    resetInputState().feed(`${gloves.invlet}        `);
    await rhack('W'.charCodeAt(0));
    for (let turn = 0; turn < 10 && !gloves.known; turn++)
        await moveloop_core();
    await addInventoryObject(ROCK, { quan: 80 });
    await reportHeroEncumbrance();
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed('            ');
    game._pending_message = '';
    await rhack('T'.charCodeAt(0));
    for (let turn = 0; turn < 10 && gloves.worn; turn++)
        await moveloop_core();
    assert.equal(game.uarmg, null);
    assert.ok((game._encumbranceLevel ?? 0) > 0);
    assert.match([...messages, game._pending_message].join(' '), /movements are slowed|trouble lifting|difficulty moving/);
});
//# sourceMappingURL=glove_loss_burden.test.js.map