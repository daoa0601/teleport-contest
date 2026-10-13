import { saveMonsterTraits } from '../js/monster_traits.js';
import { initializePet } from '../js/dog.js';
import { createMonsterAt } from './support/monsters.js';
import type { ObjectRoomOptions } from './support/object-room.js';
import { aligns } from '../js/roles.js';
import { createSpecialLevel, createDungeon } from './support/topology.js';
import { loadScoreRecords } from '../js/score_records.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { artifactById, initializeArtifacts } from '../js/artifacts.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { ALTAR, AM_SANCTUM, Align2amask, Amask2align } from '../js/const.js';
import { SCORE_RECORD_STORAGE_KEY } from '../js/end.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { game } from '../js/gstate.js';
import { gameLogEvents } from '../js/gamelog.js';
import { rhack } from '../js/cmd.js';
import { ddoinv } from '../js/invent.js';
import { resetInputState } from '../js/input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR, GOLD_PIECE } from '../js/object_data.js';
import { addInventoryItem } from '../js/u_init.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, corpseObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { grantIntrinsicProperty } from '../js/properties.js';

function freshAltar({ alignment = 0, high = false, hero = {}, ...room }: ObjectRoomOptions & { alignment?: number; high?: boolean } = {}) {
    freshObjectRoom({
        ...room,
        hero: {
            ulevel: 1, uluck: 0, ugangr: 0, ublesscnt: 100,
            ualign: { type: 0, record: 0 }, ualignbase: [0, 0],
            ...hero,
        },
    });
    requirePlayingGame(game);
    const baseAlignment = game.u.ualignbase[1];
    game.initAlignment = aligns.find(alignment => alignment.value === baseAlignment) ?? null;
    initializeArtifacts();
    const altar = game.level.requireAt(game.u.ux, game.u.uy);
    altar.typ = ALTAR;
    altar.flags = Align2amask(alignment) | (high ? AM_SANCTUM : 0);
    return altar;
}

void test('offering without an altar does not use a turn', async () => {
    freshObjectRoom();
    requirePlayingGame(game);

    await runExtendedCommand('offer');

    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /not on an altar/);
});

for (const condition of ['confusion', 'stunned'] as const) {
    void test(`#offer is refused while ${condition} persists without a countdown`, async () => {
        freshAltar();
        requirePlayingGame(game);
        const corpse = await addInventoryItem(await corpseObject(MONSTER_NAME.indexOf('newt')));
        grantIntrinsicProperty(condition, 'outside');

        await runExtendedCommand('offer', `${corpse.invlet}\x1b`);

        assert.ok(game.inventory.includes(corpse));
        assert.equal(game.context.move, 0);
        assert.match(game._pending_message, /You are too impaired to perform the rite\./);
    });
}

void test('#offer rejects selected gold with the native gold refusal', async () => {
    freshAltar();
    requirePlayingGame(game);
    const corpse = await addInventoryItem(await corpseObject(MONSTER_NAME.indexOf('newt')));
    await addInventoryObject(GOLD_PIECE, { quan: 12 });

    await runExtendedCommand('offer', '$\x1b');

    assert.match(game._pending_message, /You cannot sacrifice gold\./);
    assert.equal(game.context.move, 0);
    assert.ok(game.inventory.includes(corpse));
});

void test('a fresh floor corpse is consumed and reduces the prayer timeout', async () => {
    freshAltar();
    requirePlayingGame(game);
    const corpse = placeCreatedObject(await corpseObject(MONSTER_NAME.indexOf('newt')), 10, 10);
    const timeout = game.u.ublesscnt;

    await runExtendedCommand('offer', 'y\x1b');

    assert.equal(floorObjectsAt(game.level, 10, 10).includes(corpse), false);
    assert.equal(corpse.where, 'gone');
    assert.ok(game.u.ublesscnt < timeout);
    assert.equal(game.u.uconduct.gnostic, 1);
    assert.equal(game.context.move, 1);
});

