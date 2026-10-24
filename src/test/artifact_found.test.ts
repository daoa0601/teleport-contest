import { requireScreenRow } from './support/screen.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { artifactByName, nameArtifact, uncreateArtifact } from '../js/artifacts.js';
import { NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { grantPrayerFavor } from '../js/divine_gifts.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { gameLogEvents } from '../js/gamelog.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { ddoinv, inventoryItemDescription } from '../js/invent.js';
import { mksobj } from '../js/mklev.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { pickUpMonsterFloorObject } from '../js/monster_pickup.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { addInventoryItem } from '../js/u_init.js';
import { makeWish } from '../js/wish.js';
import { dropMonsterObject } from '../js/monster_drop.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { costlySpot } from '../js/shk.js';
import { floorObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

const foundEvents = () => gameLogEvents().filter((event) => event.text.startsWith('found '));

async function pickupArtifact({
    name = 'The Mitre of Holiness',
    shop = false,
    verbose = true,
    hallucinating = false,
    descriptionKnown = true,
} = {}) {
    const input = freshTurnRoom({ left: 10, right: 17, top: 10, bottom: 10 });
    requirePlayingGame(game);
    const messages: string[] = [];
    input.beforeRead = () => {
        messages.push(game._screen_output.split('\n')[0] ?? '');
    };
    if (shop) {
        const { shopkeeper } = await createStaffedShop({
            left: 14,
            right: 17,
            top: 10,
            bottom: 10,
            keeperX: 14,
            keeperY: 10,
            doorX: 13,
            doorY: 10,
        });
        shopkeeper.mx = 17;
        shopkeeper.my = 10;
        shopkeeper.mfrozen = 100;
        shopkeeper.mcanmove = 0;
        assert.ok(!costlySpot(14, 10), 'the artifact is on the shop free spot');
        assert.ok(costlySpot(15, 10), 'the adjacent square is merchandise space');
    }
    const monster = await createMonsterAt('archeologist', 15, 10, NO_MINVENT);
    monster.mpeaceful = 0;
    monster.msleeping = 0;
    monster.movement = 12;
    const artifact = artifactByName(name);
    assert.ok(artifact);
    const object = await floorObject(artifact.baseType, 14, 10, { dknown: descriptionKnown });
    nameArtifact(object, artifact);
    game.flags.verbose = verbose;
    if (hallucinating) game.u.hallucinationTurns = 20;
    initRng(1n);
    if (shop) {
        placeMonsterAt(monster, 14, 10);
        // Admit the native one-in-25 shop pickup; this case checks artifact
        // discovery at that boundary, not the chance of going shopping.
        assert.equal(await pickUpMonsterFloorObject(monster, game, () => 0), true);
    } else {
        pushKeys('m.' + ' '.repeat(80) + 'm.');
        await moveloop_core();
        await moveloop_core();
    }
    assert.ok(monster.minvent.includes(object), 'the adventurer picked up the artifact');
    assert.ok(
        !game._artifactDiscoveries?.includes(artifact.id),
        'finding does not identify an artifact',
    );
    return { monster, object, messages };
}

void test('visible artifact pickup logs its floor origin once, including after save/restore', async () => {
    await pickupArtifact();
    assert.equal(foundEvents().length, 1);
    assert.equal(firstFoundEvent().text, 'found the Mitre of Holiness on the floor');
    const storage = memoryStorage();
    game.plname = 'Found';
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Found', storage), true);
    const monster = requireGameLevel().monsters.find((monster) =>
        monster.minvent?.some((object) => object.oartifact),
    );
    assert.ok(monster);
    assert.ok(monster.minvent);
    const object = monster.minvent.find((object) => object.oartifact);
    assert.ok(object);

    await dropMonsterObject(monster, object);

    assert.equal(foundEvents().length, 1, 'seeing it again does not log another find');
});

void test('quiet pickup on the shop free spot still logs the shop origin', async () => {
    const { messages } = await pickupArtifact({ shop: true, verbose: false });
    assert.equal(foundEvents().length, 1);
    assert.equal(firstFoundEvent().text, 'found the Mitre of Holiness in a shop');
    assert.ok(!messages.some((message) => message.includes('picks up')), messages.join(' | '));
});

for (const known of [false, true]) {
    void test(`hallucinated pickup ${known ? 'finds an already observed artifact' : 'does not find an unobserved artifact'}`, async () => {
        await pickupArtifact({
            name: 'Magicbane',
            hallucinating: true,
            descriptionKnown: known,
        });
        assert.equal(foundEvents().length, known ? 1 : 0);
        if (known) assert.equal(firstFoundEvent().text, 'found Magicbane on the floor');
    });
}

void test('seeing a monster drop an artifact records the carrier, not the landing square', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('archeologist', 14, 10, NO_MINVENT);
    const artifact = artifactByName('Magicbane');
    assert.ok(artifact);
    const object = await mksobj(artifact.baseType, false, false);
    nameArtifact(object, artifact);
    await addObjectToMonsterInventory(monster, object);
    assert.equal(foundEvents().length, 0);
    assert.ok(!object.dknown);

    await dropMonsterObject(monster, object);

    assert.equal(object.where, 'floor');
    assert.equal(foundEvents().length, 1);
    assert.equal(firstFoundEvent().text, 'found Magicbane carried by a monster');
    assert.ok(!game._artifactDiscoveries?.includes(artifact.id));
});

for (const blind of [false, true]) {
    void test(`inventory ${blind ? 'does not reveal an unseen artifact while blind' : 'finds an unseen carried artifact'}`, async () => {
        freshObjectRoom({ hero: { blindTurns: blind ? 20 : 0 } });
        requirePlayingGame(game);
        const artifact = artifactByName('Magicbane');
        assert.ok(artifact);
        const object = await mksobj(artifact.baseType, false, false);
        nameArtifact(object, artifact);
        await addInventoryItem(object, null, false);
        pushKeys(' ');

        await ddoinv();

        assert.equal(foundEvents().length, blind ? 0 : 1);
        assert.equal(!!object.dknown, !blind);
        if (!blind) assert.equal(firstFoundEvent().text, 'found Magicbane');
        assert.ok(!game._artifactDiscoveries?.includes(artifact.id));
    });
}

void test('wishing for an artifact prevents a later inventory find log', async () => {
    freshObjectRoom({ role: 'wizard', flags: { debug: true } });
    requirePlayingGame(game);
    pushKeys(' Magicbane\n');
    await makeWish();
    const object = game.inventory.find((object) => object.oartifact);
    const magicbane = artifactByName('Magicbane');
    assert.ok(magicbane);
    assert.equal(object?.oartifact, magicbane.id);
    const input = resetInputState();
    const inventory = ddoinv();
    await input.waitUntilBlocked();
    const topLine = () =>
        requireScreenRow(0)
            .map((cell) => cell.ch)
            .join('');
    assert.match(
        topLine(),
        /Magicbane.*--More--/,
        'inventory first acknowledges the unread wish result',
    );
    input.feed(' ');
    await input.waitUntilBlocked();
    assert.ok(game.nhDisplay);
    const menu = game.nhDisplay.grid.map((row) => row.map((cell) => cell.ch).join('')).join('\n');
    assert.match(menu, /Magicbane/);
    assert.match(menu, /\(end\)/, 'the acknowledged wish resumes into the inventory menu');
    input.feed('\x1b');
    await inventory;

    assert.ok(object.dknown, 'the artifact is visible in inventory');
    assert.equal(foundEvents().length, 0);
});

void test('formatting an artifact name alone does not find it', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const artifact = artifactByName('Magicbane');
    assert.ok(artifact);
    const object = await mksobj(artifact.baseType, false, false);
    nameArtifact(object, artifact);
    object.dknown = true;

    assert.match(await inventoryItemDescription(object), /Magicbane/);

    assert.equal(foundEvents().length, 0);
});

