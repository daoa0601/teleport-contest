// Slow-monster and speed-monster magic.
// C refs: zap.c bhit(), bhitm(), and zapyourself().

import { exerciseAttribute } from './attrib.js';
import {
    A_DEX, COLNO, DOOR, D_CLOSED, D_LOCKED, ROWNO, TIMEOUT, ZAP_POS,
} from './const.js';
import {
    canProjectMonster, newsym, pline,
} from './display.js';
import { game } from './gstate.js';
import {
    beginDeferredHeroExpulsion, finishDeferredHeroExpulsion,
} from './monmove.js';
import { wakeMonster } from './monster_anger.js';
import {
    MONSTER_SYMBOL, monsterTypeName,
} from './monster_data.js';
import {
    adjustMonsterSpeed, monsterSpeedMessage,
} from './monster_speed.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { checkMonsterGearNextTurn } from './monworn.js';
import {
    hasIntrinsicProperty, removeIntrinsicProperty,
} from './properties.js';
import { rn2, rnd } from './rng.js';

const PM_AIR_ELEMENTAL = 154;
const S_VORTEX = 22;
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

function isWhirly(monster) {
    return monster?.mnum === PM_AIR_ELEMENTAL
        || MONSTER_SYMBOL[monster?.mnum] === S_VORTEX;
}

async function expelHero(monster, state, random, roll) {
    const name = monsterTypeName(monster.mnum, !!monster.female);
    await pline(`You disrupt the ${name}!`);
    await pline('A huge hole opens up...');
    await pline('You get expelled!');
    const action = {
        monster,
        calls: [],
        movement: { attack: { deferredExpulsion: true } },
    };
    beginDeferredHeroExpulsion(action, state);
    const relocation = finishDeferredHeroExpulsion(
        action, state, random, roll,
    );
    if (relocation) {
        newsym(relocation.oldx, relocation.oldy);
        newsym(relocation.x, relocation.y);
    }
}

async function affectMonster(monster, kind, source, state, options) {
    const attackLevel = source === 'wand' ? 12 : state.u?.ulevel ?? 1;
    const resisted = monsterResistsEffect(
        monster, attackLevel, options.random,
    );
    let observed = false;
    if (!resisted) {
        const speed = adjustMonsterSpeed(monster, kind === 'speed' ? 1 : -1);
        checkMonsterGearNextTurn(monster);
        if (canProjectMonster(monster, monster.mx, monster.my)) {
            const subject = `The ${monsterTypeName(
                monster.mnum, !!monster.female,
            )}`;
            const message = monsterSpeedMessage(speed, subject);
            if (message) {
                await pline(message);
                observed = true;
            }
        }
        if (kind === 'slow' && state.u?.uswallow
            && state.u?.ustuck === monster && isWhirly(monster)) {
            await expelHero(monster, state, options.random, options.roll);
        }
    }
    await wakeMonster(monster, { attacked: kind === 'slow' });
    return observed;
}

function heroHasRemovableSpeed(state) {
    const hero = state.u || {};
    const legacyIntrinsic = !!hero.fast
        && !hero.fastFromArmor && !hero.veryFastFromArmor;
    return (hero.veryFastTurns ?? 0) > 0
        || hasIntrinsicProperty('fast', null, state)
        || legacyIntrinsic;
}

async function slowHero(state) {
    if (!heroHasRemovableSpeed(state)) return false;
    state.u.veryFastTurns = 0;
    removeIntrinsicProperty('fast', state);
    state.u.veryFast = !!state.u.veryFastFromArmor;
    if (state.u.fast || state.u.veryFast)
        await pline('Your quickness feels less natural.');
    else
        await pline('You slow down.');
    exerciseAttribute(A_DEX, false, state);
    return true;
}

async function speedHero(state, random) {
    if (!state.u.veryFast) {
        const alreadyFast = state.u.fast || state.u.veryFastFromArmor;
        const much = alreadyFast ? '' : 'much ';
        await pline(`You are suddenly moving ${much}faster.`);
    } else {
        await pline('Your legs get new energy.');
    }
    state.u.veryFastTurns = Math.min(
        TIMEOUT,
        (state.u.veryFastTurns ?? 0) + 50 + random(25),
    );
    state.u.veryFast = true;
    exerciseAttribute(A_DEX, true, state);
    return true;
}

export async function changeMonsterSpeedInDirection(direction, {
    kind,
    source = 'wand',
    state = game,
    random = rn2,
    roll = rnd,
} = {}) {
    if (kind !== 'slow' && kind !== 'speed') return false;
    const options = { random, roll };
    if (state.u?.uswallow && state.u?.ustuck) {
        return affectMonster(state.u.ustuck, kind, source, state, options);
    }
    if (direction === '.') {
        return kind === 'speed' ? speedHero(state, random) : slowHero(state);
    }
    if (direction === '>' && state.u?.usteed) {
        await affectMonster(state.u.usteed, kind, source, state, options);
        return true;
    }
    if (direction === '<' || direction === '>') return false;

    const dx = DIR_DX[direction], dy = DIR_DY[direction];
    if (dx === undefined || dy === undefined) return false;
    let x = state.u.ux, y = state.u.uy;
    let range = 6 + random(8);
    let observed = false;
    while (range-- > 0) {
        x += dx;
        y += dy;
        if (x < 1 || x >= COLNO || y < 0 || y >= ROWNO) break;
        const monster = monsterAt(x, y, state);
        if (monster) {
            if (await affectMonster(monster, kind, source, state, options))
                observed = true;
            range -= 3;
        }
        if (!rayCellIsOpen(x, y, state)) break;
    }
    return observed;
}
