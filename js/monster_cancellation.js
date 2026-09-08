// Cancellation applied to a monster.
// C ref: zap.c cancel_monst() and mon.c normal_shape().

import { M_AP_MONSTER } from './const.js';
import { canProjectMonster, pline } from './display.js';
import { game } from './gstate.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { rn2 } from './rng.js';
import {
    isHumanWereMonster, isWereMonster, transformWereMonster,
} from './were.js';

const PM_CLAY_GOLEM = MONSTER_NAME.indexOf('clay golem');
const S_MIMIC = 13;

async function restoreNaturalShape(monster, state, publish) {
    let changed = false;
    if (Number.isInteger(monster.cham) && monster.cham >= 0) {
        const cancelled = monster.mcan;
        changed = !!await changeMonsterForm(monster, monster.cham, state, { publish }) || changed;
        monster.cham = -1;
        if (cancelled) monster.mcan = 1;
    }
    if (isWereMonster(monster) && !isHumanWereMonster(monster)) {
        changed = await transformWereMonster(monster, state, {
            repaint: false, publish,
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
    const changedShape = await restoreNaturalShape(monster, state, publish);
    const clayGolem = monster.mnum === PM_CLAY_GOLEM;
    if (clayGolem && canProjectMonster(monster, monster.mx, monster.my)) {
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
