import test from 'node:test';
import assert from 'node:assert/strict';

import { abusePetAfterHeroHit, initializePet } from '../js/dog.js';
import {
    canSeeMonster, canSpotMonster, flush_screen, newsym, pline,
} from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initializeMonsterWormBody } from '../js/monster_worm.js';
import { catchUpMonster, migrateMonsterOffLevel } from '../js/monster_migration.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { LEASH } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

async function leashedPet({ withLeash = true } = {}) {
    const pet = await createMonsterAt('little dog', 11, 10);
    initializePet(pet);
    pet.mtame = 1;
    pet.mleashed = 1;
    pet.msleeping = 1;
    const leash = withLeash
        ? await addInventoryObject(LEASH, { leashmon: pet.m_id }) : null;
    return { pet, leash };
}

async function topline() {
    await flush_screen();
    const row = requireGameDisplay().grid[0];
    assert.ok(row, 'The display must contain its message row');
    return row.map(cell => cell.ch).join('').trimEnd();
}

void test('an untamed visible pet pulls free with its name and native pronoun', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { pet, leash } = await leashedPet();
    requirePlayingGame(game);
    setMonsterGivenName(pet, 'Fido');
    pet.female = true;
    pet.minvis = true;
    grantIntrinsicProperty('seeInvisible', 'outside');
    assert.equal(canSeeMonster(pet), true);

    await abusePetAfterHeroHit(pet, 1);

    assert.equal(pet.mtame, 0);
    assert.equal(pet.mleashed, 0);
    assert.ok(leash);
    assert.equal(leash.leashmon, 0);
    assert.equal(await topline(), 'The invisible Fido pulls free of its leash!');
});

void test('a sensed but unseen untamed pet makes its leash fall slack', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { pet, leash } = await leashedPet();
    requirePlayingGame(game);
    grantIntrinsicProperty('telepathy', 'outside');
    setHeroBlindnessTurns(10);
    vision_recalc(0);
    assert.equal(canSpotMonster(pet), true);
    assert.equal(canSeeMonster(pet), false);

    await abusePetAfterHeroHit(pet, 1);

    assert.equal(pet.mtame, 0);
    assert.equal(pet.mleashed, 0);
    assert.ok(leash);
    assert.equal(leash.leashmon, 0);
    assert.equal(await topline(), 'Your leash falls slack.');
});

void test('untaming clears a stale leash attachment even when the object is gone', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { pet } = await leashedPet({ withLeash: false });
    requirePlayingGame(game);

    await abusePetAfterHeroHit(pet, 1);

    assert.equal(pet.mleashed, 0);
    assert.equal(await topline(), 'The little dog pulls free of its leash!');
});

void test('leash feedback waits for the message pager before detaching the pet', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { pet, leash } = await leashedPet();
    requirePlayingGame(game);
    await pline('You hear a loud rumbling sound somewhere deep in the dungeon.');
    const input = resetInputState();

    const untaming = abusePetAfterHeroHit(pet, 1);
    await input.waitUntilBlocked();
    try {
        assert.equal(pet.mtame, 0);
        assert.equal(pet.mleashed, 1);
        assert.ok(leash);
        assert.equal(leash.leashmon, pet.m_id);
    } finally {
        input.feed('    ');
        await untaming;
    }

    assert.equal(pet.mleashed, 0);
    assert.ok(leash);
    assert.equal(leash.leashmon, 0);
});

void test('untaming a long worm removes pet highlighting from its visible tail', async () => {
    freshObjectRoom({ flags: { hilite_pet: true } });
    requirePlayingGame(game);
    const worm = await createMonsterAt('long worm', 12, 10);
    initializeMonsterWormBody(worm, { segmentCount: 2 });
    assert.equal(worm.wormSegments?.length, 2);
    initializePet(worm);
    worm.mtame = 1;
    worm.msleeping = 1;
    newsym(worm.mx, worm.my);
    for (const segment of worm.wormSegments) newsym(segment.x, segment.y);
    await flush_screen();
    for (const segment of worm.wormSegments)
        assert.equal(displayedCell(segment.x - 1, segment.y + 1).attr & 1, 1);

    await abusePetAfterHeroHit(worm, 1);

    await flush_screen();
    assert.equal(displayedCell(worm.mx - 1, worm.my + 1).attr & 1, 0);
    for (const segment of worm.wormSegments)
        assert.equal(displayedCell(segment.x - 1, segment.y + 1).attr & 1, 0);
});

void test('a migrating pet releases its leash while still visible on the old level', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { pet, leash } = await leashedPet();
    requirePlayingGame(game);
    await pline('You hear a loud rumbling sound somewhere deep in the dungeon.');
    const input = resetInputState();
    const oldPosition = { x: pet.mx, y: pet.my };
    const migrating = (async () => await migrateMonsterOffLevel(pet, game,
        { dst: { dnum: 0, dlevel: 9 } }))();
    const blocked = await Promise.race([
        input.waitUntilBlocked().then(() => true),
        migrating.then(() => false),
    ]);
    try {
        assert.equal(blocked, true, 'leash feedback must reach the message pager');
        assert.equal(game.level.monsters.includes(pet), true);
        assert.equal(pet.mx, oldPosition.x);
        assert.equal(pet.my, oldPosition.y);
        assert.equal(pet.mleashed, 1);
        assert.ok(leash);
        assert.equal(leash.leashmon, pet.m_id);
    } finally {
        input.feed('    ');
        await migrating;
    }

    assert.equal(game.level.monsters.includes(pet), false);
    assert.equal(pet.mx, 0);
    assert.equal(pet.mtame, 0);
    assert.equal(pet.pet, false);
    assert.equal(pet.mleashed, 0);
    assert.ok(leash);
    assert.equal(leash.leashmon, 0);
    assert.equal(await topline(), 'The little dog pulls free of its leash!');
});

void test('a pet made wild by time apart loses its leash and highlight silently', async () => {
    freshObjectRoom({ flags: { hilite_pet: true } });
    requirePlayingGame(game);
    const { pet, leash } = await leashedPet();
    requirePlayingGame(game);
    pet.mtame = 5;
    game.moves = 1100;
    newsym(pet.mx, pet.my);
    await flush_screen();
    assert.equal(displayedCell(pet.mx - 1, pet.my + 1).attr & 1, 1);

    catchUpMonster(pet, 1000, game);
    newsym(pet.mx, pet.my);
    await flush_screen();

    assert.equal(pet.mtame, 0);
    assert.equal(pet.mleashed, 0);
    assert.ok(leash);
    assert.equal(leash.leashmon, 0);
    assert.equal(displayedCell(pet.mx - 1, pet.my + 1).attr & 1, 0);
    assert.equal(await topline(), '');
});

function displayedCell(x: number, y: number) {
    const cell = requireGameDisplay().grid[y]?.[x];
    assert.ok(cell, `Expected a displayed cell at ${x},${y}`);
    return cell;
}
