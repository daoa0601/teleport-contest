// The #monster mind blast used by a polymorphed mind flayer.
// C refs: cmd.c domonability() and polyself.c domindblast().

import { BOLT_LIM } from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { dist2 } from './hacklib.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { wakeMonster } from './monster_anger.js';
import {
    monsterIsMindFlayer, monsterIsMindless, monsterIsTelepathic,
    monsterTypeName,
} from './monster_data.js';
import { rn2, rnd } from './rng.js';

export function heroCanMindBlast(state = game) {
    return (state.u?.mtimedone ?? 0) > 0
        && monsterIsMindFlayer(state.u?.umonnum);
}

export async function useHeroMindBlast({
    state = game,
    publish = plineWithContinuation,
    random = rn2,
    rollDamage = rnd,
    wake = wakeMonster,
    finishMonsterKill = finishHeroMonsterKill,
} = {}) {
    const hero = state.u || (state.u = {});
    if ((hero.uen ?? 0) < 10) {
        await publish(
            'You concentrate but lack the energy to maintain doing so.',
        );
        return { spentTime: false, hitCount: 0 };
    }

    hero.uen -= 10;
    await publish('You concentrate.');
    await publish('A wave of psychic energy pours out.');

    let hitCount = 0;
    for (const monster of Array.from(state.level?.monsters || [])) {
        if (!canReachMonsterMind(monster, hero)) continue;

        const sense = mindBlastSense(monster, random);
        if (!sense) continue;

        const damage = rollDamage(15);
        await wake(monster, { attacked: damage > monster.mhp });
        await publish(
            `You lock in on ${possessive(monsterName(monster))} ${sense}.`,
        );
        monster.mhp -= damage;
        hitCount++;
        if (monster.mhp <= 0) {
            await finishMonsterKill(monster, monster.mx, monster.my);
        }
    }
    return { spentTime: true, hitCount };
}

function canReachMonsterMind(monster, hero) {
    if (!monster || monster.dead || (monster.mhp ?? 0) <= 0)
        return false;
    if (monster.mpeaceful || monsterIsMindless(monster.mnum)) return false;
    return dist2(hero.ux, hero.uy, monster.mx, monster.my)
        <= BOLT_LIM * BOLT_LIM;
}

function mindBlastSense(monster, random) {
    const telepathic = monsterIsTelepathic(monster.mnum);
    const blind = monster.mcansee === 0 || monster.mcansee === false;
    if (telepathic && blind) return 'telepathy';
    if (telepathic && random(2) !== 0) return 'latent telepathy';
    if (random(10) === 0)
        return telepathic ? 'latent telepathy' : 'mind';
    return null;
}

function monsterName(monster) {
    return monster.name
        || `the ${monsterTypeName(monster.mnum, !!monster.female)}`;
}

function possessive(name) {
    return /s$/iu.test(name) ? `${name}'` : `${name}'s`;
}