void test('declining a floor corpse allows a different inventory offering', async () => {
    freshAltar();
    requirePlayingGame(game);
    const floor = placeCreatedObject(await corpseObject(MONSTER_NAME.indexOf('newt')), 10, 10);
    const carried = await addInventoryItem(await corpseObject(MONSTER_NAME.indexOf('jackal')));

    await runExtendedCommand('offer', `n${carried.invlet}\x1b`);

    assert.ok(floorObjectsAt(game.level, 10, 10).includes(floor));
    assert.equal(game.inventory.includes(carried), false);
});

void test('an old ordinary corpse is retained without earning favor', async () => {
    freshAltar({ moves: 200 });
    requirePlayingGame(game);
    const corpse = await addInventoryItem(await corpseObject(MONSTER_NAME.indexOf('newt'), { age: 0 }));

    assert.ok(corpse.invlet);

    await runExtendedCommand('offer', corpse.invlet);

    assert.ok(game.inventory.includes(corpse));
    assert.equal(game.u.ublesscnt, 100);
    assert.match(game._pending_message, /Nothing happens/);
});

void test('an acid blob remains a valid offering even when old', async () => {
    freshAltar({ moves: 200 });
    requirePlayingGame(game);
    const corpse = await addInventoryItem(await corpseObject(MONSTER_NAME.indexOf('acid blob'), { age: 0 }));

    await runExtendedCommand('offer', `${corpse.invlet}\x1b`);

    assert.equal(corpse.where, 'gone');
    assert.ok(game.u.ublesscnt < 100);
});

void test('offering from a floor stack consumes only one corpse', async () => {
    freshAltar();
    requirePlayingGame(game);
    const corpse = placeCreatedObject(await corpseObject(MONSTER_NAME.indexOf('newt'), {
        quan: 3, quantity: 3,
    }), 10, 10);

    await runExtendedCommand('offer', 'y\x1b');

    assert.equal(corpse.quan, 2);
    assert.ok(floorObjectsAt(game.level, 10, 10).includes(corpse));
});

void test('a former pet is refused even after its corpse becomes old', async () => {
    freshAltar({ moves: 200, hero: { uluck: 10, ualign: { type: 0, record: 10 } } });
    requirePlayingGame(game);
    const pet = await createMonsterAt('little dog', 11, 10);
    initializePet(pet);
    const corpse = await addInventoryItem(await corpseObject(MONSTER_NAME.indexOf('little dog'), {
        age: 0, oextra: { omonst: saveMonsterTraits(pet) },
    }));

    await runExtendedCommand('offer', `${corpse.invlet}\x1b`);

    assert.ok(game.inventory.includes(corpse));
    assert.equal(game.u.aggravateMonster, true);
    assert.ok(game.u.ualign.record < 10);
});

void test('a chaotic human sacrifice changes a neutral altar without changing the hero', async () => {
    const altar = freshAltar({ hero: { ualign: { type: -1, record: 0 }, ualignbase: [-1, -1] } });
    requirePlayingGame(game);
    const corpse = await addInventoryItem(await corpseObject(MONSTER_NAME.indexOf('human')));

    await runExtendedCommand('offer', `${corpse.invlet}\x1b`);

    assert.equal(Amask2align(altar.flags), -1);
    assert.equal(game.u.ualign.type, -1);
    assert.equal(corpse.where, 'gone');
});

void test('a disloyal hero can convert once by offering to another god', async () => {
    freshAltar({ alignment: 1, hero: { ualign: { type: 0, record: -5 } } });
    requirePlayingGame(game);
    const corpse = await addInventoryItem(await corpseObject(MONSTER_NAME.indexOf('newt')));

    await runExtendedCommand('offer', `${corpse.invlet}\x1b`);

    assert.equal(game.u.ualign.type, 1);
    assert.equal(game.u.ualignbase[0], 1);
    assert.equal(game.u.ualignbase[1], 0);
    assert.equal(game.u.ualign.record, 0);
    assert.equal(corpse.where, 'gone');
    assert.equal(game.u.uluck, -3);
});

