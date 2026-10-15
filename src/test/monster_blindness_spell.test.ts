import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { BLINDFOLD } from '../js/object_data.js';
import { syncBlindness } from '../js/senses.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { finishSpellTurn, prepareSpellCaster } from './support/monster-spells.js';

for (const body of ['blindfolded human', 'Cyclops']) {
    void test(`a cleric blinds a ${body} with scales`, async () => {
        let cast = false;
        for (let seed = 1; seed <= 64 && !cast; seed++) {
            await prepareSpellCaster('aligned cleric', 8);
            if (body === 'Cyclops') {
                installPolymorphedHero('Cyclops', { hitPoints: 500 });
                game.u.uac = -1000;
            } else {
                game.ublindf = await addInventoryObject(BLINDFOLD);
                syncBlindness(game);
            }

            const messages = await finishSpellTurn(seed);

            if (/Scales cover/.test(messages)) {
                assert.match(messages, body === 'Cyclops' ? /Scales cover your eye!/ : /Scales cover your eyes!/);
                assert.ok((game.u.blindTurns ?? 0) > 0, 'Scales cause timed blindness even under a blindfold');
                cast = true;
            }
        }
        assert.ok(cast, `The cleric should blind the ${body}`);
    });
}
