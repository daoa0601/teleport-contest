// C mhitu.c:mayberem() strips a seduced hero's cloak through
// steal.c:remove_worn_item() -> do_wear.c:Cloak_off(), which never calls
// find_ac(); u.uac keeps counting the cloak until allmain.c's
// once-per-player-input find_ac().  A later electric hit that recharges a
// worn ring (zap.c:maybe_destroy_item() -> read.c:recharge(), the "spins
// clockwise" branch) also never calls find_ac(): its Ring_off()/Ring_on()
// pair only recomputes for a protection ring with nonzero enchantment
// (do_wear.c:1335-1341, 1425-1436).  mattacku()'s end-of-slot
// `if (flags.botl) bot()` therefore repaints the status line with the
// armor class from before the cloak came off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/mhitu.js';
import { findArmorClass, wearHeroArmor } from '../js/do_wear.js';

import { wearHeroAccessory } from '../js/do_wear.js';

import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/tty_topline.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { LEATHER_CLOAK, OBJECT_NAMES } from '../js/object_data.js';
import { removeWornHeroItem } from '../js/hero_equipment.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

function statusRow(): string {
    return requireGameDisplay(game).grid[23]?.map(cell => cell.ch).join('') ?? '';
}

void test('a ring recharged by an electric hit repaints the status with the pre-removal armor class', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const cloak = await addInventoryObject(LEATHER_CLOAK);
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('gain strength'), { spe: 0 });
    await wearHeroArmor(cloak);
    await wearHeroAccessory(ring, 'uright');
    const classWithCloak = findArmorClass();
    assert.equal(classWithCloak, 9, 'a +0 leather cloak improves AC 10 to 9');

    // The seducer's mayberem() -> remove_worn_item() -> Cloak_off() takes
    // the cloak off without find_ac(); u.uac stays 9 for the pager.
    await removeWornHeroItem(cloak, game);
    assert.equal(game.uarmc, null, 'the cloak is off');
    assert.equal(game.u.uac, classWithCloak,
        'Cloak_off() leaves u.uac at the value find_ac() last computed');

    // A grid bug bite zaps the hero and recharges the worn ring
    // (random(3) must spare it for charging, the other rolls stay 0).
    const bug = await createMonsterAt('grid bug', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    bug.m_lev = 30;
    bug.mux = game.u.ux;
    bug.muy = game.u.uy;
    const input = resetInputState();
    const messages: string[] = [];
    installPagerInput(input, { expected: /grid bug|zap|spins/, limit: 10 });
    input.beforeRead = () => { messages.push(game._pending_message); };

    await performMonsterHeroAttack(bug, game, {
        random: limit => limit === 3 ? 1 : 0,
        rollOne: () => 1, rollDice: (count, sides) => count * sides,
    });
    await flushPendingTopline();

    const prose = messages.join('\n');
    const zapped = prose.indexOf('You get zapped!');
    const spins = prose.indexOf('spins clockwise for a moment.');
    assert.ok(zapped >= 0 && spins > zapped, `the zap precedes the ring's recharge:\n${prose}`);
    assert.equal(ring.spe, 1, 'the electric hit recharged the worn ring by 1');
    assert.match(statusRow(), /AC:9/,
        "the end-of-slot bot() still paints the armor class from before the cloak came off");
    assert.equal(game.u.uac, 9,
        'recharge() leaves u.uac stale for the once-per-player-input find_ac()');

    // C allmain.c's once-per-player-input find_ac() then drops the AC to 10.
    assert.equal(findArmorClass(game), 10);
});
