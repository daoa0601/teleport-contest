import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { wearHeroArmor } from '../js/armor.js';
import { M_ATTK_HIT, M_ATTK_MISS, MM_ANGRY, MM_NOGRP, MM_NOWAIT, MMOVE_NOTHING, NO_MINVENT, ROOM, STONE, W_AMUL, W_WEP } from '../js/const.js';
import { plineWithContinuation } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { makeDeaf } from '../js/hero_hearing.js';
import { resetInputState } from '../js/input.js';
import { monsterAtPosition, placeMonsterAt } from '../js/monster_location.js';
import { AT_SPIT } from '../js/monster_attack_types.js';
import { MONSTER_ATTACKS } from '../js/monster_data.js';
import { resolveMonsterCombatSpit, resolveMonsterSpitAtHero } from '../js/monster_spit.js';
import { performPetRangedAttack, runMonsterAction } from '../js/monmove.js';
import { AMULET_OF_LIFE_SAVING, DAGGER, HELMET } from '../js/object_data.js';
import { initRng, rn2, rnd } from '../js/rng.js';
import { vision_note_blocker_change, vision_recalc } from '../js/vision.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
const BIRTH_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOWAIT | NO_MINVENT;
async function spitRoom(sourceName = 'black naga', targetName = 'jackal', heroTarget = false) {
    freshObjectRoom({
        left: 7, right: 22, top: 6, bottom: 15,
        heroX: heroTarget ? 12 : 15, heroY: heroTarget ? 10 : 12,
        flags: { verbose: true },
    });
    requirePlayingGame(game);
    const source = await createMonsterAt(sourceName, 9, 10, BIRTH_FLAGS);
    const target = heroTarget ? null : await createMonsterAt(targetName, 12, 10, BIRTH_FLAGS);
    source.msleeping = 0;
    source.mux = game.u.ux;
    source.muy = game.u.uy;
    if (target)
        target.mhp = target.mhpmax = 100;
    const foundAttack = MONSTER_ATTACKS[source.mnum]?.find(([method]) => method === AT_SPIT);
    assert.ok(foundAttack, `${sourceName} needs a native spit attack.`);
    const attack = foundAttack;
    game.context.mon_moving = true;
    installPagerInput(resetInputState(), {
        expected: /venom|acid|rattle|blind|unaffected|kill|medallion|But wait|looks much better|feel much better|new life|amulet of life saving|dagger|It burns!/i,
        limit: 20,
    });
    const messages = [];
    const publish = async (message, options) => {
        messages.push(message);
        await plineWithContinuation(message, options);
    };
    async function spit({ launch = true, hit = true } = {}) {
        requirePlayingGame(game);
        const options = {
            state: game, publish,
            random: (limit) => launch ? 0 : limit - 1,
            rollOne: (sides) => hit ? 1 : sides,
        };
        return target ? resolveMonsterCombatSpit(source, target, attack, options)
            : resolveMonsterSpitAtHero(source, attack, options);
    }
    initRng(43261n);
    return { source, target, spit, messages };
}
void test('a black naga spits acid through the shared projectile owner', async () => {
    const { source, target, spit, messages } = await spitRoom();
    assert.ok(target);
    const result = await spit();
    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.equal(result.heroDied, false);
    assert.equal(target.mhp, 98);
    assert.equal(source.mx, 9);
    assert.ok(messages.includes('The black naga spits venom!'));
    assert.equal(game._thrownObject, null);
});
void test('acid venom leaves an acid-resistant target unharmed', async () => {
    const { target, spit } = await spitRoom('black naga', 'yellow dragon');
    assert.ok(target);
    const result = await spit();
    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.equal(target.mhp, 100);
});
void test('venom waits for the launch message pager before striking its target', async () => {
    const { target, spit } = await spitRoom();
    assert.ok(target);
    const input = resetInputState();
    await plineWithContinuation('You listen for danger while watching the distant black naga.');
    const attack = spit();
    await input.waitUntilBlocked();
    assert.equal(target.mhp, 100, 'The paused launch has not struck the target.');
    assert.ok(!game._thrownObject, 'Flight starts only after the launch message resumes.');
    installPagerInput(input, { expected: /venom|acid/, limit: 8 });
    input.feed(' ');
    await attack;
    assert.equal(target.mhp, 98);
});
void test('blinding venom cannot blind an eyeless target', async () => {
    const { target, spit } = await spitRoom('cobra', 'gelatinous cube');
    assert.ok(target);
    await spit();
    assert.equal(target.mcansee, 1);
    assert.ok(!target.mblinded);
    assert.equal(target.mhp, 100);
});
void test('blinding venom blinds a seeing monster without damaging it', async () => {
    const { target, spit } = await spitRoom('cobra');
    assert.ok(target);
    await spit();
    assert.equal(target.mcansee, 0);
    assert.equal(target.mblinded, 21);
    assert.equal(target.mhp, 100);
});
void test('an intervening monster intercepts venom before the intended victim', async () => {
    const { target, spit } = await spitRoom();
    assert.ok(target);
    const bystander = await createMonsterAt('jackal', 10, 10, BIRTH_FLAGS);
    bystander.mhp = bystander.mhpmax = 100;
    await spit();
    assert.equal(bystander.mhp, 98);
    assert.equal(target.mhp, 100);
    assert.equal(game.bhitpos.x, 10);
    assert.equal(game.bhitpos.y, 10);
});
void test('a launched miss still stops repeated commands and spends pet hunger', async () => {
    const { source, target, spit } = await spitRoom('black naga', 'black dragon');
    assert.ok(target);
    source.m_lev = 50;
    initializePet(source);
    assert.ok(source.edog);
    source.edog.hungrytime = 3;
    game.multi = 7;
    const result = await spit({ hit: false });
    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.equal(target.mhp, 100, 'Venom does not gain a weapon archer accuracy bonus.');
    assert.equal(game.multi, 0);
    assert.equal(source.edog.hungrytime, -2);
});
void test('an unlaunched spit leaves the hero command and pet hunger unchanged', async () => {
    const { source, target, spit, messages } = await spitRoom();
    assert.ok(target);
    initializePet(source);
    assert.ok(source.edog);
    const hunger = source.edog.hungrytime;
    game.multi = 7;
    const result = await spit({ launch: false });
    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(target.mhp, 100);
    assert.equal(source.edog.hungrytime, hunger);
    assert.equal(game.multi, 7);
    assert.equal(messages.length, 0);
    assert.ok(!game._thrownObject);
});
void test('a pet minion does not get hungry when spitting', async () => {
    const { source, spit } = await spitRoom();
    initializePet(source);
    assert.ok(source.edog);
    source.isminion = 1;
    source.emin = { min_align: 0, renegade: false };
    const hunger = source.edog.hungrytime;
    await spit();
    assert.equal(source.edog.hungrytime, hunger);
});
void test('a cancelled monster rattles before considering whether its target is aligned', async () => {
    const { source, target, spit, messages } = await spitRoom();
    assert.ok(target);
    source.mcan = 1;
    target.my = 11;
    const result = await spit();
    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(target.mhp, 100);
    assert.ok(messages.some(message => /dry rattle comes from the black naga's throat/.test(message)));
});
void test('a deaf hero cannot hear a cancelled spitter', async () => {
    const { source, spit, messages } = await spitRoom();
    source.mcan = 1;
    await makeDeaf(10, { talk: false });
    await spit();
    assert.equal(messages.length, 0);
});
void test('a cancelled spitter exactly eight squares away is silent', async () => {
    const { source, spit, messages } = await spitRoom();
    source.mcan = 1;
    source.mx = game.u.ux - 8;
    source.my = game.u.uy;
    await spit();
    assert.equal(messages.length, 0);
});
void test('an unseen cancelled spitter produces the ordinary heard rattle', async () => {
    const { source, spit, messages } = await spitRoom();
    source.mcan = 1;
    source.minvis = 1;
    await spit();
    assert.ok(messages.includes('You hear a dry rattle nearby.'));
});
void test('solid rock between monsters prevents a spit launch', async () => {
    const { target, spit, messages } = await spitRoom();
    requirePlayingGame(game);
    assert.ok(target);
    game.level.requireAt(10, 10).typ = STONE;
    vision_note_blocker_change(10, 10);
    vision_recalc(0);
    const result = await spit();
    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.equal(target.mhp, 100);
    assert.equal(messages.length, 0);
});
void test('a venom kill is resolved before the spitter completes its attack', async () => {
    const { target, spit } = await spitRoom();
    requirePlayingGame(game);
    assert.ok(target);
    target.mhp = 1;
    const experience = game.u.uexp;
    const result = await spit();
    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.equal(monsterAtPosition(game.level, target.mx, target.my), null);
    assert.equal(game.u.uexp, experience);
    assert.equal(game.u.uconduct.killer ?? 0, 0);
});
void test('monster life saving completes during an acid spit', async () => {
    const { target, spit } = await spitRoom();
    requirePlayingGame(game);
    assert.ok(target);
    const amulet = await equipMonsterObject(target, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    target.mhp = 1;
    const result = await spit();
    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.equal(amulet.where, 'gone');
    assert.ok(target.mhp > 0);
    assert.equal(monsterAtPosition(game.level, target.mx, target.my), target);
});
void test('life saving rescues the hero during fatal acid flight', async () => {
    const { spit } = await spitRoom('black naga', 'jackal', true);
    requirePlayingGame(game);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    game.u.uhp = 1;
    const result = await spit();
    assert.equal(result.heroDied, false);
    assert.ok(game.u.uhp > 0);
    assert.equal(amulet.where, 'gone');
});
void test('a visored helmet protects the hero from venom blindness', async () => {
    const { spit } = await spitRoom('cobra', 'jackal', true);
    assert.ok(game.objectDescriptions);
    game.objectDescriptions[HELMET] = 'visored helmet';
    wearHeroArmor(await addInventoryObject(HELMET));
    const result = await spit();
    assert.equal(result.nativeResult, M_ATTK_HIT);
    assert.equal(game.u.blindTurns ?? 0, 0);
    assert.equal(game.u.ucreamed ?? 0, 0);
});
void test('a pet black naga cannot reach its later spit slot after skipping a distant bite', async () => {
    const { source, target } = await spitRoom('black naga', 'orc-captain');
    requirePlayingGame(game);
    assert.ok(target);
    initializePet(source);
    assert.ok(source.edog);
    const hunger = source.edog.hungrytime;
    const action = await performPetRangedAttack(source, game, {
        random: () => 0, rollOne: () => 1,
    });
    // pet_ranged_attk aims bhitpos at the pet's square. The first bite is
    // out of reach; mattackm's next-slot check cannot find its target there.
    assert.equal(action.status, MMOVE_NOTHING);
    assert.ok(action.attack?.kind === 'monster-attack');
    assert.equal(action.attack.nativeResult, M_ATTK_MISS);
    assert.equal(source.mx, 9);
    assert.equal(source.my, 10);
    assert.equal(target.mhp, 100);
    assert.equal(source.edog.hungrytime, hunger);
});
void test('a pet black naga can keep moving after its distant attack is not admitted', async () => {
    const { source, target } = await spitRoom('black naga', 'orc-captain');
    requirePlayingGame(game);
    assert.ok(target);
    initializePet(source);
    assert.ok(source.edog);
    const hunger = source.edog.hungrytime;
    await runMonsterAction(source, game, () => 0, (count, sides) => count * sides, () => 1);
    assert.equal(Math.max(Math.abs(source.mx - 9), Math.abs(source.my - 10)), 1);
    assert.equal(game.level.requireAt(source.mx, source.my).typ, ROOM);
    assert.equal(monsterAtPosition(game.level, source.mx, source.my), source);
    assert.equal(target.mhp, 100);
    assert.equal(source.edog.hungrytime, hunger);
});
void test('a cobra completes venom retaliation against a pet', async () => {
    const { source, target } = await spitRoom('cobra', 'orc-captain');
    requirePlayingGame(game);
    assert.ok(target);
    initializePet(target);
    await equipMonsterObject(target, await knownObject(DAGGER, { quan: 5 }), W_WEP);
    // Seven squares makes the venom launch automatic. A thrown dagger can
    // reach that distance without a launcher's shorter pet missile limit.
    placeMonsterAt(target, 16, 10);
    source.mhp = source.mhpmax = 100;
    const action = await performPetRangedAttack(target, game, {
        random: limit => limit === 4 ? 1 : rn2(limit),
        rollOne: sides => sides === 20 ? 1 : rnd(sides),
    });
    assert.ok(action.counterattack, 'The attacked cobra gets its native retaliation.');
    assert.ok(source.mhp < 100, 'The pet must attack before retaliation.');
    assert.equal(target.mcansee, 0);
    assert.ok((target.mblinded ?? 0) > 0);
    assert.equal(target.mhp, 100);
});
//# sourceMappingURL=monster_spit.test.js.map