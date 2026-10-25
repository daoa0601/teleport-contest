// C end.c:741-744: savelife() marks botl, then curs_on_u() — display.c:1687,
// i.e. flush_screen(1) — repaints the status line with the restored hit
// points. The message pager only rewrites the topline, so without that
// flush the next --More-- (here surfacing the crumble prose after the
// life saving) would page over a stale zero-hit-point status.

import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { loseHeroHp } from '../js/hero_damage.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('life saving repaints the restored hit points before paging the crumble message', async () => {
    freshObjectRoom({ role: 'barbarian' });
    game.u.uhp = game.u.uhpmax = 40;
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    game.u.uhp = 1;
    initRng(2n);
    const input = resetInputState();
    let crumbleStatus: string | null = null;
    input.display = {
        async readKey() {
            if (/much better/.test(game._pending_message || ''))
                crumbleStatus = requireGameDisplay(game).grid
                    .map(row => row.map(cell => cell.ch).join('')).join('\n');
            return ' '.charCodeAt(0);
        },
    };

    await loseHeroHp(6, 'acid');
    await flushPendingTopline();

    assert.equal(game.u.uhp, 40, 'the amulet revives the hero');
    assert.ok(crumbleStatus, 'the recovery prose must reach its pager');
    assert.match(crumbleStatus, /HP:40\(40\)/,
        'curs_on_u() inside savelife() repaints the status before the pager');
});
