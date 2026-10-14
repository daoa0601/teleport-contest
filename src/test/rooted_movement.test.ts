import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

for (const levitating of [false, true]) {
    void test(`a blue jelly stays rooted ${levitating ? 'while levitating' : 'on the ground'}`, async () => {
        freshObjectRoom();
        installPolymorphedHero('blue jelly');
        if (levitating) grantIntrinsicProperty('levitation', 'outside');

        await rhack('l'.charCodeAt(0));

        assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
        assert.equal(game.context.move, 1);
        assert.equal(game._pending_message, `You are rooted ${levitating ? 'in place' : 'to the ground'}.`);
    });
}
