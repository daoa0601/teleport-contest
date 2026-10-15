import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { createGasCloudSelection, runLevelRegions } from '../js/regions.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('cloud dissipation is announced after surviving clouds affect their occupants', async () => {
    freshObjectRoom();
    await createMonsterAt('soldier', 11, 10);
    await createGasCloudSelection(game, [{ x: 10, y: 10 }], 0, 0, async () => {});
    const active = await createGasCloudSelection(game, [{ x: 11, y: 10 }], 5, 8, async () => {});
    assert.ok(active);
    active.heroFault = false;
    const messages: string[] = [];

    await runLevelRegions(game, { publish: async message => { messages.push(message); } });

    assert.deepEqual(messages, ['The soldier coughs!', 'The gas cloud around you dissipates.']);
});
