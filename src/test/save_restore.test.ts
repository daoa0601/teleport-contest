import { createMonsterAt } from './support/monsters.js';
import { knownObject } from './support/game-objects.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { pushKey } from '../js/input.js';
import { gameLogEvents } from '../js/gamelog.js';
import { currentAttribute } from '../js/attrib.js';
import { A_DEX, NON_PM } from '../js/const.js';
import { heroSpecies, setHeroSpecies } from '../js/hero_species.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { races } from '../js/roles.js';
import { healHeroLegs, woundHeroLegs } from '../js/hero_legs.js';
import { resetInputState } from '../js/input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
import { runSegment } from '../js/jsmain.js';
import { CLUB, SACK, GOLD_PIECE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { initializePet } from '../js/dog.js';
import { CORPSE } from '../js/object_data.js';
import { restoreGame, saveGame } from '../js/save.js';
import { SAVE_VERSION } from '../js/state_schema.js';
import { decodeSavedGame } from '../js/persistent_state_validation.js';
import { decodeSavedGraph, encodeSavedGraph, isSavedRecord } from '../js/saved_graph.js';
import { dropInventoryObject, runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshGame } from './support/game-state.js';
import { floorObjects } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshConnectedLevels } from './support/connected-levels.js';

void test('save and restore preserve entity identity across every loaded level', async () => {
    const storage = memoryStorage();
    const level = freshObjectRoom({ moves: 12 });
    requirePlayingGame(game);
    const cachedLevel = new GameMap();
    const pet = await createMonsterAt('little dog', 11, 10);
    const weapon = await addInventoryObject(CLUB);
    const bag = await addInventoryObject(SACK);
    const coin = await knownObject(GOLD_PIECE);
    await addCreatedObjectToContainer(bag, coin);
    game.u.ustuck = pet;
    game.plname = 'Schema';
    game._levelCache = new Map([['0:2', {
        level: cachedLevel, stairs: null, savedAt: game.moves,
    }]]);
    game.uwep = weapon;

    assert.equal(await saveGame(storage), true);
    resetGame();

    assert.equal(restoreGame('Schema', storage), true);
    assert.equal(game.level instanceof GameMap, true);
    assert.ok(game._levelCache !== undefined && game._levelCache !== null, 'Expected game._levelCache to be initialized');
    assert.equal(game._levelCache.get('0:2')?.level instanceof GameMap, true);
    assert.equal(game.uwep, game.inventory[0]);
    assert.equal(game.u.ustuck, game.level.monsters[0]);
    assert.equal(game.inventory[1]?.contents?.[0]?.container, game.inventory[1]);
});

// C dog.c records only context.startingpet_mid, so a dead starting pet's
// corpse is the sole saved holder of that monster's traits. A grown-up
// horse is large, so xkilled() always leaves its corpse, and a tame
// monster's corpse keeps its traits.
void test('a game whose starting pet died leaving a corpse can be saved and restored', async () => {
    const storage = memoryStorage();
    const level = freshObjectRoom({ moves: 30 });
    requirePlayingGame(game);
    const pet = await createMonsterAt('horse', 11, 10);
    initializePet(pet, { state: game });
    game.context.startingpet_mid = pet.m_id;
    game.plname = 'Mourner';
    await finishHeroMonsterKill(pet, pet.mx, pet.my, { showKillMessage: false, recordConduct: false });
    const corpse = floorObjects(level).find(object => object.otyp === CORPSE);
    assert.equal(corpse?.oextra?.omonst?.m_id, pet.m_id);

    assert.equal(await saveGame(storage), true);
    resetGame();

    assert.equal(restoreGame('Mourner', storage), true);
    assert.equal(game.context.startingpet_mid, pet.m_id);
});

void test('an object falling down stairs survives saving and reaches the next level',
    async () => {
        const storage = memoryStorage();
        const { source } = freshConnectedLevels();
        const club = await addInventoryObject(CLUB, {
            invlet: 'a', o_id: 7301,
        });
        game.plname = 'Faller';
        initRng(1n);

        await dropInventoryObject(club);

        assert.equal(floorObjects(source).includes(club), false);
        assert.equal(await saveGame(storage), true);
        assert.equal(restoreGame('Faller', storage), true);

        pushKey(' ');
        await rhack('>'.charCodeAt(0));

        requirePlayingGame(game);
        const delivered = floorObjects(game.level)
            .find(object => object.o_id === club.o_id);
        assert.ok(delivered);
        assert.deepEqual(game.u.uz, { dnum: 0, dlevel: 2 });
    });

