import test from 'node:test';
import assert from 'node:assert/strict';
import {
    AM_LAWFUL, LOW_PM, M_AP_F_DKNOWN, M_AP_FURNITURE, M_AP_MONSTER,
    M_AP_OBJECT, MM_NOGRP, NON_PM, NO_MINVENT,
} from '../js/const.js';
import { game, requirePlayingGame, resetGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { saveMonsterTraits } from '../js/monster_traits.js';
import { CORPSE, EGG, FIGURINE, LOADSTONE, SLIME_MOLD, STATUE, TIN } from '../js/object_data.js';
import { decodeSavedGraph, encodeSavedGraph, isSavedRecord } from '../js/saved_graph.js';
import { restoreGame, saveGame } from '../js/save.js';
import { tinDetails } from '../js/tin.js';
import { addInventoryObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const SAVE_KEY = 'teleport-save:species';

function savedRecord(value: unknown): Record<string, unknown> {
    assert.ok(isSavedRecord(value), 'Expected a record in the saved game');
    return value;
}

function firstRecord(value: unknown): Record<string, unknown> {
    assert.ok(Array.isArray(value), 'Expected a saved entity array');
    const entries: unknown[] = value;
    return savedRecord(entries[0]);
}

function savedMonster(state: Record<string, unknown>) {
    return firstRecord(savedRecord(state.level).monsters);
}

function editSave(storage: ReturnType<typeof memoryStorage>, edit: (state: Record<string, unknown>) => void) {
    const encoded = storage.getItem(SAVE_KEY);
    assert.ok(encoded, 'Expected a saved game to alter');
    const snapshot = savedRecord(decodeSavedGraph(encoded));
    edit(savedRecord(snapshot.state));
    storage.setItem(SAVE_KEY, encodeSavedGraph(snapshot));
}

async function speciesRoom() {
    freshObjectRoom({ moves: 37 });
    requirePlayingGame(game);
    game.plname = 'Species';
    const monster = await createMonsterAt('orc', 11, 10, MM_NOGRP | NO_MINVENT);
    monster.cham = NON_PM;
    monster.mcorpsenm = NON_PM;
    monster.mextra = { mcorpsenm: NON_PM };
    const tin = await addInventoryObject(TIN, { corpsenm: NON_PM, spe: -1 });
    return { monster, tin, level: game.level };
}

interface SpeciesCarrier {
    name: string;
    change(state: Record<string, unknown>, species: number): void;
}

const carriers: readonly SpeciesCarrier[] = [
    {
        name: 'object contents species',
        change(state, species) { firstRecord(state.inventory).corpsenm = species; },
    },
    {
        name: 'monster natural shape',
        change(state, species) { savedMonster(state).cham = species; },
    },
    {
        name: 'monster represented corpse',
        change(state, species) { savedMonster(state).mcorpsenm = species; },
    },
    {
        name: 'monster extra represented corpse',
        change(state, species) { savedRecord(savedMonster(state).mextra).mcorpsenm = species; },
    },
    {
        name: 'monster disguise species',
        change(state, species) {
            const monster = savedMonster(state);
            monster.m_ap_type = M_AP_MONSTER | M_AP_F_DKNOWN;
            monster.mappearance = species;
        },
    },
];

for (const carrier of carriers) {
    for (const species of [NON_PM - 1, MONSTER_NAME.length, 1.5]) {
        void test(`restore rejects ${carrier.name} ${species} before changing the live game`, async () => {
            const { level, monster, tin } = await speciesRoom();
            const storage = memoryStorage();
            assert.equal(await saveGame(storage), true);
            editSave(storage, state => carrier.change(state, species));
            game.moves = 91;
            game.u.uhp = 13;
            game.plname = 'Still playing';

            assert.equal(restoreGame('Species', storage), false);

            assert.equal(game.moves, 91);
            assert.equal(game.u.uhp, 13);
            assert.equal(game.plname, 'Still playing');
            assert.ok(game.level === level, 'Rejected data must not replace the current map');
            assert.ok(level.monsters.includes(monster), 'Rejected data must not replace its monsters');
            assert.ok(game.inventory.includes(tin), 'Rejected data must not replace carried objects');
            assert.equal(monster.cham, NON_PM);
            assert.equal(tin.corpsenm, NON_PM);
        });
    }
}

for (const objectType of [CORPSE, STATUE, FIGURINE]) {
    for (const species of [undefined, NON_PM]) {
        void test(`restore requires an actual species for body object ${objectType}, not ${species}`, async () => {
            const { level } = await speciesRoom();
            const body = await addInventoryObject(objectType, { corpsenm: LOW_PM });
            const storage = memoryStorage();
            assert.equal(await saveGame(storage), true);
            editSave(storage, state => {
                assert.ok(Array.isArray(state.inventory));
                const objects: unknown[] = state.inventory;
                const saved = objects.map(savedRecord).find(object => object.o_id === body.o_id);
                assert.ok(saved, 'The saved body must be present');
                if (species === undefined) delete saved.corpsenm;
                else saved.corpsenm = species;
            });

            assert.equal(restoreGame('Species', storage), false);

            assert.ok(game.level === level);
            assert.ok(game.inventory.includes(body));
            assert.equal(body.corpsenm, LOW_PM);
        });
    }
}

void test('restore also rejects an invalid natural shape stored inside a corpse', async () => {
    const { level } = await speciesRoom();
    const troll = await createMonsterAt('troll', 12, 10, MM_NOGRP | NO_MINVENT);
    troll.mhp = 0;
    await finishEnvironmentalMonsterDeath(troll, game, { noCorpse: true });
    const corpse = await addInventoryObject(CORPSE, {
        corpsenm: troll.mnum, oextra: { omonst: saveMonsterTraits(troll) },
    });
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    editSave(storage, state => {
        assert.ok(Array.isArray(state.inventory));
        const objects: unknown[] = state.inventory;
        const body = objects.map(savedRecord).find(object => object.o_id === corpse.o_id);
        assert.ok(body);
        savedRecord(savedRecord(body.oextra).omonst).cham = MONSTER_NAME.length;
    });

    assert.equal(restoreGame('Species', storage), false);

    assert.ok(game.level === level);
    assert.ok(game.inventory.includes(corpse));
    assert.equal(corpse.oextra?.omonst?.cham, NON_PM);
});

void test('generic food and absent shape metadata survive restore alongside the first real species', async () => {
    const { monster, tin } = await speciesRoom();
    monster.m_ap_type = M_AP_MONSTER;
    monster.mappearance = LOW_PM;
    const egg = await addInventoryObject(EGG, { corpsenm: NON_PM });
    const corpse = await addInventoryObject(CORPSE, { corpsenm: LOW_PM });
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    resetGame();

    assert.equal(restoreGame('Species', storage), true);

    requirePlayingGame(game);
    const restoredMonster = game.level.monsters.find(actor => actor.m_id === monster.m_id);
    assert.ok(restoredMonster);
    assert.equal(restoredMonster.cham, NON_PM);
    assert.equal(restoredMonster.mcorpsenm, NON_PM);
    assert.equal(restoredMonster.mextra?.mcorpsenm, NON_PM);
    assert.equal(restoredMonster.mappearance, LOW_PM);
    const restoredTin = game.inventory.find(object => object.o_id === tin.o_id);
    assert.ok(restoredTin);
    assert.equal(tinDetails(restoredTin), 'empty tin');
    assert.equal(game.inventory.find(object => object.o_id === egg.o_id)?.corpsenm, NON_PM);
    assert.equal(game.inventory.find(object => object.o_id === corpse.o_id)?.corpsenm, LOW_PM);
});

void test('a loadstone selected count is preserved even when it exceeds the monster table', async () => {
    await speciesRoom();
    const count = MONSTER_NAME.length + 10;
    const loadstone = await addInventoryObject(LOADSTONE, { quan: count + 1, corpsenm: count, cursed: true });
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    resetGame();

    assert.equal(restoreGame('Species', storage), true);

    const restored = game.inventory.find(object => object.o_id === loadstone.o_id);
    assert.ok(restored);
    assert.equal(restored.corpsenm, count);
    assert.equal(restored.quan, count + 1);
});

void test('mimic fruit and altar metadata retain their native meanings across restore', async () => {
    const { monster: fruitMimic } = await speciesRoom();
    const fruit = game.context.current_fruit;
    assert.ok(fruit !== undefined);
    fruitMimic.m_ap_type = M_AP_OBJECT;
    fruitMimic.mappearance = SLIME_MOLD;
    fruitMimic.mcorpsenm = fruit;
    fruitMimic.mextra = { mcorpsenm: fruit };
    const altarMimic = await createMonsterAt('small mimic', 12, 10, MM_NOGRP | NO_MINVENT);
    altarMimic.m_ap_type = M_AP_FURNITURE;
    altarMimic.mappearance = 33; // S_altar
    altarMimic.mcorpsenm = AM_LAWFUL;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    resetGame();

    assert.equal(restoreGame('Species', storage), true);

    requirePlayingGame(game);
    const restoredFruit = game.level.monsters.find(actor => actor.m_id === fruitMimic.m_id);
    const restoredAltar = game.level.monsters.find(actor => actor.m_id === altarMimic.m_id);
    assert.ok(restoredFruit);
    assert.ok(restoredAltar);
    assert.equal(restoredFruit.mcorpsenm, fruit);
    assert.equal(restoredFruit.mextra?.mcorpsenm, fruit);
    assert.equal(game.fruits?.find(entry => entry.fid === fruit)?.fname, 'slime mold');
    assert.equal(restoredAltar.mcorpsenm, AM_LAWFUL);
});
