import assert from 'node:assert/strict';
import test from 'node:test';
import { PIT, WEB } from '../js/const.js';
import { ROCK } from '../js/object_data.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishImmediateMonsterTrap, triggerImmediateMonsterTrap } from '../js/monmove.js';
import { initRng } from '../js/rng.js';
import { floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';

// C trap.c:3831-3837: after trapeffect_selector(), a monster newly caught by
// a trap is unhidden by maybe_unhide_at(), and a first sighting reports
// "<a monster> appears." instead of leaving it concealed under the object.
void test('a concealing monster caught by a pit under its object appears', async () => {
    const level = freshPlayableRoom({});
    addTrap(level, PIT, 11, 10, { tseen: false });
    await floorObject(ROCK, 11, 10);
    const hider = await createMonsterAt('snake', 11, 10);
    hider.mundetected = 1;
    requirePlayingGame(game);
    const messages: string[] = [];
    initRng(1n);

    const action = await triggerImmediateMonsterTrap(hider, game, { force: true });
    await finishImmediateMonsterTrap(action, game, {
        publish: async message => { messages.push(message); },
    });

    assert.equal(hider.mtrapped, 1, 'the snake is caught in the pit');
    assert.equal(hider.mundetected, 0,
        'maybe_unhide_at() must expose the trapped hider');
    const text = messages.join(' | ');
    assert.match(text, /A snake (?:is|was|falls|climbs|appears)/, text);
    assert.match(text, /A snake appears\./, text);
});

// The tail is limited to trapped survivors: a web that a monster tears
// through (or any untrapping effect) stays silent.
void test('a monster that tears straight through a web does not appear', async () => {
    const level = freshPlayableRoom({});
    addTrap(level, WEB, 11, 10, { tseen: false });
    const giant = await createMonsterAt('hill giant', 11, 10);
    requirePlayingGame(game);
    const messages: string[] = [];
    initRng(1n);

    const action = await triggerImmediateMonsterTrap(giant, game, { force: true });
    await finishImmediateMonsterTrap(action, game, {
        publish: async message => { messages.push(message); },
    });

    assert.equal(giant.mtrapped, 0, 'the giant tears through the web');
    const text = messages.join(' | ');
    assert.doesNotMatch(text, /appears\./, text);
});
