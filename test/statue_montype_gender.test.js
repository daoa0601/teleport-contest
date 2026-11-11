import test from 'node:test';
import assert from 'node:assert/strict';
import { CORPSTAT_HISTORIC, CORPSTAT_MALE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { generateMinetown } from '../js/mkmaze.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { STATUE } from '../js/object_data.js';
import { roles } from '../js/role.js';
import { floorObjects } from './support/level-state.js';
import { freshSpecialLevel } from './support/special-level.js';
// C sp_lev.c:lspo_object() "Obey statue type gender": a montype spelling
// that is the male or female name of its species records that gender in
// the statue's CORPSTAT overloads, so minetn-5's gnome king statue is not
// described with the species' neutral "gnome ruler" name.
void test('a montype spelling with gender marks the statue gender', async () => {
    const active = freshSpecialLevel({
        prototype: 'minetn', variant: 5, seed: 5 * 131, depth: 6,
    });
    requirePlayingGame(game);
    const role = roles.find(entry => entry.key === 'wizard');
    assert.ok(role);
    game.urole = role;
    await generateMinetown(active);
    const statue = floorObjects(game.level).find(object => object.otyp === STATUE
        && object.corpsenm === MONSTER_NAME.indexOf('gnome ruler'));
    assert.ok(statue, 'minetn-5 places the gnome ruler statue');
    assert.equal(statue.spe, CORPSTAT_HISTORIC | CORPSTAT_MALE);
});
//# sourceMappingURL=statue_montype_gender.test.js.map