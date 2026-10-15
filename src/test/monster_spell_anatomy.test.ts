import assert from 'node:assert/strict';
import test from 'node:test';
import { MFAST } from '../js/const.js';
import { game } from '../js/gstate.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { finishSpellTurn, prepareSpellCaster } from './support/monster-spells.js';

void test('a psi bolt describes the hero’s current elemental body', async () => {
    let cast = false;
    for (let seed = 1; seed <= 32 && !cast; seed++) {
        const caster = await prepareSpellCaster('kobold shaman', 3);
        caster.permspeed = MFAST;
        installPolymorphedHero('fire elemental', { hitPoints: 500 });
        game.u.uac = -1000;
        game.u.halfSpellDamage = true;

        const messages = await finishSpellTurn(seed);

        if (/slight .*ache/.test(messages)) {
            assert.match(messages, /You get a slight central coreache\./);
            cast = true;
        }
    }
    assert.ok(cast, 'The shaman should land a small psi bolt');
});

void test('an unseen lich’s death spell uses an unseen speaker pronoun', async () => {
    let cast = false;
    for (let seed = 1; seed <= 128 && !cast; seed++) {
        const lich = await prepareSpellCaster('arch-lich', 21);
        lich.minvis = 1;
        game.u.antimagic = true;

        const messages = await finishSpellTurn(seed);

        if (messages.includes('using the touch of death')) {
            assert.match(messages, /Oh no, it's using the touch of death!/);
            cast = true;
        }
    }
    assert.ok(cast, 'The unseen lich should attempt the touch of death');
});
