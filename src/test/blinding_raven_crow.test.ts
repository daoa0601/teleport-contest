import assert from 'node:assert/strict';
import test from 'node:test';
import { canBlnd } from '../js/mondata.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AT_SPIT, AT_WEAP } from '../js/monster_attack_types.js';
import { BLINDING_VENOM, CREAM_PIE } from '../js/object_data.js';
import { polymonHero, heroSpecies } from '../js/polyself.js';
import { createMonsterAt } from './support/monsters.js';
import { NO_MINVENT } from '../js/const.js';
import { freshObjectRoom } from './support/object-room.js';

// C mondata.c:can_blnd(): "a crow will not pluck out the eye of another
// crow" — a raven aggressor cannot blind a raven defender. uhitm.c and
// dothrow.c pass &gy.youmonst as the aggressor, so a raven hero neither
// blinds a fellow raven with pie or venom nor blinds itself with a
// self-thrown hit; mthrowu.c passes a null aggressor, which skips the check.
void test('a raven hero cannot blind a fellow raven with pie or venom', async () => {
    await freshObjectRoom();
    await polymonHero(MONSTER_NAME.indexOf('raven'));
    const raven = await createMonsterAt('raven', 12, 10, NO_MINVENT);

    assert.equal(
        canBlnd({ youmonst: true }, { monster: raven },
            AT_SPIT, { otyp: BLINDING_VENOM }, game),
        false,
        `venom from a raven hero (species ${heroSpecies(game)}) cannot blind a raven`,
    );
    assert.equal(
        canBlnd({ youmonst: true }, { monster: raven },
            AT_WEAP, { otyp: CREAM_PIE }, game),
        false,
    );
    // Null aggressor (monster-thrown, scattered): the raven can be blinded.
    assert.equal(
        canBlnd(null, { monster: raven }, AT_SPIT, { otyp: BLINDING_VENOM }, game),
        true,
    );
});

void test('a raven hero is not blinded by its own self-thrown pie or venom', async () => {
    await freshObjectRoom();
    await polymonHero(MONSTER_NAME.indexOf('raven'));

    assert.equal(
        canBlnd({ youmonst: true }, { youmonst: true },
            AT_WEAP, { otyp: CREAM_PIE }, game),
        false,
    );
    assert.equal(
        canBlnd({ youmonst: true }, { youmonst: true },
            AT_SPIT, { otyp: BLINDING_VENOM }, game),
        false,
    );
    // A monster throwing at the raven hero passes no aggressor and blinds it.
    assert.equal(
        canBlnd(null, { youmonst: true }, AT_SPIT, { otyp: BLINDING_VENOM }, game),
        true,
    );
});
