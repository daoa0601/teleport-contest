// Bear traps triggered by monsters.
// C ref: trap.c:trapeffect_bear_trap().
import { finishMonsterTrapDeath } from './monster_death.js';
import { AD_PHYS } from './monster_attack_types.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { publishHeardMessage } from './hero_speech.js';
import { MONSTER_NAME, MONSTER_SIZE, monsterIsAmorphous, monsterIsUnsolid, monsterIsWhirly, } from './monster_data.js';
import { monsterWearsIronShoes } from './monworn.js';
import { d, rn2 } from './rng.js';
import { monsterTrapVisibility, seeTrap } from './trap.js';
import { monsterInAir } from './terrain_properties.js';
import { monsterName } from './monster_name.js';
const MZ_SMALL = 1;
const PM_OWLBEAR = MONSTER_NAME.indexOf('owlbear');
const PM_BUGBEAR = MONSTER_NAME.indexOf('bugbear');
function bearTrapCanCatch(monster, state) {
    return ((MONSTER_SIZE[monster?.mnum] ?? 0) > MZ_SMALL &&
        !monsterIsAmorphous(monster) &&
        !monsterIsWhirly(monster) &&
        !monsterIsUnsolid(monster) &&
        !monsterInAir(monster, state));
}
export function beginMonsterBearTrap(monster, trap, state = game, { forced = false } = {}) {
    const event = {
        kind: 'bear-trap',
        trap,
        forced,
        caught: false,
        damage: 0,
        killed: false,
        finished: false,
        ...monsterTrapVisibility(monster, state),
    };
    if (!bearTrapCanCatch(monster, state)) {
        event.finished = true;
        return event;
    }
    monster.mtrapped = 1;
    event.caught = true;
    return event;
}
export async function finishMonsterBearTrap(monster, event, state = game, { publish = plineWithContinuation, random = rn2, rollDice = d, describeMonster = target => monsterName(target, { state, capitalized: true }), } = {}) {
    if (!event)
        return event;
    if (event.finished) {
        if (event.forced && event.inSight) {
            await publish(`${describeMonster(monster)} evades ${event.trap.madeby_u ? 'your' : 'a'} bear trap!`);
            seeTrap(event.trap, state);
        }
        return event;
    }
    if (event.inSight) {
        const owner = event.trap.madeby_u ? 'your' : 'a';
        await publish(`${describeMonster(monster)} is caught in ${owner} bear trap!`);
        seeTrap(event.trap, state);
    }
    else if (monster.mnum === PM_OWLBEAR || monster.mnum === PM_BUGBEAR) {
        await publishHeardMessage('the roaring of an angry bear!', publish, state);
    }
    if (!monsterWearsIronShoes(monster)) {
        event.damage = rollDice(2, 4);
        monster.mhp = Math.max(0, (monster.mhp ?? 1) - event.damage);
    }
    if (monster.mhp <= 0) {
        const death = await finishMonsterTrapDeath(monster, state, {
            damageType: AD_PHYS,
            random,
            publish,
        });
        event.death = death;
        event.killed = !death.survived;
    }
    event.finished = true;
    return event;
}
//# sourceMappingURL=bear_trap.js.map