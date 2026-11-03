import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { addObjectToContainer } from '../js/mkobj.js';
import { FOOD_RATION, LARGE_BOX, SACK } from '../js/object_data.js';
import { answerPrompts } from './support/input-boundaries.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

// C pickup.c:doloot_core() loots each selected container in menu order:
// do_loot_cont() prints "Hmmm, %s turns out to be locked." for a locked
// container with an unknown lock (pickup.c:2109) and returns ECMD_OK
// (pickup.c:2146), then the next container's use_container() menu is
// displayed.  A menu display first pages the pending topline (wintty.c:
// tty_display_nhwindow case NHW_MENU, "if (ttyDisplay->toplin ==
// TOPLINE_NEED_MORE) tty_display_nhwindow(WIN_MESSAGE, TRUE);"), so the
// locked line is acknowledged with --More-- before the sack's prompt.
void test('#loot pages the locked-container message before the next container menu', async () => {
    await freshObjectRoom();
    const { ux, uy } = game.u;
    // The sack is dropped first and the large box after it, so the box heads
    // the floor chain and the loot menu lists it first (menu item 'a').
    const sack = await floorObject(SACK, ux, uy, { cknown: true });
    const ration = await knownObject(FOOD_RATION, { where: 'free' });
    await addObjectToContainer(sack, ration);
    const box = await floorObject(LARGE_BOX, ux, uy, { initialize: false, olocked: true });

    const input = resetInputState();
    pushKeys('loot\n');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, [
        { prompt: /Loot which containers\?/, keys: 'ab\n' },
        { prompt: /Hmmm, the large box turns out to be locked\./, keys: ' ' },
        { prompt: /Do what with the sack\?/, keys: 'q' },
    ]);

    assert.equal(box.lknown, true, 'do_loot_cont() marked the lock known');
    assert.equal(sack.lknown, true, 'use_container() marks the lock known');
    // pickup.c:2146: the bare locked message returns ECMD_OK, and 'q' at the
    // "Do what with" prompt adds no time, so the whole #loot costs no turn.
    assert.equal(game.context.move, 0);
});
