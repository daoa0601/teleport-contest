import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { PIT, TT_PIT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { installPagerInput } from './support/pager-input.js';

void test('down reveals a lurker above before a later command can use the stairs', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    installPolymorphedHero('lurker above');
    game.u.uundetected = true;
    installPagerInput(resetInputState(), { expected: /stairs|fly out of hiding/, limit: 3 });

    await rhack('>'.charCodeAt(0));

    assert.ok(game.level === source, 'coming out of hiding takes its own turn');
    assert.equal(game.u.uundetected, 0);
    assert.equal(game._pending_message, 'You fly out of hiding.');
    assert.equal(game.context.move, 1);
});

void test('a piercer coming down triggers the trap below its hiding place', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    installPolymorphedHero('rock piercer');
    game.u.uundetected = true;
    addTrap(source, PIT, game.u.ux, game.u.uy, { tseen: true });
    installPagerInput(resetInputState(), { expected: /stairs|drop to|pit|land/, limit: 3 });

    await rhack('>'.charCodeAt(0));

    assert.ok(game.level === source);
    assert.equal(game.u.uundetected, 0);
    assert.equal(game.u.utraptype, TT_PIT);
    assert.ok((game.u.utrap ?? 0) > 0, 'landing triggers the pit trap');
    assert.equal(game.context.move, 1);
});
