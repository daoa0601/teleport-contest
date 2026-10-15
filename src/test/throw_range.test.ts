import assert from 'node:assert/strict';
import test from 'node:test';

import { A_STR, STR19 } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { BOULDER, DAGGER } from '../js/object_data.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

void test('underwater throws stop one square from the hero', async () => {
    freshObjectRoom({ right: 35 });
    game.underwater = true;
    const dagger = await addInventoryObject(DAGGER);

    await throwInventoryObject(dagger);

    assert.equal(dagger.where, 'floor');
    assert.equal(dagger.ox, 11);
    assert.equal(dagger.oy, 10);
});

void test('a giant throws a boulder twenty squares regardless of its weight', async () => {
    freshObjectRoom({ right: 35 });
    installPolymorphedHero('hill giant');
    const boulder = await addInventoryObject(BOULDER);

    await throwInventoryObject(boulder);

    assert.equal(boulder.where, 'floor');
    assert.equal(boulder.ox, 30);
    assert.equal(boulder.oy, 10);
});

void test('Mjollnir travels half the ordinary hammer range for a non-Valkyrie', async () => {
    freshObjectRoom({ right: 35, role: 'caveman' });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = STR19(25);
    const hammer = await addInventoryItem(await artifactObject('Mjollnir'));
    await setPrimaryWeapon(hammer);

    await throwInventoryObject(hammer);

    assert.equal(hammer.where, 'floor');
    assert.equal(hammer.ox, 16);
    assert.equal(hammer.oy, 10);
});
