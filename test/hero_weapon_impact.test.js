import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT, PIT, POOL, P_BASIC, P_EXPERT, P_ISRESTRICTED, P_LANCE, P_TWO_WEAPON_COMBAT, STONE, } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { gameLogEvents } from '../js/gamelog.js';
import { rollHeroJoust, resolveHeroJoust, tryHeroPuddingSplit } from '../js/hero_weapon_impact.js';
import { resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { monsterAtPosition, placeMonsterAt } from '../js/monster_location.js';
import { DAGGER, GOLD_PIECE, OBJECT_NAMES, POT_ACID } from '../js/object_data.js';
import { objectMaterial } from '../js/object_material.js';
import { initRng } from '../js/rng.js';
import { setPrimaryWeapon, setSecondaryWeapon, setTwoWeaponCombat } from '../js/weapon_slots.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
const LANCE = OBJECT_NAMES.indexOf('lance');
const BIRTH_FLAGS = MM_NOGRP | MM_NOWAIT | NO_MINVENT;
async function impactRoom(species = 'goblin') {
    const level = freshObjectRoom({
        role: 'knight', flags: { verbose: true },
        hero: { ulevel: 30, uhitinc: 100, dx: 1, dy: 0 },
    });
    requirePlayingGame(game);
    const monster = await createMonsterAt(species, 11, 10, BIRTH_FLAGS);
    monster.mhp = monster.mhpmax = 500;
    monster.mpeaceful = false;
    monster.msleeping = 0;
    const weapon = await addInventoryObject(LANCE);
    await setPrimaryWeapon(weapon);
    installHeroWeaponSkills({ [P_LANCE]: P_EXPERT, [P_TWO_WEAPON_COMBAT]: P_EXPERT });
    const messages = [];
    const publish = async (message) => { messages.push(message); };
    return { level, monster, weapon, messages, publish, state: game };
}
for (const impairment of ['fumbling', 'stunned', 'trapped']) {
    void test(`${impairment} prevents a wielded lance from jousting`, async () => {
        const { monster, weapon } = await impactRoom();
        if (impairment === 'fumbling')
            game.u.fumbling = true;
        else if (impairment === 'stunned')
            game.u.stunnedTurns = 4;
        else
            game.u.utrap = 4;
        initRng(2n);
        assert.equal(rollHeroJoust(monster, weapon), 0);
    });
}
void test('an alternate lance can joust only while two-weapon combat is active', async () => {
    const { monster } = await impactRoom();
    const secondary = await addInventoryObject(LANCE, { spe: 1 });
    await setSecondaryWeapon(secondary);
    initRng(2n);
    assert.equal(rollHeroJoust(monster, secondary), 0);
    setTwoWeaponCombat(true);
    initRng(2n);
    assert.equal(rollHeroJoust(monster, secondary), 1);
});
void test('two-weapon proficiency can limit an expert lancer', async () => {
    const { monster, weapon } = await impactRoom();
    await setSecondaryWeapon(await addInventoryObject(DAGGER));
    installHeroWeaponSkills({ [P_LANCE]: P_EXPERT, [P_TWO_WEAPON_COMBAT]: P_BASIC });
    initRng(2n);
    assert.equal(rollHeroJoust(monster, weapon), 1);
    setTwoWeaponCombat(true);
    initRng(2n);
    assert.equal(rollHeroJoust(monster, weapon), 0);
});
void test('a restricted lance skill still permits an unskilled joust', async () => {
    const { monster, weapon } = await impactRoom();
    installHeroWeaponSkills({ [P_LANCE]: P_ISRESTRICTED });
    initRng(385n);
    assert.equal(rollHeroJoust(monster, weapon), -1);
});
void test('the same hard impact breaks a lance on a solid creature but not an unsolid one', async () => {
    const { monster, weapon } = await impactRoom();
    const cloud = await createMonsterAt('fog cloud', 12, 10, BIRTH_FLAGS);
    initRng(385n);
    assert.equal(rollHeroJoust(monster, weapon), -1);
    initRng(385n);
    assert.equal(rollHeroJoust(cloud, weapon), 1);
});
void test('jousting adds lance damage and moves a survivor without subtracting pending damage', async () => {
    const { monster, weapon, publish, messages, state } = await impactRoom();
    state.u.uconduct.weaphit = 1;
    initRng(12n);
    const result = await resolveHeroJoust(monster, weapon, { damage: 10, joust: 1, publish });
    assert.ok(result.damage >= 12 && result.damage <= 30);
    assert.equal(result.alreadyKilled, false);
    assert.equal(result.heroDied, false);
    assert.equal(result.weapon, weapon);
    assert.equal(monster.mhp, 500);
    assert.equal(monster.mx, 12);
    assert.equal(monster.my, 10);
    assert.equal(monster.movement, 0);
    assert.equal(monster.mstun, 1);
    assert.match(messages.join('\n'), /You joust the goblin!/);
    assert.equal(gameLogEvents().filter(event => event.text.includes('wielded weapon')).length, 1);
});
void test('a secondary lance gets its smaller native jousting bonus', async () => {
    const { monster, publish } = await impactRoom();
    const secondary = await addInventoryObject(LANCE, { spe: 1 });
    await setSecondaryWeapon(secondary);
    setTwoWeaponCombat(true);
    initRng(12n);
    const result = await resolveHeroJoust(monster, secondary, { damage: 10, joust: 1, publish });
    assert.ok(result.damage >= 12 && result.damage <= 14);
    assert.equal(monster.mx, 12);
});
void test('lethal pending joust damage does not push the target onto a trap', async () => {
    const { level, monster, weapon, publish } = await impactRoom();
    monster.mhp = 5;
    addTrap(level, PIT, 12, 10);
    const result = await resolveHeroJoust(monster, weapon, { damage: 5, joust: 1, publish });
    assert.equal(result.alreadyKilled, false);
    assert.equal(monster.mhp, 5);
    assert.equal(monster.mx, 11);
    assert.equal(!!monster.mtrapped, false);
});
void test('a jousted survivor lands in a pit before pending weapon damage is applied', async () => {
    const { level, monster, weapon, publish } = await impactRoom();
    addTrap(level, PIT, 12, 10);
    initRng(12n);
    const result = await resolveHeroJoust(monster, weapon, { damage: 30, joust: 1, publish });
    assert.equal(result.alreadyKilled, false);
    assert.equal(monster.mx, 12);
    assert.equal(monster.mtrapped, 1);
    assert.ok(monster.mhp >= 494 && monster.mhp < 500);
});
void test('drowning during a joust finishes and credits death before the pending weapon hit', async () => {
    const { level, monster, weapon, publish, state } = await impactRoom();
    state.u.uconduct.weaphit = 1;
    level.requireAt(12, 10).typ = POOL;
    initRng(12n);
    const result = await resolveHeroJoust(monster, weapon, { damage: 10, joust: 1, publish });
    assert.equal(result.alreadyKilled, true);
    assert.equal(result.heroDied, false);
    assert.equal(monster.dead, true);
    assert.notEqual(monsterAtPosition(level, monster.mx, monster.my), monster);
    assert.equal(state.u.uconduct.killer, 1);
    assert.ok(state.u.uexp > 0);
    const events = gameLogEvents().map(event => event.text);
    const firstHit = events.findIndex(text => text.includes('wielded weapon'));
    const firstKill = events.findIndex(text => text.includes('killed for the first time'));
    assert.ok(firstHit >= 0 && firstKill > firstHit, 'The in-game chronicle should record the hit before the kill.');
});
void test('jousting an unseen pet into water drops its inventory before announcing grief', async () => {
    const { level, monster: pet, weapon } = await impactRoom('little dog');
    initializePet(pet);
    pet.minvis = true;
    game.u.uluck = -5;
    level.requireAt(12, 10).typ = POOL;
    const acid = await knownObject(POT_ACID);
    await addObjectToMonsterInventory(pet, acid);
    const messages = [];
    let griefPaged = false;
    const input = resetInputState();
    installPagerInput(input, {
        expected: /joust|drown|potion.*explodes|sad feeling|thunder/,
        limit: 8,
    });
    input.beforeRead = () => {
        messages.push(game._pending_message);
        if (game._pending_message.includes('sad feeling')) {
            griefPaged = true;
            assert.equal(acid.where, 'gone', 'Grief follows the dropped potion exploding.');
            assert.equal(pet.minvent.length, 0, 'Grief follows releasing the pet inventory.');
            assert.notEqual(monsterAtPosition(level, pet.mx, pet.my), pet, 'Grief follows removing the pet from the map.');
        }
    };
    const result = await resolveHeroJoust(pet, weapon, { damage: 10, joust: 1 });
    assert.equal(result.alreadyKilled, true);
    assert.equal(griefPaged, true, 'The hero must acknowledge the grief message.');
    const text = [...messages, game._pending_message].join('\n');
    const explosion = text.search(/potion.*explodes/);
    const grief = text.indexOf('You have a sad feeling for a moment, then it passes.');
    assert.ok(explosion >= 0 && grief > explosion, `The potion must explode before grief is announced: ${text}`);
});
for (const secondary of [false, true]) {
    void test(`a broken ${secondary ? 'secondary' : 'primary'} lance consumes one stacked item and leaves correct slots`, async () => {
        const { monster, weapon: original, publish } = await impactRoom();
        const lance = await addInventoryObject(LANCE, { spe: 2, quan: 2 });
        if (secondary)
            await setSecondaryWeapon(lance);
        else {
            await setPrimaryWeapon(lance);
            await setSecondaryWeapon(await addInventoryObject(DAGGER));
        }
        setTwoWeaponCombat(true);
        const result = await resolveHeroJoust(monster, lance, { damage: 10, joust: -1, publish });
        assert.equal(result.weapon, null);
        assert.equal(game.u.twoweap, false);
        assert.equal(lance.quan, 1);
        assert.ok(game.inventory.includes(lance));
        assert.equal(game.uwep, secondary ? original : null);
        if (secondary)
            assert.equal(game.uswapwep, lance);
        else
            assert.equal(lance.wielded, false);
    });
}
async function puddingRoom(species = 'black pudding') {
    const setup = await impactRoom(species);
    const weapon = await addInventoryObject(DAGGER);
    await setPrimaryWeapon(weapon);
    setup.monster.mhp = 21;
    setup.monster.mhpmax = 80;
    return { ...setup, weapon };
}
for (const species of ['black pudding', 'brown pudding']) {
    void test(`an iron melee weapon splits a ${species} without copying its inventory`, async () => {
        const { level, monster, weapon, publish, messages } = await puddingRoom(species);
        const gold = await knownObject(GOLD_PIECE, { quan: 17 });
        await addObjectToMonsterInventory(monster, gold);
        const result = await tryHeroPuddingSplit(monster, weapon, {
            handToHand: true, material: objectMaterial(weapon), offMap: false, publish,
        });
        const clone = level.monsters.find(other => other !== monster && other.mnum === monster.mnum);
        assert.equal(result.split, true);
        assert.ok(clone);
        assert.equal(monster.mhp + clone.mhp, 21);
        assert.equal(monster.mhp, 11);
        assert.equal(clone.mhp, 10);
        assert.equal(monster.mhpmax, 80);
        assert.equal(clone.mhpmax, 80);
        assert.ok(monster.minvent.includes(gold));
        assert.equal(clone.minvent?.length, 0);
        assert.equal(gold.ocarry, monster);
        assert.match(messages.join('\n'), /divides as you hit it!/);
    });
}
for (const guard of ['cancelled', 'one hit point', 'off map', 'thrown', 'wooden weapon', 'missile', 'unwielded']) {
    void test(`a ${guard} hit cannot split a pudding`, async () => {
        const { level, monster, weapon, publish } = await puddingRoom();
        let object = weapon;
        if (guard === 'cancelled')
            monster.mcan = 1;
        if (guard === 'one hit point')
            monster.mhp = 1;
        if (guard === 'wooden weapon' || guard === 'missile') {
            object = await addInventoryObject(OBJECT_NAMES.indexOf(guard === 'missile' ? 'dart' : 'club'));
            await setPrimaryWeapon(object);
        }
        if (guard === 'unwielded')
            await setPrimaryWeapon(null);
        const result = await tryHeroPuddingSplit(monster, object, {
            handToHand: guard !== 'thrown', offMap: guard === 'off map',
            material: objectMaterial(object), publish,
        });
        assert.equal(result.split, false);
        assert.equal(level.monsters.filter(other => other.mnum === monster.mnum).length, 1);
    });
}
void test('a metal scalpel in an active off hand can split a pudding', async () => {
    const { level, monster, publish, messages } = await puddingRoom();
    const scalpel = await addInventoryObject(OBJECT_NAMES.indexOf('scalpel'));
    await setSecondaryWeapon(scalpel);
    const options = { handToHand: true, material: objectMaterial(scalpel), offMap: false, publish };
    assert.equal((await tryHeroPuddingSplit(monster, scalpel, options)).split, false);
    setTwoWeaponCombat(true);
    assert.equal((await tryHeroPuddingSplit(monster, scalpel, options)).split, true);
    assert.equal(level.monsters.filter(other => other.mnum === monster.mnum).length, 2);
    assert.match(messages.join('\n'), /divides as you hit it with your scalpel!/);
});
void test('a pudding clone immediately encounters the trap in its only available square', async () => {
    const { level, monster, weapon, publish } = await puddingRoom();
    for (let x = 10; x <= 12; x++) {
        for (let y = 9; y <= 11; y++) {
            if (y !== 10)
                level.requireAt(x, y).typ = STONE;
        }
    }
    addTrap(level, PIT, 12, 10);
    const result = await tryHeroPuddingSplit(monster, weapon, {
        handToHand: true, material: objectMaterial(weapon), offMap: false, publish,
    });
    const clone = level.monsters.find(other => other !== monster && other.mnum === monster.mnum);
    assert.equal(result.split, true);
    assert.ok(clone);
    assert.equal(clone.mx, 12);
    assert.equal(clone.my, 10);
    assert.equal(clone.mtrapped, 1);
    assert.ok(clone.mhp < 10);
    assert.equal(monster.mhp, 11);
});
void test('a mounted lance attack can joust while the same unmounted command cannot', async () => {
    for (const mounted of [false, true]) {
        const { monster } = await impactRoom();
        if (mounted) {
            const pony = await createSaddledSteed('pony', { x: 10, y: 11 });
            await runExtendedCommand('ride', 'j');
            assert.equal(game.u.usteed, pony);
            // Mounting moves the hero onto the pony's square.
            placeMonsterAt(monster, game.u.ux + 1, game.u.uy);
        }
        const input = resetInputState();
        installPagerInput(input, { expected: /goblin|pony|lance/, limit: 8 });
        const messages = [];
        const pager = input.display;
        assert.ok(pager);
        input.display = { async readKey() { messages.push(game._pending_message); return pager.readKey(); } };
        initRng(2n);
        await rhack('l'.charCodeAt(0));
        messages.push(game._pending_message);
        if (mounted) {
            assert.match(messages.join('\n'), /You joust the goblin/);
            assert.equal(monster.mx, 12);
        }
        else
            assert.doesNotMatch(messages.join('\n'), /You joust/);
    }
});
//# sourceMappingURL=hero_weapon_impact.test.js.map