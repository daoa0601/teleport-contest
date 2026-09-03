import { game } from '../../js/gstate.js';
import { init_objects } from '../../js/o_init.js';
import { initRng } from '../../js/rng.js';
import { vision_recalc, vision_reset_new_level } from '../../js/vision.js';
import { freshPlayableRoom } from './playable-room.js';

export function freshObjectRoom({
    objectInitializationSeed = 999n,
    gameplaySeed,
    moves = 40,
    flags = {},
    context = {},
    hero = {},
    recalculateVision = true,
    ...room
} = {}) {
    const attributes = Array(6).fill(12);
    const level = freshPlayableRoom({
        left: 7,
        right: 16,
        top: 6,
        bottom: 14,
        ...room,
        seed: objectInitializationSeed,
        moves,
        flags,
        context,
        hero: {
            uz: { dnum: 0, dlevel: 8 },
            ulevel: 8,
            uhp: 40,
            uhpmax: 40,
            ualign: { type: 0, record: 0 },
            acurr: { a: attributes.slice() },
            amax: { a: attributes.slice() },
            uconduct: {},
            uhave: {},
            blindTurns: 0,
            ...hero,
        },
    });
    game.mvitals = [];
    game.in_mklev = false;
    vision_reset_new_level();
    if (recalculateVision) vision_recalc(0);
    init_objects();
    if (gameplaySeed !== undefined) initRng(BigInt(gameplaySeed));
    return level;
}
