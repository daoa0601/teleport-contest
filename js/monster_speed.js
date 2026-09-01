// Permanent monster speed and worn speed boots.
// C ref: worn.c mon_adjust_speed().

import { MFAST, MSLOW } from './const.js';
import { MONSTER_MOVE } from './monster_data.js';
import { SPEED_BOOTS } from './object_data.js';

function wearsSpeedBoots(monster) {
    return (monster?.minvent || monster?.inventory || []).some(object =>
        object?.otyp === SPEED_BOOTS && (object.owornmask ?? 0) !== 0);
}

function naturalSpeed(monster) {
    return Number.isFinite(monster?.mmove)
        ? monster.mmove : MONSTER_MOVE[monster?.mnum] ?? 0;
}

export function adjustMonsterSpeed(monster, amount) {
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

    monster.mspeed = wearsSpeedBoots(monster)
        ? MFAST : monster.permspeed ?? 0;
    return {
        amount,
        oldSpeed,
        speed: monster.mspeed,
        changed: monster.mspeed !== oldSpeed,
        much: monster.mspeed + oldSpeed === MFAST + MSLOW,
        canDescribe: naturalSpeed(monster) !== 0
            && !(monster.mfrozen ?? 0) && !monster.msleeping,
    };
}

export function monsterSpeedMessage(change, subject) {
    if ((!change.changed && change.amount !== -3) || !change.canDescribe)
        return null;
    if (change.amount === -3) return `${subject} is slowing down.`;
    const much = change.much ? 'much ' : '';
    if (change.amount > 0 || change.speed === MFAST)
        return `${subject} is suddenly moving ${much}faster.`;
    return `${subject} seems to be moving ${much}slower.`;
}
