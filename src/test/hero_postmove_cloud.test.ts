import assert from 'node:assert/strict';
import test from 'node:test';

// C hack.c:domove_core() calls m_postmove_effect(&youmonst) after the
// tentative step: a polymorphed hezrou leaves stench where it stood.

import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('a hero polymorphed into a hezrou leaves a stench cloud behind each step', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    installPagerInput(input, { expected: /./, limit: 10 });
    installPolymorphedHero('hezrou');
    const { ux, uy } = game.u;

    await rhack('l'.charCodeAt(0));

    assert.equal(game.u.ux, ux + 1);
    const clouds = game.level.regions.filter(region =>
        region.cells.some(cell => cell.x === ux && cell.y === uy));
    assert.equal(clouds.length, 1);
    assert.equal(clouds[0]?.cells.length, 1);
});

void test('a hero in human form leaves no cloud behind', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    installPagerInput(input, { expected: /./, limit: 10 });

    await rhack('l'.charCodeAt(0));

    assert.equal(game.level.regions.length, 0);
});
