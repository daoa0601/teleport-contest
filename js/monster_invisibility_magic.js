// The make-invisible wand against monsters, the hero, and engravings.
// C refs: zap.c bhitm(), zap_steed(), zap_updown(), and weffects().

import {
    COLNO, DOOR, D_CLOSED, D_LOCKED, ROWNO, ZAP_POS,
} from './const.js';
import {
    canSeeMonster, canSpotMonster, newsym, pline,
} from './display.js';
import { deleteEngravingAt } from './engrave.js';
import { game } from './gstate.js';
import { zapHeroInvisible } from './hero_invisibility.js';
import { wakeMonster } from './monster_anger.js';
import {
    setMonsterPermanentInvisibility,
} from './monster_invisibility.js';
import { monsterTypeName } from './monster_data.js';
import { rn2 } from './rng.js';

const DIR_DX = {
    h: -1, l: 1, j: 0, k: 0, y: -1, u: 1, b: -1, n: 1,
};
const DIR_DY = {
    h: 0, l: 0, j: 1, k: -1, y: -1, u: -1, b: 1, n: 1,
};

function monsterAt(x, y, state) {
    return state.level?.monsters?.find(monster =>
        (monster.mhp ?? 1) > 0 && monster.mx === x && monster.my === y,
    ) || null;
}

function rayCellIsOpen(x, y, state) {
    const location = state.level?.at(x, y);
    if (!location || !ZAP_POS(location.typ)) return false;
    return location.typ !== DOOR
        || !(location.doormask & (D_CLOSED | D_LOCKED));
}

function revealMimic(monster) {
    if (!monster.m_ap_type) return;
    monster.m_ap_type = 0;
    monster.mappearance = 0;
    newsym(monster.mx, monster.my);
}

function monsterName(monster) {
    return monster.name
        || `The ${monsterTypeName(monster.mnum, !!monster.female)}`;
}

async function makeMonsterInvisible(monster) {
    const wasInvisible = !!monster.minvis;
    const wasVisible = canSeeMonster(monster, monster.mx, monster.my);
    revealMimic(monster);
    const name = monsterName(monster);

    setMonsterPermanentInvisibility(monster);
    newsym(monster.mx, monster.my);

    let identified = false;
    if (!wasInvisible && monster.minvis && canSpotMonster(monster)) {
        await pline(`${name} turns transparent!`);
        identified = true;
    } else if (wasVisible
        && !canSeeMonster(monster, monster.mx, monster.my)) {
        await pline(`${name} vanishes!`);
    }
    await wakeMonster(monster, { attacked: true });
    return identified;
}

export async function makeInvisibleInDirection(direction, {
    state = game,
    random = rn2,
} = {}) {
    if (state.u?.uswallow && state.u?.ustuck) {
        return makeMonsterInvisible(state.u.ustuck);
    }
    if (direction === '.') return zapHeroInvisible(state, random);
    if (direction === '>' && state.u?.usteed) {
        await makeMonsterInvisible(state.u.usteed);
        return true;
    }
    if (direction === '>') {
        deleteEngravingAt(state.u.ux, state.u.uy, state.level);
        return false;
    }
    if (direction === '<') return false;

    const dx = DIR_DX[direction], dy = DIR_DY[direction];
    if (dx === undefined || dy === undefined) return false;
    let x = state.u.ux, y = state.u.uy;
    let range = 6 + random(8);
    let identified = false;
    while (range-- > 0) {
        x += dx;
        y += dy;
        if (x < 1 || x >= COLNO || y < 0 || y >= ROWNO) break;
        const monster = monsterAt(x, y, state);
        if (monster) {
            if (await makeMonsterInvisible(monster)) identified = true;
            range -= 3;
        }
        if (!rayCellIsOpen(x, y, state)) break;
    }
    return identified;
}
