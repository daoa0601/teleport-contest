import test from 'node:test';
import assert from 'node:assert/strict';

import { ROOM } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { turnUndeadByCallingOnDeity } from '../js/turn_undead.js';
import { vision_recalc, vision_reset_new_level } from '../js/vision.js';
import { addMonster } from './support/monsters.js';

const PM_HUMAN_MUMMY = 192;
const PM_HUMAN_ZOMBIE = 244;

function freshPriest(alignment = 1) {
    resetGame();
    game.urole = {
        key: 'priest',
        gods: { lawful: 'Athena', neutral: 'Hermes', chaotic: 'Loki' },
    };
    game.u = {
        ux: 10, uy: 10,
        uz: { dnum: 0, dlevel: 6 },
        ulevel: 6,
        uhp: 40, uhpmax: 40,
        ualign: { type: alignment, record: 0 },
        uconduct: {}, uhave: {},
    };
    game.moves = 50;
    game.context = {};
    game.flags = {};
    game.inventory = [];
    game.mvitals = [];
    game.dungeons = [{ dname: 'The Dungeons of Doom' }];
    game.level = new GameMap();
    game.level.monsters = [];
    for (let x = 6; x <= 14; x++) {
        for (let y = 6; y <= 14; y++) {
            const spot = game.level.at(x, y);
            spot.typ = ROOM;
            spot.lit = true;
        }
    }
    vision_reset_new_level();
    vision_recalc(0);
    initRng(44n);
    init_objects();
}

test('a lawful priest destroys a zombie and frightens a tougher mummy',
    async () => {
        freshPriest(1);
        const zombie = addMonster({
            mnum: PM_HUMAN_ZOMBIE, x: 11, y: 10,
            level: 4, msleeping: 1,
        });
        const mummy = addMonster({
            mnum: PM_HUMAN_MUMMY, x: 12, y: 10,
            level: 4, msleeping: 1,
        });

        await turnUndeadByCallingOnDeity(game, {
            random: range => range - 1,
        });

        assert.ok(zombie.mhp <= 0);
        assert.equal(mummy.mhp, mummy.mhpmax);
        assert.equal(mummy.msleeping, 0);
        assert.equal(mummy.mflee, 1);
        assert.equal(game.context.move, 1);
    });

test('a chaotic priest makes a weak undead monster peaceful', async () => {
    freshPriest(-1);
    const zombie = addMonster({
        mnum: PM_HUMAN_ZOMBIE, x: 11, y: 10,
        level: 4, msleeping: 1,
    });

    await turnUndeadByCallingOnDeity(game, {
        random: range => range - 1,
    });

    assert.ok(zombie.mhp > 0);
    assert.equal(zombie.mpeaceful, 1);
    assert.ok(!zombie.mflee);
});
