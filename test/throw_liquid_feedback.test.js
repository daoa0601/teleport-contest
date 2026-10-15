import assert from 'node:assert/strict';
import test from 'node:test';
import { LAVAPOOL, POOL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CLUB, DIAMOND, TALLOW_CANDLE, TOUCHSTONE } from '../js/object_data.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
for (const landing of [
    { name: 'a touchstone into water', type: TOUCHSTONE, terrain: POOL, sound: 'Splash!', survives: true },
    { name: 'a diamond into water', type: DIAMOND, terrain: POOL, sound: 'Plop!', survives: true },
    { name: 'a touchstone into lava', type: TOUCHSTONE, terrain: LAVAPOOL, sound: 'Splash!', survives: true },
    { name: 'a candle into lava', type: TALLOW_CANDLE, terrain: LAVAPOOL, sound: 'Plop!', survives: false },
    { name: 'a wooden club into lava', type: CLUB, terrain: LAVAPOOL, sound: null, survives: false },
]) {
    void test(`throwing ${landing.name} ${landing.sound ? `makes a ${landing.sound}` : 'burns without a splash'}`, async () => {
        const level = freshObjectRoom({ right: 20 });
        for (let x = 11; x <= 20; x++)
            level.requireAt(x, 10).typ = landing.terrain;
        const object = await addInventoryObject(landing.type);
        const messages = [];
        resetInputState().beforeRead = () => { messages.push(game._pending_message); };
        await throwInventoryObject(object, 'l', ' '.repeat(20));
        const text = messages.join('\n') + '\n' + game._pending_message;
        if (landing.sound)
            assert.ok(text.includes(landing.sound), text);
        else
            assert.doesNotMatch(text, /Splash!|Plop!/);
        if (landing.type === TALLOW_CANDLE) {
            assert.match(text, /It burns up!/);
            assert.ok(text.indexOf('Plop!') < text.indexOf('It burns up!'), text);
        }
        assert.equal(object.where, landing.survives ? 'floor' : 'gone');
        assert.equal(game.inventory.includes(object), false);
        assert.equal(game.context.move, 1);
    });
}
for (const condition of ['deaf', 'underwater']) {
    void test(`throwing a touchstone into water makes no sound while ${condition}`, async () => {
        const level = freshObjectRoom({ right: 20, hero: { deafTurns: condition === 'deaf' ? 20 : 0 } });
        for (let x = 11; x <= 20; x++)
            level.requireAt(x, 10).typ = POOL;
        game.underwater = game.u.uinwater = condition === 'underwater';
        if (game.u.uinwater)
            level.requireAt(game.u.ux, game.u.uy).typ = POOL;
        const stone = await addInventoryObject(TOUCHSTONE);
        const messages = [];
        resetInputState().beforeRead = () => { messages.push(game._pending_message); };
        await throwInventoryObject(stone, 'l', ' '.repeat(20));
        assert.doesNotMatch(messages.join('\n') + '\n' + game._pending_message, /Splash!|Plop!/);
        assert.equal(stone.where, 'floor');
        assert.equal(game.context.move, 1);
    });
}
//# sourceMappingURL=throw_liquid_feedback.test.js.map