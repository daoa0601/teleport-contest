// A monster falling into an ordinary or spiked pit.
// C ref: trap.c:trapeffect_pit().
import { SPIKED_PIT } from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { monsterSelfTouch } from './monster_stoning.js';
import { finishEnvironmentalMonsterDeath, finishMonsterKilled } from './monster_death.js';
import { AD_PHYS } from './monster_attack_types.js';
import { MONSTER_FLAGS1, MONSTER_SYMBOL, } from './monster_data.js';
import { monsterWearsIronShoes } from './monworn.js';
import { monsterName } from './monster_name.js';
import { rnd } from './rng.js';
import { monsterTrapVisibility, seeTrap } from './trap.js';
import { levelHasCeiling } from './terrain_properties.js';
const M1_CLING = 0x00000010;
const M1_FLY = 0x00000001;
const M1_WALLWALK = 0x00000008;
const PM_PIT_FIEND = 300;
const PM_PIT_VIPER = 218;
const S_EYE = 5;
const S_LIGHT = 25;
function monsterIsUngrounded(monster, state) {
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[monster.mnum];
    const clingsToCeiling = !!(flags & M1_CLING) && levelHasCeiling(state);
    return !!(flags & M1_FLY) || clingsToCeiling || symbol === S_EYE || symbol === S_LIGHT
        || !!monster.wormno && (monster.wormSegments?.length ?? 0) > 5;
}
export function beginMonsterPitTrap(monster, trap, state = game, { forced = false } = {}) {
    if (!trap)
        return null;
    const ungrounded = monsterIsUngrounded(monster, state);
    const sokoban = !!state.level?.flags.sokoban_rules;
    const falls = !(ungrounded && forced && !sokoban);
    const inescapable = forced || sokoban && !trap.madeby_u;
    if (ungrounded && falls && !inescapable)
        return null;
    const visibility = monsterTrapVisibility(monster, state);
    const spiked = trap.ttyp === SPIKED_PIT;
    const relevantSpikes = spiked && !monsterWearsIronShoes(monster);
    if (falls && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_WALLWALK))
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
        falls,
        dragged: ungrounded && falls,
    };
}
export async function finishMonsterPitTrap(monster, event, { publish = plineWithContinuation, random, rollOne = rnd, state = game, describeMonster = target => monsterName(target, { state, capitalized: true }), } = {}) {
    if (!event || event.finished)
        return event;
    if (!event.falls) {
        if (event.inSight) {
            seeTrap(event.trap, state);
            await publish(`${monsterName(monster, { capitalized: true, state })} doesn't fall into the pit.`);
        }
        event.finished = true;
        return event;
    }
    if (event.inSight) {
        const owner = event.trap.madeby_u ? 'your' : 'a';
        await publish(`${describeMonster(monster)} ${event.dragged ? 'is dragged' : 'falls'} into ${owner} pit!`);
        if (monster.mnum === PM_PIT_VIPER || monster.mnum === PM_PIT_FIEND)
            await publish("How pitiful.  Isn't that the pits?");
        seeTrap(event.trap, state);
    }
    const selfTouch = await monsterSelfTouch(monster, {
        prefix: 'Falling, ',
        finishDeath: (victim, options) => finishEnvironmentalMonsterDeath(victim, state, {
            ...options, publish,
            ...(random === undefined ? {} : { random }),
        }),
        publish,
        state,
    });
    if (!selfTouch.survived) {
        event.killed = true;
        event.finished = true;
        return event;
    }
    const damage = rollOne(event.damageSides);
    monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
    if (monster.mhp <= 0) {
        const death = await finishMonsterKilled(monster, state, {
            damageType: AD_PHYS,
            ...(random === undefined ? {} : { random }),
            publish,
        });
        event.death = death;
        event.killed = !death.survived;
        if (death.survived)
            monster.dead = false;
    }
    event.finished = true;
    return event;
}
//# sourceMappingURL=monster_pit_trap.js.map