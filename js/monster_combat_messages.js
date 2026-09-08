// C mhitm.c:hitmm(), missmm(), and noises().

import { canSpotMonster, map_invisible, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { monsterSentenceSubject } from './monster_sound.js';
import { cansee } from './vision.js';

export function canSeeMonsterCombat(attacker, defender) {
    return (cansee(attacker.mx, attacker.my)
            && canSpotMonster(attacker, attacker.mx, attacker.my))
        || (cansee(defender.mx, defender.my)
            && canSpotMonster(defender, defender.mx, defender.my));
}

export async function showMonsterCombatAttack(aggressor, defender, attack, state = game) {
    if (state._suppressMessagesUntilInput) return;
    const attackerSpotted = canSpotMonster(aggressor, aggressor.mx, aggressor.my);
    const defenderSpotted = canSpotMonster(defender, defender.mx, defender.my);
    const visible = canSeeMonsterCombat(aggressor, defender);
    if (!visible) {
        await reportCombatNoise(aggressor, state);
        return;
    }
    if (!attackerSpotted) map_invisible(aggressor.mx, aggressor.my);
    if (!defenderSpotted) map_invisible(defender.mx, defender.my);
    const subject = attackerSpotted ? monsterSentenceSubject(aggressor) : 'It';
    const target = defenderSpotted
        ? monsterSentenceSubject(defender).replace(/^The /u, 'the ') : 'it';
    const nymphContact = aggressor.mnum === 68 && !aggressor.mcan
        && [21, 22].includes(attack.damageType);
    if (nymphContact) {
        if (!attack.hit) {
            await plineWithContinuation(`${subject} pretends to be friendly to ${target}.`);
        } else {
            const verb = defender.mcansee ? 'smiles at' : 'talks to';
            const manner = !!aggressor.female === !!defender.female
                ? 'engagingly' : 'seductively';
            await plineWithContinuation(`${subject} ${verb} ${target} ${manner}.`);
        }
        return;
    }
    const verb = !attack.hit ? 'misses'
        : { bite: 'bites', sting: 'stings', butt: 'butts', touch: 'touches' }[attack.type]
            || 'hits';
    await plineWithContinuation(`${subject} ${verb} ${target}.`);
}

export async function showMonsterCombatDeath(defender, state = game) {
    if (!state._suppressMessagesUntilInput && cansee(defender.mx, defender.my))
        await plineWithContinuation(`${monsterSentenceSubject(defender)} is killed!`);
}

async function reportCombatNoise(aggressor, state) {
    if (state.deaf) return;
    const far = (aggressor.mx - state.u.ux) ** 2
        + (aggressor.my - state.u.uy) ** 2 > 15;
    const lastFar = state._farMonsterNoise ?? false;
    const lastMove = state._monsterNoiseTime ?? 0;
    if (far === lastFar && state.moves - lastMove <= 10) return;
    state._farMonsterNoise = far;
    state._monsterNoiseTime = state.moves;
    await plineWithContinuation(`You hear some noises${far ? ' in the distance' : ''}.`);
}
