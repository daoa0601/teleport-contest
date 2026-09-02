import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { useHeroWereSummon } from '../js/were.js';
import { runMonsterAbilityCommand } from './support/commands.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';

function installWerewolfHero(energy) {
    return freshRoomWithPolymorphedHero('werewolf', {
        left: 2,
        right: 30,
        top: 3,
        bottom: 17,
        heroX: 10,
        heroY: 10,
        gameplaySeed: 314,
        polymorph: {
            uen: energy,
            uenmax: energy,
        },
    });
}

test('a werewolf uses #monster to call tame wolves', async () => {
    const level = installWerewolfHero(30);
    await runMonsterAbilityCommand(' '.repeat(8));

    const helpers = level.monsters.filter(monster => monster.mtame > 0);
    assert.ok(helpers.length >= 1 && helpers.length <= 5);
    assert.ok(helpers.every(monster =>
        ['wolf', 'warg', 'winter wolf'].includes(MONSTER_NAME[monster.mnum])));
    assert.equal(game.u.uen, 20);
    assert.equal(game.context.move, 1);
});

test('a were-creature without enough energy cannot call help', async () => {
    const level = installWerewolfHero(9);

    const result = await useHeroWereSummon({
        state: game,
        publish: async () => undefined,
    });

    assert.equal(result.reason, 'energy');
    assert.equal(result.spentTime, false);
    assert.equal(game.u.uen, 9);
    assert.equal(level.monsters.length, 0);
});
