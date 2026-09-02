import test from 'node:test';
import assert from 'node:assert/strict';

import { G_GENOD } from '../js/const.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { polymonHero } from '../js/polyself.js';
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

test('a vampire uses #monster to assume one of its animal forms', async () => {
    freshMonsterAbilityRoom('vampire', { gameplaySeed: 8231n });
    game.u.mcham = PM_VAMPIRE;

    await runMonsterAbilityCommand(' '.repeat(4));

    assert.ok([PM_FOG_CLOUD, PM_VAMPIRE_BAT].includes(game.u.umonnum));
    assert.equal(game.u.mcham, PM_VAMPIRE);
    assert.equal(game.context.move, 1);
});

test('ordinary polymorph records the vampire form across later shifts',
    async () => {
        freshHeroConditionRoom({
            role: { key: 'archeologist', mnum: 0 },
        });
        await polymonHero(PM_VAMPIRE, { announceForm: false });

        await useHeroVampireShift({
            random: () => 1,
            publish: async () => {},
        });

        assert.equal(game.u.umonnum, PM_VAMPIRE_BAT);
        assert.equal(game.u.mcham, PM_VAMPIRE);
    });

test('a shifted vampire can return to its vampire form', async () => {
    freshMonsterAbilityRoom('vampire bat');
    game.u.mcham = PM_VAMPIRE;

    const result = await useHeroVampireShift({
        random: () => 0,
        publish: async () => {},
    });

    assert.equal(result.changed, true);
    assert.equal(game.u.umonnum, PM_VAMPIRE);
    assert.equal(game.u.mcham, PM_VAMPIRE);
});

test('a vampire leader can take wolf form', async () => {
    freshMonsterAbilityRoom('vampire leader');
    game.u.mcham = PM_VAMPIRE_LEADER;

    await useHeroVampireShift({
        random: () => 0,
        publish: async () => {},
    });

    assert.equal(game.u.umonnum, PM_WOLF);
    assert.equal(game.u.mcham, PM_VAMPIRE_LEADER);
});

test('polymorph control can decline a vampire form without saving time',
    async () => {
        freshMonsterAbilityRoom('vampire');
        game.u.mcham = PM_VAMPIRE;
        wearPolymorphControlRing();

        await runMonsterAbilityCommand('n');

        assert.equal(game.u.umonnum, PM_VAMPIRE);
        assert.equal(game.context.move, 1);
    });

test('unchanging prevents vampire shape changing but still uses a turn',
    async () => {
        freshMonsterAbilityRoom('vampire');
        game.u.mcham = PM_VAMPIRE;
        game.u.unchanging = true;

        await runMonsterAbilityCommand();

        assert.equal(game.u.umonnum, PM_VAMPIRE);
        assert.equal(game.context.move, 1);
        assert.match(game._pending_message, /fail to transform/);
    });

test('a genocided animal form leaves the vampire unchanged', async () => {
    freshMonsterAbilityRoom('vampire');
    game.u.mcham = PM_VAMPIRE;
    game.mvitals = [];
    game.mvitals[PM_VAMPIRE_BAT] = { mvflags: G_GENOD };
    const messages = [];

    await useHeroVampireShift({
        random: () => 1,
        publish: async message => messages.push(message),
    });

    assert.equal(game.u.umonnum, PM_VAMPIRE);
    assert.deepEqual(messages, ['You feel rather vampire bat-ish.']);
});
