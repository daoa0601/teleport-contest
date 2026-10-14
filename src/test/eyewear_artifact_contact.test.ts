import assert from 'node:assert/strict';
import test from 'node:test';
import { artifactByName } from '../js/artifacts.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { LENSES } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('puton resolves artifact contact before wearing the Eyes of the Overworld', async () => {
    freshObjectRoom({ role: 'caveman', hero: { ualign: { type: -1, record: 0 }, uhp: 100, uhpmax: 100 } });
    const artifact = artifactByName('The Eyes of the Overworld');
    assert.ok(artifact);
    const lenses = await addInventoryObject(LENSES, { oartifact: artifact.id, oname: artifact.name });
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed(`${lenses.invlet}                `);

    await rhack('P'.charCodeAt(0));

    assert.equal(game.ublindf ?? null, null);
    assert.equal(!!lenses.worn, false);
    assert.ok((game.u.uhp ?? 100) < 100);
    assert.equal(game.context.move, 1);
    assert.match([...messages, game._pending_message].join(' '), /blasted by The Eyes of the Overworld's power/);
});
