import assert from 'node:assert/strict';
import test from 'node:test';
// C zap.c:probe_monster() → invent.c:display_minventory(MINV_ALL) →
// pickup.c:query_objlist(INCLUDE_HERO): probing an engulfer appends an
// "Engulfed Creatures" heading and the hero as a fake CONTAINED_SYM entry
// after the last class group. tty_end_menu() measures that stored row
// ("> - " + an(self_lookat()) = 40 columns here) plus one margin column
// per side, and tty_display_nhwindow()'s corner rule then centers the
// menu at min(82, cols/2, cols - maxcol - 1) + 1 = column 38 of 80, with
// the pager cursor after "(end) " at [44, 6] (wintty.c:1955-1963,
// wintty.c:2786-2819, wintty.c:1596-1601).
import { applyWandEffect } from '../js/zap.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { races } from '../js/role.js';
import { TIN_OPENER, WAN_PROBING } from '../js/object_data.js';
import { placeMonsterAt } from '../js/steed.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
void test('probing an engulfer adds the hero row and places the menu at the tty column', async () => {
    const gnome = races.find(candidate => candidate.name === 'gnome');
    if (!gnome)
        throw new Error('The native gnome race is required');
    const input = freshTurnRoom({ role: 'archeologist', race: gnome });
    game.plname = 'wizard';
    const jelly = await createMonsterAt('ochre jelly', 12, 10);
    placeMonsterAt(jelly, game.u.ux, game.u.uy);
    jelly.minvent = [await knownObject(TIN_OPENER, { initialize: false })];
    game.u.uswallow = game.uswallow = 1;
    game.u.ustuck = jelly;
    const wand = await knownObject(WAN_PROBING, { initialize: false, spe: 3, where: 'inventory' });
    const screens = [];
    input.display = {
        async readKey() {
            const display = requireGameDisplay();
            screens.push({
                rows: display.grid.map(row => row.map(cell => cell.ch).join('')),
                cursorCol: display.cursorCol,
                cursorRow: display.cursorRow,
            });
            return ' '.charCodeAt(0);
        },
    };
    await applyWandEffect(wand);
    const menu = screens.find(screen => /possessions:/.test(screen.rows[0] ?? ''));
    assert.ok(menu, `no possessions menu in ${JSON.stringify(screens.map(s => s.rows[0]))}`);
    assert.equal(menu.rows[0]?.indexOf("The ochre jelly's possessions:"), 38);
    assert.equal(menu.rows[2]?.indexOf('Tools'), 38);
    assert.equal(menu.rows[3]?.indexOf('a - an uncursed tin opener'), 38);
    assert.equal(menu.rows[4]?.indexOf('Engulfed Creatures'), 38);
    assert.equal(menu.rows[5]?.indexOf('> - a gnomish archeologist called wizard'), 38);
    assert.equal(menu.rows[6]?.indexOf('(end)'), 38);
    // The pager leaves the cursor after "(end) " on the row below the hero.
    assert.deepEqual([menu.cursorCol, menu.cursorRow], [44, 6]);
});
//# sourceMappingURL=probe_engulfer_possessions_menu.test.js.map