import test from 'node:test';
import assert from 'node:assert/strict';
import { MIGR_WITH_HERO, ROOM } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { deliverMigratingObjects, impactDrop } from '../js/object_migration.js';
import { CLUB, MIRROR, ROCK } from '../js/object_data.js';
import { updateHeroRoomMembership } from '../js/room.js';
import { dropInventoryObject } from './support/commands.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';
import { createDungeon } from './support/topology.js';

function downwardLadder(): void {
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'Doom', num_dunlevs: 2 })];
    game.stairs = { sx: 10, sy: 10, up: false, isladder: true,
        tolev: { dnum: 0, dlevel: 2 }, next: null, u_traversed: false };
}

void test('a dropped stack falls down a ladder with plural transit feedback', async () => {
    freshPlayableRoom();
    downwardLadder();
    const clubs = await addInventoryObject(CLUB, { initialize: false, quan: 3 });

    await dropInventoryObject(clubs, ' '.repeat(10));

    assert.equal(clubs.where, 'migrating');
    assert.match(game._pending_message, /The clubs fall down the ladder\.$/);
});

void test('a migrating object stays on its arrival ladder', async () => {
    freshPlayableRoom();
    downwardLadder();
    const club = await addInventoryObject(CLUB, { initialize: false });
    await dropInventoryObject(club, ' '.repeat(10));
    requirePlayingGame(game);
    const lower = new GameMap();
    for (let x = 8; x <= 18; x++) for (let y = 8; y <= 12; y++) lower.requireAt(x, y).typ = ROOM;
    game.level = lower;
    game.u.uz = { ...game.u.uz, dlevel: 2 };
    game.stairs = { sx: 12, sy: 10, up: true, isladder: true,
        tolev: { dnum: 0, dlevel: 1 }, next: null, u_traversed: false };

    await deliverMigratingObjects(game);

    assert.equal(club.where, 'floor');
    assert.equal(club.ox, 12);
    assert.equal(club.oy, 10);
});

void test('impact-dropped shop goods become debt for a hero inside the shop', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ left: 8, right: 16, top: 8, bottom: 12 });
    downwardLadder();
    updateHeroRoomMembership(game);
    const rock = await floorObject(ROCK, 10, 10, { initialize: false, no_charge: false });
    const messages: string[] = [];

    await impactDrop(null, 10, 10, { state: game, random: () => 0, publish: message => { messages.push(message); } });

    assert.equal(rock.where, 'migrating');
    assert.ok(shopkeeper.eshk.debit > 0);
    assert.ok(messages.some(message => /for goods lost\./.test(message)));
});

void test('a mirror arriving with the hero breaks visibly without blaming the hero', async () => {
    const level = freshPlayableRoom({ hero: { uluck: 5 } });
    downwardLadder();
    requirePlayingGame(game);
    const mirror = await floorObject(MIRROR, 10, 10, { initialize: false });
    await impactDrop(null, 10, 10, { state: game, destinationLevel: 2, random: () => 0 });
    assert.equal(mirror.migration?.arrival, MIGR_WITH_HERO);
    game.u.uz = { ...game.u.uz, dlevel: 2 };
    const messages: string[] = [];

    await deliverMigratingObjects(game, { nearHero: true, random: () => 99,
        publish: message => { messages.push(message); } });

    assert.equal(mirror.where, 'gone');
    assert.equal(game.u.uluck, 5);
    assert.ok(messages.some(message => /shatters into a thousand pieces/.test(message)));
    assert.ok(!level.objects[10]?.[10]?.includes(mirror));
});
