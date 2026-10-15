import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { gotoLevel } from '../js/level_change.js';
import { resetInputState } from '../js/input.js';
import { ensureQuestStatus } from '../js/quest.js';
import { freshConnectedLevels } from './support/connected-levels.js';

void test('entering the Healer quest delivers its homecoming text before marking the visit', async () => {
    freshConnectedLevels({ dungeonName: 'The Quest', role: 'healer' });
    const destination = game._levelCache?.get('0:2');
    assert.ok(destination);
    destination.activeSpecialLevel = { prototype: 'Hea-strt', file: 'Hea-strt.lua' };
    const pages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => {
        pages.push(game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '');
        assert.equal(ensureQuestStatus().first_start, false);
        input.feed(' ');
    };

    await gotoLevel({ dlevel: 2 });

    assert.match(pages.join('\n'), /What sorcery/);
    assert.equal(ensureQuestStatus().first_start, true);
});
