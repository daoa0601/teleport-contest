import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { DB_FLOOR, DB_ICE, DB_LAVA, DB_MOAT, DRAWBRIDGE_UP, TT_LAVA } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { hurtleHero } from '../js/hero_hurtle.js';
import { pushKeys } from '../js/input.js';
import { levitationDialogue } from '../js/levitation_timeout.js';
import { refreshProperty } from '../js/properties.js';
import { freshObjectRoom } from './support/object-room.js';

for (const under of [DB_FLOOR, DB_ICE] as const) {
    void test(`hurtling past a raised bridge over ${under === DB_FLOOR ? 'ground' : 'ice'} keeps moving`, async () => {
        const level = freshObjectRoom({ hero: { swimming: true } });
        const square = level.requireAt(11, 10);
        square.typ = DRAWBRIDGE_UP;
        square.drawbridgemask = under;

        await hurtleHero(1, 0, 2);

        assert.equal(game.u.ux, 12);
        assert.ok(!game.u.uinwater);
        assert.equal(game._helplessTurns, 2);
    });
}

void test('hurtling over a raised drawbridge names its moat', async () => {
    const level = freshObjectRoom();
    const square = level.requireAt(11, 10);
    square.typ = DRAWBRIDGE_UP;
    square.drawbridgemask = DB_MOAT;
    game.u.flying = true;
    pushKeys(' '.repeat(10));

    await hurtleHero(1, 0, 1);

    assert.match(game._pending_message, /You move over a moat/);
});

void test('moving toward lava below a raised bridge does not help escape lava', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    game.u.utrap = 4;
    game.u.utraptype = TT_LAVA;
    level.requireAt(10, 10).typ = DRAWBRIDGE_UP;
    level.requireAt(10, 10).drawbridgemask = DB_LAVA;
    level.requireAt(11, 10).typ = DRAWBRIDGE_UP;
    level.requireAt(11, 10).drawbridgemask = DB_LAVA;
    pushKeys(' '.repeat(10));

    await rhack('l'.charCodeAt(0));

    assert.equal(game.u.utrap, 4);
    assert.equal(game.u.ux, 10);
});

void test('the levitation countdown stays quiet above dry ground below a raised bridge', async () => {
    const level = freshObjectRoom();
    const square = level.requireAt(10, 10);
    square.typ = DRAWBRIDGE_UP;
    square.drawbridgemask = DB_FLOOR;
    game.u.levitationTurns = 3;
    refreshProperty('levitation');
    const messages: string[] = [];

    await levitationDialogue(game, { publish: message => { messages.push(message); } });

    assert.deepEqual(messages, []);
});
