import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { swingMonsterWeapon } from '../js/monster_weapon.js';
import { ELVEN_DAGGER } from '../js/object_data.js';
import { knownObject, untimedCorpse } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a monster swing describes a corpse as a corpse before the contact identifies its species', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const attacker = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const defender = await createMonsterAt('orc', 12, 10, NO_MINVENT);
    const corpse = await untimedCorpse(MONSTER_NAME.indexOf('cockatrice'));
    const messages = [];
    await swingMonsterWeapon(attacker, corpse, game, {
        defender, publish: message => { messages.push(message); },
    });
    assert.ok(messages.some(message => / (?:his|her) corpse at the orc\.$/.test(message)), messages.join('\n'));
    assert.equal(messages.some(message => message.includes('cockatrice')), false);
});
void test('an unidentified weapon swing uses the player assigned type name', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const attacker = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const defender = await createMonsterAt('orc', 12, 10, NO_MINVENT);
    const dagger = await knownObject(ELVEN_DAGGER, { typeKnown: false });
    game._knownObjectTypes?.delete(ELVEN_DAGGER);
    game._objectCallNames = { ...game._objectCallNames, [ELVEN_DAGGER]: 'leaf blade' };
    const messages = [];
    await swingMonsterWeapon(attacker, dagger, game, {
        defender, publish: message => { messages.push(message); },
    });
    assert.ok(messages.some(message => message.includes('runed dagger called leaf blade at the orc.')), messages.join('\n'));
});
//# sourceMappingURL=monster_weapon_swing_names.test.js.map