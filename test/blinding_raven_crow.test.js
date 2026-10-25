import assert from 'node:assert/strict';
import test from 'node:test';
import { heroCanBeBlindedByObject, monsterCanBeBlindedByObject, } from '../js/blinding_attack.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { BLINDING_VENOM, CREAM_PIE } from '../js/object_data.js';
import { polymonHero } from '../js/polyself.js';
import { createMonsterAt } from './support/monsters.js';
import { NO_MINVENT } from '../js/const.js';
import { freshObjectRoom } from './support/object-room.js';
import { heroSpecies } from '../js/hero_species.js';
// C mondata.c:can_blnd(): "a crow will not pluck out the eye of another
// crow" — a raven aggressor cannot blind a raven defender. uhitm.c and
// dothrow.c pass &gy.youmonst as the aggressor, so a raven hero neither
// blinds a fellow raven with pie or venom nor blinds itself with a
// self-thrown hit; mthrowu.c passes a null aggressor, which skips the check.
void test('a raven hero cannot blind a fellow raven with pie or venom', async () => {
    freshObjectRoom();
    await polymonHero(MONSTER_NAME.indexOf('raven'));
    const raven = await createMonsterAt('raven', 12, 10, NO_MINVENT);
    assert.equal(monsterCanBeBlindedByObject(raven, BLINDING_VENOM, {
        attackerSpecies: heroSpecies(game),
    }), false);
    assert.equal(monsterCanBeBlindedByObject(raven, CREAM_PIE, {
        attackerSpecies: heroSpecies(game),
    }), false);
    // Null aggressor (monster-thrown, scattered): the raven can be blinded.
    assert.equal(monsterCanBeBlindedByObject(raven, BLINDING_VENOM, {}), true);
});
void test('a raven hero is not blinded by its own self-thrown pie or venom', async () => {
    freshObjectRoom();
    await polymonHero(MONSTER_NAME.indexOf('raven'));
    assert.equal(heroCanBeBlindedByObject(CREAM_PIE, game, { thrownByHero: true }), false);
    assert.equal(heroCanBeBlindedByObject(BLINDING_VENOM, game, { thrownByHero: true }), false);
    // A monster throwing at the raven hero passes no aggressor and blinds it.
    assert.equal(heroCanBeBlindedByObject(BLINDING_VENOM, game), true);
});
//# sourceMappingURL=blinding_raven_crow.test.js.map