void test('a god can bestow the role\'s preferred artifact as a usable floor object', async () => {
    freshAltar({
        alignment: -1, role: 'barbarian', flags: { debug: true },
        hero: { ulevel: 3, ublesscnt: 0, ualign: { type: -1, record: 10 }, ualignbase: [-1, -1] },
    });
    requirePlayingGame(game);
    const corpse = await addInventoryItem(await corpseObject(MONSTER_NAME.indexOf('red dragon')));

    // Acknowledge the sacrifice message before answering the gift query.
    await runExtendedCommand('offer', `${corpse.invlet} y\x1b`);

    const gift = floorObjectsAt(game.level, 10, 10).find(object => object.oartifact);
    assert.ok(gift, 'the offering did not produce a gift');
    assert.equal(artifactById(gift.oartifact)?.name, 'Cleaver');
    assert.equal(gift.cursed, false);
    assert.equal(gift.oerodeproof, true);
    assert.equal(game.u.ugifts, 1);
    const input = resetInputState();
    await answerPrompts(rhack(','.charCodeAt(0)), input, []);
    assert.ok(game.inventory.includes(gift));
    await answerPrompts(ddoinv(), input, [
        { prompt: /battle-axe named Cleaver[\s\S]*\(end\)/, keys: '\x1b' },
    ]);
    assert.ok(gift.dknown);
    const log = gameLogEvents();
    assert.ok(log.some(event => event.text.startsWith('was bestowed with Cleaver')));
    assert.ok(!log.some(event => event.text.startsWith('found ')));
});

void test('a fake Amulet on a high altar is exposed but does not end the game', async () => {
    freshAltar({ high: true });
    requirePlayingGame(game);
    const amulet = await addInventoryObject(FAKE_AMULET_OF_YENDOR, { known: false });

    await runExtendedCommand('offer', `${amulet.invlet}\x1b`);

    assert.ok(game.inventory.includes(amulet));
    assert.equal(amulet.known, true);
    assert.equal(game.u.uluck, -1);
    assert.ok(!game.program_state.gameover);
});

void test('the real Amulet on a low altar is retained and does not end the game', async () => {
    freshAltar();
    requirePlayingGame(game);
    const amulet = await addInventoryObject(AMULET_OF_YENDOR);

    assert.ok(amulet.invlet);

    await runExtendedCommand('offer', amulet.invlet);

    assert.ok(game.inventory.includes(amulet));
    assert.ok(!game.program_state.gameover);
    assert.match(game._pending_message, /return to the surface/);
});

for (const [alignment, outcome] of [[0, 'ascended'], [1, 'escaped']] as const) {
    void test(`offering the real Amulet at ${alignment === 0 ? 'the hero\'s' : 'another god\'s'} high altar ends with ${outcome}`, async () => {
        freshAltar({
            alignment, high: true,
            flags: { disclose: '-i -a -v -c -o', bones: false },
            hero: { uz: { dnum: 1, dlevel: 1 }, urexp: 100 },
        });
        requirePlayingGame(game);
        game.astral_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
        game.dungeons = [
            createDungeon({ dname: 'The Dungeons of Doom', depth_start: 1, dunlev_ureached: 1 }),
            createDungeon({ dname: 'The Elemental Planes', dunlev_ureached: 1 }),
        ];
        game.storage = memoryStorage();
        const amulet = await addInventoryObject(AMULET_OF_YENDOR);
        await wearHeroAccessory(amulet, 'uamul');

        const input = resetInputState();
        // Escape suppresses further offering messages, including the native
        // message-window flush before disclosure. The next input is the summary.
        await answerPrompts(runExtendedCommand('offer', amulet.invlet), input, [
            { prompt: /You offer the Amulet of Yendor to (?:Ishtar|Anu)\.\.\.--More--/, keys: '\x1b' },
            {
                prompt: outcome === 'ascended'
                    ? /You went to your reward with/
                    : /You escaped from the dungeon with/,
                keys: '\x1b',
            },
        ]);

        assert.equal(game.program_state.gameover, true);
        assert.equal(game.inventory.includes(amulet), false);
        assert.equal(!!game.u.uevent?.ascended, outcome === 'ascended');
        assert.equal(game.u.uhave.amulet, false);
        assert.equal(game.uamul, null);
        const records = loadScoreRecords(game);
        assert.equal(records[0]?.outcome, outcome);
        assert.equal(records[0]?.points, outcome === 'ascended' ? 200 : 100);
    });
}
