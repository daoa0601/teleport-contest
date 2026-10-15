import test from 'node:test';
import assert from 'node:assert/strict';
import { DB_MOAT, DRAWBRIDGE_UP, MOAT, POOL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { DAGGER, DIAMOND, POT_WATER } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const bridge of [false, true]) {
    void test(`a thrown gem splashes when landing in ${bridge ? 'water below a raised bridge' : 'a moat'}`, async () => {
        const level = freshObjectRoom({ right: 25 });
        const square = level.requireAt(16, 10);
        square.typ = bridge ? DRAWBRIDGE_UP : MOAT;
        square.drawbridgemask = DB_MOAT;
        const gem = await addInventoryObject(DIAMOND);

        await throwInventoryObject(gem, 'l', ' '.repeat(10));

        assert.equal(gem.ox, 16);
        assert.equal(gem.oy, 10);
        assert.match(game._pending_message, /Plop!/);
    });
}

for (const [type, terrain, description, sound] of [
    [DAGGER, POOL, 'a dagger into a pool', 'Splash!'],
    [DIAMOND, POOL, 'a gem into a pool', 'Plop!'],
    [DAGGER, DRAWBRIDGE_UP, 'a dagger into water below a raised bridge', 'Splash!'],
    [POT_WATER, POOL, 'a potion into a pool', 'Splash!'],
] as const) {
    void test(`throwing ${description} downward while levitating makes one ${sound}`, async () => {
        const level = freshObjectRoom();
        const square = level.requireAt(game.u.ux, game.u.uy);
        square.typ = terrain;
        square.drawbridgemask = DB_MOAT;
        grantIntrinsicProperty('levitation', 'outside');
        const object = await addInventoryObject(type);

        await throwInventoryObject(object, '>', ' '.repeat(10));

        assert.equal(game._pending_message, sound);
        assert.equal(object.where, 'floor');
        assert.equal(object.ox, game.u.ux);
        assert.equal(object.oy, game.u.uy);
        assert.equal(game.context.move, 1);
    });
}
