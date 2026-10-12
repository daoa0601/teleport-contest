import test from 'node:test';
import assert from 'node:assert/strict';
// C hack.c:losehp() lets hit points fall below one and then dies with the
// caller's killer and format. Each case starts the hero at one hit point.
import { LAVAPOOL, MAGIC_TRAP, ROCKTRAP, ROLLING_BOULDER_TRAP, SPIKED_PIT, TT_LAVA, TT_PIT, } from '../js/const.js';
import { gotoLevel } from '../js/level_change.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { pushKeys } from '../js/input.js';
import { BAG_OF_HOLDING, BOULDER, CLUB } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { scatterFloorObjects } from '../js/scatter.js';
import { loadScoreRecords } from '../js/score_records.js';
import { dosit } from '../js/sit.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { carriedGold, readyGold } from './support/gold-arena.js';
import { addTrap } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';
function lowHitPointRoom() {
    const level = freshObjectRoom({
        hero: { uhp: 1, uhpmax: 100, urexp: 100 },
        flags: { verbose: true, bones: false, disclose: '-i -a -v -c -o', tombstone: false },
    });
    requirePlayingGame(game);
    game.plname = 'Victim';
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
    return level;
}
async function dieWith(action, death) {
    pushKeys(' '.repeat(100));
    await action();
    assert.equal(game.program_state.gameover, true);
    assert.equal(loadScoreRecords()[0]?.death, death);
}
void test('sitting in lava kills a hero who cannot spare the burn', async () => {
    const level = lowHitPointRoom();
    level.requireAt(game.u.ux, game.u.uy).typ = LAVAPOOL;
    game.u.utrap = 2;
    game.u.utraptype = TT_LAVA;
    initRng(1n);
    await dieWith(() => dosit(), 'killed by sitting in lava');
});
void test('sitting down on a spike can be the last point of damage', async () => {
    const level = lowHitPointRoom();
    addTrap(level, SPIKED_PIT, game.u.ux, game.u.uy, { tseen: true });
    game.u.utrap = 3;
    game.u.utraptype = TT_PIT;
    initRng(1n);
    await dieWith(() => dosit(), 'killed by sitting on an iron spike');
});
void test('a falling rock trap kills with the falling rock', async () => {
    const level = lowHitPointRoom();
    const trap = addTrap(level, ROCKTRAP, game.u.ux, game.u.uy);
    initRng(1n);
    await dieWith(() => triggerHeroTrap(trap), 'killed by a falling rock');
});
void test('a fatal magic trap explosion leaves no energy to absorb', async () => {
    const level = lowHitPointRoom();
    const trap = addTrap(level, MAGIC_TRAP, game.u.ux, game.u.uy);
    const energy = game.u.uenmax;
    initRng(33n); // rn2(30) selects the explosion
    await dieWith(() => triggerHeroTrap(trap), 'killed by a magical explosion');
    assert.equal(game.u.uenmax, energy);
});
void test('a rolling boulder that hits the hero kills with the boulder', async () => {
    const level = lowHitPointRoom();
    const { ux, uy } = game.u;
    const trap = addTrap(level, ROLLING_BOULDER_TRAP, ux, uy, {
        launch: { x: ux + 4, y: uy }, launch2: { x: ux - 3, y: uy },
    });
    await floorObject(BOULDER, ux + 4, uy);
    initRng(1n); // the boulder hits rather than misses
    await dieWith(() => triggerHeroTrap(trap), 'killed by a boulder');
});
for (const [count, cause] of [[1, 'a club'], [3, 'clubs']]) {
    void test(`a fatal scattered object records ${cause} as its killer`, async () => {
        lowHitPointRoom();
        await floorObject(CLUB, 11, 10, { quantity: count, spe: 0 });
        await dieWith(() => scatterFloorObjects(11, 10, 2, {
            mayDestroy: false, mayFracture: false,
            random: () => 0,
            rollOne: sides => sides === 20 ? 1 : sides,
        }), `killed by ${cause}`);
    });
}
void test('putting a bag of holding into another can kill with the explosion', async () => {
    lowHitPointRoom();
    for (const invlet of ['a', 'b']) {
        const bag = await addInventoryObject(BAG_OF_HOLDING, {
            invlet, initialize: false, olocked: false, otrapped: false, cknown: true,
        });
        bag.contents ??= [];
    }
    initRng(1n);
    pushKeys('aib\n');
    await dieWith(() => rhack('a'.charCodeAt(0)), 'killed by a magical explosion');
});
void test('a coin fired straight up can kill the hero it falls on', async () => {
    lowHitPointRoom();
    await carriedGold(5);
    await readyGold();
    initRng(1n);
    pushKeys('<');
    await dieWith(() => rhack('f'.charCodeAt(0)), 'killed by a falling object');
});
for (const [arrival, ladder, killer] of [
    ['falling', false, 'falling down a mine shaft'],
    ['stairs', false, 'tumbling down a flight of stairs'],
    ['stairs', true, 'falling off a ladder'],
]) {
    void test(`a fatal fall records ${killer} without an article`, async () => {
        freshConnectedLevels({ ladder });
        requirePlayingGame(game);
        game.u.uhp = 1;
        game.u.uhpmax = 100;
        game.u.fumbling = true;
        game.u.dz = 1;
        game.flags.bones = false;
        game.flags.disclose = '-i -a -v -g -c -o';
        game.flags.tombstone = false;
        game.storage = memoryStorage();
        game.iflags.toptenwin = false;
        await dieWith(() => gotoLevel({ dnum: 0, dlevel: 2 }, { arrival, ladder }), `killed by ${killer}`);
    });
}
//# sourceMappingURL=hero_damage_death.test.js.map