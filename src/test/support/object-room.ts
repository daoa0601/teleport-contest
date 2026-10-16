import type { PlayableRoomOptions } from './playable-room.js';
import type { AttributeValues } from '../../js/roles.js';
import { game } from '../../js/gstate.js';
import { init_objects } from '../../js/o_init.js';
import { initRng } from '../../js/rng.js';
import { vision_recalc, vision_reset_new_level } from '../../js/vision.js';
import { freshPlayableRoom } from './playable-room.js';

export interface ObjectRoomOptions extends PlayableRoomOptions {
    objectInitializationSeed?: bigint;
    gameplaySeed?: bigint | number | string;
    recalculateVision?: boolean;
}


export function freshObjectRoom({
    objectInitializationSeed = 999n,
    gameplaySeed,
    moves = 40,
    flags = {},
    context = {},
    hero = {},
    recalculateVision = true,
    ...room
}: ObjectRoomOptions = {}) {
    const attributes: AttributeValues = [12, 12, 12, 12, 12, 12];
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
            acurr: { a: [...attributes] },
            amax: { a: [...attributes] },
            uconduct: {},
            uhave: {},
            blindTurns: 0,
            ...hero,
        },
    });
    game.in_mklev = false;
    vision_reset_new_level();
    if (recalculateVision) vision_recalc(0);
    // Opting out of initial sight also opts out of its pending refresh.
    else game.vision_full_recalc = 0;
    init_objects();
    if (gameplaySeed !== undefined) initRng(BigInt(gameplaySeed));
    return level;
}