void test('runSegment resumes a saved game through the same Engine boundary',
    async () => {
        const storage = memoryStorage();
        const input = {
            seed: 9201,
            datetime: '20260830190000',
            nethackrc: [
                'OPTIONS=name:Saver,role:Wizard,race:human,gender:male,align:neutral',
                'OPTIONS=!legacy,!tutorial,!autopickup,pettype:none',
            ].join('\n'),
            storage,
        };

        const saved = await runSegment({ ...input, moves: ' Sy' });
        requirePlayingGame(game);
        assert.ok(saved.lastRunResult !== undefined && saved.lastRunResult !== null, 'Expected saved.lastRunResult to be initialized');
        assert.equal(saved.lastRunResult.kind, 'stopped');

        const restored = await runSegment({ ...input, moves: ' .' });
        requirePlayingGame(game);
        assert.ok(restored.lastRunResult !== undefined && restored.lastRunResult !== null, 'Expected restored.lastRunResult to be initialized');
        assert.equal(restored.lastRunResult.kind, 'input-needed');
        assert.equal(restored.state.moves, saved.state.moves + 1);
        assert.equal(restored.state.level instanceof GameMap, true);
    });


void test('saves from before interface option separation report an incompatible version', async () => {
    freshObjectRoom();
    game.plname = 'OldOptions';
    resetInputState().feed('\x1b');
    await rhack('O'.charCodeAt(0));
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    const encoded = storage.getItem('teleport-save:oldoptions');
    assert.ok(encoded);
    const snapshot = decodeSavedGraph(encoded);
    assert.ok(isSavedRecord(snapshot) && isSavedRecord(snapshot.state));
    // Format 30 saved this flag after opening the options menu.
    snapshot.version = 30;
    snapshot.state._optionsInitialized = true;

    assert.throws(() => decodeSavedGame(encodeSavedGraph(snapshot)), {
        message: 'Saved game has invalid version',
    });
});

for (const version of [SAVE_VERSION - 1, SAVE_VERSION + 1]) {
    void test(`incompatible save version ${version} is rejected without changing the live game`, async () => {
        freshGame({ level: new GameMap(), moves: 17 });
        requirePlayingGame(game);
        game.plname = 'OldFormat';
        const level = game.level;
        const storage = memoryStorage();
        assert.equal(await saveGame(storage), true);
        const key = 'teleport-save:oldformat';
        const encoded = storage.getItem(key);
        assert.ok(encoded);
        const snapshot = decodeSavedGraph(encoded);
        assert.ok(isSavedRecord(snapshot));
        snapshot.version = version;
        storage.setItem(key, encodeSavedGraph(snapshot));

        assert.equal(restoreGame('OldFormat', storage), false);

        assert.equal(game.level, level);
        assert.equal(game.moves, 17);
    });
}

async function changeLevel(level: number): Promise<void> {
    const input = resetInputState();
    await answerPrompts(runExtendedCommand('levelchange'), input, [
        { prompt: /To what experience level do you want to be set\?/, keys: `${level}\n` },
    ]);
}

void test('a saved hero retains the highest earned level after wizard level reduction', async () => {
    freshObjectRoom({ flags: { debug: true, verbose: true }, hero: { ulevel: 1 } });
    requirePlayingGame(game);
    game.plname = 'LevelHistory';
    const storage = memoryStorage();
    await changeLevel(2);
    await changeLevel(1);
    assert.equal(game.u.ulevelmax, 1);

    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('LevelHistory', storage), true);
    await changeLevel(2);

    assert.equal(game.u.ulevel, 2);
    assert.ok(gameLogEvents().some(event => event.text === 'regained experience level 2'));
});

void test('saved leg wounds retain temporary Dexterity loss and heal only once', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.plname = 'Wounded';
    const dexterity = currentAttribute(A_DEX);
    const storage = memoryStorage();
    await woundHeroLegs('left', 12);
    await woundHeroLegs('right', 20);

    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Wounded', storage), true);
    assert.equal(currentAttribute(A_DEX), dexterity - 1);
    assert.equal(game.u.acurr.a[A_DEX], dexterity);
    const input = resetInputState();
    await answerPrompts(healHeroLegs(), input, []);
    await answerPrompts(healHeroLegs(), input, []);

    assert.equal(currentAttribute(A_DEX), dexterity);
});


void test('searching and resting do not prevent a later save', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.plname = 'Rested';
    await rhack('s'.charCodeAt(0));
    await rhack('.'.charCodeAt(0));
    const storage = memoryStorage();
    const position = { x: game.u.ux, y: game.u.uy };

    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Rested', storage), true);

    assert.equal(game.u.ux, position.x);
    assert.equal(game.u.uy, position.y);
});

