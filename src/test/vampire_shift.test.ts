import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { G_GENOD, POLY_CONTROLLED, POLY_REVERT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { polymonHero, polymorphHero } from '../js/polyself.js';
import { pushKeys } from '../js/input.js';
import { useHeroVampireShift } from '../js/vampire_shift.js';
import {
    runMonsterAbilityCommand,
} from './support/commands.js';
import {
    freshHeroConditionRoom, freshMonsterAbilityRoom,
    wearPolymorphControlRing,
} from './support/hero-state.js';

const PM_WOLF = MONSTER_NAME.indexOf('wolf');
const PM_FOG_CLOUD = MONSTER_NAME.indexOf('fog cloud');
const PM_VAMPIRE_BAT = MONSTER_NAME.indexOf('vampire bat');
const PM_VAMPIRE = MONSTER_NAME.indexOf('vampire');
const PM_VAMPIRE_LEADER = MONSTER_NAME.indexOf('vampire leader');

void test('a vampire uses #monster to assume one of its animal forms', async () => {
    freshMonsterAbilityRoom('vampire', { gameplaySeed: 8231n });
    requirePlayingGame(game);
    game.u.mcham = PM_VAMPIRE;

    await runMonsterAbilityCommand(' '.repeat(4));

    assert.ok([PM_FOG_CLOUD, PM_VAMPIRE_BAT].includes(game.u.umonnum));
    assert.equal(game.u.mcham, PM_VAMPIRE);
    assert.equal(game.context.move, 1);
});

void test('ordinary polymorph records the vampire form across later shifts',
    async () => {
        freshHeroConditionRoom({
            role: 'archeologist', hero: { umonster: 0 },
        });
        requirePlayingGame(game);
        await polymonHero(PM_VAMPIRE, { announceForm: false });

        pushKeys('                ');
        await useHeroVampireShift();

        assert.ok([PM_VAMPIRE_BAT, PM_FOG_CLOUD].includes(game.u.umonnum));
        assert.equal(game.u.mcham, PM_VAMPIRE);
    });

void test('a shifted vampire can return to its vampire form', async () => {
    freshMonsterAbilityRoom('vampire bat');
    requirePlayingGame(game);
    game.u.mcham = PM_VAMPIRE;

    pushKeys('                ');
    const result = await polymorphHero(POLY_REVERT);

    assert.equal(result.transformed, true);
    assert.equal(game.u.umonnum, PM_VAMPIRE);
    assert.equal(game.u.mcham, PM_VAMPIRE);
});

void test('a vampire leader can take wolf form', async () => {
    freshMonsterAbilityRoom('vampire leader');
    requirePlayingGame(game);
    game.u.mcham = PM_VAMPIRE_LEADER;

    pushKeys('wolf\n                ');
    await polymorphHero(POLY_CONTROLLED);

    assert.equal(game.u.umonnum, PM_WOLF);
    assert.equal(game.u.mcham, PM_VAMPIRE_LEADER);
});

void test('polymorph control can decline a vampire form without saving time',
    async () => {
        freshMonsterAbilityRoom('vampire');
        requirePlayingGame(game);
        game.u.mcham = PM_VAMPIRE;
        await wearPolymorphControlRing();

        await runMonsterAbilityCommand('n');

        assert.equal(game.u.umonnum, PM_VAMPIRE);
        assert.equal(game.context.move, 1);
    });

void test('unchanging prevents vampire shape changing but still uses a turn',
    async () => {
        freshMonsterAbilityRoom('vampire');
        requirePlayingGame(game);
        game.u.mcham = PM_VAMPIRE;
        game.u.unchanging = true;

        await runMonsterAbilityCommand();

        assert.equal(game.u.umonnum, PM_VAMPIRE);
        assert.equal(game.context.move, 1);
        assert.match(game._pending_message, /fail to transform/);
    });

void test('a genocided animal form leaves the vampire unchanged', async () => {
    freshMonsterAbilityRoom('vampire');
    requirePlayingGame(game);
    game.u.mcham = PM_VAMPIRE;
    assert.ok(game.mvitals);
    const vampireBat = game.mvitals[PM_VAMPIRE_BAT];
    assert.ok(vampireBat);
    vampireBat.mvflags = G_GENOD;
    pushKeys('vampire bat\n                ');
    await polymorphHero(POLY_CONTROLLED);

    assert.equal(game.u.umonnum, PM_VAMPIRE);
    assert.match(game._pending_message, /feel rather vampire bat-ish/);
});
