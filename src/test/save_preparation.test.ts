import type { InMemoryStorage } from '../js/storage.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { DB_ICE, DB_MOAT, DRAWBRIDGE_UP } from '../js/const.js';
import { unplaceBallAndChain } from '../js/ball.js';
import { punishHero } from '../js/punishment.js';
import { SCR_BLANK_PAPER, SPE_BLANK_PAPER, FOOD_RATION, DAGGER, HEAVY_IRON_BALL } from '../js/object_data.js';
import { decodeSavedGame } from '../js/persistent_state_validation.js';
import { requireInitializedHero } from '../js/hero_types.js';
import { PanicTermination } from '../js/panic_termination.js';
import { saveGame, saveErrorGame } from '../js/save.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';

function savedPreparation(storage: InMemoryStorage, key: string) {
    const encoded = storage.getItem(key);
    assert.ok(encoded, 'The save must exist');
    const { state } = decodeSavedGame(encoded);
    const level = state.level;
    const hero = state.u;
    assert.ok(level, 'The save must retain its current level');
    requireInitializedHero(hero);
    return { ...state, level, u: hero };
}

for (const [kind, save, key] of [
    ['ordinary', saveGame, 'teleport-save:preparation'],
    ['panic', saveErrorGame, 'teleport-error-save:preparation'],
] as const) {
    void test(`${kind} saves finish one of each in-use item and clear prayer invulnerability`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        game.plname = 'Preparation';
        const storage = memoryStorage();
        const scrolls = await addInventoryObject(SCR_BLANK_PAPER, { quantity: 3 });
        const book = await addInventoryObject(SPE_BLANK_PAPER);
        const rations = await addInventoryObject(FOOD_RATION, { quantity: 2 });
        scrolls.in_use = book.in_use = true;
        game.u.invulnerable = true;

        assert.equal(await save(storage), true);

        const saved = savedPreparation(storage, key);
        assert.equal(saved.inventory.find(item => item.o_id === scrolls.o_id)?.quantity, 2);
        assert.equal(saved.inventory.some(item => item.o_id === book.o_id), false);
        assert.equal(saved.inventory.find(item => item.o_id === rations.o_id)?.quantity, 2);
        assert.equal(saved.inventory.some(item => item.in_use), false);
        assert.equal(!!saved.u.invulnerable, false);
    });

    for (const [under, nextToHero] of [[DB_ICE, true], [DB_MOAT, false]] as const) {
        void test(`${kind} saves recover an in-flight missile using the raised bridge's surface (${under})`, async () => {
            freshObjectRoom();
            requirePlayingGame(game);
            game.plname = 'Preparation';
            const storage = memoryStorage();
            const { ux, uy } = game.u;
            game.u.dx = 1;
            game.u.dy = 0;
            const drawbridgeSquare = game.level.requireAt(ux + 1, uy);
            drawbridgeSquare.typ = DRAWBRIDGE_UP;
            drawbridgeSquare.drawbridgemask = under;
            const missile = await knownObject(DAGGER, { where: 'free' });
            game._thrownObject = missile;

            assert.equal(await save(storage), true);

            const saved = savedPreparation(storage, key);
            const x = nextToHero ? ux + 1 : ux;
            const landed = saved.level.objects[x]?.[uy]?.find(item => item.o_id === missile.o_id);
            assert.ok(landed);
            assert.equal(landed.otyp, DAGGER);
            assert.equal(landed.where, 'floor');
            assert.equal(landed.ox, x);
            assert.equal(landed.oy, uy);
        });
    }

    void test(`${kind} saves put a temporarily unplaced punishment ball and chain back on the floor`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        game.plname = 'Preparation';
        const storage = memoryStorage();
        await punishHero(await knownObject(HEAVY_IRON_BALL));
        unplaceBallAndChain();

        assert.equal(await save(storage), true);

        const saved = savedPreparation(storage, key);
        const pile = saved.level.objects[saved.u.ux]?.[saved.u.uy];
        assert.ok(pile && saved.uball && saved.uchain);
        assert.ok(pile.includes(saved.uball));
        assert.ok(pile.includes(saved.uchain));
        assert.equal(saved.uball.where, 'floor');
        assert.equal(saved.uchain.where, 'floor');
    });
    void test(`${kind} save failure keeps the prior snapshot and completed cleanup`, async t => {
        freshObjectRoom({ hero: { uhp: 25, uhpmax: 40 } });
        requirePlayingGame(game);
        game.plname = 'Preparation';
        const storage = memoryStorage();
        const scroll = await addInventoryObject(SCR_BLANK_PAPER, { quantity: 2 });
        assert.equal(await save(storage), true);
        scroll.in_use = true;
        game.u.invulnerable = true;
        game.u.uhp = 12;
        game.program_state.something_worth_saving = true;
        const errors: string[] = [];
        t.mock.method(console, 'error', (message: unknown) => { errors.push(String(message)); });
        const unavailableStorage = {
            ...storage,
            setItem() { throw new Error('Storage is full'); },
        };

        assert.equal(await save(unavailableStorage), false);

        assert.equal(scroll.quantity, 1);
        assert.equal(!!scroll.in_use, false);
        assert.equal(game.u.invulnerable, false);
        assert.equal(game.program_state.something_worth_saving, true);
        const previous = savedPreparation(storage, key);
        assert.equal(previous.u.uhp, 25);
        assert.equal(previous.inventory.find(item => item.o_id === scroll.o_id)?.quantity, 2);
        assert.deepEqual(errors, kind === 'ordinary'
            ? ['Unable to save game: Storage is full'] : []);

        assert.equal(await save(storage), true);
        const retried = savedPreparation(storage, key);
        assert.equal(retried.u.uhp, 12);
        assert.equal(retried.inventory.find(item => item.o_id === scroll.o_id)?.quantity, 1);
    });

    void test(`${kind} save propagates panic termination instead of reporting a failed save`, async t => {
        freshObjectRoom();
        requirePlayingGame(game);
        game.plname = 'Preparation';
        const storage = memoryStorage();
        assert.equal(await save(storage), true);
        const errors: string[] = [];
        t.mock.method(console, 'error', (message: unknown) => { errors.push(String(message)); });
        const panickingStorage = {
            ...storage,
            setItem() { throw new PanicTermination('Write cannot continue'); },
        };

        await assert.rejects(save(panickingStorage), {
            name: 'PanicTermination', message: 'Write cannot continue',
        });

        assert.deepEqual(errors, []);
        assert.ok(savedPreparation(storage, key).u);
    });

}
