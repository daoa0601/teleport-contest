import assert from 'node:assert/strict';
import test from 'node:test';
import { heroCanBeBlindedByContact } from '../js/blinding_attack.js';
import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { AT_BOOM, AT_BREA, AT_EXPL, AT_GAZE, AT_MAGC, AT_NONE, AT_SPIT, AT_WEAP } from '../js/monster_attack_types.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('light-based blinding requires an uncancelled attacker and a susceptible hero', async () => {
    freshObjectRoom();
    const attacker = await createMonsterAt('yellow light', 12, 10, NO_MINVENT);
    const methods = [AT_BOOM, AT_BREA, AT_EXPL, AT_GAZE, AT_MAGC];
    attacker.mcan = 0;
    for (const method of methods)
        assert.equal(heroCanBeBlindedByContact(attacker, method, game), true, `attack type ${method} can blind a sighted hero`);
    attacker.mcan = 1;
    for (const method of methods)
        assert.equal(heroCanBeBlindedByContact(attacker, method, game), false, `cancelled attack type ${method} cannot blind`);
    attacker.mcan = 0;
    setHeroBlindnessTurns(5);
    for (const method of methods)
        assert.equal(heroCanBeBlindedByContact(attacker, method, game), false, `attack type ${method} cannot extend light-induced blindness`);
});
void test('weapon and spit attacks without a blinding object cannot blind the hero', async () => {
    freshObjectRoom();
    const attacker = await createMonsterAt('cobra', 12, 10, NO_MINVENT);
    for (const method of [AT_NONE, AT_SPIT, AT_WEAP])
        assert.equal(heroCanBeBlindedByContact(attacker, method, game), false, `attack type ${method} needs a blinding object`);
});
//# sourceMappingURL=mondata_blinding.test.js.map