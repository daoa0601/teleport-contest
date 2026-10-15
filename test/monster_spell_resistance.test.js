import assert from 'node:assert/strict';
import test from 'node:test';
import { MFAST, M_SEEN_MAGR, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { createMonsterAt } from './support/monsters.js';
import { finishSpellTurn, prepareSpellCaster } from './support/monster-spells.js';
for (const antimagic of [true, false]) {
    void test(`psi bolts ${antimagic ? 'reveal' : 'disprove'} magic protection to watching monsters`, async () => {
        let cast = false;
        for (let seed = 1; seed <= 32 && !cast; seed++) {
            const caster = await prepareSpellCaster('kobold shaman', 3);
            requirePlayingGame(game);
            caster.permspeed = MFAST;
            game.u.antimagic = antimagic;
            const witness = await createMonsterAt('hill orc', 14, 10, NO_MINVENT);
            witness.msleeping = 1;
            witness.movement = 0;
            witness.seen_resistance = antimagic ? 0 : M_SEEN_MAGR;
            const messages = await finishSpellTurn(seed);
            if (/headache|brain is on fire|head suddenly aches/.test(messages)) {
                assert.equal(!!((witness.seen_resistance ?? 0) & M_SEEN_MAGR), antimagic, 'A visible spell result updates the observer’s knowledge');
                assert.ok(game.u.uhp < 500, 'Antimagic halves psi damage rather than cancelling it');
                cast = true;
            }
        }
        assert.ok(cast, 'A shaman should land a psi bolt');
    });
}
for (const [species, level, feedback] of [
    ['kobold shaman', 5, /momentarily disoriented/],
    ['kobold shaman', 8, /momentarily weakened/],
    ['aligned cleric', 4, /momentarily dizzy/],
    ['aligned cleric', 6, /stiffen briefly/],
]) {
    void test(`${feedback.source} reveals magic protection to the caster`, async () => {
        let cast = false;
        for (let seed = 1; seed <= 64 && !cast; seed++) {
            const caster = await prepareSpellCaster(species, level);
            game.u.antimagic = true;
            const messages = await finishSpellTurn(seed);
            if (feedback.test(messages)) {
                assert.ok((caster.seen_resistance ?? 0) & M_SEEN_MAGR, `The resisted spell must reveal protection: ${messages}`);
                cast = true;
            }
        }
        assert.ok(cast, `A caster should produce ${feedback.source}`);
    });
}
//# sourceMappingURL=monster_spell_resistance.test.js.map