import assert from 'node:assert/strict';
import test from 'node:test';
import { bot, flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { runLevelRegions } from '../js/regions.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('poison gas displays HP lost by an already blind hero', async () => {
    const level = freshObjectRoom({ hero: { blindTurns: 5 } });
    level.regions = [{ kind: 'gas-cloud', damage: 8, visible: true, heroFault: false, ttl: 3, cells: [{ x: 10, y: 10 }] }];
    await bot();

    await runLevelRegions(game, { rollOne: () => 3, publish: async () => undefined });
    await flush_screen(1);

    assert.equal(game.u.uhp, 32);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /HP:32\(40\)/);
});
