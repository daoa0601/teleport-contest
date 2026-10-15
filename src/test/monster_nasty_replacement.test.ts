import assert from 'node:assert/strict';
import test from 'node:test';
import { G_GENOD } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { finishSpellTurn, prepareSpellCaster } from './support/monster-spells.js';

void test('a monster replaces genocided summon-nasties choices with ordinary monsters', async () => {
    let summoned = false;
    for (let seed = 1; seed <= 64 && !summoned; seed++) {
        const caster = await prepareSpellCaster('arch-lich', 17);
        requirePlayingGame(game);
        game.u.ulevel = 1;
        game.u.uz.dlevel = 1;
        game.level.flags.rndmongen = true;
        game.mvitals ??= [];
        for (const [species, name] of MONSTER_NAME.entries()) {
            const vital = game.mvitals[species] ??= { born: 0, died: 0, mvflags: 0 };
            if (name !== 'goblin') vital.mvflags |= G_GENOD;
        }

        const messages = await finishSpellTurn(seed);

        if (/monster.*appears? from nowhere/i.test(messages)) {
            const replacements = game.level.monsters.filter(monster => monster !== caster && !monster.dead);
            assert.ok(replacements.length > 0, 'A successful summon must create monsters');
            assert.ok(replacements.every(monster => MONSTER_NAME[monster.mnum] === 'goblin'),
                'Only a surviving, non-genocided species may replace the direct choice');
            summoned = true;
        }
    }
    assert.ok(summoned, 'Summon nasties must still work when every nasty species is genocided');
});

for (const { casterSpecies, forbiddenSpecies } of [
    { casterSpecies: 'Orcus', forbiddenSpecies: 'Archon' },
    { casterSpecies: 'Archon', forbiddenSpecies: 'amorous demon' },
    { casterSpecies: 'Orcus', forbiddenSpecies: 'Aleax' },
    { casterSpecies: 'Archon', forbiddenSpecies: 'horned devil' },
]) {
    void test(`${casterSpecies} cannot summon ${forbiddenSpecies} when other species are genocided`, async () => {
        let castSpell = false;
        for (let seed = 1; seed <= 64; seed++) {
            const caster = await prepareSpellCaster(casterSpecies, 30);
            requirePlayingGame(game);
            game.u.ulevel = 30;
            game.u.uz.dlevel = 30;
            game.u.antimagic = true;
            game.u.deafTurns = 100;
            game.level.flags.rndmongen = true;
            genocideOtherSpecies(forbiddenSpecies);

            const messages = await finishSpellTurn(seed);

            castSpell ||= (caster.mspec_used ?? 0) > 0;
            // Ordinary world spawns may still occur; this feedback belongs
            // specifically to a successful summon-nasties spell.
            assert.doesNotMatch(messages, /monster.*appears? from nowhere/i,
                `${casterSpecies} must reject ${forbiddenSpecies} in game ${seed}`);
        }
        assert.ok(castSpell, `${casterSpecies} must have opportunities to cast spells`);
    });
}

void test('a demon retains dragon replacements for genocided summon-nasties choices', async () => {
    let summoned = false;
    for (let seed = 1; seed <= 64 && !summoned; seed++) {
        const caster = await prepareSpellCaster('Orcus', 30);
        requirePlayingGame(game);
        game.u.ulevel = 30;
        game.u.uz.dlevel = 30;
        game.u.antimagic = true;
        game.u.deafTurns = 100;
        game.level.flags.rndmongen = true;
        // White dragons are outside nasties[], so they can only replace a
        // genocided choice rather than being selected directly.
        genocideOtherSpecies('white dragon');

        const messages = await finishSpellTurn(seed);

        if (/monster.*appears? from nowhere/i.test(messages)) {
            const dragons = game.level.monsters.filter(monster =>
                monster !== caster && !monster.dead
                && MONSTER_NAME[monster.mnum] === 'white dragon');
            assert.ok(dragons.length > 0, 'A demon may keep a summoned dragon');
            summoned = true;
        }
    }
    assert.ok(summoned, 'A demon must be able to replace genocided nasties with dragons');
});

function genocideOtherSpecies(survivor: string): void {
    game.mvitals ??= [];
    for (const [species, name] of MONSTER_NAME.entries()) {
        const vital = game.mvitals[species] ??= { born: 0, died: 0, mvflags: 0 };
        if (name !== survivor) vital.mvflags |= G_GENOD;
    }
}
