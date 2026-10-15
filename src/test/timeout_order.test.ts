import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import { setPropertyTimeout } from '../js/properties.js';
import { beginObjectBurn } from '../js/light.js';
import { OIL_LAMP } from '../js/object_data.js';
import { startHeroSliming } from '../js/slime.js';
import { startHeroPetrification } from '../js/stoning.js';
import { installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';
import { addInventoryObject } from './support/game-objects.js';

void test('slime dialogue cancels petrification before the fatal property tick', async () => {
    const input = freshTurnRoom();
    startHeroPetrification({ turns: 1, killer: 'cockatrice egg' });
    startHeroSliming({ turns: 3 });
    installPagerInput(input, { expected: /statue|turning into|green slime/, limit: 5 });
    input.feed('ll');

    await moveloop_core();
    await moveloop_core();

    assert.equal(Boolean(game.program_state.gameover), false);
    assert.equal(game.u.stonedTurns, 0);
    assert.equal(game.u.slimedTurns, 2);
});

void test('blindness expires before a due lamp warning is presented', async () => {
    const input = freshTurnRoom();
    const lamp = await addInventoryObject(OIL_LAMP, { initialize: false, age: 151 });
    beginObjectBurn(lamp);
    setPropertyTimeout('blinded', 1);
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message || game._retained_message); };
    installPagerInput(input, { expected: /see again|lamp flickers/, limit: 4 });
    input.feed('..');

    await moveloop_core();
    await moveloop_core();

    assert.equal(game.u.blindTurns, 0);
    assert.match(messages.join('\n'), /lamp flickers/);
});

void test('prayer pauses object timers along with property countdowns', async () => {
    const input = freshTurnRoom();
    const lamp = await addInventoryObject(OIL_LAMP, { initialize: false, age: 1 });
    beginObjectBurn(lamp);
    game.u.invulnerable = true;
    input.feed('..');

    await moveloop_core();
    await moveloop_core();

    assert.equal(lamp.lamplit, true);
    assert.equal(lamp.timed, 1);
});
