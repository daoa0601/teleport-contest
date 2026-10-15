import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { PIT, ROOM, TT_PIT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { runExtendedCommand } from './support/commands.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('up climbs out of a pit before looking for stairs', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    game.stairs = null;
    source.requireAt(game.u.ux, game.u.uy).typ = ROOM;
    addTrap(source, PIT, game.u.ux, game.u.uy, { tseen: true });
    game.u.utrap = 1;
    game.u.utraptype = TT_PIT;

    await rhack('<'.charCodeAt(0));

    assert.equal(game.u.utrap, 0);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, 'You crawl to the edge of the pit.');
    assert.ok(game.level === source);
});

void test('down deliberately enters a known pit while flying', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    game.stairs = null;
    source.requireAt(game.u.ux, game.u.uy).typ = ROOM;
    installPolymorphedHero('vampire bat');
    addTrap(source, PIT, game.u.ux, game.u.uy, { tseen: true });
    installPagerInput(resetInputState(), { expected: /pit|land/, limit: 3 });

    await rhack('>'.charCodeAt(0));

    assert.equal(game.u.utraptype, TT_PIT);
    assert.ok((game.u.utrap ?? 0) > 0, 'the deliberate plunge leaves the hero in the pit');
    assert.equal(game.context.move, 1);
    assert.ok(game.level === source);
});

void test('up names a mounted pony without its saddle when it remains in a pit', async () => {
    const level = freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    assert.equal(game.u.usteed, pony);
    addTrap(level, PIT, game.u.ux, game.u.uy, { tseen: true });
    game.u.utrap = 3;
    game.u.utraptype = TT_PIT;
    installPagerInput(resetInputState(), { expected: /mount|pony|pit/, limit: 3 });

    await rhack('<'.charCodeAt(0));

    assert.equal(game._pending_message, 'Your pony is still in a pit.');
    assert.equal(game.u.utrap, 2);
    assert.equal(game.u.usteed, pony);
    assert.equal(game.context.move, 1);
});
