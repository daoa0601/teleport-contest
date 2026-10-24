import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { A_INT, A_STR, A_WIS, HUNGRY, P_BASIC, P_SKILLED, WEAK } from '../js/const.js';
import { wearHeroArmor } from '../js/armor.js';
import { game } from '../js/gstate.js';
import { makeConfused, makeStunned } from '../js/hero_mental_status.js';
import { currentHungerState } from '../js/hunger.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_YENDOR, CHAIN_MAIL, HELMET, OBJECT_NAMES, OBJECT_SPELL_CATEGORY, QUARTERSTAFF, ROBE, ROCK, SMALL_SHIELD, SPE_FINGER_OF_DEATH, SPE_FIREBALL, SPE_FORCE_BOLT, SPE_HASTE_SELF, SPE_HEALING, SPE_TURN_UNDEAD, TWO_HANDED_SWORD, } from '../js/object_data.js';
import { ensureHeroSkills } from '../js/skills.js';
import { forceLearnSpell } from '../js/spell.js';
import { checkSpellCast, currentSpellKnowledge, liveSpellSkill, percentSuccess, rejectCasting, } from '../js/spell_casting_rules.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { trainSpellSkill } from './support/spells.js';
const spellType = (name) => OBJECT_NAMES.findIndex((candidate, type) => candidate === name && OBJECT_SPELL_CATEGORY[type]);
function learnSpell(type, { role = 'wizard', level = 30, intelligence = 18, wisdom = 18, energy = 100, nutrition = 900, strength = 12, } = {}) {
    freshObjectRoom({ role, gameplaySeed: 41n, hero: {
            ulevel: level, uen: energy, uenmax: energy, uenpeak: energy,
            uhunger: nutrition,
        } });
    requirePlayingGame(game);
    for (const [attribute, value] of [[A_INT, intelligence], [A_WIS, wisdom], [A_STR, strength]]) {
        game.u.acurr.a[attribute] = value;
        game.u.amax.a[attribute] = value;
    }
    game.u.uhs = currentHungerState();
    ensureHeroSkills(game);
    forceLearnSpell(type);
    const spell = game.spells.find(spell => spell.otyp === type);
    assert.ok(spell);
    return spell;
}
void test('an unmemorized spell cannot spend energy or nutrition', async () => {
    learnSpell(SPE_FORCE_BOLT);
    requirePlayingGame(game);
    const result = await checkSpellCast({ otyp: SPE_HEALING });
    assert.equal(result.allowed, false);
    assert.equal(result.spentTime, false);
    assert.equal(game.u.uen, 100);
    assert.equal(game.u.uhunger, 900);
});
void test('stunning rejects casting before any resource expenditure', async () => {
    const spell = learnSpell(SPE_FORCE_BOLT);
    requirePlayingGame(game);
    await makeStunned(8, { talk: false });
    const result = await checkSpellCast(spell);
    assert.equal(result.allowed, false);
    assert.equal(result.spentTime, false);
    assert.equal(game.u.uen, 100);
    assert.equal(game.u.uhunger, 900);
    assert.match(game._pending_message, /too impaired to cast/);
});
void test('a form unable to chant cannot cast', async () => {
    learnSpell(SPE_FORCE_BOLT);
    requirePlayingGame(game);
    installPolymorphedHero('fog cloud');
    assert.equal(await rejectCasting(), true);
    assert.match(game._pending_message, /unable to chant/);
});
void test('a welded two-handed sword prevents casting but a welded quarterstaff permits it', async () => {
    const spell = learnSpell(SPE_FORCE_BOLT);
    requirePlayingGame(game);
    const sword = await addInventoryObject(TWO_HANDED_SWORD, { cursed: true });
    await setPrimaryWeapon(sword);
    assert.equal((await checkSpellCast(spell)).spentTime, false);
    assert.match(game._pending_message, /arms are not free/);
    const staff = await addInventoryObject(QUARTERSTAFF, { cursed: true });
    await setPrimaryWeapon(staff);
    resetInputState().feed(' ');
    assert.equal((await checkSpellCast(spell)).allowed, true);
});
void test('hunger blocks ordinary casting without taking a turn', async () => {
    const spell = learnSpell(SPE_HEALING, { nutrition: 10 });
    requirePlayingGame(game);
    const result = await checkSpellCast(spell);
    assert.equal(result.allowed, false);
    assert.equal(result.spentTime, false);
    assert.equal(game.u.uhunger, 10);
    assert.equal(game.u.uen, 100);
});
void test('detect food remains castable while hungry and consumes no nutrition', async () => {
    const spell = learnSpell(spellType('detect food'), { nutrition: 3 });
    requirePlayingGame(game);
    const result = await checkSpellCast(spell);
    assert.equal(result.allowed, true);
    assert.equal(game.u.uhunger, 3);
});
void test('weak strength blocks ordinary casting but permits restore ability', async () => {
    const ordinary = learnSpell(SPE_HEALING, { role: 'healer', strength: 3 });
    requirePlayingGame(game);
    assert.equal((await checkSpellCast(ordinary)).allowed, false);
    assert.match(game._pending_message, /lack the strength/);
    forceLearnSpell(spellType('restore ability'));
    const restoring = game.spells.find(spell => spell.otyp === spellType('restore ability'));
    assert.ok(restoring);
    resetInputState().feed(' ');
    assert.equal((await checkSpellCast(restoring)).allowed, true);
});
void test('overburdened concentration consumes a turn without spending energy or food', async () => {
    const spell = learnSpell(SPE_FORCE_BOLT);
    requirePlayingGame(game);
    await addInventoryObject(ROCK, { quan: 1000 });
    const result = await checkSpellCast(spell);
    assert.equal(result.allowed, false);
    assert.equal(result.spentTime, true);
    assert.equal(game.u.uen, 100);
    assert.equal(game.u.uhunger, 900);
    assert.match(game._pending_message, /concentration falters/);
});
void test('insufficient energy without the Amulet consumes neither food nor time', async () => {
    const spell = learnSpell(SPE_FORCE_BOLT, { energy: 4 });
    requirePlayingGame(game);
    const result = await checkSpellCast(spell);
    assert.equal(result.allowed, false);
    assert.equal(result.spentTime, false);
    assert.equal(game.u.uen, 4);
    assert.equal(game.u.uhunger, 900);
    assert.match(game._pending_message, /that spell yet\./);
});
void test('a caster whose former maximum sufficed is told they lack energy anymore', async () => {
    const spell = learnSpell(SPE_FORCE_BOLT, { energy: 4 });
    requirePlayingGame(game);
    game.u.uenpeak = 10;
    await checkSpellCast(spell);
    assert.match(game._pending_message, /that spell anymore\./);
});
void test('the real Amulet drains a viable casting attempt even when that prevents casting', async () => {
    const spell = learnSpell(SPE_FORCE_BOLT, { energy: 5 });
    requirePlayingGame(game);
    await addInventoryObject(AMULET_OF_YENDOR);
    resetInputState().feed('  ');
    const result = await checkSpellCast(spell);
    assert.equal(result.allowed, false);
    assert.equal(result.spentTime, true);
    assert.ok(game.u.uen < 5);
    assert.equal(game.u.uhunger, 900);
});
void test('the Amulet does not drain an attempt already short of energy', async () => {
    const spell = learnSpell(SPE_FORCE_BOLT, { energy: 4 });
    requirePlayingGame(game);
    await addInventoryObject(AMULET_OF_YENDOR);
    const result = await checkSpellCast(spell);
    assert.equal(result.spentTime, false);
    assert.equal(game.u.uen, 4);
});
void test('confusion takes half the energy cost and still spends casting nutrition', async () => {
    const spell = learnSpell(SPE_HASTE_SELF, { role: 'healer' });
    requirePlayingGame(game);
    await makeConfused(20, { talk: false });
    const result = await checkSpellCast(spell);
    assert.equal(result.allowed, false);
    assert.equal(result.spentTime, true);
    assert.equal(result.energy, 15);
    assert.equal(game.u.uen, 93);
    assert.equal(game.u.uhunger, 870);
});
void test('an impossible success chance still spends a turn and half the power', async () => {
    const spell = learnSpell(SPE_FINGER_OF_DEATH, { level: 1, intelligence: 3, energy: 40 });
    requirePlayingGame(game);
    assert.equal(percentSuccess(spell), 0);
    const result = await checkSpellCast(spell);
    assert.equal(result.allowed, false);
    assert.equal(result.spentTime, true);
    assert.equal(game.u.uen, 23);
});
for (const [intelligence, cost] of [[14, 10], [15, 5], [16, 2], [17, 0]]) {
    void test(`Wizard Intelligence ${intelligence} determines the casting nutrition cost`, async () => {
        const spell = learnSpell(SPE_FORCE_BOLT, { intelligence });
        requirePlayingGame(game);
        const result = await checkSpellCast(spell);
        assert.equal(result.allowed, true);
        assert.equal(game.u.uhunger, 900 - cost);
        assert.equal(game.u.uen, 100, 'the successful effect caller owns the final energy deduction');
        assert.equal(result.energy, 5);
    });
}
void test('casting can cause weakness immediately but never reduces nutrition below three', async () => {
    const spell = learnSpell(spellType('restore ability'), { role: 'healer', nutrition: 51 });
    requirePlayingGame(game);
    assert.equal(game.u.uhs, HUNGRY);
    resetInputState().feed('  ');
    assert.equal((await checkSpellCast(spell)).allowed, true);
    assert.equal(game.u.uhs, WEAK);
    assert.equal(game.u.atemp.a[A_STR], -1);
    assert.equal(game.u.uhunger, 11);
    assert.equal((await checkSpellCast(spell)).allowed, true);
    assert.equal(game.u.uhunger, 3);
});
for (const [turns, message] of [
    [100, 'You strain to recall the spell.'],
    [500, 'You have difficulty remembering the spell.'],
    [1000, 'Your knowledge of this spell is growing faint.'],
    [2000, 'Your recall of this spell is gradually fading.'],
]) {
    void test(`a spell with ${turns} turns left warns without changing its memory`, async () => {
        const spell = learnSpell(SPE_FORCE_BOLT);
        requirePlayingGame(game);
        assert.ok(spell != null, 'Expected spell to be initialized');
        spell.know = game.moves - 1 + turns;
        assert.equal((await checkSpellCast(spell)).allowed, true);
        assert.equal(currentSpellKnowledge(spell), turns);
        assert.equal(game._pending_message, message);
    });
}
void test('forgotten magic backfires before hunger rejection and preserves prior confusion', async () => {
    const spell = learnSpell(SPE_FORCE_BOLT, { nutrition: 8 });
    requirePlayingGame(game);
    assert.ok(spell != null, 'Expected spell to be initialized');
    spell.know = game.moves - 1;
    await makeConfused(7, { talk: false });
    const input = resetInputState();
    const checking = checkSpellCast(spell);
    await input.waitUntilBlocked();
    assert.equal(game.u.uen, 100, 'the warning must finish before the backfire');
    assert.equal(game.u.confusionTurns, 7);
    input.feed(' ');
    const result = await checking;
    assert.equal(result.allowed, false);
    assert.equal(result.spentTime, true);
    assert.equal((game.u.confusionTurns - 7) + (game.u.stunnedTurns || 0), 6);
    assert.ok(game.u.uen >= 95 && game.u.uen < 100);
    assert.equal(game.u.uhunger, 8);
});
void test('advancing the live spell category improves success without changing the memorized entry', async () => {
    const spell = learnSpell(SPE_FIREBALL, { level: 5, intelligence: 12 });
    requirePlayingGame(game);
    assert.ok(spell != null, 'Expected spell to be initialized');
    assert.equal(liveSpellSkill(spell.otyp), P_BASIC);
    const before = percentSuccess(spell);
    await trainSpellSkill(spell.otyp, P_SKILLED);
    assert.equal(liveSpellSkill(spell.otyp), P_SKILLED);
    assert.ok(percentSuccess(spell) > before);
});
void test('metal armor penalizes casting and a robe over it halves the suit penalty', async () => {
    const spell = learnSpell(SPE_FORCE_BOLT, { level: 1, intelligence: 10 });
    requirePlayingGame(game);
    const unarmored = percentSuccess(spell);
    wearHeroArmor(await addInventoryObject(CHAIN_MAIL));
    const armored = percentSuccess(spell);
    wearHeroArmor(await addInventoryObject(ROBE));
    assert.ok(armored < percentSuccess(spell));
    assert.ok(percentSuccess(spell) < unarmored);
});
void test('a heavy shield is worse than a small shield and a quarterstaff helps casting', async () => {
    const spell = learnSpell(SPE_FORCE_BOLT, { level: 1, intelligence: 10 });
    requirePlayingGame(game);
    const unarmed = percentSuccess(spell);
    await setPrimaryWeapon(await addInventoryObject(QUARTERSTAFF));
    assert.ok(percentSuccess(spell) > unarmed);
    await setPrimaryWeapon(null);
    wearHeroArmor(await addInventoryObject(SMALL_SHIELD));
    const smallShield = percentSuccess(spell);
    wearHeroArmor(await addInventoryObject(OBJECT_NAMES.indexOf('large shield')));
    assert.ok(percentSuccess(spell) < smallShield);
});
void test('Knight clerical casting ignores metal suit and helmet penalties', async () => {
    const clerical = learnSpell(SPE_TURN_UNDEAD, { role: 'knight' });
    requirePlayingGame(game);
    assert.ok(clerical != null, 'Expected clerical to be initialized');
    await trainSpellSkill(clerical.otyp, P_BASIC);
    forceLearnSpell(SPE_FORCE_BOLT);
    const attack = game.spells.find(spell => spell.otyp === SPE_FORCE_BOLT);
    assert.ok(attack);
    const clericalChance = percentSuccess(clerical);
    const attackChance = percentSuccess(attack);
    assert.ok(clericalChance > 0);
    wearHeroArmor(await addInventoryObject(CHAIN_MAIL));
    wearHeroArmor(await addInventoryObject(HELMET));
    assert.equal(percentSuccess(clerical), clericalChance);
    assert.ok(percentSuccess(attack) < attackChance);
});
//# sourceMappingURL=spell_casting_rules.test.js.map