import test from 'node:test';
import assert from 'node:assert/strict';

import { LEVEL_TELEP, NO_MINVENT } from '../js/const.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { BOULDER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { launchRollingBoulder } from '../js/rolling_boulder.js';
import { floorObject } from './support/game-objects.js';
import { addTrap, floorObjects } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { createDungeon } from './support/topology.js';

for (const monsterTurn of [false, true]) {
    void test(`a surviving boulder hit ${monsterTurn ? 'during a monster turn preserves Elbereth and peace' : 'during the hero turn breaks Elbereth and angers a peaceful target'}`, async () => {
        freshObjectRoom({
            context: { mon_moving: monsterTurn },
            hero: { ualign: { type: 0, record: 10 } },
        });
        requirePlayingGame(game);
        const goblin = await createMonsterAt('goblin', 13, 10, NO_MINVENT);
        goblin.mpeaceful = 1;
        goblin.mhp = goblin.mhpmax = 100;
        const engraving = makeEngravingAt(10, 10, 'Elbereth');
        await floorObject(BOULDER, 12, 10);
        pushKeys(' '.repeat(10));

        await launchRollingBoulder({ x: 12, y: 10 }, { x: 14, y: 10 }, {
            state: game, rollOne: () => 1, publish: async () => {},
        });

        assert.ok(goblin.mhp > 0 && goblin.mhp < 100, 'the goblin survives the hit');
        assert.equal(engravingAt(10, 10), monsterTurn ? engraving : null);
        assert.equal(game.u.ualign.record, monsterTurn ? 10 : 4);
        assert.equal(goblin.mpeaceful, monsterTurn ? 1 : 0);
    });
}

void test('a hero-turn boulder hit gives a variable Elbereth penalty at low alignment', async () => {
    const penalties = new Set<number>();
    for (let seed = 1n; seed <= 16n; seed++) {
        freshObjectRoom({ hero: { ualign: { type: 0, record: 5 } } });
        requirePlayingGame(game);
        const goblin = await createMonsterAt('goblin', 13, 10, NO_MINVENT);
        goblin.mpeaceful = 0;
        goblin.mhp = goblin.mhpmax = 100;
        makeEngravingAt(10, 10, 'Elbereth');
        await floorObject(BOULDER, 12, 10);
        initRng(seed);
        pushKeys(' '.repeat(10));

        await launchRollingBoulder({ x: 12, y: 10 }, { x: 14, y: 10 }, {
            state: game, rollOne: () => 1, publish: async () => {},
        });

        assert.equal(engravingAt(10, 10), null, `Elbereth must fade, seed ${seed}`);
        const penalty = 5 - game.u.ualign.record;
        assert.ok(penalty >= 1 && penalty <= 5, `expected a penalty of 1–5, got ${penalty}, seed ${seed}`);
        penalties.add(penalty);
    }
    assert.ok(penalties.size > 1, 'low alignment uses a random penalty');
});

for (const teleportWorks of [false, true]) {
    void test(`a rolling boulder ${teleportWorks ? 'loses its shop exemption when it migrates' : 'retains its shop exemption when level teleport fails'}`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
        await createStaffedShop({
            left: 11, right: 15, top: 8, bottom: 12, keeperX: 15, keeperY: 9,
        });
        addTrap(level, LEVEL_TELEP, 13, 10);
        const boulder = await floorObject(BOULDER, 12, 10, { no_charge: true });
        assert.equal(boulder.no_charge, true, 'the boulder starts exempt from this shop\'s charges');

        await launchRollingBoulder({ x: 12, y: 10 }, { x: 14, y: 10 }, {
            state: game, random: () => teleportWorks ? 1 : 0, publish: async () => {},
        });

        assert.equal(boulder.where, teleportWorks ? 'migrating' : 'floor');
        assert.equal(floorObjects(level).includes(boulder), !teleportWorks);
        assert.equal(Boolean(boulder.no_charge), !teleportWorks);
        if (teleportWorks) {
            assert.ok(boulder.migration);
            assert.notEqual(boulder.migration.destination.dlevel, game.u.uz.dlevel);
            assert.ok(game.migratingObjects?.includes(boulder));
        }
    });
}
