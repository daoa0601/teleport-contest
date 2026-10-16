import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishScheduledLevelChange } from '../js/level_change.js';
import { levelTeleport } from '../js/level_teleport.js';
import { resetInputState } from '../js/input.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { planInput } from './support/planned-input.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
void test('duplicate annotations resolve in dungeon and level order', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    grantIntrinsicProperty('teleportControl', 'outside');
    game._levelAnnotations = new Map([['0:2', 'Camp'], ['0:1', 'Camp']]);
    resetInputState().feed('camp\r');
    await levelTeleport();
    await finishScheduledLevelChange();
    assert.equal(game.u.uz.dlevel, 1, 'the first matching level is the current level');
});
void test('controlled level teleport recognizes the role-specific Quest prototype', async (t) => {
    const { destination } = freshConnectedLevels();
    requirePlayingGame(game);
    grantIntrinsicProperty('teleportControl', 'outside');
    game.specialLevels = new Map([['x-strt', createSpecialLevel({ dnum: 0, dlevel: 2 })]]);
    const input = resetInputState();
    input.feed(`${game.urole.filecode}-strt\r`);
    planInput(input, t, []);
    await levelTeleport();
    await finishScheduledLevelChange();
    assert.equal(game.level, destination);
});
void test('a named branch outside the current dungeon cannot select its parent through Gehennom', async (t) => {
    freshConnectedLevels();
    requirePlayingGame(game);
    grantIntrinsicProperty('teleportControl', 'outside');
    const cached = game._levelCache?.get('0:2');
    assert.ok(cached);
    game._levelCache = new Map([['1:3', cached], ['2:3', cached]]);
    game.dungeons.push(createDungeon({ dname: 'Gehennom', num_dunlevs: 10, depth_start: 20 }), createDungeon({ dname: "Vlad's Tower", num_dunlevs: 3, entry_lev: 3, depth_start: 20 }));
    game.medusa_level = createSpecialLevel({ dnum: 0, dlevel: 2 });
    game.valley_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
    game.branches = [{ end1: { dnum: 1, dlevel: 3 }, end2: { dnum: 2, dlevel: 3 },
            end1_up: true, type: 'stair', portal: false }];
    const input = resetInputState();
    input.feed("Vlad's Tower\r");
    planInput(input, t, [{ prompt: /To what level do you want to teleport\? \[type a number or name\]/, keys: '\x1b' }]);
    await levelTeleport();
    assert.equal(game._scheduledLevelChange, undefined);
    assert.equal(game.u.uz.dnum, 0);
});
//# sourceMappingURL=dungeon_level_names.test.js.map