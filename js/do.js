// do.js — shared hero command transactions.
// C refs: do.c cmd_safety_prevention()/donull() and hack.c monster_nearby().

import { game } from './gstate.js';
import { canSpotMonster, pline } from './display.js';
import { MONSTER_ATTACKS } from './monster_data.js';
import { M_AP_FURNITURE, M_AP_OBJECT } from './const.js';

const AT_BOOM = 14;

function monsterHasActiveAttack(monster) {
    return (MONSTER_ATTACKS[monster?.mnum] || [])
        .some(([attackType]) => attackType && attackType !== AT_BOOM);
}

function monsterIsHelpless(monster) {
    return !!(monster?.helpless || monster?.msleeping
        || monster?.mcanmove === 0 || (monster?.mfrozen ?? 0) > 0);
}

// C hack.c:monster_nearby().  This is the shared threat predicate used by
// both safe waiting and safe searching; it is intentionally stricter than
// mere adjacency.
export function threateningMonsterNearby(state = game) {
    const u = state.u;
    if (!u) return false;
    const hallucinating = !!(u.hallucinating
        || (u.hallucinationTurns ?? 0) > 0);
    return (state.level?.monsters || []).some(monster => {
        if (!monster || monster.dead || (monster.mhp ?? 1) <= 0
            || monsterIsHelpless(monster)
            || monster.m_ap_type === M_AP_FURNITURE
            || monster.m_ap_type === M_AP_OBJECT
            || monster.mundetected
            || (monster.mx === u.ux && monster.my === u.uy)
            || Math.abs(monster.mx - u.ux) > 1
            || Math.abs(monster.my - u.uy) > 1
            || !canSpotMonster(monster)) {
            return false;
        }
        return hallucinating
            || (!monster.mpeaceful && monsterHasActiveAttack(monster));
    });
}

function dangerousHeroProperties() {
    const u = game.u || {};
    return !!(u.stoned || (u.stonedTurns ?? 0) > 0
        || u.slimed || (u.slimedTurns ?? 0) > 0
        || u.strangled || (u.strangledTurns ?? 0) > 0
        || u.sick || (u.sickTurns ?? 0) > 0);
}

async function norep(message) {
    if (game._last_message !== message) await pline(message);
}

// C do.c:cmd_safety_prevention().  The per-command counter is durable across
// rejected inputs: with cmdassist disabled the first warning includes the
// `m`-prefix hint and later warnings shorten.  A successful or forced command
// resets its own counter.
export async function commandSafetyPrevention({
    force = false,
    multi = false,
    verb,
    description,
    action,
    counterKey,
}) {
    if (game.flags?.safe_wait !== false && !force && !multi) {
        const count = game[counterKey] ?? 0;
        const cmdassist = game.flags?.cmdassist !== false;
        const suffix = cmdassist || count === 0
            ? `  Use 'm' prefix to force ${description}.`
            : '';
        if (!cmdassist) game[counterKey] = count + 1;

        if (threateningMonsterNearby()) {
            await norep(`${action}${suffix}`);
            game.context.move = 0;
            return true;
        }
        if (dangerousHeroProperties()) {
            await norep(`${verb} doesn't feel like a good idea right now.`);
            game.context.move = 0;
            return true;
        }
    }

    game[counterKey] = 0;
    return false;
}

// C do.c:donull().  Return true when the wait consumes time and false when
// safe-wait policy rejects it.
export async function donull(force = false, multi = false) {
    const prevented = await commandSafetyPrevention({
        force,
        multi,
        verb: 'Waiting',
        description: 'a no-op (to rest)',
        action: 'Are you waiting to get hit?',
        counterKey: '_didNothingFlag',
    });
    return !prevented;
}
