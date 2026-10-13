import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { DAGGER, RIN_PROTECTION } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

void test('inventory dropping is refused while the hero is buried', async () => {
    freshObjectRoom({ hero: { uburied: true } });
    const dagger = await addInventoryObject(DAGGER);
    const input = resetInputState();

    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Weapons/, keys: dagger.invlet },
        { prompt: /Do what with the dagger\?/, keys: 'd' },
    ]);
    await rhack(0);

    assert.equal(game.inventory.includes(dagger), true);
    assert.equal(game._pending_message, "You can't do that while you are buried!");
    assert.equal(game.context.move, 0);
});

void test('a kitten cannot put on a ring from its inventory action menu', async () => {
    freshObjectRoom({ hero: { umonnum: MONSTER_NAME.indexOf('kitten'), mh: 10, mhmax: 10 } });
    const ring = await addInventoryObject(RIN_PROTECTION, { known: true, typeKnown: true });
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Rings/, keys: ring.invlet },
        { prompt: /Do what with the ring of protection\?/, keys: 'P' },
    ]);

    await answerPrompts(rhack(0), input, []);

    assert.equal(game.uleft ?? null, null);
    assert.equal(game.uright ?? null, null);
    assert.equal(game._pending_message, "Don't even bother.");
    assert.equal(game.context.move, 0);
});

void test('a humanoid can wear an inventory ring when carrying no armor', async () => {
    freshObjectRoom();
    const ring = await addInventoryObject(RIN_PROTECTION, { known: true, typeKnown: true });
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Rings/, keys: ring.invlet },
        { prompt: /Do what with the ring of protection\?/, keys: 'P' },
    ]);

    await answerPrompts(rhack(0), input, [
        { prompt: /Which ring-finger/, keys: 'l' },
    ]);

    assert.equal(game.uleft, ring);
    assert.equal(game.context.move, 1);
});
