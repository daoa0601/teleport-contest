import assert from 'node:assert/strict';
import test from 'node:test';
import { FOUNTAIN } from '../js/const.js';
import { map_location } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { gotoLevel } from '../js/level_change.js';
import { resetInputState } from '../js/input.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { readDungeonOverview } from './support/dungeon-overview.js';
import { createDungeon } from './support/topology.js';
void test('leaving a level records its learned features without opening the overview first', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    source.requireAt(11, 10).typ = FOUNTAIN;
    map_location(11, 10, false);
    await gotoLevel({ dlevel: 2 }, { arrival: 'stairs' });
    const text = await readDungeonOverview();
    assert.match(text, /Level 1:[\s\S]*A fountain\./);
});
for (const arrival of ['stairs', 'portal', 'random']) {
    void test(`${arrival} travel ${arrival === 'random' ? 'does not record' : 'records'} a forward dungeon connection`, async () => {
        freshConnectedLevels();
        requirePlayingGame(game);
        const cached = game._levelCache?.get('0:2');
        assert.ok(cached);
        game._levelCache = new Map([['1:1', cached]]);
        game.dungeons = [createDungeon({ dname: 'Parent', depth_start: 12, num_dunlevs: 3 }),
            createDungeon({ dname: 'Child', depth_start: 11 })];
        game.branches = [{ end1: { dnum: 0, dlevel: 1 }, end2: { dnum: 1, dlevel: 1 },
                type: arrival === 'portal' ? 'portal' : 'stair', end1_up: true, portal: arrival === 'portal' }];
        game.flags.verbose = false;
        resetInputState().display = { async readKey() { return 32; } };
        await gotoLevel({ dnum: 1, dlevel: 1 }, { arrival });
        const text = await readDungeonOverview();
        if (arrival === 'random')
            assert.doesNotMatch(text, /Stairs up to Child/);
        else if (arrival === 'portal')
            assert.match(text, /Portal to Child, level 11\./);
        else
            assert.match(text, /Stairs up to Child, level 11\./);
    });
}
//# sourceMappingURL=dungeon_history.test.js.map