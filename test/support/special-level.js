import { GameMap } from '../../js/game.js';
import { game, resetGame } from '../../js/gstate.js';
import { init_objects } from '../../js/o_init.js';
import { initRng } from '../../js/rng.js';

export function freshSpecialLevel({
    prototype, variant, seed, depth = 11, defaultLit = false,
    monsterAlignment = null,
}) {
    resetGame();
    game.u = {
        ux: 1, uy: 1, ux0: 1, uy0: 1,
        uz: { dnum: 0, dlevel: depth },
        ulevel: Math.max(1, Math.min(depth, 30)),
        uhp: 80, uhpmax: 80,
        acurr: { a: Array(6).fill(12) },
        amax: { a: Array(6).fill(12) },
        uhave: {}, ualign: { type: 0 },
    };
    game.flags = {};
    game.context = {};
    game.moves = 2;
    game.in_mklev = true;
    game.dungeons = [{
        dname: 'The Dungeons of Doom',
        depth_start: 1,
        num_dunlevs: 30,
        flags: {},
    }];
    game.level = new GameMap();
    game.stairs = null;

    initRng(999n);
    init_objects();
    initRng(BigInt(seed));

    const active = {
        prototype, variant, defaultLit,
        align: ['law', 'neutral', 'chaos'],
        ...(monsterAlignment ? { monsterAlignment } : {}),
    };
    game._activeSpecialLevel = active;
    return active;
}
