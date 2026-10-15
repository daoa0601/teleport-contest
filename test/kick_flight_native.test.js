import test from 'node:test';
import assert from 'node:assert/strict';
import { A_STR, HWALL, STONE, TREE_LOOTED, TREE_SWARM } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroSpecies } from '../js/hero_species.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, GOLD_PIECE, ROCK } from '../js/object_data.js';
import { kickDirection } from './support/commands.js';
import { floorObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('a kicked coin stops at the first floor pile', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 18;
    const coin = await floorObject(GOLD_PIECE, 11, 10, { initialize: false });
    await floorObject(ROCK, 12, 10, { initialize: false });
    await kickDirection('l', ' '.repeat(10));
    assert.equal(coin.ox, 12);
    assert.equal(coin.oy, 10);
});
void test('a bare foot kicking a cockatrice corpse turns a flesh golem to stone', async () => {
    freshPlayableRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    game.u.mh = game.u.mhmax = 100;
    game.u.mtimedone = 100;
    setHeroSpecies(MONSTER_NAME.indexOf('flesh golem'));
    await floorObject(CORPSE, 11, 10, { initialize: false, corpsenm: MONSTER_NAME.indexOf('cockatrice') });
    await kickDirection('l', ' '.repeat(30));
    assert.equal(game.u.umonnum, MONSTER_NAME.indexOf('stone golem'));
    assert.ok(!game.program_state.gameover);
});
void test('arboreal rock is a tree and can release its occupants', async () => {
    let disturbed = false;
    for (let seed = 1n; seed <= 40n && !disturbed; seed++) {
        const level = freshPlayableRoom({ seed, hero: { uhp: 100, uhpmax: 100 } });
        level.flags.arboreal = true;
        const tree = level.requireAt(11, 10);
        tree.typ = STONE;
        tree.looted = TREE_LOOTED;
        await kickDirection('l', ' '.repeat(20));
        disturbed = !!((tree.looted ?? 0) & TREE_SWARM);
    }
    assert.ok(disturbed, 'Arboreal rock uses the native tree rules.');
});
void test('a blind wall kick remembers the wall by touch', async () => {
    const level = freshPlayableRoom({ hero: { blindTurns: 100, uhp: 100, uhpmax: 100 } });
    const wall = level.requireAt(11, 10);
    wall.typ = HWALL;
    wall.seenv = 0;
    wall.remembered_glyph = null;
    await kickDirection('l', ' '.repeat(20));
    assert.ok(wall.seenv > 0, 'Feeling the impact updates the known map cell.');
});
//# sourceMappingURL=kick_flight_native.test.js.map