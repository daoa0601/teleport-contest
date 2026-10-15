import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { PIT, TELEP_TRAP, TT_PIT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { installPagerInput } from './support/pager-input.js';

void test('a hidden trapper with granted flight descends instead of coming off the ceiling', async () => {
    const { destination } = freshConnectedLevels();
    requirePlayingGame(game);
    installPolymorphedHero('trapper');
    grantIntrinsicProperty('flying', 'outside');
    game.u.uundetected = true;
    installPagerInput(resetInputState(), { expected: /stairs/, limit: 2 });

    await rhack('>'.charCodeAt(0));

    assert.ok(game.level === destination, 'a trapper hides on the floor even when it can fly');
    assert.equal(game.u.uz.dlevel, 2);
    assert.equal(game.context.move, 1);
});

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

void test('a piercer coming down onto a teleport trap completes its arrival', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    installPolymorphedHero('rock piercer');
    game.u.uundetected = true;
    const trap = addTrap(source, TELEP_TRAP, game.u.ux, game.u.uy, {
        teledest: { x: 14, y: 10 },
    });
    installPagerInput(resetInputState(), { expected: /drop to|materialize/, limit: 3 });

    await rhack('>'.charCodeAt(0));

    assert.ok(game.level === source, 'the teleport stays on the current level');
    assert.equal(game.u.uundetected, 0);
    assert.equal(trap.tseen, true);
    assert.equal(game.u.ux, 14);
    assert.equal(game.u.uy, 10);
    assert.match(game._pending_message, /You materialize in a different location!$/);
    assert.equal(game.context.move, 1);
});
