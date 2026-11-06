import assert from 'node:assert/strict';
import test from 'node:test';
import { canBlnd } from '../js/mondata.js';
import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { AT_BITE, AT_BOOM, AT_BREA, AT_CLAW, AT_ENGL, AT_EXPL, AT_GAZE, AT_MAGC, AT_NONE, AT_SPIT, AT_STNG, AT_TUCH, AT_WEAP } from '../js/monster_attack_types.js';
import { BLINDING_VENOM, CREAM_PIE } from '../js/object_data.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

// C mondata.c:can_blnd(): the one native check behind every contact,
// engulfing and object blinding in uhitm.c, mhitu.c, mthrowu.c and dothrow.c.
void test('light-based blinding requires an uncancelled attacker and a susceptible hero', async () => {
    await freshObjectRoom();
    const attacker = await createMonsterAt('yellow light', 12, 10, NO_MINVENT);
    const methods = [AT_BOOM, AT_BREA, AT_EXPL, AT_GAZE, AT_MAGC];
    attacker.mcan = 0;
    for (const method of methods)
        assert.equal(canBlnd({ monster: attacker }, { youmonst: true }, method, null, game), true,
            `attack type ${method} can blind a sighted hero`);
    attacker.mcan = 1;

    for (const method of methods)
        assert.equal(canBlnd({ monster: attacker }, { youmonst: true }, method, null, game), false,
            `cancelled attack type ${method} cannot blind`);

    attacker.mcan = 0;
    setHeroBlindnessTurns(5);
    for (const method of methods)
        assert.equal(canBlnd({ monster: attacker }, { youmonst: true }, method, null, game), false,
            `attack type ${method} cannot extend light-induced blindness`);
});

void test('weapon and spit attacks without a blinding object cannot blind the hero', async () => {
    await freshObjectRoom();
    const attacker = await createMonsterAt('cobra', 12, 10, NO_MINVENT);

    for (const method of [AT_NONE, AT_SPIT, AT_WEAP])
        assert.equal(canBlnd({ monster: attacker }, { youmonst: true }, method, null, game), false,
            `attack type ${method} needs a blinding object`);
});

// C can_blnd() object branch: a cream pie only cares about a blindfold,
// while blinding venom is stopped by any eyewear or an already creamed face.
void test('thrown pies and venom blind a bare hero', async () => {
    await freshObjectRoom();

    assert.equal(canBlnd(null, { youmonst: true }, AT_WEAP, { otyp: CREAM_PIE }, game), true);
    assert.equal(canBlnd(null, { youmonst: true }, AT_SPIT, { otyp: BLINDING_VENOM }, game), true);
    game.u.ucreamed = 4;
    assert.equal(canBlnd(null, { youmonst: true }, AT_SPIT, { otyp: BLINDING_VENOM }, game), false,
        'a creamed face keeps venom out of the eyes');
    game.u.ucreamed = 0;
});

// C can_blnd() defender branches: a permanently blind monster cannot be
// blinded further, an engulfed defender only needs to be awake, and a hero
// inside a monster cannot blind the monster it swallowed.
void test('monster defenders follow their own can_blnd() rules', async () => {
    await freshObjectRoom();
    const raven = await createMonsterAt('raven', 12, 10, NO_MINVENT);

    assert.equal(canBlnd(null, { monster: raven }, AT_SPIT, { otyp: BLINDING_VENOM }, game), true);
    raven.msleeping = 1;
    assert.equal(canBlnd({ youmonst: true }, { monster: raven }, AT_ENGL, null, game), false,
        'a sleeping monster cannot be blinded by engulfing darkness');
    raven.msleeping = 0;
    raven.mcansee = 0;
    raven.mblinded = 0;
    assert.equal(canBlnd(null, { monster: raven }, AT_SPIT, { otyp: BLINDING_VENOM }, game), false,
        'a permanently blind monster is already done for');
    raven.mcansee = 1;

    // Physical touch attacks need an uncancelled attacker on either side.
    const naga = await createMonsterAt('guardian naga', 13, 10, NO_MINVENT);
    naga.mcan = 1;
    assert.equal(canBlnd({ monster: naga }, { youmonst: true }, AT_TUCH, null, game), false);
    assert.equal(canBlnd({ monster: naga }, { youmonst: true }, AT_STNG, null, game), false);
    naga.mcan = 0;
    assert.equal(canBlnd({ monster: naga }, { youmonst: true }, AT_TUCH, null, game), true);
    // Every other body attack (bite, claw on a bare head) simply blinds.
    assert.equal(canBlnd({ monster: naga }, { youmonst: true }, AT_CLAW, null, game), true);
    assert.equal(canBlnd({ monster: naga }, { youmonst: true }, AT_BITE, null, game), true);
});
