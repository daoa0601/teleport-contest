import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { PIT, TT_PIT } from '../js/const.js';
import { resetInputState } from '../js/input.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { freshGameplayRoom, freshTurnRoom } from './support/playable-room.js';
import { addTrap } from './support/level-state.js';

// C trap.c:trapeffect_pit(): only the 'm' prefix (iflags.menu_requested)
// descends deliberately into a known pit. Fumbling prevents dotrap()'s
// random escape, so each test reaches the descent behavior regardless of seed.
void test('traveling onto a known pit falls in and deals damage', async () => {
    const input = freshTurnRoom({ flags: { tips: false } });
    grantIntrinsicProperty('fumbling', 'outside');
    const level = game.level;
    if (!level) throw new Error('travel pit test requires a level');
    const pit = addTrap(level, PIT, game.u.ux + 1, game.u.uy, { tseen: true });
    game.context.botl = false;

    input.feed('_l.');
    await rhack(0);

    assert.ok(pit.tseen);
    assert.equal(game.u.utraptype, TT_PIT);
    assert.ok((game.u.utrap ?? 0) >= 1, 'hero is trapped in the pit');
    assert.match(game._pending_message ?? '', /You fall into a pit!/);
    assert.ok((game.u.uhp ?? 0) < (game.u.uhpmax ?? 0), 'falling into the pit costs hit points');
});

// C trap.c:1877: iflags.menu_requested && already_known lowers the hero
// into the pit without the fall damage.
void test('the m prefix lowers the hero into a known pit without damage', async () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    grantIntrinsicProperty('fumbling', 'outside');
    addTrap(level, PIT, game.u.ux + 1, game.u.uy, { tseen: true });
    const input = resetInputState();
    const command = rhack('m'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.feed('l');
    await command;

    assert.equal(game.u.utraptype, TT_PIT);
    assert.ok((game.u.utrap ?? 0) >= 1, 'deliberate descent still traps the hero');
    assert.match(game._pending_message ?? '', /You carefully lower yourself into the pit\./);
    assert.equal(game.u.uhp, game.u.uhpmax, 'deliberate descent takes no damage');
});
