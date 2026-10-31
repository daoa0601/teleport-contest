import assert from 'node:assert/strict';
import test from 'node:test';
import { A_STR, MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { currentAttribute } from '../js/attrib.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { hitMonsterWithHeroObject } from '../js/hero_physical_hit.js';
import { SPLINT_MAIL } from '../js/object_data.js';
import { enableRngLog, getRngLog, initRng } from '../js/rng.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
// C uhitm.c:hmon_hitmon_dmg_recalc() applies the 3/2 two-handed strength
// multiplier only when bimanual(uwep) holds, and include/obj.h:bimanual()
// demands WEAPON_CLASS or TOOL_CLASS.  oc_bimanual aliases oc_big, which is
// also set on heavy armor, so a hero bashing with wielded splint mail must
// not have a doubled strength penalty.  The whole hit is the misc-object
// path of uhitm.c:hmon_hitmon_misc_obj(): a weight roll capped at 6, a
// blessed bonus against undead, then the undoubled dbon() strength bonus.
void test('bashing undead with wielded armor takes the undoubled strength penalty', async () => {
    await freshObjectRoom({ flags: { verbose: true }, hero: { acurr: { a: [3, 10, 10, 10, 10, 10] } } });
    requirePlayingGame(game);
    const monster = await createMonsterAt('orc zombie', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    monster.mhp = monster.mhpmax = 200;
    monster.mpeaceful = false;
    monster.msleeping = 0;
    monster.mcanmove = 1;
    const mail = await addInventoryObject(SPLINT_MAIL, {
        blessed: true, bknown: true, owt: 400,
    });
    await addInventoryItem(mail);
    await setPrimaryWeapon(mail);
    assert.equal(currentAttribute(A_STR, game), 3);
    initRng(12n);
    enableRngLog();
    await hitMonsterWithHeroObject(monster, mail, {
        mode: 'melee', dieRoll: 5, publish: async () => { },
    });
    const dice = getRngLog()
        .filter(entry => /^rnd\(4\)=/.test(entry))
        .map(entry => Number(entry.slice('rnd(4)='.length)));
    assert.equal(dice.length, 2);
    const weightRoll = dice[0] ?? 0;
    const blessedRoll = dice[1] ?? 0;
    assert.equal(200 - monster.mhp, weightRoll + blessedRoll - 1);
});
//# sourceMappingURL=armor_bash_strength.test.js.map