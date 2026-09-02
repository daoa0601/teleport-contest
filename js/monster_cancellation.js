// Cancellation applied to a monster.
// C ref: zap.c cancel_monst() and mon.c normal_shape().

import { M_AP_MONSTER } from './const.js';
import { canProjectMonster, pline } from './display.js';
import { game } from './gstate.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { shapechangeMonster } from './mklev.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { rn2 } from './rng.js';
import {
    isHumanWereMonster, isWereMonster, transformWereMonster,
} from './were.js';

const PM_CLAY_GOLEM = MONSTER_NAME.indexOf('clay golem');
const S_MIMIC = 13;

function restoreNaturalShape(monster, state) {
    let changed = false;
    if (Number.isInteger(monster.cham) && monster.cham >= 0) {
        const cancelled = monster.mcan;
        changed = shapechangeMonster(monster, monster.cham) || changed;
        monster.cham = -1;
        if (cancelled) monster.mcan = 1;
    }
    if (isWereMonster(monster) && !isHumanWereMonster(monster)) {
        changed = transformWereMonster(monster, state, {
            repaint: false,
        }) || changed;
    }

    if (!monster.m_ap_type) return changed;
    if (monster.meating) {
        monster.meating = 0;
        if (MONSTER_SYMBOL[monster.mnum] !== S_MIMIC)
            revealMonsterAppearance(monster);
        return true;
    }
    if (monster.m_ap_type !== M_AP_MONSTER)
        monster.msleeping = 1;
    revealMonsterAppearance(monster);
    return true;
}

function monsterName(monster) {
    return monster.name || MONSTER_NAME[monster.mnum] || 'monster';
}

export async function cancelMonster(monster, {
    state = game,
    attackLevel,
    random = rn2,
    allowKill = true,
    publish = pline,
    finishMonsterKill = finishHeroMonsterKill,
} = {}) {
    if (monsterResistsEffect(monster, attackLevel, random)) {
        return { cancelled: false, resisted: true, killed: false };
    }

    monster.mcan = 1;
    const changedShape = restoreNaturalShape(monster, state);
    const clayGolem = monster.mnum === PM_CLAY_GOLEM;
    if (clayGolem && canProjectMonster(monster, monster.mx, monster.my)) {
        await publish(
            `Some writing vanishes from the ${monsterName(monster)}'s head!`,
        );
    }

    let killed = false;
    if (clayGolem && allowKill) {
        killed = await finishMonsterKill(
            monster, monster.mx, monster.my, { weaponHit: false },
        );
    }
    return {
        cancelled: true,
        resisted: false,
        killed,
        clayGolem,
        changedShape,
    };
}
