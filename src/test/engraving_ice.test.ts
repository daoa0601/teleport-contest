import assert from 'node:assert/strict';
import test from 'node:test';

import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { BURN, DB_ICE, DRAWBRIDGE_UP, DUST } from '../js/const.js';
import { engravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { WAN_FIRE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { requireFixtureGame } from './support/game-state.js';
import { answerPrompts } from './support/input-boundaries.js';
import { installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('reading fingertip writing beneath a raised drawbridge describes frost', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    const square = game.level.requireAt(10, 10);
    square.typ = DRAWBRIDGE_UP;
    square.drawbridgemask = DB_ICE;
    input.feed('E');

    await answerPrompts(moveloop_core(), input, [
        { prompt: /What do you want to write with\?/, keys: '-' },
        { prompt: /You write in the frost with your fingertip\./, keys: ' ' },
        { prompt: /What do you want to write in the frost here\?/, keys: 'X\r' },
    ]);
    await moveloop_core();
    assert.equal(engravingAt(10, 10)?.engr_type, DUST);
    await answerPrompts(rhack(':'.charCodeAt(0)), input, [
        { prompt: /Something is written here in the frost\.[\s\S]*--More--/, keys: ' ' },
    ]);

    assert.equal(game._pending_message, 'You read: "X".');
});

void test('walking wears text melted into the ice beneath a raised drawbridge', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    const square = game.level.requireAt(10, 10);
    square.typ = DRAWBRIDGE_UP;
    square.drawbridgemask = DB_ICE;
    const wand = await addInventoryObject(WAN_FIRE, { spe: 3, typeKnown: true });
    input.feed('E');

    await answerPrompts(moveloop_core(), input, [
        { prompt: /What do you want to write with\?/, keys: wand.invlet },
        { prompt: /You melt into the ice with/, keys: ' ' },
        { prompt: /What do you want to melt into the ice here\?/, keys: '?\r' },
    ]);
    await moveloop_core();
    assert.equal(engravingAt(10, 10)?.engr_type, BURN);
    installPagerInput(input, { expected: /text|read|ice|slip|friction|Flames/, limit: 150 });

    for (let attempt = 0; attempt < 64 && engravingAt(10, 10); attempt++) {
        await rhack('l'.charCodeAt(0));
        await rhack('h'.charCodeAt(0));
    }

    assert.equal(engravingAt(10, 10), null, 'melted ice text must be vulnerable to footsteps');
});
