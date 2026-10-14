import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { pushKeys } from '../js/input.js';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT, W_AMUL } from '../js/const.js';
import { AMULET_OF_LIFE_SAVING, CLUB, CORPSE } from '../js/object_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('blind priest pickup learns earlier menu items before touching a corpse at the head of the pile', async () => {
    freshPlayableRoom({ role: 'priest', hero: { blindTurns: 10 } });
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING, {
        invlet: 'a', worn: true, owornmask: W_AMUL,
    });
    game.uamul = game.u.uamul = amulet;
    const club = await floorObject(CLUB, 10, 10, { cursed: true, bknown: false });
    const corpse = await floorObject(CORPSE, 10, 10, { corpsenm: 10 });
    pushKeys(' '.repeat(12));

    await rhack(','.charCodeAt(0));

    assert.equal(club.bknown, true,
        'The Weapons menu heading precedes Food, so naming the club reveals its curse.');
    assert.equal(game.inventory.includes(club), false);
    assert.equal(corpse.where, 'floor');
    assert.equal(amulet.where, 'gone');
});

void test('blind pickup inspects a lethal corpse before allowing a choice from the pile', async () => {
    freshPlayableRoom();
    game.u.blindTurns = 10;
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING, {
        invlet: 'a', worn: true, owornmask: W_AMUL,
    });
    game.uamul = game.u.uamul = amulet;
    const club = await floorObject(CLUB, 10, 10);
    const corpse = await floorObject(CORPSE, 10, 10, { corpsenm: 10 });
    pushKeys('a\n' + ' '.repeat(12));

    await rhack(','.charCodeAt(0));

    assert.equal(game.inventory.includes(amulet), false);
    assert.equal(game.inventory.includes(club), false);
    assert.equal(corpse.where, 'floor');
    assert.equal(game.context.move, 0);
});

void test('blind swallowed pickup touches a lethal corpse before offering safe loot', async () => {
    freshPlayableRoom();
    const swallower = await createMonsterAt('purple worm', 10, 10,
        MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    const club = await knownObject(CLUB);
    const corpse = await knownObject(CORPSE, { corpsenm: 10 });
    await addObjectToMonsterInventory(swallower, club);
    await addObjectToMonsterInventory(swallower, corpse);
    game.u.uswallow = 1;
    game.u.ustuck = swallower;
    game.u.blindTurns = 10;
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING, {
        invlet: 'a', worn: true, owornmask: W_AMUL,
    });
    game.uamul = game.u.uamul = amulet;
    pushKeys('a\n' + ' '.repeat(12));

    await rhack(','.charCodeAt(0));

    assert.equal(game.inventory.includes(amulet), false,
        'Feeling the corpse must trigger life saving before a safe item can be selected.');
    assert.equal(game.inventory.includes(club), false);
    assert.equal(swallower.minvent.includes(corpse), true);
    assert.equal(game.context.move, 0);
});
