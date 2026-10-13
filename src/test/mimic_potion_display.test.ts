import assert from 'node:assert/strict';
import test from 'node:test';
import { M_AP_OBJECT, NO_MINVENT } from '../js/const.js';
import { glyphAt, newsym, flush_screen } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { POT_HEALING } from '../js/object_data.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a distant mimic shows the color of its potion disguise', async () => {
    freshObjectRoom();
    const mimic = await createMonsterAt('large mimic', 15, 10, NO_MINVENT);
    mimic.m_ap_type = M_AP_OBJECT;
    mimic.mappearance = POT_HEALING;

    newsym(15, 10);
    await flush_screen(1);

    const glyph = glyphAt(15, 10);
    assert.equal(glyph?.kind, 'object');
    const cell = requireGameDisplay().grid[11]?.[14];
    assert.equal(cell?.ch, '!');
    assert.equal(cell?.color, game.objectColors?.[POT_HEALING]);
});
