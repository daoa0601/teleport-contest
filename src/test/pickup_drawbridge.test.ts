import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { DB_FLOOR, DB_ICE, DB_LAVA, DRAWBRIDGE_UP } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { DIAMOND } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const under of [DB_FLOOR, DB_ICE] as const) {
    void test(`pickup can reach an object below a raised bridge over ${under === DB_FLOOR ? 'ground' : 'ice'}`, async () => {
        const level = freshObjectRoom();
        const square = level.requireAt(10, 10);
        square.typ = DRAWBRIDGE_UP;
        square.drawbridgemask = under;
        const gem = await floorObject(DIAMOND, 10, 10);
        pushKeys(' '.repeat(10));

        await rhack(','.charCodeAt(0));

        assert.ok(game.inventory.includes(gem));
        assert.equal(gem.where, 'inventory');
    });
}

for (const under of [DB_FLOOR, DB_ICE, DB_LAVA] as const) {
    void test(`the raised bridge underlay ${under} does not cover floor objects`, async () => {
        const level = freshObjectRoom();
        const square = level.requireAt(11, 10);
        square.typ = DRAWBRIDGE_UP;
        square.drawbridgemask = under;
        await floorObject(DIAMOND, 11, 10);

        newsym(11, 10);

        assert.equal(glyphAt(11, 10)?.kind, 'object');
    });
}
