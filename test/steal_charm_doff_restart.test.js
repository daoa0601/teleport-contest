// C steal.c:steal() ARMOR_CLASS branch: stop_donning() captures its return
// value (-multi) only after cancel_don() has already zeroed multi, so the
// olddelay steal() receives is always 0. A seduction interrupting an armor
// doff therefore restarts the item's full oc_delay instead of resuming the
// turns that were left, and the hero stays charmed for those whole turns
// before stealarm() takes the armor.
import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/tty_topline.js';
import { OBJECT_DELAY, RING_MAIL } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
void test('a seduction interrupting an armor doff restarts the full removal delay', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    const mail = await addInventoryObject(RING_MAIL);
    await wearHeroArmor(mail);
    const nymph = await createMonsterAt('water nymph', game.u.ux + 1, game.u.uy, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    nymph.mux = game.u.ux;
    nymph.muy = game.u.uy;
    // Without movement she cannot act while the doff spends its first turns.
    const removalDelay = OBJECT_DELAY[RING_MAIL] ?? 0;
    const seen = [];
    let answeredCommandInput = false;
    input.beforeRead = () => { seen.push(game._pending_message); };
    input.display = {
        async readKey() {
            const display = requireGameDisplay(game);
            const screen = display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (/--More--|Hit space to continue/.test(screen))
                return ' '.charCodeAt(0);
            assert.equal(answeredCommandInput, false, 'the recovered hero needs no second command');
            answeredCommandInput = true;
            return 27; // cancel the following command prompt
        },
    };
    await rhack('T'.charCodeAt(0)); // one worn armor: the doff starts at once
    assert.ok(game.multi < 0, 'the ring mail doff is under way');
    let doffTurns = 0;
    for (; doffTurns < 10 && !/seduces you and you continue taking off/.test(seen.join('\n')); doffTurns++) {
        await moveloop_core();
        seen.push(game._pending_message);
    }
    const charmFeedback = seen.join('\n');
    assert.match(charmFeedback, /seduces you and you continue taking off/, 'the nymph interrupts the doff in progress');
    assert.ok(doffTurns >= 1, 'the charm arrives after the doff spent turns');
    assert.equal(game.multi, -(removalDelay - 1), 'steal() restarts the whole armor delay (olddelay is always zero)');
    let charmedTurns = 0;
    while (game.multi < 0) {
        await moveloop_core();
        seen.push(game._pending_message);
        charmedTurns++;
    }
    await flushPendingTopline();
    const feedback = [...seen, game._pending_message].join('\n');
    assert.equal(charmedTurns, removalDelay - 1, 'the restarted removal keeps the hero helpless for the full delay');
    assert.match(feedback, /You can move again\./);
    assert.match(feedback, /water nymph steals/);
    assert.equal(game.inventory.includes(mail), false, 'the mail left the inventory');
    assert.equal(nymph.minvent.includes(mail), true, 'the thief ends up with the mail');
});
//# sourceMappingURL=steal_charm_doff_restart.test.js.map