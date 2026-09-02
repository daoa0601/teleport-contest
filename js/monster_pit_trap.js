// A monster falling into an ordinary or spiked pit.
// C ref: trap.c:trapeffect_pit().

import { SPIKED_PIT, W_ARMF } from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import {
    MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SYMBOL,
} from './monster_data.js';
import { IRON_SHOES } from './object_data.js';
import { rnd } from './rng.js';
import { monsterTrapVisibility } from './trap.js';

const M1_CLING = 0x00000010;
const M1_FLY = 0x00000001;
const M1_WALLWALK = 0x00000008;
const PM_PIT_FIEND = 300;
const PM_PIT_VIPER = 218;
const S_EYE = 5;
const S_LIGHT = 25;
function inventoryOf(monster) {
    return monster.minvent || monster.inventory || [];
}

function wearsIronShoes(monster) {
    return inventoryOf(monster).some(object =>
        object.otyp === IRON_SHOES
        && ((object.owornmask ?? 0) & W_ARMF));
}

function ordinaryMonsterSubject(monster) {
    return `The ${monster.name || MONSTER_NAME[monster.mnum] || 'monster'}`;
}

function monsterIsUngrounded(monster) {
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[monster.mnum];
    return !!(flags & M1_FLY) || symbol === S_EYE || symbol === S_LIGHT;
}

export function monsterAvoidsPit(monster, { forced = false } = {}) {
    if (monsterIsUngrounded(monster)) return true;
    return !forced && !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_CLING);
}

export function beginMonsterPitTrap(
    monster,
    trap,
    state = game,
    { forced = false } = {},
) {
    if (!trap || monsterAvoidsPit(monster, { forced })) return null;
    const visibility = monsterTrapVisibility(monster, state);
    const spiked = trap.ttyp === SPIKED_PIT;
    const relevantSpikes = spiked && !wearsIronShoes(monster);
    if (!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_WALLWALK))
        monster.mtrapped = 1;
    return {
        kind: 'pit-trap',
        trap,
        spiked,
        relevantSpikes,
        damageSides: relevantSpikes ? 10 : 6,
        killed: false,
        finished: false,
        ...visibility,
    };
}

export async function finishMonsterPitTrap(
    monster,
    event,
    {
        finishDeath,
        publish = plineWithContinuation,
        random,
        rollOne = rnd,
        describeMonster = ordinaryMonsterSubject,
    } = {},
) {
    if (!event || event.finished) return event;
    if (typeof finishDeath !== 'function')
        throw new TypeError('pit trap requires the monster death handler');

    if (event.inSight) {
        const owner = event.trap.madeby_u ? 'your' : 'a';
        await publish(
            `${describeMonster(monster)} falls into ${owner} ${
                event.spiked ? 'spiked ' : ''
            }pit!`,
        );
        event.trap.tseen = true;
        if (monster.mnum === PM_PIT_VIPER || monster.mnum === PM_PIT_FIEND)
            await publish("How pitiful.  Isn't that the pits?");
    }

    const damage = rollOne(event.damageSides);
    monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
    if (monster.mhp <= 0) {
        const name = describeMonster(monster);
        const death = await finishDeath(monster, {
            deathMessage: event.seeSquare ? `${name} is killed!` : null,
            visible: event.seeSquare,
            spotted: event.inSight,
            random,
            publish,
        });
        event.death = death;
        event.killed = !death.survived;
        if (death.survived) monster.dead = false;
    }
    event.finished = true;
    return event;
}
