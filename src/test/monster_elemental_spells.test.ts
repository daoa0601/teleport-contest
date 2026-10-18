import { objectTypeKnown } from '../js/shk.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { IRONBARS, M_SEEN_ELEC, M_SEEN_REFL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { AMULET_OF_REFLECTION } from '../js/object_data.js';
import { syncBlindness } from '../js/senses.js';
import { addInventoryObject } from './support/game-objects.js';
import { finishSpellTurn, prepareSpellCaster } from './support/monster-spells.js';

void test('an Amulet reflects clerical lightning before it damages the hero or the floor', async () => {
    let cast = false;
    for (let seed = 1; seed <= 64 && !cast; seed++) {
        const caster = await prepareSpellCaster('aligned cleric', 12);
        requirePlayingGame(game);
        const amulet = await addInventoryObject(AMULET_OF_REFLECTION, { typeKnown: false });
        await wearHeroAccessory(amulet, 'uamul');
        const square = game.level.requireAt(game.u.ux, game.u.uy);
        square.typ = IRONBARS;

        const messages = await finishSpellTurn(seed);

        if (messages.includes('A bolt of lightning')) {
            assert.match(messages, /It bounces off your medallion\./);
            assert.equal(game.u.uhp, 500);
            assert.equal(square.typ, IRONBARS);
            assert.equal(objectTypeKnown(amulet), true);
            assert.ok((caster.seen_resistance ?? 0) & M_SEEN_REFL);
            assert.doesNotMatch(messages, /blinded by the flash/);
            cast = true;
        }
    }
    assert.ok(cast, 'The cleric should cast lightning');
});

void test('a blind hero resists the flash from clerical lightning', async () => {
    let cast = false;
    for (let seed = 1; seed <= 64 && !cast; seed++) {
        const caster = await prepareSpellCaster('aligned cleric', 12);
        game.u.blindTurns = 100;
        game.u.shockResistance = true;
        syncBlindness(game);

        const messages = await finishSpellTurn(seed);

        if (messages.includes('A bolt of lightning')) {
            assert.doesNotMatch(messages, /blinded by the flash/);
            assert.equal(game.u.blindTurns, 99, 'The flash does not extend existing blindness');
            assert.ok((caster.seen_resistance ?? 0) & M_SEEN_ELEC);
            cast = true;
        }
    }
    assert.ok(cast, 'The cleric should cast lightning at a blind hero');
});
