import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { polymonHero } from '../js/polyself.js';
import { ELVEN_CLOAK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { resetInputState } from '../js/input.js';
import { uninitializedObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
// C polyself.c polymon() installs the monster body's hit points after
// set_uasmon() has made the form current, and the handless-form
// make_glib(0) (potion.c) flags the status line on a hero who was not
// slippery-fingered. A petrifying hero spends that first flag on the
// "You no longer seem to be petrifying." message, whose pline()-driven
// flush_screen() draws the form before it has hit points (HP:0(0)).
// make_glib(0) then re-arms the update, so break_armor()'s cloak report
// — the next pline() — redraws the status with the monster HP while
// polymon() is still running.
void test('a handless polymorph publishes its monster HP with the armor-breaking message', async () => {
    await freshObjectRoom();
    const greenSlime = MONSTER_NAME.indexOf('green slime');
    game.u.uarmc = game.uarmc = await uninitializedObject(ELVEN_CLOAK);
    game.u.stonedTurns = 3;
    let statusAtClasp = '';
    const input = resetInputState();
    input.beforeRead = () => {
        if (/no longer seem to be petrifying/.test(game._pending_message || ''))
            statusAtClasp = game.nhDisplay?.statusLines?.[1] ?? '';
        input.feed(' ');
    };
    initRng(7n);
    await polymonHero(greenSlime);
    const mh = game.u.mh ?? 0;
    const mhmax = game.u.mhmax ?? 0;
    assert.ok(mh === mhmax && mhmax > 0, 'the fresh form starts unwounded');
    assert.match(statusAtClasp, new RegExp(`HP:${mh}\\(${mhmax}\\)`), 'the monster hit points are already on the status line');
    assert.match(statusAtClasp, /HD:6/, 'the status presents the form through hit dice, not experience');
});
//# sourceMappingURL=polymon_status_flush.test.js.map