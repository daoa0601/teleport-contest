import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverArtifact } from '../js/artifacts.js';
import { SINK } from '../js/const.js';
import { game } from '../js/gstate.js';
import { addInventoryItem } from '../js/u_init.js';
import { initRng } from '../js/rng.js';
import { artifactObject } from './support/game-objects.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
void test('dipping a named artifact in a sink uses its proper article', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = SINK;
    const sword = await addInventoryItem(await artifactObject('Excalibur', { rknown: true, oerodeproof: true }));
    assert.ok(sword.oartifact && sword.invlet);
    discoverArtifact(sword.oartifact);
    initRng(1n);
    await runExtendedCommand('dip', sword.invlet + 'y' + ' '.repeat(10));
    assert.match(game._pending_message, /You hold Excalibur under the tap/);
});
//# sourceMappingURL=sink_dip_artifact_name.test.js.map