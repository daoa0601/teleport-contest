import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { G_EXTINCT, STONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { splitHeroMonsterForm } from '../js/mklev.js';
import { initRng } from '../js/rng.js';
import { freshPlayableRoom } from './support/playable-room.js';
const PM_GREMLIN = 40;
function gremlinHeroState({ openMap = true } = {}) {
    freshPlayableRoom({
        left: 8,
        right: 12,
        top: 8,
        bottom: 12,
        hero: {
            uz: { dnum: 0, dlevel: 8 },
            umonster: 331,
            umonnum: PM_GREMLIN,
            mtimedone: 300,
            mh: 17,
            mhmax: 17,
            ulevel: 8,
            ualign: { type: 0, record: 0 },
            acurr: { a: [12, 12, 12, 12, 12, 12] },
            uconduct: {},
            uhave: {},
        },
    });
    requireFixtureGame(game);
    game.plname = 'Splitter';
    game.moves = 40;
    game.flags = { female: false };
    game.context = { move: 0 };
    if (!openMap) {
        for (let x = 8; x <= 12; x++) {
            for (let y = 8; y <= 12; y++)
                game.level.requireAt(x, y).typ = STONE;
        }
    }
    initRng(3510n);
    return game;
}
void test('extinction suppresses hero cloning before placement or identity allocation', async () => {
    gremlinHeroState();
    requireFixtureGame(game);
    const vital = game.mvitals[PM_GREMLIN];
    assert.ok(vital);
    vital.mvflags = G_EXTINCT;
    vital.born = 120;
    const clone = await splitHeroMonsterForm(game);
    assert.equal(clone, null);
    assert.equal(game._nextIdent, undefined);
    assert.equal(game.level.monsters.length, 0);
    assert.equal(game.u.mh, 17);
    assert.equal(game.u.mhmax, 17);
    assert.equal(game.u.uconduct.pets ?? 0, 0);
});
void test('failed adjacent placement preserves hero HP and pet conduct', async () => {
    gremlinHeroState({ openMap: false });
    requireFixtureGame(game);
    const clone = await splitHeroMonsterForm(game);
    assert.equal(clone, null);
    assert.equal(game._nextIdent, undefined);
    assert.equal(game.level.monsters.length, 0);
    assert.equal(game.u.mh, 17);
    assert.equal(game.u.mhmax, 17);
    assert.equal(game.u.uconduct.pets ?? 0, 0);
    assert.equal(game.mvitals[PM_GREMLIN]?.born, 0);
});
void test('the clone birth that reaches the species limit is retained and extincts later births', async () => {
    gremlinHeroState();
    requireFixtureGame(game);
    const vital = game.mvitals[PM_GREMLIN];
    assert.ok(vital);
    vital.mvflags = 0;
    vital.born = 119;
    const clone = await splitHeroMonsterForm(game);
    assert.ok(clone);
    assert.equal(game.level.monsters.includes(clone), true);
    assert.equal(vital.born, 120);
    assert.equal(vital.mvflags & G_EXTINCT, G_EXTINCT);
    assert.equal(game.u.mh, 9);
    assert.equal(game.u.mhmax, 9);
    assert.equal(clone.mhp, 8);
    assert.equal(clone.mhpmax, 8);
    assert.equal(game.u.uconduct.pets, 1);
});
//# sourceMappingURL=hero_clone.test.js.map