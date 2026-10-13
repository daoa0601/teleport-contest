import test from 'node:test';
import assert from 'node:assert/strict';
import { A_STR, M_AP_F_DKNOWN, M_AP_OBJECT } from '../js/const.js';
import { newsym } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { pushKey, pushKeys } from '../js/input.js';
import { prepareAppliedWeaponAttack } from '../js/hero_attack_preflight.js';
import { dodiscovered } from '../js/o_init.js';
import { ARROW, BOULDER, CLUB, POT_HEALING } from '../js/object_data.js';
import { cansee, vision_recalc, vision_reset } from '../js/vision.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryWeapon } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const distance of [2, 4]) {
    void test(`a potion disguise ${distance} squares away does not add its appearance to discoveries`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const mimic = await createMonsterAt('small mimic', 10 + distance, 10);
        mimic.m_ap_type = M_AP_OBJECT;
        mimic.mappearance = POT_HEALING;
        newsym(mimic.mx, mimic.my);
        const showing = dodiscovered();
        const text = requireGameDisplay().grid
            .map(row => row.map(cell => cell.ch).join('')).join('\n');
        pushKey(27);
        await showing;
        const appearance = game.objectDescriptions?.[POT_HEALING];
        assert.equal(text.includes(`potion (${appearance})`), false);
    });
}
void test('recognizing a boulder disguise does not let the hero see through it', async () => {
    freshObjectRoom({ right: 20 });
    requirePlayingGame(game);
    const mimic = await createMonsterAt('small mimic', 12, 10);
    mimic.m_ap_type = M_AP_OBJECT | M_AP_F_DKNOWN;
    mimic.mappearance = BOULDER;
    assert.equal(cansee(14, 10), true);
    vision_reset();
    vision_recalc(0);
    assert.equal(cansee(12, 10), true);
    assert.equal(cansee(14, 10), false);
});
void test('attacking a known object appearance still reveals the mimic', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mimic = await createMonsterAt('small mimic', 12, 10);
    mimic.m_ap_type = M_AP_OBJECT | M_AP_F_DKNOWN;
    mimic.mappearance = ARROW;
    newsym(12, 10);
    pushKeys(' '.repeat(10));
    const result = await prepareAppliedWeaponAttack(mimic, await addInventoryWeapon(CLUB));
    assert.equal(result.proceed, false);
    assert.equal(result.spentTime, true);
    assert.equal(mimic.m_ap_type, 0);
    assert.match(game._pending_message, /That arrow is a small mimic/);
});
void test('a thrown weapon passes over a known object disguise', async () => {
    freshObjectRoom({ right: 20 });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 10;
    const club = await addInventoryWeapon(CLUB, { invlet: 'a' });
    const mimic = await createMonsterAt('small mimic', 12, 10);
    mimic.m_ap_type = M_AP_OBJECT | M_AP_F_DKNOWN;
    mimic.mappearance = POT_HEALING;
    const hp = mimic.mhp;
    newsym(12, 10);
    await throwInventoryObject(club, 'l', Array.from({ length: 10 }, () => ' '));
    assert.equal(mimic.mhp, hp);
    assert.ok(club.ox > mimic.mx);
    assert.equal(club.oy, mimic.my);
});
//# sourceMappingURL=mimic_discovery.test.js.map