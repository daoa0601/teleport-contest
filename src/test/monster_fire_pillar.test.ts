import assert from 'node:assert/strict';
import test from 'node:test';
import { ICE, ICED_POOL, POOL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishSpellTurn, prepareSpellCaster } from './support/monster-spells.js';

void test('a clerical fire pillar melts ice even when the hero resists fire', async () => {
    let cast = false;
    for (let seed = 1; seed <= 64 && !cast; seed++) {
        await prepareSpellCaster('aligned cleric', 13);
        requirePlayingGame(game);
        game.u.fireResistance = true;
        game.u.waterWalking = true;
        const square = game.level.requireAt(game.u.ux, game.u.uy);
        square.typ = ICE;
        square.icedpool = ICED_POOL;

        const messages = await finishSpellTurn(seed);

        if (messages.includes('A pillar of fire')) {
            assert.equal(square.typ, POOL, messages);
            cast = true;
        }
    }
    assert.ok(cast, 'The cleric should cast a fire pillar');
});

