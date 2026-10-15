import test from 'node:test';
import assert from 'node:assert/strict';
import { M_SEEN_POISON } from '../js/const.js';
import { game } from '../js/gstate.js';
import { createGasCloudSelection, runLevelRegions } from '../js/regions.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const resistant of [false, true]) {
    void test(`gas ${resistant ? 'teaches' : 'clears'} a watching monster's knowledge of poison resistance`, async () => {
        freshObjectRoom({ hero: { poisonResistance: resistant, blindTurns: 5 } });
        const watcher = await createMonsterAt('soldier', 13, 10);
        watcher.seen_resistance = resistant ? 0 : M_SEEN_POISON;
        await createGasCloudSelection(game, [{ x: 10, y: 10 }], 5, 8, async () => { });
        await runLevelRegions(game, { publish: async () => { }, rollOne: () => 1 });
        assert.equal(!!((watcher.seen_resistance ?? 0) & M_SEEN_POISON), resistant);
    });
}
//# sourceMappingURL=region_resistance.test.js.map