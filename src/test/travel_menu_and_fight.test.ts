import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { doprevMessage } from '../js/prevmsg.js';
import { resetInputState } from '../js/input.js';
import { moveloop_core } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';

function toplineText(): string {
    return (game.nhDisplay?.grid[0] ?? []).map(cell => cell.ch).join('').trimEnd();
}

// C getpos.c:getpos() accepts a queued direction before printing cursor help.
void test('travel to a queued position shows only the travel question', async () => {
    const input = freshTurnRoom({ flags: { tips: false, verbose: true } });
    input.queueCommandKeys('_');
    input.queueCommandResponses([{ dx: 0, dy: 0, dz: 0 }]);

    await rhack(0);
    await doprevMessage();
    await doprevMessage();

    assert.equal(toplineText(), 'Where do you want to travel to?');
});

// C hack.c:domove_core(): the shared destination-monster block runs
// nomul(0) for a fight prefix even when u.ustuck is a safe monster, so a
// counted F-attack on the swallower spends a single hero action.
void test('a counted fight-prefix attack on a safe swallower is cut short', async () => {
    const input = freshTurnRoom({ role: 'barbarian' });
    game.u.uhp = game.u.uhpmax = 500;
    // Telepathy spots the engulfer on the hero's own square while swallowed,
    // so a peaceful swallower passes _is_safemon(); only the fight prefix
    // keeps hack.c's nomul(0) unconditional.
    const helm = await addInventoryObject(100); // helm of telepathy
    await wearHeroArmor(helm);
    const worm = await createMonsterAt('purple worm', game.u.ux, game.u.uy);
    worm.mpeaceful = true;
    game.u.uswallow = 1;
    game.u.ustuck = worm;
    resetInputState().feed('F4y');
    await moveloop_core();

    assert.equal(game.multi, 0,
        `nomul(0) cancels the count for the fight prefix, saw multi ${game.multi}`);
});
