import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
import type { MessagePublisher } from './display.js';
// Cancellation applied to a monster.
// C ref: zap.c cancel_monst() and mon.c normal_shape().

import { canSeeMonster, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { MONSTER_NAME } from './monster_data.js';
import { normalizeMonsterShape } from './monster_polymorph.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { rn2 } from './rng.js';

const PM_CLAY_GOLEM = MONSTER_NAME.indexOf('clay golem');

function monsterName(monster: Monster) {
    return monster.name || MONSTER_NAME[monster.mnum] || 'monster';
}

export interface CancelMonsterOptions {
    state?: GameState;
    attackLevel: number;
    random?: typeof rn2;
    allowKill?: boolean;
    publish?: MessagePublisher;
    finishMonsterKill?: typeof finishHeroMonsterKill;
}

export async function cancelMonster(monster: Monster, {
    state = game,
    attackLevel,
    random = rn2,
    allowKill = true,
    publish = plineWithContinuation,
    finishMonsterKill = finishHeroMonsterKill,
}: CancelMonsterOptions) {
    if (monsterResistsEffect(monster, attackLevel, random)) {
        return { cancelled: false, resisted: true, killed: false };
    }

    monster.mcan = 1;
    const shape = await normalizeMonsterShape(monster, state, publish);
    if (shape.heroDied) return {
        cancelled: true, resisted: false, heroDied: true, changedShape: shape.changed,
    };
    const changedShape = shape.changed;
    const clayGolem = monster.mnum === PM_CLAY_GOLEM;
    if (clayGolem && canSeeMonster(monster)) {
        await publish(
            `Some writing vanishes from the ${monsterName(monster)}'s head!`,
        );
    }

    let killed = false;
    if (clayGolem && allowKill) {
        killed = await finishMonsterKill(monster, monster.mx, monster.my);
    }
    return {
        cancelled: true,
        resisted: false,
        killed,
        clayGolem,
        changedShape,
    };
}
