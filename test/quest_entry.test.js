import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { gotoLevel } from '../js/level_change.js';
import { resetInputState } from '../js/input.js';
import { ensureQuestStatus } from '../js/quest.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { createDungeon } from './support/topology.js';
import { addTrap } from './support/level-state.js';
import { MAGIC_PORTAL } from '../js/const.js';
void test('entering the Healer quest delivers its homecoming text before marking the visit', async () => {
    freshConnectedLevels({ role: 'healer' });
    const cache = game._levelCache;
    const destination = cache?.get('0:2');
    assert.ok(cache && destination);
    game.dungeons.push(createDungeon({ dname: 'The Quest' }));
    game.quest_dnum = 1;
    game.branches = [{ end1: { dnum: 0, dlevel: 1 }, end2: { dnum: 1, dlevel: 1 },
            type: 'portal', portal: true, end1_up: false }];
    cache.set('1:1', destination);
    cache.delete('0:2');
    destination.activeSpecialLevel = { prototype: 'Hea-strt', file: 'Hea-strt.lua' };
    addTrap(destination.level, MAGIC_PORTAL, 12, 10);
    const pages = [];
    const input = resetInputState();
    input.beforeRead = () => {
        pages.push(game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '');
        assert.equal(ensureQuestStatus().first_start, false);
        input.feed(' ');
    };
    await gotoLevel({ dnum: 1, dlevel: 1 }, { arrival: 'portal' });
    assert.match(pages.join('\n'), /What sorcery/);
    assert.equal(ensureQuestStatus().first_start, true);
});
//# sourceMappingURL=quest_entry.test.js.map