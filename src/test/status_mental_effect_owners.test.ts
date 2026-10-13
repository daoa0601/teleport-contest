import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { bot, flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { advanceHeroVomiting, startHeroVomiting } from '../js/hero_illness.js';
import { pushKeys } from '../js/input.js';
import { tryKnockback } from '../js/knockback.js';
import { AD_PHYS, AT_WEAP } from '../js/monster_attack_types.js';
import { applyHeroContactPassive } from '../js/monster_passive.js';
import { fixPrayerTrouble, Trouble } from '../js/prayer_trouble.js';
import { throneSitEffect } from '../js/throne.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('yellow mold contact displays its new stun condition', async () => {
    freshObjectRoom();
    const mold = await createMonsterAt('yellow mold', 11, 10, NO_MINVENT);
    await bot();

    await applyHeroContactPassive(mold, { hit: true, random: () => 1, rollDice: () => 3 });
    await flush_screen(1);

    assert.equal(game.u.stunnedTurns, 3);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\bStun\b/);
});

for (const [turns, conditions] of [[10, /\bConf\b/], [7, /\bConf Stun\b/]] as const) {
    void test(`nausea with ${turns} turns remaining displays its new impairments`, async () => {
        freshObjectRoom();
        startHeroVomiting({ turns });
        await bot();

        await advanceHeroVomiting();
        await flush_screen(1);

        assert.ok((game.u.confusionTurns ?? 0) > 0);
        assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), conditions);
    });
}

void test('a giant knockback displays the resulting stun', async () => {
    freshObjectRoom();
    installPolymorphedHero('kobold');
    const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
    await bot();
    pushKeys(' '.repeat(10));

    await tryKnockback(giant, game.u, { attackType: AT_WEAP, damageType: AD_PHYS }, { random: () => 0 });
    await flush_screen(1);

    assert.equal(game.u.ux, 8);
    assert.equal(game.u.stunnedTurns, 3);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\bStun\b/);
});

for (const effect of [10, 13]) {
    void test(`throne effect ${effect} displays confusion`, async () => {
        const level = freshObjectRoom({ gameplaySeed: 8n, flags: { debug: true }, hero: { uluck: -1 } });
        level.flags.nommap = true;
        await bot();
        pushKeys(`${effect}\n${' '.repeat(10)}`);

        await throneSitEffect();
        await flush_screen(1);

        assert.ok((game.u.confusionTurns ?? 0) > 0);
        assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\bConf\b/);
    });
}

void test('a throne curse displays the blindness it inflicts', async () => {
    freshObjectRoom({ gameplaySeed: 8n, flags: { debug: true }, hero: { uluck: 1 } });
    await bot();
    pushKeys(`9\n${' '.repeat(10)}`);

    await throneSitEffect();
    await flush_screen(1);

    assert.ok((game.u.blindTurns ?? 0) > 0);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\bBlind\b/);
});

for (const [trouble, hero, label] of [
    [Trouble.STUNNED, { stunnedTurns: 5, stunned: true }, 'Stun'],
    [Trouble.CONFUSED, { confusionTurns: 5 }, 'Conf'],
] as const) {
    void test(`prayer removes the displayed ${label} condition`, async () => {
        freshObjectRoom({ hero });
        await bot();

        await fixPrayerTrouble(trouble);
        await flush_screen(1);

        assert.doesNotMatch(requireScreenRow(23).map(cell => cell.ch).join(''), new RegExp(`\\b${label}\\b`));
    });
}
