import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { flushPendingTopline } from '../js/tty_topline.js';
import { resetInputState } from '../js/input.js';
import { P_ATTACK_SPELL, P_DAGGER } from '../js/const.js';
import {
    addHeroWeaponSkillSlots, advanceHeroSkill, ensureHeroSkills, loseHeroWeaponSkillSlots,
    useHeroSkill,
} from '../js/weapon.js';
import { freshObjectRoom } from './support/object-room.js';

async function dismissFeedback() {
    resetInputState().feed(' ');
    await flushPendingTopline();
}

// C weapon.c:add_weapon_skill(): gaining a slot reports the shared
// eligibility change (give_may_advance_msg(P_NONE)) only when a skill
// becomes advanceable, and never repeats an existing eligibility.
void test('a gained weapon skill slot announces newly advanceable practice once', async () => {
    await freshObjectRoom({ flags: { tips: false } });
    requirePlayingGame(game);
    assert.ok(ensureHeroSkills(game));
    await useHeroSkill(P_ATTACK_SPELL, 60);
    assert.equal(game._pending_message || '', '');
    assert.equal(game.u.weapon_slots || 0, 0);

    await addHeroWeaponSkillSlots(1);

    assert.equal(game._pending_message, 'You feel more confident in your skills.');
    await dismissFeedback();
    await addHeroWeaponSkillSlots(1);
    assert.equal(game._pending_message || '', '', 'an extra slot must not repeat existing eligibility');
});

// C weapon.c:lose_weapon_skill(): with no unused slot left, the most
// recently advanced skill drops a level and refunds the remaining slots
// its advancement spent (slots_required(skill) - 1).
void test('losing a skill slot drops the last advanced skill and refunds its extra slots', async () => {
    await freshObjectRoom({ role: 'wizard', flags: { tips: false } });
    requirePlayingGame(game);
    const skills = ensureHeroSkills(game);
    assert.ok(skills);
    await addHeroWeaponSkillSlots(1);
    await useHeroSkill(P_DAGGER, 20);
    await dismissFeedback();
    assert.ok(await advanceHeroSkill(game, P_DAGGER));
    await dismissFeedback();
    await addHeroWeaponSkillSlots(2);
    await useHeroSkill(P_DAGGER, 60);
    await dismissFeedback();
    assert.ok(await advanceHeroSkill(game, P_DAGGER));
    await dismissFeedback();
    assert.equal(skills[P_DAGGER]?.skill, 3);
    game.u.weapon_slots = 0;
    assert.ok(game.u.skillRecord);

    await loseHeroWeaponSkillSlots(1);

    assert.equal(skills[P_DAGGER]?.skill, 2, 'the last advancement is lost first');
    assert.equal(game.u.weapon_slots, 1, 'the unused slot of a two-slot step is refunded');
});
