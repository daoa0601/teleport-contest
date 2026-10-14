import test from 'node:test';
import assert from 'node:assert/strict';
import { M_AP_OBJECT, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { BOULDER } from '../js/object_data.js';
import { cansee, vision_note_blocker_change, vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('polymorphing a boulder mimic opens the view beyond its old disguise', async () => {
    freshObjectRoom({ top: 10, bottom: 10 });
    requirePlayingGame(game);
    const mimic = await createMonsterAt('small mimic', 11, 10, NO_MINVENT);
    mimic.m_ap_type = M_AP_OBJECT;
    mimic.mappearance = BOULDER;
    vision_note_blocker_change(11, 10);
    vision_recalc(0);
    assert.equal(cansee(12, 10), false);
    await changeMonsterForm(mimic, MONSTER_NAME.indexOf('jackal'), game, { showMessage: true });
    assert.equal(mimic.m_ap_type, 0);
    assert.equal(cansee(12, 10), true);
});
//# sourceMappingURL=monster_polymorph_disguise.test.js.map