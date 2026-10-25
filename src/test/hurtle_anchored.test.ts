import assert from 'node:assert/strict';
import test from 'node:test';

// C dothrow.c:hurtle() names what holds a trapped hero with hliquid("lava")
// and surface(), so hallucination and the floor type both show through.

import { TT_INFLOOR, TT_LAVA } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { makeHallucinated } from '../js/hero_mental_status.js';
import { hurtleHero } from '../js/hero_hurtle.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

async function anchoredMessages(attempts: number): Promise<string[]> {
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /anchored/, limit: attempts + 1 });
    for (let attempt = 0; attempt < attempts; attempt++) await hurtleHero(1, 0, 2);
    await flushPendingTopline();
    return messages.join('\n').match(/You are anchored by the [^.]*\./g) ?? [];
}

void test('a hero stuck in the floor is anchored by that surface', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    game.u.utrap = 5;
    game.u.utraptype = TT_INFLOOR;

    assert.deepEqual(await anchoredMessages(1), ['You are anchored by the floor.']);
    assert.deepEqual([game.u.ux, game.u.uy], [ux, uy]);
});

void test('a hallucinating hero is anchored by varying imaginary liquids', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await makeHallucinated(100, { talk: false });
    game.u.utrap = 5;
    game.u.utraptype = TT_LAVA;

    const names = new Set(await anchoredMessages(12));
    assert.ok(names.size > 1, `Anchors: ${[...names].join(', ')}`);
});
