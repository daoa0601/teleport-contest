// Monster movement rates and permanent speed changes.
// C refs: mon.c:mcalcmove(), worn.c:mon_adjust_speed().

import { MFAST, MSLOW, NORMAL_SPEED } from './const.js';
import { game } from './gstate.js';
import { rn2 } from './rng.js';
import { MONSTER_MOVE } from './monster_data.js';
import { OBJECT_PROPERTY } from './object_data.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';

export interface MonsterSpeedChange {
    amount: number;
    oldSpeed: number;
    speed: number;
    changed: boolean;
    much: boolean;
    canDescribe: boolean;
}

function wearsSpeedItem(monster: Monster): boolean {
    return (monster?.minvent || monster?.inventory || []).some(object =>
        OBJECT_PROPERTY[object.otyp] === 'fast' && (object.owornmask ?? 0) !== 0);
}

export function naturalMonsterSpeed(monster: Monster): number {
    return monster.mmove !== undefined && Number.isFinite(monster.mmove)
        ? monster.mmove : MONSTER_MOVE[monster.mnum] ?? 0;
}

export function initializeMonsterMovement(monster: Monster): Monster {
    if (!monster) return monster;
    if (!Number.isFinite(monster.movement)) monster.movement = 0;
    if (!Number.isFinite(monster.mmove))
        monster.mmove = naturalMonsterSpeed(monster);
    if (!Number.isFinite(monster.mspeed)) monster.mspeed = 0;
    return monster;
}

// C mon.c:mcalcmove(). moving=false leaves the adjusted speed unrounded.
export function mcalcmove(
    monster: Monster, moving = true, random = rn2, state: GameState = game,
): number {
    initializeMonsterMovement(monster);
    let mmove = naturalMonsterSpeed(monster);

    if (monster.mspeed === MSLOW) {
        mmove = mmove < NORMAL_SPEED
            ? Math.trunc((2 * mmove + 1) / 3)
            : 4 + Math.trunc(mmove / 3);
    } else if (monster.mspeed === MFAST) {
        mmove = Math.trunc((4 * mmove + 2) / 3);
    }

    if (monster === state.u?.usteed
        && (state.u?.ugallop ?? 0) > 0
        && state.context?.mv) {
        mmove = Math.trunc((random(2) ? 4 : 5) * mmove / 3);
    }

    if (moving) {
        const adjustment = mmove % NORMAL_SPEED;
        mmove -= adjustment;
        // NetHack performs this draw even when adjustment is zero.
        if (random(NORMAL_SPEED) < adjustment) mmove += NORMAL_SPEED;
    }
    return mmove;
}

export function adjustMonsterSpeed(monster: Monster, amount: number): MonsterSpeedChange {
    const oldSpeed = monster.mspeed ?? 0;
    if (amount === 2) {
        monster.permspeed = MFAST;
    } else if (amount > 0) {
        monster.permspeed = monster.permspeed === MSLOW ? 0 : MFAST;
    } else if (amount === -1) {
        monster.permspeed = monster.permspeed === MFAST ? 0 : MSLOW;
    } else if (amount === -2) {
        monster.permspeed = MSLOW;
    } else if (amount === -3 || amount === -4) {
        if (monster.permspeed === MFAST) monster.permspeed = 0;
    }

    monster.mspeed = wearsSpeedItem(monster)
        ? MFAST : monster.permspeed ?? 0;
    return {
        amount,
        oldSpeed,
        speed: monster.mspeed,
        changed: monster.mspeed !== oldSpeed,
        much: monster.mspeed + oldSpeed === MFAST + MSLOW,
        canDescribe: naturalMonsterSpeed(monster) !== 0
            && !(monster.mfrozen ?? 0) && !monster.msleeping,
    };
}

export function monsterSpeedMessage(change: MonsterSpeedChange, subject: string): string | null {
    if ((!change.changed && change.amount !== -3) || !change.canDescribe)
        return null;
    if (change.amount === -3) return `${subject} is slowing down.`;
    const much = change.much ? 'much ' : '';
    if (change.amount > 0 || change.speed === MFAST)
        return `${subject} is suddenly moving ${much}faster.`;
    return `${subject} seems to be moving ${much}slower.`;
}
