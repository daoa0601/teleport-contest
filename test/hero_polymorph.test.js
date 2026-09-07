import test from 'node:test';
import assert from 'node:assert/strict';

import { wearHeroArmor } from '../js/armor.js';
import { touchArtifactByHero } from '../js/artifact_touch.js';
import { A_CON, A_STR, BEAR_TRAP, STR18, STR19, WEB } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { loseHeroHp } from '../js/hero_damage.js';
import { heroIsSick, startHeroSickness } from '../js/hero_illness.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { retouchEquipment } from '../js/hero_retouch.js';
import { polymorphHero } from '../js/polyself.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    CLOAK_OF_PROTECTION, HAWAIIAN_SHIRT, LEATHER_ARMOR, LONG_SWORD,
    OBJECT_NAMES, SHIELD_OF_REFLECTION,
} from '../js/object_data.js';
import { roles, races } from '../js/roles.js';
import { heroIsSliming, startHeroSliming } from '../js/slime.js';
import { heroIsPetrifying, startHeroPetrification } from '../js/stoning.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import {
    installHeroChainedToBuriedBall, installPolymorphedHero, installPunishedHero,
} from './support/hero-state.js';
import { addTrap } from './support/level-state.js';

for (const [trapType, form] of [
    [WEB, 'fog cloud'], [WEB, 'giant spider'], [BEAR_TRAP, 'newt'],
]) {
    test(`a ${form} body escapes a ${trapType === WEB ? 'web' : 'bear trap'}`, async () => {
        const level = freshObjectRoom({ flags: { debug: true } });
        const trap = addTrap(level, trapType, game.u.ux, game.u.uy);
        await triggerHeroTrap(trap);
        assert.ok(game.u.utrap > 0);
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

test('a cloud slips out of punishment and leaves the iron ball behind', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    const { ball, chain } = installPunishedHero();
    pushKeys('polyself\nfog cloud\n                ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.uball, null);
    assert.equal(game.uchain, null);
    assert.ok(level.objects[game.u.ux][game.u.uy].includes(ball));
    assert.equal(chain.where, 'gone');
});

test('passing through walls releases a buried ball without dragging it to the hero', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    const x = game.u.ux - 1;
    const y = game.u.uy;
    const ball = installHeroChainedToBuriedBall({ x, y });
    pushKeys('polyself\nxorn\n                ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.utrap, 0);
    assert.ok(level.objects[x][y].includes(ball));
    assert.equal(level.buriedObjects.includes(ball), false);
    assert.ok(!game.uchain);
});

test('a ghoul body cures illness and cannot be infected again', async () => {
    freshObjectRoom({ flags: { debug: true } });
    startHeroSickness({ turns: 12, cause: 'tainted meat' });
    pushKeys('polyself\nghoul\n                ');

    await rhack('#'.charCodeAt(0));

    assert.equal(heroIsSick(), false);
    const infection = startHeroSickness({ turns: 12, cause: 'tainted meat' });
    assert.equal(infection.started, false);
});

for (const form of ['fire elemental', 'green slime']) {
    test(`becoming a ${form} stops the slime transformation`, async () => {
        freshObjectRoom({ flags: { debug: true } });
        startHeroSliming({ turns: 3 });
        pushKeys(`polyself\n${form}\n                `);

        await rhack('#'.charCodeAt(0));

        assert.equal(game.u.umonnum, MONSTER_NAME.indexOf(form));
        assert.equal(heroIsSliming(), false);
    });
}

test('a petrifying hero becomes a stone golem instead of the chosen golem', async () => {
    freshObjectRoom({ flags: { debug: true } });
    startHeroPetrification();
    pushKeys('polyself\nrope golem\n                ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.umonnum, MONSTER_NAME.indexOf('stone golem'));
    assert.equal(heroIsPetrifying(), false);
    assert.equal(game.u.mh, 100);
});

test('a goblin retains ordinary strength but has the orc strength limit', async () => {
    freshObjectRoom({ flags: { debug: true } });
    game.u.acurr.a[A_STR] = 16;
    pushKeys('polyself\ngoblin\n                ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.acurr.a[A_STR], 16);
    assert.equal(game.u.amax.a[A_STR], STR18(50));
});

test('living giant strength exceeds undead giant strength', async () => {
    freshObjectRoom({ flags: { debug: true } });
    pushKeys('polyself\nhill giant\n                ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.acurr.a[A_STR], STR19(19));
    resetInputState();
    pushKeys('polyself\ngiant zombie\n                ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.acurr.a[A_STR], STR18(100));
});

test('an adult dragon body has full health dice on the elemental planes', async () => {
    freshObjectRoom({ flags: { debug: true } });
    game.astral_level = { dnum: 7, dlevel: 1 };
    game.u.uz = { dnum: 7, dlevel: 3 };
    pushKeys('polyself\nred dragon\n                ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.mhmax, 120);
});

test('human renewal restarts the slime countdown even when already human', async () => {
    freshObjectRoom({ role: roles[0], flags: { debug: true }, gameplaySeed: 2317n });
    game.urace = races.find(race => race.name === 'human');
    game.u.umonster = game.u.umonnum = MONSTER_NAME.indexOf('archeologist');
    game.u.slimed = true;
    game.u.slimedTurns = 2;
    pushKeys('polyself\nhuman\n        ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.slimedTurns, 10);
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.match(game._pending_message, /still slime on you/);
});

test('a vampire taking silver damage loses monster health, not human health', async () => {
    freshObjectRoom({ role: roles[0], flags: { debug: true }, gameplaySeed: 2317n });
    const saber = addInventoryObject(OBJECT_NAMES.indexOf('silver saber'));
    setPrimaryWeapon(saber);
    const humanHealth = game.u.uhp;
    pushKeys('polyself\nvampire\n        ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.uhp, humanHealth);
    assert.ok(game.u.mh > 0 && game.u.mh < game.u.mhmax);
    assert.equal(game.uwep, null);
    assert.ok(game.level.objects[game.u.ux][game.u.uy].includes(saber));
});

test('losing a shield during polymorph also loses its reflection', async () => {
    freshObjectRoom({ role: roles[0], flags: { debug: true }, gameplaySeed: 2317n });
    const shield = addInventoryObject(SHIELD_OF_REFLECTION);
    wearHeroArmor(shield);
    assert.equal(game.u.reflection, true);
    pushKeys('polyself\nfog cloud\n        ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.uarms, null);
    assert.equal(game.u.reflection, false);
    assert.ok(game.level.objects[game.u.ux][game.u.uy].includes(shield));
});

test('an artifact blast that kills a monster form preserves the human body', async () => {
    freshObjectRoom({ role: roles[0], gameplaySeed: 2317n });
    game.urace = races.find(race => race.name === 'human');
    installPolymorphedHero('vampire', { hitPoints: 1 });
    const excalibur = artifactObject('Excalibur');
    const humanHealth = game.u.uhp;
    pushKeys('        ');

    const result = await touchArtifactByHero(excalibur);

    assert.equal(result.died, false);
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.uhp, humanHealth);
});

test('losing a form during equipment checks finishes the original item removal', async () => {
    freshObjectRoom({ role: roles[0], gameplaySeed: 2317n });
    game.urace = races.find(race => race.name === 'human');
    installPolymorphedHero('vampire', { hitPoints: 1 });
    const saber = addInventoryObject(OBJECT_NAMES.indexOf('silver saber'));
    setPrimaryWeapon(saber);
    const humanHealth = game.u.uhp;
    pushKeys('        ');

    const result = await retouchEquipment(2);

    assert.equal(result.died, false);
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.uhp, humanHealth);
    assert.equal(game.uwep, null);
    assert.ok(game.level.objects[game.u.ux][game.u.uy].includes(saber));
});

test('declining death in wizard mode restores an unchanging monster body', async () => {
    freshObjectRoom({ flags: { debug: true }, gameplaySeed: 2317n });
    installPolymorphedHero('vampire', { hitPoints: 1, maxHitPoints: 40 });
    game.u.unchanging = true;
    const vampire = game.u.umonnum;
    pushKeys(' n');

    const died = await loseHeroHp(5, 'injury');

    assert.equal(died, false);
    assert.equal(game.u.umonnum, vampire);
    assert.ok(game.u.mh > 0);
});

test('an expired polymorph timer does not move damage into the human body', async () => {
    freshObjectRoom();
    installPolymorphedHero('vampire', { turns: 0, hitPoints: 40 });
    const humanHealth = game.u.uhp;

    await loseHeroHp(5, 'injury');

    assert.equal(game.u.mh, 35);
    assert.equal(game.u.uhp, humanHealth);
});

test('a cloud slips out of its suit, cloak, and shirt', async () => {
    freshObjectRoom({ role: roles[0], flags: { debug: true } });
    const garments = [LEATHER_ARMOR, CLOAK_OF_PROTECTION, HAWAIIAN_SHIRT]
        .map(type => addInventoryObject(type));
    for (const garment of garments) wearHeroArmor(garment);
    pushKeys('polyself\nfog cloud\n                        ');

    await rhack('#'.charCodeAt(0));

    for (const garment of garments) {
        assert.equal(garment.worn, false);
        assert.ok(!game.inventory.includes(garment));
        assert.ok(game.level.objects[game.u.ux][game.u.uy].includes(garment));
    }
});

test('a handless form releases a welded sword without dropping it', async () => {
    freshObjectRoom({ role: roles[0], flags: { debug: true } });
    const sword = addInventoryObject(LONG_SWORD, { cursed: true });
    setPrimaryWeapon(sword);
    pushKeys('polyself\nfog cloud\n                        ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.uwep, null);
    assert.ok(game.inventory.includes(sword));
});

test('random polymorph can renew the human body instead of changing species', async () => {
    let renewed = false;
    let changedSpecies = false;
    for (let seed = 1; seed <= 32; seed++) {
        freshObjectRoom({ role: roles[0], gameplaySeed: BigInt(seed) });
        game.urace = races[0];
        game.u.umonster = game.u.umonnum = MONSTER_NAME.indexOf('archeologist');
        game.u.acurr.a[A_CON] = 25;
        game.u.uhunger = 1;
        pushKeys('                                ');

        const result = await polymorphHero();

        assert.equal(result.transformed, true, `seed ${seed}`);
        if (result.newman) {
            renewed = true;
            assert.equal(game.u.umonnum, game.u.umonster);
            assert.ok(game.u.uhunger >= 500);
        } else {
            changedSpecies = true;
            assert.notEqual(game.u.umonnum, game.u.umonster);
        }
    }
    assert.ok(renewed, 'random polymorph never renewed the human body');
    assert.ok(changedSpecies, 'random polymorph never changed species');
});

test('a luminous form lights the dungeon until the hero changes back', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    for (let x = 7; x <= 16; x++) {
        for (let y = 6; y <= 14; y++)
            Object.assign(level.at(x, y), { lit: false, waslit: false });
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
