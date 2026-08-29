// were.js — Shared deterministic were-creature form transition.
// C refs: were.c counter_were(), new_were(); mondata.c set_mon_data().

import { game } from './gstate.js';
import { newsym } from './display.js';
import {
    MONSTER_COLOR, MONSTER_FLAGS2, MONSTER_MOVE, MONSTER_SYMBOL,
} from './monster_data.js';
import { RIN_PROTECTION_FROM_SHAPE_CHANGERS } from './object_data.js';

const M2_WERE = 0x00000004;
const M2_HUMAN = 0x00000008;
const MONSTER_CLASS_SYMBOLS = ['', ...'abcdefghijklmnopqrstuvwxyz',
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '@', ' ', "'", '&', ';', ':', '~', ']'];

const COUNTER_WERE = new Map([
    [15, 262], [262, 15], // werejackal <-> human werejackal
    [21, 263], [263, 21], // werewolf <-> human werewolf
    [91, 261], [261, 91], // wererat <-> human wererat
]);

export function heroHasProtectionFromShapeChangers(state = game) {
    if (state.u?.protectionFromShapeChangers
        || state.protectionFromShapeChangers) return true;
    return [state.uleft, state.uright, state.u?.uleft, state.u?.uright]
        .some(object => object?.otyp === RIN_PROTECTION_FROM_SHAPE_CHANGERS
            && object.worn !== false);
}

export function isWereMonster(monster) {
    return !!((MONSTER_FLAGS2[monster?.mnum] ?? 0) & M2_WERE);
}

export function isHumanWereMonster(monster) {
    const flags = MONSTER_FLAGS2[monster?.mnum] ?? 0;
    return !!(flags & M2_WERE) && !!(flags & M2_HUMAN);
}

export function transformWereMonster(monster, state = game, {
    repaint = state === game,
} = {}) {
    if (!isWereMonster(monster)) return false;
    if (isHumanWereMonster(monster)
        && heroHasProtectionFromShapeChangers(state)) return false;

    const oldMnum = monster.mnum;
    const newMnum = COUNTER_WERE.get(oldMnum);
    if (!Number.isInteger(newMnum)) return false;

    const oldSpeed = MONSTER_MOVE[oldMnum] ?? monster.mmove ?? 0;
    const newSpeed = MONSTER_MOVE[newMnum] ?? monster.mmove ?? 0;
    if ((monster.movement ?? 0) && newSpeed < oldSpeed && oldSpeed > 0)
        monster.movement = Math.trunc(monster.movement * newSpeed / oldSpeed);

    monster.mnum = newMnum;
    monster.mmove = newSpeed;
    monster.symbol = MONSTER_CLASS_SYMBOLS[MONSTER_SYMBOL[newMnum] || 0] || '?';
    monster.color = MONSTER_COLOR[newMnum];
    if (monster.msleeping || monster.mfrozen || monster.mcanmove === 0) {
        monster.msleeping = 0;
        monster.mfrozen = 0;
        monster.mcanmove = 1;
    }
    if (Number.isFinite(monster.mhp) && Number.isFinite(monster.mhpmax)) {
        const healing = Math.trunc((monster.mhpmax - monster.mhp) / 4);
        monster.mhp = Math.min(monster.mhpmax, monster.mhp + healing);
    }
    if (repaint) newsym(monster.mx, monster.my);
    return true;
}