const speciesFields: ReadonlyArray<{
    owner: 'u' | 'urace'; field: string; minimumInvalid: number;
}> = [
    { owner: 'u', field: 'umonster', minimumInvalid: NON_PM },
    { owner: 'u', field: 'umonnum', minimumInvalid: NON_PM },
    { owner: 'u', field: 'ulycn', minimumInvalid: NON_PM - 1 },
    { owner: 'u', field: 'mcham', minimumInvalid: NON_PM - 1 },
    { owner: 'urace', field: 'mnum', minimumInvalid: NON_PM },
    { owner: 'urace', field: 'mummynum', minimumInvalid: NON_PM },
    { owner: 'urace', field: 'zombienum', minimumInvalid: NON_PM },
];

for (const { owner, field, minimumInvalid } of speciesFields) {
    for (const invalid of [minimumInvalid, MONSTER_NAME.length]) {
        void test(`restore rejects ${owner}.${field} species ${invalid} without replacing the live game`, async () => {
            const level = freshObjectRoom({ moves: 73 });
            requirePlayingGame(game);
            const club = await addInventoryObject(CLUB);
            const hero = game.u;
            const race = game.urace;
            const inventory = game.inventory;
            game.plname = 'SpeciesBoundary';
            const storage = memoryStorage();
            assert.equal(await saveGame(storage), true);
            const key = 'teleport-save:speciesboundary';
            const encoded = storage.getItem(key);
            assert.ok(encoded);
            const saved = decodeSavedGraph(encoded);
            assert.ok(isSavedRecord(saved) && isSavedRecord(saved.state));
            const record = saved.state[owner];
            assert.ok(isSavedRecord(record));
            record[field] = invalid;
            storage.setItem(key, encodeSavedGraph(saved));
            game.moves = 89;
            game.u.uhp = 13;

            assert.equal(restoreGame('SpeciesBoundary', storage), false);

            assert.equal(game.u, hero);
            assert.equal(game.urace, race);
            assert.equal(game.level, level);
            assert.equal(game.inventory, inventory);
            assert.equal(game.inventory[0], club);
            assert.equal(game.moves, 89);
            assert.equal(game.u.uhp, 13);
            assert.notEqual(storage.getItem(key), null);
        });
    }
}

for (const species of [0, MONSTER_NAME.length - 1]) {
    void test(`restore accepts hero species endpoint ${species} and absent lycanthropy and shapechanger sentinels`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        game.u.mtimedone = 100;
        game.u.mh = game.u.mhmax = 20;
        setHeroSpecies(species);
        assert.equal(game.u.ulycn, NON_PM);
        assert.equal(game.u.mcham, NON_PM);
        game.plname = 'HeroSpeciesEndpoint';
        const storage = memoryStorage();

        assert.equal(await saveGame(storage), true);
        assert.equal(restoreGame('HeroSpeciesEndpoint', storage), true);

        assert.equal(heroSpecies(), species);
        assert.equal(game.u.ulycn, NON_PM);
        assert.equal(game.u.mcham, NON_PM);
    });
}

void test('restore preserves a vampire shifter hero and a real lycanthrope species', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const vampire = MONSTER_NAME.indexOf('vampire');
    const bat = MONSTER_NAME.indexOf('vampire bat');
    const werewolf = MONSTER_NAME.indexOf('werewolf');
    game.u.mtimedone = 100;
    game.u.mh = game.u.mhmax = 20;
    setHeroSpecies(vampire);
    setHeroSpecies(bat);
    game.u.ulycn = werewolf;
    game.plname = 'SpeciesCarriers';
    const storage = memoryStorage();

    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('SpeciesCarriers', storage), true);

    assert.equal(heroSpecies(), bat);
    assert.equal(game.u.mcham, vampire);
    assert.equal(game.u.ulycn, werewolf);
});

for (const race of races) {
    void test(`restore accepts the native ${race.name} body and undead race species`, async () => {
        freshObjectRoom({ race });
        requirePlayingGame(game);
        game.plname = 'RaceSpecies';
        const storage = memoryStorage();

        assert.equal(await saveGame(storage), true);
        assert.equal(restoreGame('RaceSpecies', storage), true);

        assert.ok(game.urace);
        assert.equal(game.urace.mnum, race.mnum);
        assert.equal(game.urace.mummynum, race.mummynum);
        assert.equal(game.urace.zombienum, race.zombienum);
    });
}
