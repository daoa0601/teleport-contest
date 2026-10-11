import test from 'node:test';
import assert from 'node:assert/strict';
import { LOST_THROWN, M_ATTK_AGR_DONE, M_ATTK_DEF_DIED, NO_MINVENT, STRAT_WAITFORU, W_ARMG, W_WEP } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AD_SEDU, AD_SGLD, AD_SITM, AD_SSEX, AT_TUCH } from '../js/monster_attack_types.js';
import { resolveMonsterCombatDamage } from '../js/monster_combat_damage.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { APPLE, DAGGER, GOLD_PIECE, LEATHER_GLOVES, STATUE } from '../js/object_data.js';
import { knownObject, untimedCorpse } from './support/game-objects.js';
import { runExtendedCommand } from './support/commands.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, createSaddledSteed, equipMonsterObject, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
async function theftFight(species = 'monkey') {
    const level = freshObjectRoom({ right: 22, gameplaySeed: 37n });
    requirePlayingGame(game);
    level.flags.noteleport = true;
    const attacker = await createMonsterAt(species, 11, 10, NO_MINVENT);
    const defender = await createMonsterAt('soldier', 12, 10, NO_MINVENT);
    attacker.mhp = attacker.mhpmax = 20;
    defender.mhp = defender.mhpmax = 20;
    const messages = [];
    const options = {
        state: game, visible: true, random: (bound) => bound - 1,
        rollDice: (count, sides) => count * sides,
        publish: (message) => { messages.push(message); },
    };
    installPagerInput(resetInputState(), { expected: /steal|stone|saddle|ride|dismount|pit|teleport|looks much better/, limit: 10 });
    return { level, attacker, defender, options, messages };
}
const itemTheftTypes = [AD_SITM, AD_SEDU, AD_SSEX];
for (const type of itemTheftTypes) {
    void test(`monster theft ${type} transfers a wielded object without applying pickup side effects`, async () => {
        const { attacker, defender, options } = await theftFight();
        const dagger = await equipMonsterObject(defender, await knownObject(DAGGER), W_WEP);
        dagger.how_lost = LOST_THROWN;
        dagger.no_charge = true;
        defender.mstrategy = STRAT_WAITFORU;
        await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, type, 1, 3], options);
        assert.ok(attacker.minvent.includes(dagger));
        assert.equal(dagger.ocarry, attacker);
        assert.equal(dagger.carrierMid, attacker.m_id);
        assert.equal(dagger.how_lost, LOST_THROWN);
        assert.equal(dagger.no_charge, true);
        assert.equal(dagger.owornmask, 0);
        assert.equal(defender.mw, null);
        assert.equal(defender.mhp, 20);
        assert.equal(defender.mstrategy & STRAT_WAITFORU, 0);
    });
}
void test('a tame thief skips cursed possessions and steals the first acceptable item', async () => {
    const { attacker, defender, options } = await theftFight();
    initializePet(attacker);
    const apple = await knownObject(APPLE);
    const cursed = await knownObject(DAGGER, { cursed: true });
    await addObjectToMonsterInventory(defender, apple);
    await addObjectToMonsterInventory(defender, cursed);
    await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_SITM, 1, 3], options);
    assert.ok(attacker.minvent.includes(apple));
    assert.ok(defender.minvent.includes(cursed));
    assert.equal(defender.mhp, 20);
});
for (const goldAttack of [false, true]) {
    void test(`cancellation ${goldAttack ? 'removes gold-theft damage' : 'retains item-theft physical damage'}`, async () => {
        const { attacker, defender, options } = await theftFight();
        attacker.mcan = true;
        const object = await knownObject(goldAttack ? GOLD_PIECE : APPLE);
        await addObjectToMonsterInventory(defender, object);
        await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, goldAttack ? AD_SGLD : AD_SITM, 1, 3], options);
        assert.ok(defender.minvent.includes(object));
        assert.equal(defender.mhp, goldAttack ? 20 : 17);
    });
}
void test('a nymph escapes after stealing while a teleport restriction keeps her in place', async () => {
    const { level, attacker, defender, options, messages } = await theftFight('wood nymph');
    await addObjectToMonsterInventory(defender, await knownObject(APPLE));
    const blocked = await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_SEDU, 0, 0], options);
    assert.equal(attacker.mx, 11);
    assert.equal(blocked.nativeResult & M_ATTK_AGR_DONE, 0);
    assert.match(messages.join('\n'), /mysterious force prevents/);
    level.flags.noteleport = false;
    await addObjectToMonsterInventory(defender, await knownObject(DAGGER));
    const escaped = await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_SEDU, 0, 0], {
        ...options, random: bound => bound === 21 ? 10 : bound - 1,
        rollOne: bound => Math.min(bound, 14),
    });
    assert.equal(attacker.mx, 14);
    assert.equal(attacker.my, 10);
    assert.ok(escaped.nativeResult & M_ATTK_AGR_DONE);
});
void test('gold theft merges the entire purse and leaves other possessions', async () => {
    const { attacker, defender, options } = await theftFight('leprechaun');
    const purse = await knownObject(GOLD_PIECE, { quan: 10 });
    await addObjectToMonsterInventory(attacker, purse);
    const apple = await knownObject(APPLE);
    await addObjectToMonsterInventory(defender, apple);
    await addObjectToMonsterInventory(defender, await knownObject(GOLD_PIECE, { quan: 39 }));
    await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_SGLD, 1, 3], options);
    assert.equal(purse.quan, 49);
    assert.ok(defender.minvent.includes(apple));
    assert.equal(defender.minvent.some(object => object.oclass === 12), false);
    assert.equal(defender.mhp, 20);
});
void test('glove theft petrifies a corpse-wielding victim and grows the thief without hero credit', async () => {
    const { level, attacker, defender, options } = await theftFight();
    const corpse = await untimedCorpse(MONSTER_NAME.indexOf('cockatrice'));
    await equipMonsterObject(defender, corpse, W_WEP);
    const gloves = await equipMonsterObject(defender, await knownObject(LEATHER_GLOVES), W_ARMG);
    const oldMaximum = attacker.mhpmax;
    const result = await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_SITM, 0, 0], options);
    assert.ok(result.nativeResult & M_ATTK_DEF_DIED);
    assert.equal(defender.dead, true);
    assert.ok(attacker.minvent.includes(gloves));
    assert.ok(attacker.mhpmax > oldMaximum);
    const statue = floorObjectsAt(level, 12, 10).find(object => object.otyp === STATUE);
    assert.ok(statue?.contents?.includes(corpse));
    assert.equal(requireMonsterVital(defender.mnum).died, 1);
    assert.equal(game.u.uconduct?.killer ?? 0, 0);
});
void test('stealing a mounted pony saddle dismounts the hero before transferring the saddle', async () => {
    const level = freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    installPagerInput(resetInputState(), { expected: /mount|ride|steal|saddle/, limit: 10 });
    await runExtendedCommand('ride', 'l');
    assert.equal(game.u.usteed, pony);
    const saddle = pony.saddle;
    assert.ok(saddle);
    const thief = await createMonsterAt('monkey', 12, 10, NO_MINVENT);
    const messages = [];
    await resolveMonsterCombatDamage(thief, pony, [AT_TUCH, AD_SITM, 0, 0], {
        state: game, visible: true, random: bound => bound - 1,
        publish: message => { messages.push(message); },
    });
    assert.equal(game.u.usteed, null);
    assert.ok(thief.minvent.includes(saddle));
    assert.equal(saddle.ocarry, thief);
    assert.equal(saddle.owornmask, 0);
    assert.equal(pony.saddle, null);
    assert.ok(level.monsters.includes(pony));
    assert.match(messages.join('\n'), /can no longer ride[\s\S]*steals/);
});
//# sourceMappingURL=monster_combat_theft.test.js.map