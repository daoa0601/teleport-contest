import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverArtifact } from '../js/artifacts.js';
import { THRONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { addInventoryItem } from '../js/u_init.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { artifactObject } from './support/game-objects.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a throne curse names the intelligent artifact which resists it', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = THRONE;
    const sword = await addInventoryItem(await artifactObject('Excalibur', { rknown: true }));
    assert.ok(sword.oartifact);
    discoverArtifact(sword.oartifact);
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    initRng(41n);

    await runExtendedCommand('sit', ' '.repeat(20));

    assert.match([...messages, game._pending_message].join('\n'), /Excalibur resists!/);
});
