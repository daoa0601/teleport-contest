import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { GameMap } from '../js/game.js';
import { game } from '../js/gstate.js';
import { pushKey } from '../js/input.js';
import { runSegment } from '../js/jsmain.js';
import { CLUB } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { dropInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshGame } from './support/game-state.js';
import { floorObjects } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshConnectedLevels } from './support/connected-levels.js';

test('save and restore preserve entity identity across every loaded level', () => {
    const storage = memoryStorage();
    const level = new GameMap();
    const cachedLevel = new GameMap();
    const pet = { m_id: 7101, mnum: 18, mx: 10, my: 10 };
    const weapon = { o_id: 7201, otyp: 55, where: 'inventory' };
    const bag = { o_id: 7202, otyp: 218, where: 'inventory', contents: [] };
    const coin = { o_id: 7203, otyp: 452, where: 'contained', container: bag };
    bag.contents.push(coin);
    level.monsters.push(pet);

    freshGame({
        level,
        inventory: [weapon, bag],
        hero: { ustuck: pet },
        moves: 12,
    });
    Object.assign(game, {
        plname: 'Schema',
        _levelCache: new Map([['0:2', { level: cachedLevel, stairs: null }]]),
        uwep: weapon,
        startingPet: pet,
    });

    assert.equal(saveGame(storage), true);
    game.level = null;
    game.inventory = [];

    assert.equal(restoreGame('Schema', storage), true);
    assert.equal(game.level instanceof GameMap, true);
    assert.equal(game._levelCache.get('0:2').level instanceof GameMap, true);
    assert.equal(game.uwep, game.inventory[0]);
    assert.equal(game.startingPet, game.level.monsters[0]);
    assert.equal(game.u.ustuck, game.level.monsters[0]);
    assert.equal(game.inventory[1].contents[0].container, game.inventory[1]);
});

test('an object falling down stairs survives saving and reaches the next level',
    async () => {
        const storage = memoryStorage();
        const { source } = freshConnectedLevels();
        const club = addInventoryObject(CLUB, {
            invlet: 'a', o_id: 7301,
        });
        game.plname = 'Faller';
        initRng(1n);

        await dropInventoryObject(club);

        assert.equal(floorObjects(source).includes(club), false);
        assert.equal(saveGame(storage), true);
        assert.equal(restoreGame('Faller', storage), true);

        pushKey(' ');
        await rhack('>'.charCodeAt(0));

        const delivered = floorObjects(game.level)
            .find(object => object.o_id === club.o_id);
        assert.ok(delivered);
        assert.deepEqual(game.u.uz, { dnum: 0, dlevel: 2 });
    });

test('runSegment resumes a saved game through the same Engine boundary',
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
        assert.equal(saved.lastRunResult.kind, 'stopped');

        const restored = await runSegment({ ...input, moves: ' .' });
        assert.equal(restored.lastRunResult.kind, 'input-needed');
        assert.equal(restored.state.moves, saved.state.moves + 1);
        assert.equal(restored.state.level instanceof GameMap, true);
    });
