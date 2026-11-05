import assert from 'node:assert/strict';
import test from 'node:test';
import { nameToMonster, resolveMonsterNamePrefix } from '../js/mondata.js';
import { MONSTER_NAME, SPECIAL_PM } from '../js/monster_data.js';
import { rankOf, roleSwitch } from '../js/botl.js';
import { game } from '../js/gstate.js';
import { freshObjectRoom } from './support/object-room.js';
void test('rank titles resolve to their role player monster with the suffix retained', () => {
    // C botl.c:title_to_mon(), reached through mondata.c:name_to_monplus().
    // The first matching rank prefix in role order wins and keeps any
    // attached suffix as the wish remainder.
    assert.equal(nameToMonster('curator'), MONSTER_NAME.indexOf('archeologist'));
    assert.equal(nameToMonster('excavator of things'), MONSTER_NAME.indexOf('archeologist'));
    const match = resolveMonsterNamePrefix('excavator corpse');
    assert.ok(match);
    assert.equal(match.mnum, MONSTER_NAME.indexOf('archeologist'));
    assert.equal(match.gender, 2);
    assert.equal(match.remainder, ' corpse');
});
void test('the hero rank reads the roles table through Role_switch', async () => {
    // C botl.c:rank_of(u.ulevel, Role_switch, flags.female): the monster
    // number names a player monster, and a female hero reads the female
    // title when the role table has one.
    await freshObjectRoom({ role: 'priest', hero: { ulevel: 10 } });
    assert.equal(rankOf(4, roleSwitch(game), false, game), 'Acolyte');
    assert.equal(rankOf(10, SPECIAL_PM + 1 + (game.urole?.mnum ?? -1), false, game), 'Priest');
    assert.equal(rankOf(30, SPECIAL_PM + 1 + (game.urole?.mnum ?? -1), true, game), 'High Priestess');
});
//# sourceMappingURL=rank_title_names.test.js.map