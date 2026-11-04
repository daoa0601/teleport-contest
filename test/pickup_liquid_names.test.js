import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN, POOL } from '../js/const.js';
import { displayLiquidName } from '../js/do_name.js';
import { game } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { freshGameplayRoom } from './support/playable-room.js';
for (const { hallucinating, seed } of [
    { hallucinating: false, seed: 1n },
    { hallucinating: true, seed: 1n },
    { hallucinating: true, seed: 36n },
]) {
    void test(`empty fountain pickup uses liquid names (hallucinating=${hallucinating}, seed=${seed})`, async () => {
        const level = freshGameplayRoom({
            seed,
            hero: { hallucinationTurns: hallucinating ? 20 : 0 },
        });
        level.requireAt(10, 10).typ = FOUNTAIN;
        const liquids = [displayLiquidName('water'), displayLiquidName('water')];
        initRng(seed);
        for (const liquid of liquids) {
            game._pending_message = '';
            await rhack(','.charCodeAt(0));
            assert.equal(game._pending_message, `You could drink the ${liquid}...`);
            assert.equal(game.context.move, 0);
        }
    });
    void test(`pickup above a pool uses liquid names (hallucinating=${hallucinating}, seed=${seed})`, async () => {
        const level = freshGameplayRoom({
            seed,
            hero: { waterWalking: true, hallucinationTurns: hallucinating ? 20 : 0 },
        });
        level.requireAt(10, 10).typ = POOL;
        const liquids = [displayLiquidName('water'), displayLiquidName('water')];
        initRng(seed);
        for (const liquid of liquids) {
            game._pending_message = '';
            await rhack(','.charCodeAt(0));
            assert.equal(game._pending_message, `You cannot dive into the ${liquid} to pick things up.`);
            assert.equal(game.context.move, 0);
        }
    });
}
//# sourceMappingURL=pickup_liquid_names.test.js.map