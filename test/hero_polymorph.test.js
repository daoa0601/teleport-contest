import { createSpecialLevel } from './support/topology.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroArmor } from '../js/armor.js';
import { touchArtifactByHero } from '../js/artifact_touch.js';
import { A_CON, A_STR, BEAR_TRAP, PIT, POOL, STR18, STR19, TT_PIT, WEB, } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { requireGameLevel, game } from '../js/gstate.js';
import { loseHeroHp } from '../js/hero_damage.js';
import { heroIsSick, startHeroSickness } from '../js/hero_illness.js';
import { spendHeroNutrition } from '../js/hunger.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { retouchEquipment } from '../js/hero_retouch.js';
import { polymorphHero } from '../js/polyself.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CLOAK_OF_PROTECTION, HAWAIIAN_SHIRT, LEATHER_ARMOR, LONG_SWORD, OBJECT_NAMES, SHIELD_OF_REFLECTION, } from '../js/object_data.js';
import { roles, races } from '../js/roles.js';
import { heroIsSliming, startHeroSliming } from '../js/slime.js';
import { heroIsPetrifying, startHeroPetrification } from '../js/stoning.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installHeroChainedToBuriedBall, installPolymorphedHero, installPunishedHero, installSwallowedHero, } from './support/hero-state.js';
import { floorObjectsAt, addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
function requiredRole(predicate) {
    const role = roles.find(predicate);
    assert.ok(role, 'native role exists');
    return role;
}
function requiredRace(predicate) {
    const race = races.find(predicate);
    assert.ok(race, 'native race exists');
    return race;
}
void test('a giant body is expelled and falls into the pit beneath the monster', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    requireFixtureGame(game);
    const worm = await createMonsterAt('purple worm', game.u.ux + 1, game.u.uy);
    addTrap(level, PIT, game.u.ux, game.u.uy);
    await installSwallowedHero(worm);
    pushKeys('polyself\nhill giant\n                                ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.ustuck, null);
    assert.ok(worm.mx !== game.u.ux || worm.my !== game.u.uy);
    assert.equal(game.u.utraptype, TT_PIT);
    assert.ok((game.u.utrap ?? 0) > 0);
});
void test('an unsolid body escapes an engulfer even without becoming huge', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requireFixtureGame(game);
    const worm = await createMonsterAt('purple worm', game.u.ux + 1, game.u.uy);
    await installSwallowedHero(worm);
    pushKeys('polyself\nfog cloud\n                                ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.ustuck, null);
});
void test('a small new body remains inside a large engulfer', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requireFixtureGame(game);
    const worm = await createMonsterAt('purple worm', game.u.ux + 1, game.u.uy);
    await installSwallowedHero(worm);
    pushKeys('polyself\ngoblin\n                                ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.uswallow, 1);
    assert.equal(game.u.ustuck, worm);
});
void test('a grabbing body makes its holder release rather than swapping who holds whom', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requireFixtureGame(game);
    const python = await createMonsterAt('python', game.u.ux + 1, game.u.uy);
    game.u.ustuck = python;
    pushKeys('polyself\nowlbear\n                                ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.ustuck, null);
});
void test('returning to human form releases a monster held by the old body', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const python = await createMonsterAt('python', game.u.ux + 1, game.u.uy);
    installPolymorphedHero('owlbear');
    game.u.ustuck = python;
    pushKeys('                                ');
    await loseHeroHp(game.u.mh, 'injury');
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.ustuck, null);
});
void test('losing flight puts a swimming body into the water below', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    requireFixtureGame(game);
    installPolymorphedHero('bat');
    level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    pushKeys('polyself\nnewt\n                                ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.flying, false);
    assert.equal(game.u.swimming, true);
    assert.equal(game.u.uinwater, 1);
});
void test('losing a flying body over water makes the human seek dry land', async () => {
    const level = freshObjectRoom();
    requireFixtureGame(game);
    installPolymorphedHero('bat');
    level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    pushKeys('                                ');
    await loseHeroHp(game.u.mh, 'injury');
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.flying, false);
    assert.notEqual(level.requireAt(game.u.ux, game.u.uy).typ, POOL);
    assert.ok(game.u.uhp > 0);
});
for (const [trapType, form] of [
    [WEB, 'fog cloud'], [WEB, 'giant spider'], [BEAR_TRAP, 'newt'],
]) {
    void test(`a ${form} body escapes a ${trapType === WEB ? 'web' : 'bear trap'}`, async () => {
        const level = freshObjectRoom({ flags: { debug: true } });
        requireFixtureGame(game);
        const trap = addTrap(level, trapType, game.u.ux, game.u.uy);
        await triggerHeroTrap(trap);
        assert.ok((game.u.utrap ?? 0) > 0);
        pushKeys(`polyself\n${form}\n                `);
        await rhack('#'.charCodeAt(0));
        assert.equal(game.u.utrap, 0);
        assert.ok(level.traps.includes(trap), 'escaping does not destroy the trap');
        resetInputState();
        const x = game.u.ux;
        await rhack('l'.charCodeAt(0));
        assert.equal(game.u.ux, x + 1);
    });
}
void test('a cloud slips out of punishment and leaves the iron ball behind', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    requireFixtureGame(game);
    const { ball, chain } = await installPunishedHero();
    pushKeys('polyself\nfog cloud\n                ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.uball, null);
    assert.equal(game.uchain, null);
    assert.ok(floorObjectsAt(level, game.u.ux, game.u.uy).includes(ball));
    assert.equal(chain.where, 'gone');
});
void test('passing through walls releases a buried ball without dragging it to the hero', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    requireFixtureGame(game);
    const x = game.u.ux - 1;
    const y = game.u.uy;
    const ball = await installHeroChainedToBuriedBall({ x, y });
    pushKeys('polyself\nxorn\n                ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.utrap, 0);
    assert.ok(floorObjectsAt(level, x, y).includes(ball));
    assert.ok(level.buriedObjects != null);
    assert.equal(level.buriedObjects.includes(ball), false);
    assert.ok(!game.uchain);
});
void test('a ghoul body cures illness and cannot be infected again', async () => {
    freshObjectRoom({ flags: { debug: true } });
    await startHeroSickness({ turns: 12, cause: 'tainted meat' });
    pushKeys('polyself\nghoul\n                ');
    await rhack('#'.charCodeAt(0));
    assert.equal(heroIsSick(), false);
    const infection = await startHeroSickness({ turns: 12, cause: 'tainted meat' });
    assert.equal(infection.started, false);
});
for (const form of ['fire elemental', 'green slime']) {
    void test(`becoming a ${form} stops the slime transformation`, async () => {
        freshObjectRoom({ flags: { debug: true } });
        requireFixtureGame(game);
        startHeroSliming({ turns: 3 });
        pushKeys(`polyself\n${form}\n                `);
        await rhack('#'.charCodeAt(0));
        assert.equal(game.u.umonnum, MONSTER_NAME.indexOf(form));
        assert.equal(heroIsSliming(), false);
    });
}
void test('a petrifying hero becomes a stone golem instead of the chosen golem', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requireFixtureGame(game);
    startHeroPetrification();
    pushKeys('polyself\nrope golem\n                ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.umonnum, MONSTER_NAME.indexOf('stone golem'));
    assert.equal(heroIsPetrifying(), false);
    assert.equal(game.u.mh, 100);
});
void test('a goblin retains ordinary strength but has the orc strength limit', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requireFixtureGame(game);
    game.u.acurr.a[A_STR] = 16;
    pushKeys('polyself\ngoblin\n                ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.acurr.a[A_STR], 16);
    assert.equal(game.u.amax.a[A_STR], STR18(50));
});
// C polyself.c:uasmon_maxStr(): orc-captains and Uruk-hai keep 18/100
// instead of the hero orc limit.
for (const form of ['orc-captain', 'Uruk-hai']) {
    void test(`an ${form} body has full exceptional strength`, async () => {
        freshObjectRoom({ flags: { debug: true } });
        requireFixtureGame(game);
        pushKeys(`polyself\n${form}\n                `);
        await rhack('#'.charCodeAt(0));
        assert.equal(game.u.acurr.a[A_STR], STR18(100));
        assert.equal(game.u.amax.a[A_STR], STR18(100));
    });
}
void test('living giant strength exceeds undead giant strength', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requireFixtureGame(game);
    pushKeys('polyself\nhill giant\n                ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.acurr.a[A_STR], STR19(19));
    resetInputState();
    pushKeys('polyself\ngiant zombie\n                ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.acurr.a[A_STR], STR18(100));
});
void test('an adult dragon body has full health dice on the elemental planes', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requireFixtureGame(game);
    game.astral_level = createSpecialLevel({ dnum: 7, dlevel: 1 });
    game.u.uz = { dnum: 7, dlevel: 3 };
    pushKeys('polyself\nred dragon\n                ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.mhmax, 120);
});
void test('human renewal restarts the slime countdown even when already human', async () => {
    freshObjectRoom({ role: 'archeologist', flags: { debug: true }, gameplaySeed: 2317n });
    requireFixtureGame(game);
    game.urace = requiredRace(race => race.name === 'human');
    game.u.umonster = game.u.umonnum = MONSTER_NAME.indexOf('archeologist');
    game.u.slimed = true;
    game.u.slimedTurns = 2;
    pushKeys('polyself\nhuman\n        ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.slimedTurns, 10);
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.match(game._pending_message, /still slime on you/);
});
void test('a vampire taking silver damage loses monster health, not human health', async () => {
    freshObjectRoom({ role: 'archeologist', flags: { debug: true }, gameplaySeed: 2317n });
    requireFixtureGame(game);
    const saber = await addInventoryObject(OBJECT_NAMES.indexOf('silver saber'));
    await setPrimaryWeapon(saber);
    const humanHealth = game.u.uhp;
    pushKeys('polyself\nvampire\n        ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.uhp, humanHealth);
    assert.ok(game.u.mh > 0 && game.u.mh < game.u.mhmax);
    assert.equal(game.uwep, null);
    assert.ok(floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy).includes(saber));
});
void test('losing a shield during polymorph also loses its reflection', async () => {
    freshObjectRoom({ role: 'archeologist', flags: { debug: true }, gameplaySeed: 2317n });
    requireFixtureGame(game);
    const shield = await addInventoryObject(SHIELD_OF_REFLECTION);
    wearHeroArmor(shield);
    assert.equal(game.u.reflection, true);
    pushKeys('polyself\nfog cloud\n        ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.uarms, null);
    assert.equal(game.u.reflection, false);
    assert.ok(floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy).includes(shield));
});
void test('an artifact blast that kills a monster form preserves the human body', async () => {
    freshObjectRoom({ role: 'archeologist', gameplaySeed: 2317n });
    requireFixtureGame(game);
    game.urace = requiredRace(race => race.name === 'human');
    installPolymorphedHero('vampire', { hitPoints: 1 });
    const excalibur = await artifactObject('Excalibur');
    const humanHealth = game.u.uhp;
    pushKeys('        ');
    const result = await touchArtifactByHero(excalibur);
    assert.equal(result.died, false);
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.uhp, humanHealth);
});
void test('losing a form during equipment checks finishes the original item removal', async () => {
    freshObjectRoom({ role: 'archeologist', gameplaySeed: 2317n });
    requireFixtureGame(game);
    game.urace = requiredRace(race => race.name === 'human');
    installPolymorphedHero('vampire', { hitPoints: 1 });
    const saber = await addInventoryObject(OBJECT_NAMES.indexOf('silver saber'));
    await setPrimaryWeapon(saber);
    const humanHealth = game.u.uhp;
    pushKeys('        ');
    const result = await retouchEquipment(2);
    assert.equal(result.died, false);
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.uhp, humanHealth);
    assert.equal(game.uwep, null);
    assert.ok(floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy).includes(saber));
});
void test('declining death in wizard mode restores an unchanging monster body', async () => {
    freshObjectRoom({ flags: { debug: true }, gameplaySeed: 2317n });
    requireFixtureGame(game);
    installPolymorphedHero('vampire', { hitPoints: 1, maxHitPoints: 40 });
    game.u.unchanging = true;
    const vampire = game.u.umonnum;
    pushKeys(' n');
    const died = await loseHeroHp(5, 'injury');
    assert.equal(died, false);
    assert.equal(game.u.umonnum, vampire);
    assert.ok(game.u.mh > 0);
});
void test('an expired polymorph timer does not move damage into the human body', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    installPolymorphedHero('vampire', { turns: 0, hitPoints: 40 });
    const humanHealth = game.u.uhp;
    await loseHeroHp(5, 'injury');
    assert.equal(game.u.mh, 35);
    assert.equal(game.u.uhp, humanHealth);
});
void test('a cloud slips out of its suit, cloak, and shirt', async () => {
    freshObjectRoom({ role: 'archeologist', flags: { debug: true } });
    requireFixtureGame(game);
    const garments = [];
    for (const type of [LEATHER_ARMOR, CLOAK_OF_PROTECTION, HAWAIIAN_SHIRT])
        garments.push(await addInventoryObject(type));
    for (const garment of garments)
        wearHeroArmor(garment);
    pushKeys('polyself\nfog cloud\n                        ');
    await rhack('#'.charCodeAt(0));
    for (const garment of garments) {
        assert.equal(garment.worn, false);
        assert.ok(!game.inventory.includes(garment));
        assert.ok(floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy).includes(garment));
    }
});
void test('a handless form releases a welded sword without dropping it', async () => {
    freshObjectRoom({ role: 'archeologist', flags: { debug: true } });
    requireFixtureGame(game);
    const sword = await addInventoryObject(LONG_SWORD, { cursed: true });
    await setPrimaryWeapon(sword);
    pushKeys('polyself\nfog cloud\n                        ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.uwep, null);
    assert.ok(game.inventory.includes(sword));
});
void test('random polymorph can renew the human body instead of changing species', async () => {
    let renewed = false;
    let changedSpecies = false;
    for (let seed = 1; seed <= 32; seed++) {
        freshObjectRoom({ role: 'archeologist', gameplaySeed: BigInt(seed) });
        requireFixtureGame(game);
        game.urace = requiredRace(race => race.name === 'human');
        game.u.umonster = game.u.umonnum = MONSTER_NAME.indexOf('archeologist');
        game.u.acurr.a[A_CON] = 25;
        await spendHeroNutrition(899);
        pushKeys('                                ');
        const result = await polymorphHero();
        assert.equal(result.transformed, true, `seed ${seed}`);
        if ('newman' in result && result.newman) {
            renewed = true;
            assert.equal(game.u.umonnum, game.u.umonster);
            assert.ok(game.u.uhunger >= 500);
            assert.equal(game.u.atemp.a[A_STR], 0);
        }
        else {
            changedSpecies = true;
            assert.notEqual(game.u.umonnum, game.u.umonster);
        }
    }
    assert.ok(renewed, 'random polymorph never renewed the human body');
    assert.ok(changedSpecies, 'random polymorph never changed species');
});
void test('a luminous form lights the dungeon until the hero changes back', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    requireFixtureGame(game);
    for (let x = 7; x <= 16; x++) {
        for (let y = 6; y <= 14; y++) {
            const location = level.requireAt(x, y);
            location.lit = false;
            location.waslit = false;
        }
    }
    const x = game.u.ux + 2;
    const y = game.u.uy;
    vision_recalc(0);
    assert.equal(cansee(x, y), false);
    pushKeys('polyself\ngold dragon\n                ');
    await rhack('#'.charCodeAt(0));
    vision_recalc(0);
    assert.equal(cansee(x, y), true);
    resetInputState();
    pushKeys('polyself\ncaveman\n                ');
    await rhack('#'.charCodeAt(0));
    vision_recalc(0);
    assert.equal(cansee(x, y), false);
});
//# sourceMappingURL=hero_polymorph.test.js.map