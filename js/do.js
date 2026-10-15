// do.js — shared hero command transactions.
// C refs: do.c cmd_safety_prevention(), donull(), dowipe(), and wipeoff();
//         hack.c monster_nearby().
import { heroIsHallucinating } from './senses.js';
import { game } from './gstate.js';
import { canSpotMonster, pline, plineWithContinuation, } from './display.js';
import { MONSTER_ATTACKS } from './monster_data.js';
import { AT_BOOM } from './monster_attack_types.js';
import { M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPE } from './const.js';
import { setHeroBlindnessTurns } from './senses.js';
import { makeBlinded } from './sight_change.js';
import { gulpBlindnessCheck } from './engulf_blindness.js';
import { heroFaceName } from './body_parts.js';
function monsterHasActiveAttack(monster) {
    return (MONSTER_ATTACKS[monster?.mnum] || [])
        .some(([attackType]) => attackType && attackType !== AT_BOOM);
}
function monsterIsHelpless(monster) {
    return !!(monster.msleeping
        || monster?.mcanmove === 0 || (monster?.mfrozen ?? 0) > 0);
}
// C hack.c:monster_nearby().  This is the shared threat predicate used by
// both safe waiting and safe searching; it is intentionally stricter than
// mere adjacency.
export function threateningMonsterNearby(state = game) {
    const u = state.u;
    if (!u)
        return false;
    const hallucinating = heroIsHallucinating(state);
    return (state.level?.monsters || []).some(monster => {
        if (!monster || monster.dead || (monster.mhp ?? 1) <= 0
            || monsterIsHelpless(monster)
            || M_AP_TYPE(monster) === M_AP_FURNITURE
            || M_AP_TYPE(monster) === M_AP_OBJECT
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
    const u = game.u;
    return !!(u.stoned || (u.stonedTurns ?? 0) > 0
        || u.slimed || (u.slimedTurns ?? 0) > 0
        || u.strangled || (u.strangledTurns ?? 0) > 0
        || u.sick || (u.sickTurns ?? 0) > 0);
}
async function norep(message) {
    if (game._last_message !== message)
        await pline(message);
}
// C do.c:cmd_safety_prevention().  The per-command counter is durable across
// rejected inputs: with cmdassist disabled the first warning includes the
// `m`-prefix hint and later warnings shorten.  A successful or forced command
// resets its own counter.
export async function commandSafetyPrevention({ force = false, multi = false, verb, description, action, counterKey, }) {
    if (game.flags?.safe_wait !== false && !force && !multi) {
        const count = game[counterKey] ?? 0;
        const cmdassist = game.flags?.cmdassist !== false;
        const suffix = cmdassist || count === 0
            ? `  Use 'm' prefix to force ${description}.`
            : '';
        if (!cmdassist)
            game[counterKey] = count + 1;
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
// C do.c:dowipe().  Starting the command and cleaning one turn are separate
// because monsters and timed effects act between occupation turns.
export async function dowipe(state = game) {
    if ((state.u?.ucreamed ?? 0) > 0) {
        state._occupation = {
            key: 'wipe-face',
            remaining: 1,
            text: `wiping off your ${heroFaceName(state)}`,
        };
        state.context.move = 1;
        return;
    }
    await pline(`Your ${heroFaceName(state)} is already clean.`);
    state.context.move = 1;
}
export async function continueWipingFace(occupation, state = game) {
    occupation.remaining--;
    const creamRemoved = Math.min(4, state.u?.ucreamed ?? 0);
    const blindnessRemoved = Math.min(4, state.u?.blindTurns ?? 0);
    state.u.ucreamed = Math.max(0, (state.u?.ucreamed ?? 0) - creamRemoved);
    state.u.blindTurns = Math.max(0, (state.u?.blindTurns ?? 0) - blindnessRemoved);
    if ((state.u?.blindTurns ?? 0) === 0) {
        await pline("You've got the glop off.");
        state.u.ucreamed = 0;
        const gulp = await gulpBlindnessCheck({ state, publish: plineWithContinuation });
        if (!gulp.triggered && !gulp.died) {
            setHeroBlindnessTurns(1, state);
            await makeBlinded(0, { state, publish: plineWithContinuation });
        }
        state._occupation = null;
    }
    else if ((state.u?.ucreamed ?? 0) === 0) {
        await pline(`Your ${heroFaceName(state)} feels clean now.`);
        state._occupation = null;
    }
    else if (occupation.remaining <= 0) {
        occupation.remaining = 1;
    }
    state.context.move = 1;
    return true;
}
//# sourceMappingURL=do.js.map