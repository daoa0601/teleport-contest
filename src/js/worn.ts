// C worn.c:mon_adjust_speed(). Permanent monster speed changes.
import { MFAST, MSLOW } from './const.js';
import { game } from './gstate.js';
import { MONSTER_MOVE } from './monster_data.js';
import { OBJECT_PROPERTY } from './object_data.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import { naturalMonsterSpeed } from './mon.js';

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
export function adjustMonsterSpeed(monster: Monster, amount: number): MonsterSpeedChange {
    const oldSpeed = monster.mspeed ?? 0;
    if (amount === 2) {
        monster.permspeed = MFAST;
    } else if (amount === 1) {
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
export function monsterSpeedMessage(change: MonsterSpeedChange, subject: string, state: GameState = game): string | null {
    if (state.in_mklev || [2, -2, -4].includes(change.amount)
        || (!change.changed && change.amount !== -3) || !change.canDescribe)
        return null;
    if (change.amount === -3)
        return state.flags.verbose ? `${subject} is slowing down.` : null;
    const much = change.much ? 'much ' : '';
    if (change.amount > 0 || change.speed === MFAST)
        return `${subject} is suddenly moving ${much}faster.`;
    return `${subject} seems to be moving ${much}slower.`;
}
