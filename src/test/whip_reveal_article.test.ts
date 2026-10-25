import test from 'node:test';
import assert from 'node:assert/strict';
import { W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { BULLWHIP } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createMonsterAt } from './support/monsters.js';
import { inventoryLetter } from './support/commands.js';
import { rhack } from '../js/cmd.js';

// C apply.c:3139 reveals an unseen whip target with Amonnam(), the
// capitalized form of a_monnam(), so vowel-initial species take "An".
void test('a whip revealing a hidden acid blob names it with the article an', async () => {
    freshPlayableRoom();
    const whip = await addInventoryObject(BULLWHIP, { wielded: true, owornmask: W_WEP });
    game.uwep = game.u.uwep = whip;
    const blob = await createMonsterAt('acid blob', game.u.ux + 1, game.u.uy);
    blob.mundetected = 1;
    initRng(7105n);

    const paged: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => { paged.push(game._pending_message || ''); };
    pushKeys(`${inventoryLetter(whip)}l   `);
    await rhack('a'.charCodeAt(0));

    assert.equal(blob.mundetected, 0);
    assert.deepEqual(paged.filter(line => line.includes('is there that you')),
        ["An acid blob is there that you couldn't see."]);
    assert.equal(
        game._pending_message,
        'You flick your bullwhip towards the acid blob.  Snap!',
    );
});
