import { monsterAtPosition } from '../js/monster_location.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS, MM_NOGRP, MM_NOWAIT, NO_MINVENT, STRAT_WAITFORU, W_ARM, } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resolveHeroNaturalDamage } from '../js/hero_natural_damage.js';
import { resetInputState } from '../js/input.js';
import { AD_BLND, AD_COLD, AD_CONF, AD_DRLI, AD_FIRE, AD_PHYS, AD_RUST, AD_SLEE, AD_SLOW, AD_STUN, AD_TLPT, AT_CLAW, AT_KICK, AT_TUCH, AT_WEAP, } from '../js/monster_attack_types.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { CORPSE, OBJECT_NAMES, POT_HEALING } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
async function naturalAttackRoom(form, defender, expected, limit = 6) {
    freshObjectRoom({ flags: { verbose: true }, hero: { ulevel: 30 } });
    installPolymorphedHero(form, { hitPoints: 80 });
    const monster = await createMonsterAt(defender, 11, 10, NO_MINVENT | MM_NOGRP | MM_NOWAIT);
    monster.mhp = monster.mhpmax = 200;
    monster.msleeping = 0;
    monster.mcanmove = 1;
    installPagerInput(resetInputState(), { expected, limit });
    initRng(97n);
    return monster;
}
void test('a damage ring adds to a thick hide kick and to the halved claw damage', async () => {
    const monster = await naturalAttackRoom('minotaur', 'iron golem', /iron golem/);
    await wearHeroAccessory(await addInventoryObject(OBJECT_NAMES.indexOf('increase damage'), { spe: 3 }), 'uleft');
    await resolveHeroNaturalDamage(monster, [AT_KICK, AD_PHYS, 4, 1], 0);
    assert.equal(monster.mhp, 197);
    await resolveHeroNaturalDamage(monster, [AT_CLAW, AD_PHYS, 4, 1], 0);
    assert.equal(monster.mhp, 192);
});
void test('a shade takes only the special contact damage from a natural physical hit', async () => {
    const monster = await naturalAttackRoom('minotaur', 'shade', /shade/);
    const result = await resolveHeroNaturalDamage(monster, [AT_CLAW, AD_PHYS, 8, 1], 4);
    assert.equal(monster.mhp, 196);
    assert.equal(result.nativeResult, M_ATTK_HIT);
});
void test('a weapon stun followup stuns without applying weapon damage again', async () => {
    const monster = await naturalAttackRoom('minotaur', 'goblin', /goblin staggers/);
    await resolveHeroNaturalDamage(monster, [AT_WEAP, AD_STUN, 8, 1], 0);
    assert.equal(monster.mhp, 200);
    assert.equal(monster.mstun, 1);
});
void test('fire heals a wounded iron golem instead of applying its body damage', async () => {
    const monster = await naturalAttackRoom('fire elemental', 'iron golem', /iron golem|fire doesn't heat/);
    monster.mhp = 80;
    await resolveHeroNaturalDamage(monster, [AT_TUCH, AD_FIRE, 6, 1], 0);
    assert.equal(monster.mhp, 86);
});
void test('cold resistance still permits carried potions to shatter and injure the monster', async () => {
    const monster = await naturalAttackRoom('ice vortex', 'white dragon', /white dragon|frost doesn't chill|potions.*shatter/);
    const potions = await knownObject(POT_HEALING, { quan: 30 });
    await addObjectToMonsterInventory(monster, potions, game);
    initRng(97n);
    await resolveHeroNaturalDamage(monster, [AT_TUCH, AD_COLD, 6, 1], 0);
    assert.ok(potions.quan < 30, 'The cold attack should destroy part of the carried potion stack');
    assert.ok(monster.mhp < 200 && monster.mhp > 190, 'Only the shattered potion damage should penetrate cold resistance');
});
void test('a fire attack burns a straw golem completely and credits the hero without a corpse', async () => {
    const monster = await naturalAttackRoom('fire elemental', 'straw golem', /straw golem|You feel/);
    requirePlayingGame(game);
    const result = await resolveHeroNaturalDamage(monster, [AT_TUCH, AD_FIRE, 1, 1], 0);
    assert.equal(result.nativeResult, M_ATTK_DEF_DIED);
    assert.notEqual(monsterAtPosition(game.level, monster.mx, monster.my), monster);
    assert.equal(game.u.uconduct.killer, 1);
    assert.equal(floorObjectsAt(game.level, 11, 10).some(object => object.otyp === CORPSE), false);
});
void test('rust destroys an iron golem regardless of its remaining hit points', async () => {
    const monster = await naturalAttackRoom('rust monster', 'iron golem', /iron golem|You feel/);
    requirePlayingGame(game);
    const result = await resolveHeroNaturalDamage(monster, [AT_TUCH, AD_RUST, 0, 0], 0);
    assert.equal(result.nativeResult, M_ATTK_DEF_DIED);
    assert.notEqual(monsterAtPosition(game.level, monster.mx, monster.my), monster);
    assert.equal(game.u.uconduct.killer, 1);
});
void test('sleep contact immobilizes a grabber and releases its hold on a nonsticky hero', async () => {
    const monster = await naturalAttackRoom('homunculus', 'owlbear', /owlbear|grip relaxes/);
    game.u.ustuck = monster;
    await resolveHeroNaturalDamage(monster, [AT_TUCH, AD_SLEE, 0, 0], 0);
    assert.equal(monster.mcanmove, 0);
    assert.ok((monster.mfrozen ?? 0) > 0);
    assert.equal(game.u.ustuck, null);
});
void test('ravens cannot blind one another but can blind another eyed monster', async () => {
    const raven = await naturalAttackRoom('raven', 'raven', /goblin is blinded/);
    const goblin = await createMonsterAt('goblin', 10, 11, NO_MINVENT | MM_NOGRP | MM_NOWAIT);
    await resolveHeroNaturalDamage(raven, [AT_CLAW, AD_BLND, 2, 1], 0);
    await resolveHeroNaturalDamage(goblin, [AT_CLAW, AD_BLND, 2, 1], 0);
    assert.equal(raven.mcansee, 1);
    assert.equal(goblin.mcansee, 0);
    assert.equal(goblin.mblinded, 2);
});
void test('a natural confusion attack still damages and interrupts a waiting target', async () => {
    const monster = await naturalAttackRoom('umber hulk', 'goblin', /goblin looks confused/);
    monster.mstrategy = STRAT_WAITFORU;
    await resolveHeroNaturalDamage(monster, [AT_TUCH, AD_CONF, 3, 1], 0);
    assert.equal(monster.mhp, 197);
    assert.equal(monster.mconf, 1);
    assert.equal((monster.mstrategy ?? 0) & STRAT_WAITFORU, 0);
});
void test('blue dragon scales prevent natural slowing while physical damage remains', async () => {
    const monster = await naturalAttackRoom('skeleton', 'goblin', /goblin/);
    await equipMonsterObject(monster, await knownObject(OBJECT_NAMES.indexOf('blue dragon scales')), W_ARM);
    const originalSpeed = monster.mspeed;
    await resolveHeroNaturalDamage(monster, [AT_TUCH, AD_SLOW, 3, 1], 0);
    assert.equal(monster.mhp, 197);
    assert.equal(monster.mspeed, originalSpeed);
});
void test('draining a level zero target kills it without healing the hero', async () => {
    const monster = await naturalAttackRoom('vampire', 'goblin', /goblin.*(?:weaker|dies)|You feel/);
    requirePlayingGame(game);
    monster.m_lev = 0;
    game.u.mh = 10;
    let result = { nativeResult: M_ATTK_MISS, heroDied: false };
    for (let attempt = 0; attempt < 32 && monster.mhp > 0; attempt++)
        result = await resolveHeroNaturalDamage(monster, [AT_TUCH, AD_DRLI, 0, 0], 0);
    assert.equal(result.nativeResult, M_ATTK_DEF_DIED);
    assert.notEqual(monsterAtPosition(game.level, monster.mx, monster.my), monster);
    assert.equal(monster.m_lev, 0);
    assert.equal(game.u.mh, 10);
});
void test('teleport contact leaves a one-hit-point target alive at its new location', async () => {
    const monster = await naturalAttackRoom('quantum mechanic', 'goblin', /goblin.*(?:disappears|vanishes|reappears)/);
    requirePlayingGame(game);
    monster.mhp = 1;
    const result = await resolveHeroNaturalDamage(monster, [AT_TUCH, AD_TLPT, 6, 1], 0);
    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.equal(monster.mhp, 1);
    assert.ok(game.level.monsters.includes(monster));
    assert.ok(monster.mx !== 11 || monster.my !== 10);
});
void test('a demon natural attack can summon a tame helper instead of striking', async () => {
    const monster = await naturalAttackRoom('barbed devil', 'goblin', /Some hell-p has arrived|appears|demon|devil/);
    requirePlayingGame(game);
    let result = { nativeResult: M_ATTK_HIT, heroDied: false };
    for (let attempt = 0; attempt < 128 && result.nativeResult !== M_ATTK_MISS; attempt++)
        result = await resolveHeroNaturalDamage(monster, [AT_CLAW, AD_PHYS, 0, 0], 0);
    const helper = game.level.monsters.find(candidate => candidate !== monster && (candidate.mtame ?? 0) > 0);
    assert.ok(helper, 'A demon summon must create and tame a real nearby monster');
    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(monster.mhp, 200);
});
//# sourceMappingURL=hero_natural_damage.test.js.map