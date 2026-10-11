import { floorObjectsAt } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { COULD_SEE, M_AP_OBJECT, P_BASIC, P_POLEARMS, W_WEP } from '../js/const.js';
import { map_invisible, map_object, newsym } from '../js/display.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { BOULDER, OBJECT_NAMES, STATUE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

async function reachWeaponRoom() {
    freshObjectRoom();
    requirePlayingGame(game);
    const weapon = await addInventoryObject(OBJECT_NAMES.indexOf('halberd'), {
        spe: 20, wielded: true, owornmask: W_WEP,
    });
    game.uwep = game.u.uwep = weapon;
    installHeroWeaponSkills({ [P_POLEARMS]: P_BASIC });
}

async function fire() {
    await rhack('f'.charCodeAt(0));
}

void test('a sensed monster in darkness is a valid automatic polearm target', async () => {
    await reachWeaponRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('jackal', 12, 10);
    monster.mhp = monster.mhpmax = 1000;
    game.u.detectMonsters = true;
    const visibleRow = game.viz_array?.[10];
    assert.ok(visibleRow);
    visibleRow[12] = COULD_SEE;
    newsym(12, 10);

    await fire();

    assert.ok(monster.mhp < 1000);
    assert.equal(game.context.move, 1);
});

void test('a detected statue-disguised mimic can be attacked as a monster', async () => {
    await reachWeaponRoom();
    requirePlayingGame(game);
    const mimic = await createMonsterAt('small mimic', 12, 10);
    mimic.m_ap_type = M_AP_OBJECT;
    mimic.mappearance = STATUE;
    mimic.mhp = 1000;
    mimic.mhpmax = 1000;
    mimic.mpeaceful = false;
    game.u.detectMonsters = true;
    newsym(12, 10);

    await fire();

    assert.ok(mimic.mhp < 1000);
    assert.equal(mimic.m_ap_type, 0);
    assert.equal(game.context.move, 1);
});

void test('a hallucinated statue looks attackable but is not treated as a displayed statue', async () => {
    await reachWeaponRoom();
    requirePlayingGame(game);
    const statue = placeCreatedObject(await knownObject(STATUE, { corpsenm: 0 }), 12, 10);
    game.u.hallucinationTurns = 20;
    map_object(statue);

    await fire();

    assert.match(game._lastPlineMessage, /You miss; there is no one there to hit/);
    assert.equal(game.context.move, 1);
});

void test('a remembered statue remains targetable after its unseen removal', async () => {
    await reachWeaponRoom();
    requirePlayingGame(game);
    const statue = placeCreatedObject(await knownObject(STATUE, { corpsenm: 0 }), 12, 10);
    map_object(statue);
    const visibleRow = game.viz_array?.[10];
    assert.ok(visibleRow);
    visibleRow[12] = COULD_SEE;
    floorObjectsAt(requireGameLevel(), 12, 10).length = 0;
    game.u.confused = true;
    newsym(12, 10);

    await fire();

    assert.match(game._lastPlineMessage, /You miss; there is no one there to hit/);
    assert.equal(game.context.move, 1);
});

void test('an empty invisible marker does not turn a hidden boulder into a thump target', async () => {
    await reachWeaponRoom();
    requirePlayingGame(game);
    placeCreatedObject(await knownObject(BOULDER), 12, 10);
    map_invisible(12, 10);

    await fire();

    assert.match(game._lastPlineMessage, /You miss; there is no one there to hit/);
    assert.equal(game.context.move, 1);
});

void test('an ordinary hallucinated statue object is not a statue-family target', async () => {
    await reachWeaponRoom();
    requirePlayingGame(game);
    const arrow = placeCreatedObject(await knownObject(OBJECT_NAMES.indexOf('arrow')), 12, 10);
    game.u.hallucinationTurns = 20;
    initRng(1731n);
    map_object(arrow);

    await fire();

    assert.match(game._lastPlineMessage, /Don't know what to hit/);
    assert.equal(game.context.move, 0);
});