void test('uncreating an artifact lets its replacement be found', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const artifact = artifactByName('Magicbane');
    assert.ok(artifact);
    const original = await mksobj(artifact.baseType, false, false);
    nameArtifact(original, artifact);
    await addInventoryItem(original, null, false);
    pushKeys(' ');
    await ddoinv();
    assert.equal(foundEvents().length, 1);
    assert.ok(uncreateArtifact(original));
    const replacement = await mksobj(artifact.baseType, false, false);
    nameArtifact(replacement, artifact);
    await addInventoryItem(replacement, null, false);
    pushKeys(' ');

    await ddoinv();

    assert.equal(foundEvents().length, 2);
    assert.equal(foundEvents()[1]?.text, 'found Magicbane');
});

void test('a pet pickup logs the original floor location', async () => {
    freshTurnRoom({ left: 10, right: 17, top: 10, bottom: 10 });
    requirePlayingGame(game);
    const pet = await createMonsterAt('little dog', 14, 10, NO_MINVENT);
    initializePet(pet);
    pet.movement = 12;
    const artifact = artifactByName('Magicbane');
    assert.ok(artifact);
    const object = await floorObject(artifact.baseType, 14, 10, { dknown: false });
    nameArtifact(object, artifact);
    initRng(1n);
    pushKeys('m.' + ' '.repeat(80) + 'm.');

    await moveloop_core();
    await moveloop_core();

    assert.ok(pet.minvent.includes(object), 'the pet picked up the artifact');
    assert.equal(foundEvents().length, 1);
    assert.equal(firstFoundEvent().text, 'found Magicbane on the floor');
});

for (const [alignment, name] of [
    [0, 'Vorpal Blade'],
    [-1, 'Stormbringer'],
] as const) {
    for (const condition of ['sighted', 'blind', 'hallucinating']) {
        void test(`crowning with an unseen ${name} while ${condition} preserves native observation`, async () => {
            freshObjectRoom({
                role: 'barbarian',
                hero: {
                    ualign: { type: alignment, record: 20 },
                    blindTurns: condition === 'blind' ? 20 : 0,
                    hallucinationTurns: condition === 'hallucinating' ? 20 : 0,
                },
            });
            requirePlayingGame(game);
            const artifact = artifactByName(name);
            assert.ok(artifact);
            const object = await mksobj(artifact.baseType, false, false);
            nameArtifact(object, artifact);
            await addInventoryItem(object, null, false);
            await setPrimaryWeapon(object);
            assert.ok(!object.dknown);
            pushKeys(' '.repeat(20));

            await grantPrayerFavor(7, alignment);

            const immediatelyFound = alignment === 0 && condition === 'sighted';
            assert.equal(foundEvents().length, immediatelyFound ? 1 : 0);
            // C explicitly observes the sword after this feedback, including
            // when blind; Hallucination still prevents learning its appearance.
            assert.equal(!!object.dknown, condition !== 'hallucinating');
            await ddoinv();
            assert.equal(foundEvents().length, condition === 'hallucinating' ? 0 : 1);
            if (condition !== 'hallucinating')
                assert.equal(firstFoundEvent().text, `found ${name}`);
        });
    }
}

function firstFoundEvent() {
    const event = foundEvents()[0];
    assert.ok(event, 'the artifact discovery must produce a game log event');
    return event;
}
