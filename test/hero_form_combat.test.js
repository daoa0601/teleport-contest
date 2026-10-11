import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT, PIT, TT_PIT, Upolyd } from '../js/const.js';
import { game } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, OBJECT_NAMES } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setPrimaryWeapon, setSecondaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
async function combatRoom(form, defender = 'hill giant', formHealth = 200) {
    const level = freshObjectRoom({
        left: 9, right: 11, top: 9, bottom: 11,
        flags: { verbose: true, disclose: '-i -a -v -c -o' },
        hero: { uhitinc: 100, uhp: 200, uhpmax: 200 },
    });
    installPolymorphedHero(form, { hitPoints: formHealth });
    const monster = await createMonsterAt(defender, 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    monster.mhp = monster.mhpmax = 500;
    monster.mpeaceful = false;
    monster.msleeping = 0;
    monster.mcanmove = 1;
    monster.mfrozen = 0;
    monster.minvis = 0;
    monster.mundetected = 0;
    return { level, monster };
}
// Observe the prose shown at real message input boundaries. A new question
// or an unbounded pager fails instead of receiving an unrelated space.
async function attackEast(expected, seed = 1n) {
    const messages = [];
    const input = resetInputState();
    installPagerInput(input, { expected, limit: 12 });
    const pager = input.display;
    assert.ok(pager);
    input.display = {
        async readKey() {
            messages.push(game._pending_message);
            return pager.readKey();
        },
    };
    initRng(seed);
    await rhack('l'.charCodeAt(0));
    messages.push(game._pending_message);
    return messages.join('\n');
}
void test('a minotaur movement attack delivers both claws and its head butt', async () => {
    const { monster } = await combatRoom('minotaur');
    const messages = await attackEast(/hill giant/);
    const damage = 500 - monster.mhp;
    assert.ok(damage >= 8 && damage <= 76, `Three natural attacks dealt ${damage} damage`);
    assert.equal(messages.match(/You hit the hill giant/g)?.length, 2);
    assert.match(messages, /You head butt the hill giant/);
    assert.equal(game.u.uconduct?.weaphit ?? 0, 0);
});
for (const form of ['acid blob', 'floating eye', 'gas spore']) {
    void test(`a ${form} cannot turn its passive attack into an ordinary melee hit`, async () => {
        const { monster } = await combatRoom(form);
        const messages = await attackEast(/no way to attack monsters physically/);
        assert.equal(monster.mhp, 500);
        assert.match(messages, /You have no way to attack monsters physically/);
        assert.ok(Upolyd(game.u));
    });
}
void test('a wielded weapon replaces one claw while later natural attacks remain', async () => {
    const { monster } = await combatRoom('minotaur');
    const dagger = await addInventoryObject(DAGGER, { spe: 0 });
    await setPrimaryWeapon(dagger);
    const messages = await attackEast(/hill giant/);
    assert.equal(game.u.uconduct?.weaphit, 1);
    assert.match(messages, /You head butt the hill giant/);
    assert.equal(messages.match(/You hit the hill giant/g)?.length, 2);
    assert.ok(monster.mhp < 500);
    assert.equal(game.uwep, dagger);
});
void test('an ettin alternates actual weapons while two-weapon mode is off', async () => {
    const { monster } = await combatRoom('ettin');
    await setPrimaryWeapon(await addInventoryObject(DAGGER, { spe: 0 }));
    const secondary = await addInventoryObject(DAGGER, { spe: 20 });
    await setSecondaryWeapon(secondary);
    assert.equal(!!game.u.twoweap, false);
    await attackEast(/hill giant/);
    assert.equal(game.u.uconduct?.weaphit, 2);
    assert.ok(500 - monster.mhp >= 20, 'The enchanted secondary must contribute its damage.');
    assert.equal(game.uswapwep, secondary);
    assert.equal(!!game.u.twoweap, false);
});
void test('a cursed secondary drops after its strike and ends a marilith sequence', async () => {
    const { level } = await combatRoom('marilith');
    await setPrimaryWeapon(await addInventoryObject(DAGGER, { spe: 0 }));
    const secondary = await addInventoryObject(DAGGER, { spe: 0, cursed: true });
    await setSecondaryWeapon(secondary);
    const messages = await attackEast(/hill giant|dagger.*(?:grasp|drops)|left hand/);
    assert.equal(game.u.uconduct?.weaphit, 2);
    assert.equal(game.uswapwep, null);
    assert.equal(secondary.where, 'floor');
    assert.ok(floorObjectsAt(level, game.u.ux, game.u.uy).includes(secondary));
    assert.equal(messages.match(/You hit the hill giant/g)?.length, 2, 'The four later claws must not follow the cursed secondary.');
});
void test('a successful two-handed weapon strike uses both of an ettin\'s weapon attacks', async () => {
    await combatRoom('ettin');
    await setPrimaryWeapon(await addInventoryObject(OBJECT_NAMES.indexOf('two-handed sword'), { spe: 0 }));
    const messages = await attackEast(/hill giant/);
    assert.equal(game.u.uconduct?.weaphit, 1);
    assert.equal(messages.match(/You hit the hill giant/g)?.length, 1);
});
void test('a horse trapped in a pit can bite but cannot use its kick attack', async () => {
    const { level, monster } = await combatRoom('horse');
    const pit = addTrap(level, PIT, game.u.ux, game.u.uy);
    installPagerInput(resetInputState(), { expected: /pit|You fall/, limit: 3 });
    await triggerHeroTrap(pit, { forceTrap: true });
    assert.equal(game.u.utraptype, TT_PIT);
    assert.ok((game.u.utrap ?? 0) > 0);
    const messages = await attackEast(/hill giant/);
    assert.match(messages, /You bite the hill giant/);
    assert.doesNotMatch(messages, /You kick/);
    assert.ok(500 - monster.mhp >= 1 && 500 - monster.mhp <= 3);
});
void test('an owlbear grabs after two claws and crushes its held victim on the next command', async () => {
    const { monster } = await combatRoom('owlbear');
    const first = await attackEast(/hill giant/);
    assert.equal(game.u.ustuck, monster);
    assert.match(first, /You grab the hill giant/);
    const heldHealth = monster.mhp;
    const second = await attackEast(/hill giant/, 2n);
    assert.equal(game.u.ustuck, monster);
    assert.match(second, /The hill giant is being crushed/);
    assert.ok(monster.mhp < heldHealth);
});
void test('a rope golem throttles a held mindless nonbreather for only minimal hug damage', async () => {
    const { monster } = await combatRoom('rope golem', 'human zombie');
    game.u.ustuck = monster;
    const messages = await attackEast(/human zombie/);
    const damage = 500 - monster.mhp;
    assert.ok(damage >= 3 && damage <= 9, `Two claws and a one-point hug dealt ${damage}`);
    assert.match(messages, /being throttled/);
    assert.doesNotMatch(messages, /doesn't seem concerned/, 'The native message does not attribute concern to a mindless target.');
});
void test('a floating eye can freeze a polymorphed attacker before its later natural attacks', async () => {
    const { monster } = await combatRoom('minotaur', 'floating eye');
    const messages = await attackEast(/floating eye|frozen/, 2n);
    assert.ok((game._helplessTurns ?? 0) > 0, 'The observed gaze should leave the hero paralyzed.');
    assert.match(messages, /You are frozen/);
    assert.doesNotMatch(messages, /head butt/);
    assert.equal(messages.match(/You hit the floating eye/g)?.length, 1);
    assert.ok(500 - monster.mhp <= 30, 'Only the first claw may run before paralysis.');
});
void test('passive damage which ends the monster form also ends the natural attack sequence', async () => {
    const { monster } = await combatRoom('minotaur', 'Oracle', 1);
    const messages = await attackEast(/Oracle|magic missiles|human|normal|return/);
    assert.equal(Upolyd(game.u), false);
    assert.match(messages, /magic missiles/);
    assert.doesNotMatch(messages, /head butt/);
    assert.ok(500 - monster.mhp >= 3 && 500 - monster.mhp <= 30);
});
void test('petrifying contact ends the command before later natural attacks', async () => {
    const { monster } = await combatRoom('minotaur', 'cockatrice');
    game.storage = memoryStorage();
    const messages = await attackEast(/cockatrice|turn to stone|REST|PEACE|points|Goodbye/);
    assert.equal(game.program_state.gameover, true);
    assert.match(messages, /turn to stone/);
    assert.doesNotMatch(messages, /head butt/);
    assert.ok(500 - monster.mhp >= 3 && 500 - monster.mhp <= 30);
});
void test('a flaming sphere damages its target by exploding and returns to human form', async () => {
    const { monster } = await combatRoom('flaming sphere');
    const messages = await attackEast(/explode|hill giant|human|normal|return/);
    assert.match(messages, /You explode/);
    assert.equal(Upolyd(game.u), false);
    assert.ok(500 - monster.mhp >= 4 && 500 - monster.mhp <= 24);
    assert.equal(game.u.uconduct?.weaphit ?? 0, 0);
});
void test('a gaze slot does not add a weapon swing before the pyrolisk bite', async () => {
    const { monster } = await combatRoom('pyrolisk');
    await setPrimaryWeapon(await addInventoryObject(DAGGER, { spe: 20 }));
    const messages = await attackEast(/hill giant/);
    assert.match(messages, /You bite the hill giant/);
    assert.equal(game.u.uconduct?.weaphit ?? 0, 0);
    assert.ok(500 - monster.mhp >= 1 && 500 - monster.mhp <= 6);
});
void test('an owlbear can claw an unsolid monster but its hug cannot hold it', async () => {
    const { monster } = await combatRoom('owlbear', 'air elemental');
    const messages = await attackEast(/air elemental|grab attempt/);
    assert.ok(!game.u.ustuck);
    assert.match(messages, /grab attempt passes right through/);
    assert.ok(500 - monster.mhp >= 2 && 500 - monster.mhp <= 12);
});
//# sourceMappingURL=hero_form_combat.test.js.map