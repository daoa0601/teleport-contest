import test from 'node:test';
import assert from 'node:assert/strict';

import { removeHeroAccessory, wearHeroAccessory } from '../js/accessory.js';
import { MM_NOGRP, NON_PM, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { remove_object } from '../js/floor_object.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { gotoLevel } from '../js/level_change.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { hideMonsterUnder } from '../js/monster_hiding.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { RIN_PROTECTION_FROM_SHAPE_CHANGERS, ROCK, TRIPE_RATION } from '../js/object_data.js';
import { beginPetEating, finishPetEating } from '../js/pet_eating.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';

void test('a resident heals and its timed troubles run down while the hero visits another level', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.verbose = false;
    const resident = await createMonsterAt('jackal', 15, 10, MM_NOGRP | NO_MINVENT);
    resident.mhp = 3;
    resident.mhpmax = 20;
    resident.mcansee = 0;
    resident.mblinded = 18;
    resident.mcanmove = 0;
    resident.mfrozen = 19;
    resident.mflee = 1;
    resident.mfleetim = 17;
    resident.mspec_used = 12;

    await gotoLevel({ dlevel: 2 }, { arrival: 'stairs' });
    game.moves += 400;
    await gotoLevel({ dlevel: 1 }, { arrival: 'stairs' });

    assert.equal(game.level, source);
    assert.ok(source.monsters.includes(resident));
    assert.equal(resident.mhp, 20);
    // Catch-up leaves the final timed turn for the live monster turn owner.
    assert.equal(resident.mblinded, 1);
    assert.equal(resident.mfrozen, 1);
    assert.equal(resident.mfleetim, 1);
    assert.equal(resident.mspec_used, 0);
});

void test('a pet abandoned without food becomes feral instead of starving to death off level', async () => {
    const { source, destination } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.verbose = false;
    const pet = await createMonsterAt('housecat', 15, 10, MM_NOGRP | NO_MINVENT);
    initializePet(pet);
    assert.ok(pet.edog);
    pet.edog.hungrytime = game.moves;

    await gotoLevel({ dlevel: 2 }, { arrival: 'stairs' });
    assert.ok(source.monsters.includes(pet), 'The distant pet must stay on its original level.');
    assert.equal(destination.monsters.includes(pet), false);
    game.moves += 800;
    await gotoLevel({ dlevel: 1 }, { arrival: 'stairs' });

    assert.ok(source.monsters.includes(pet));
    assert.ok(pet.mhp > 0, 'Off-level starvation leaves a living wild animal.');
    assert.equal(pet.mtame, 0);
    assert.equal(!!pet.mpeaceful, false);
});

void test('protection gained on another level restores a resident shapechanger even without elapsed moves', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.verbose = false;
    const chameleon = MONSTER_NAME.indexOf('chameleon');
    const resident = await createMonsterAt(chameleon, 15, 10, MM_NOGRP | NO_MINVENT);
    await changeMonsterForm(resident, MONSTER_NAME.indexOf('little dog'));
    const moves = game.moves;

    await gotoLevel({ dlevel: 2 }, { arrival: 'stairs' });
    const ring = await addInventoryObject(RIN_PROTECTION_FROM_SHAPE_CHANGERS);
    await wearHeroAccessory(ring, 'uleft');
    await gotoLevel({ dlevel: 1 }, { arrival: 'stairs' });

    assert.equal(game.level, source);
    assert.equal(game.moves, moves);
    assert.equal(resident.mnum, chameleon);
    assert.equal(resident.cham, NON_PM);
});

void test('removing protection elsewhere lets a resident chameleon change shape again without elapsed moves', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.verbose = false;
    const ring = await addInventoryObject(RIN_PROTECTION_FROM_SHAPE_CHANGERS);
    await wearHeroAccessory(ring, 'uleft');
    const chameleon = MONSTER_NAME.indexOf('chameleon');
    const resident = await createMonsterAt(chameleon, 15, 10, MM_NOGRP | NO_MINVENT);
    assert.equal(resident.cham, NON_PM);
    const moves = game.moves;

    await gotoLevel({ dlevel: 2 }, { arrival: 'stairs' });
    await removeHeroAccessory(ring);
    await gotoLevel({ dlevel: 1 }, { arrival: 'stairs' });

    assert.equal(game.level, source);
    assert.equal(game.moves, moves);
    assert.equal(resident.mnum, chameleon);
    assert.equal(resident.cham, chameleon);
});

void test('returning to a level exposes a hiding resident whose cover was removed', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.verbose = false;
    const snake = await createMonsterAt('garter snake', 15, 10, MM_NOGRP | NO_MINVENT);
    const cover = await floorObject(ROCK, 15, 10);
    installPagerInput(resetInputState(), {
        expected: /You see the garter snake slither under a rock\./,
        limit: 1,
    });
    await hideMonsterUnder(snake);
    assert.equal(!!snake.mundetected, true);
    remove_object(cover);

    await gotoLevel({ dlevel: 2 }, { arrival: 'stairs' });
    game.moves += 20;
    await gotoLevel({ dlevel: 1 }, { arrival: 'stairs' });

    assert.ok(source.monsters.includes(snake));
    assert.equal(!!snake.mundetected, false);
});

void test('an adjacent pet stays on the departing level while finishing its meal', async () => {
    const { source, destination } = freshConnectedLevels();
    requirePlayingGame(game);
    game.flags.verbose = false;
    const pet = await createMonsterAt('little dog', 11, 10, MM_NOGRP | NO_MINVENT);
    initializePet(pet);
    const food = await floorObject(TRIPE_RATION, 11, 10);
    installPagerInput(resetInputState(), {
        expected: /little dog (?:eats an uncursed tripe ration|is still eating)/,
        limit: 2,
    });
    await finishPetEating(pet, beginPetEating(pet, food, { x: 11, y: 10 }));
    assert.ok((pet.meating ?? 0) > 0);

    await gotoLevel({ dlevel: 2 }, { arrival: 'stairs' });

    assert.equal(game.level, destination);
    assert.ok(source.monsters.includes(pet));
    assert.equal(destination.monsters.includes(pet), false);
    assert.ok((pet.meating ?? 0) > 0);
});
