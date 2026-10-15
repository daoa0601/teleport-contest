import assert from 'node:assert/strict';
import test from 'node:test';
import { ICE, ICED_POOL, MOAT, POOL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishSpellTurn, prepareSpellCaster } from './support/monster-spells.js';
import { memoryStorage } from './support/memory-storage.js';

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

void test('a fire pillar stops damaging the hero after its melting ice causes fatal drowning', async () => {
    let drowned = false;
    for (let seed = 1; seed <= 64 && !drowned; seed++) {
        const caster = await prepareSpellCaster('aligned cleric', 13);
        requirePlayingGame(game);
        for (let x = 7; x <= 16; x++) {
            for (let y = 6; y <= 14; y++) {
                if (x !== caster.mx || y !== caster.my) game.level.requireAt(x, y).typ = MOAT;
            }
        }
        const square = game.level.requireAt(game.u.ux, game.u.uy);
        square.typ = ICE;
        square.icedpool = ICED_POOL;
        game.storage = memoryStorage();
        game.flags.disclose = '-i -a -v -c -o';

        const messages = await finishSpellTurn(seed);

        if (game.program_state.gameover && messages.includes('A pillar of fire')) {
            assert.equal(game.u.uhp, 0, 'Death completes before the pillar can apply its pending HP damage');
            drowned = true;
        }
    }
    assert.ok(drowned, 'Melting the only ice amid deep water should drown the hero');
});

