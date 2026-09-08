import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { wearHeroArmor } from '../js/armor.js';
import { remove_object } from '../js/floor_object.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING, LEATHER_GLOVES } from '../js/object_data.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addInventoryObject, untimedCorpse } from './support/game-objects.js';
import { installPolymorphedHero, installPunishedHero } from './support/hero-state.js';

test('quest stairs require permission from the leader', async () => {
    const { source } = freshConnectedLevels({ dungeonName: 'The Quest' });
    game._activeSpecialLevel = { prototype: 'Cav-strt' };
    pushKeys(' '.repeat(8));

    await rhack('>'.charCodeAt(0));

    assert.ok(game.level === source, 'the hero left the quest entrance without permission');
    assert.equal(game.u.uz.dlevel, 1);
    assert.match(game._pending_message, /mysterious force prevents you from descending/);
});

test('falling down stairs hurts the polymorphed body, not saved human health', async () => {
    const { destination } = freshConnectedLevels();
    installPolymorphedHero('stone golem');
    game.u.fumbling = true;
    const humanHealth = game.u.uhp;
    const bodyHealth = game.u.mh;
    pushKeys(' '.repeat(8));

    await rhack('>'.charCodeAt(0));

    assert.ok(game.level === destination, 'the hero did not reach the lower level');
    assert.equal(game.u.uhp, humanHealth);
    assert.ok(game.u.mh < bodyHealth);
});

test('stair arrivals deliver the destination level message', async () => {
    freshConnectedLevels();
    game._levelCache.get('0:2').activeSpecialLevel = {
        specialMessages: ['A cold wind blows from below.'],
    };
    pushKeys(' '.repeat(8));

    await rhack('>'.charCodeAt(0));

    assert.match(game._last_message, /cold wind blows/);
});

test('returning upstairs restores the original level and the linked stair', async () => {
    const { source } = freshConnectedLevels({ ladder: true });
    const departure = game.stairs;
    pushKeys(' '.repeat(8));

    await rhack('>'.charCodeAt(0));
    assert.match(game._last_message, /climb down the ladder/);
    await rhack('<'.charCodeAt(0));

    assert.ok(game.level === source, 'returning upstairs rebuilt the original level');
    assert.equal(game.u.ux, departure.sx);
    assert.equal(game.u.uy, departure.sy);
    assert.equal(departure.u_traversed, true);
});

test('a carried punishment ball is dropped on the destination after a stair tumble', async () => {
    freshConnectedLevels();
    game.u.uhp = game.u.uhpmax = 100;
    const { ball, chain } = installPunishedHero();
    remove_object(ball);
    addInventoryItem(ball);
    pushKeys(' '.repeat(16));

    await rhack('>'.charCodeAt(0));

    assert.equal(game.inventory.includes(ball), false);
    const pile = game.level.objects[game.u.ux][game.u.uy];
    assert.ok(pile.includes(ball));
    assert.ok(pile.includes(chain));
    assert.equal(game.uball, ball);
});

test('falling can force contact with a wielded cockatrice corpse through gloves', async () => {
    freshConnectedLevels();
    game.u.fumbling = true;
    wearHeroArmor(addInventoryObject(LEATHER_GLOVES));
    const amulet = addInventoryObject(AMULET_OF_LIFE_SAVING);
    wearHeroAccessory(amulet, 'uamul');
    const corpse = addInventoryItem(untimedCorpse(MONSTER_NAME.indexOf('cockatrice')));
    setPrimaryWeapon(corpse);
    pushKeys(' '.repeat(16));

    await rhack('>'.charCodeAt(0));

    assert.equal(game.inventory.includes(amulet), false, 'the tumble did not trigger life saving');
    assert.ok(game.u.uhp > 0);
    assert.equal(game.uwep, corpse);
});
