import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { lightWieldedArtifact } from '../js/light.js';
import { pushKeys } from '../js/input.js';
import { curseObject } from '../js/object_state.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryItem } from '../js/u_init.js';
import { artifactObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('cursing a lit artifact reports its reduced light', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const sword = await addInventoryItem(await artifactObject('Sunsword'));
    pushKeys(' '.repeat(100));
    await setPrimaryWeapon(sword);
    await lightWieldedArtifact(sword);
    await curseObject(sword);
    assert.equal(game._pending_message, 'Your long sword named Sunsword shines less brightly.');
});
//# sourceMappingURL=mkobj_curse_light.test.js.map