import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN, POOL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { freshGameplayRoom } from './support/playable-room.js';

for (const hallucinating of [false, true]) {
    void test(`empty fountain pickup describes ${hallucinating ? 'a hallucinated liquid' : 'water'}`, async () => {
        const level = freshGameplayRoom({
            seed: 1n,
            hero: { hallucinationTurns: hallucinating ? 20 : 0 },
        });
        level.requireAt(10, 10).typ = FOUNTAIN;

        await rhack(','.charCodeAt(0));

        assert.match(game._pending_message, /^You could drink the .+\.\.\.$/);
        if (hallucinating)
            assert.notEqual(game._pending_message, 'You could drink the water...');
        else
            assert.equal(game._pending_message, 'You could drink the water...');
        assert.equal(game.context.move, 0);
    });

    void test(`pickup above a pool describes ${hallucinating ? 'a hallucinated liquid' : 'water'}`, async () => {
        const level = freshGameplayRoom({
            seed: 1n,
            hero: { waterWalking: true, hallucinationTurns: hallucinating ? 20 : 0 },
        });
        level.requireAt(10, 10).typ = POOL;

        await rhack(','.charCodeAt(0));

        assert.match(game._pending_message, /^You cannot dive into the .+ to pick things up\.$/);
        if (hallucinating)
            assert.notEqual(game._pending_message, 'You cannot dive into the water to pick things up.');
        else
            assert.equal(game._pending_message, 'You cannot dive into the water to pick things up.');
        assert.equal(game.context.move, 0);
    });
}
