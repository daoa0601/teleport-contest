import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { moveloop_core } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';

function toplineText(): string {
    return (game.nhDisplay?.grid[0] ?? []).map(cell => cell.ch).join('').trimEnd();
}

// C cmd.c:dotravel(): the m-prefix menu path calls getpos_menu() only; the
// "(For instructions type a '?')" pline belongs to getpos(), which that
// path never enters, so verbose travel must not print it.
void test('travel through the menu prints no instructions line', async () => {
    const input = freshTurnRoom({ flags: { tips: false, verbose: true } });
    const pages: string[] = [];
    input.display = { async readKey() {
        pages.push(toplineText());
        return 27;
    } };
    input.feed('m_');
    await moveloop_core();

    // The instructions pline would survive in the recallable transaction;
    // the menu path must leave it out entirely.
    const recall = `${game._toplines} ${game._messageHistory.join(' ')}`;
    assert.doesNotMatch(recall, /\(For instructions type a '\?'\)/,
        `The menu path prints no instructions line, saw: ${pages.join(' | ')}`);
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
