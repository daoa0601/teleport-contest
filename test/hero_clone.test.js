import test from 'node:test';
import assert from 'node:assert/strict';

import { G_EXTINCT, ROOM } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { splitHeroMonsterForm } from '../js/mklev.js';
import { initRng } from '../js/rng.js';

const PM_GREMLIN = 40;

function gremlinHeroState({ openMap = true } = {}) {
    resetGame();
    game.plname = 'Splitter';
    game.moves = 40;
    game.flags = { female: false };
    game.context = {};
    game.inventory = [];
    game.mvitals = [];
    game.level = new GameMap();
    game.u = {
        ux: 10, uy: 10,
        uz: { dnum: 0, dlevel: 8 },
        umonster: 331,
        umonnum: PM_GREMLIN,
        mtimedone: 300,
        mh: 17,
        mhmax: 17,
        ulevel: 8,
        ualign: { type: 0, record: 0 },
        acurr: { a: Array(6).fill(12) },
        uconduct: {},
        uhave: {},
    };
    if (openMap) {
        for (let x = 8; x <= 12; x++) {
            for (let y = 8; y <= 12; y++)
                game.level.at(x, y).typ = ROOM;
        }
    }
    initRng(3510n);
    return game;
}

test('extinction suppresses hero cloning before placement or identity allocation',
    async () => {
        gremlinHeroState();
        game.mvitals[PM_GREMLIN] = { mvflags: G_EXTINCT, born: 120 };

        const clone = await splitHeroMonsterForm(game);

        assert.equal(clone, null);
        assert.equal(game._nextIdent, undefined);
        assert.equal(game.level.monsters.length, 0);
        assert.equal(game.u.mh, 17);
        assert.equal(game.u.mhmax, 17);
        assert.equal(game.u.uconduct.pets ?? 0, 0);
    });

test('failed adjacent placement preserves hero HP and pet conduct', async () => {
    gremlinHeroState({ openMap: false });

    const clone = await splitHeroMonsterForm(game);

    assert.equal(clone, null);
    assert.equal(game._nextIdent, undefined);
    assert.equal(game.level.monsters.length, 0);
    assert.equal(game.u.mh, 17);
    assert.equal(game.u.mhmax, 17);
    assert.equal(game.u.uconduct.pets ?? 0, 0);
    assert.equal(game.mvitals[PM_GREMLIN], undefined);
});

test('the clone birth that reaches the species limit is retained and extincts later births',
    async () => {
        gremlinHeroState();
        game.mvitals[PM_GREMLIN] = { mvflags: 0, born: 119 };

        const clone = await splitHeroMonsterForm(game);

        assert.ok(clone);
        assert.equal(game.level.monsters.includes(clone), true);
        assert.equal(game.mvitals[PM_GREMLIN].born, 120);
        assert.equal(
            game.mvitals[PM_GREMLIN].mvflags & G_EXTINCT,
            G_EXTINCT,
        );
        assert.equal(game.u.mh, 9);
        assert.equal(game.u.mhmax, 9);
        assert.equal(clone.mhp, 8);
        assert.equal(clone.mhpmax, 8);
        assert.equal(game.u.uconduct.pets, 1);
    });
