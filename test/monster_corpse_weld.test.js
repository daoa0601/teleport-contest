import assert from 'node:assert/strict';
import test from 'node:test';
import { NEED_WEAPON, NO_MINVENT, NO_WEAPON_WANTED, W_WEP } from '../js/const.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { updateMonsterWeaponAfterPolymorph } from '../js/monster_weapon.js';
import { untimedCorpse } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('polymorph permits replacing a cursed corpse because corpses do not weld', async () => {
    freshObjectRoom();
    const giant = await createMonsterAt('giant', 11, 10, NO_MINVENT);
    await equipMonsterObject(giant, await untimedCorpse(MONSTER_NAME.indexOf('cockatrice'), { cursed: true }), W_WEP);
    giant.weaponCheck = NO_WEAPON_WANTED;
    await updateMonsterWeaponAfterPolymorph(giant);
    assert.equal(giant.weaponCheck, NEED_WEAPON);
});
//# sourceMappingURL=monster_corpse_weld.test.js.map