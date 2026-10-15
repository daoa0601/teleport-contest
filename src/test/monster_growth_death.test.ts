import assert from 'node:assert/strict';
import test from 'node:test';

import { G_GENOD, M_ATTK_AGR_DIED, M_ATTK_DEF_DIED, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { AD_PHYS, AT_WEAP } from '../js/monster_attack_types.js';
import { resolveMonsterCombatDamage } from '../js/monster_combat_damage.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE } from '../js/object_data.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a monster that grows into a genocided adult leaves that body behind', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const kop = await createMonsterAt('Keystone Kop', 11, 10, NO_MINVENT);
    kop.female = true;
    kop.m_lev = 1;
    kop.mhp = kop.mhpmax = 8;
    const adult = MONSTER_NAME.indexOf('Kop Sergeant');
    requireMonsterVital(adult).mvflags |= G_GENOD;
    const defender = await createMonsterAt('orc', 12, 10, NO_MINVENT);
    defender.mhp = 1;

    const result = await resolveMonsterCombatDamage(kop, defender, [AT_WEAP, AD_PHYS, 1, 4], {
        state: game, visible: true, random: limit => limit === 3 ? 0 : limit === 5 ? 4 : 1,
        rollOne: () => 1, rollDice: count => count, publish: () => {},
    });

    assert.equal(result.nativeResult, M_ATTK_AGR_DIED | M_ATTK_DEF_DIED);
    assert.equal(kop.dead, true);
    assert.equal(kop.female, true, 'fatal growth occurs before the new form changes gender');
    assert.ok(floorObjectsAt(game.level, 11, 10).some(object =>
        object.otyp === CORPSE && object.corpsenm === adult),
    'mondied leaves the adult corpse after fatal growth');
    assert.equal(requireMonsterVital(adult).died, 1);
    assert.equal(game.u.uconduct?.killer ?? 0, 0);
});
