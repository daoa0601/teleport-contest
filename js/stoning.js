// Shared petrifying contact and delayed hero petrification.
// State helpers serve potion.c make_stoned(); corpse pickup and whip snatching
// share the contact transaction, while egg effects serve eat.c and mthrowu.c.
import { KILLED_BY, KILLED_BY_AN } from './const.js';
import { plineWithContinuation } from './pline.js';
import { game } from './gstate.js';
import { MONSTER_NAME, requireMonsterData } from './monster_data.js';
import { CORPSE, EGG } from './object_data.js';
import { polymonHero } from './polyself.js';
import { resolveImmediatePetrification } from './trap.js';
import { PM_STONE_GOLEM, touchPetrifies, fleshPetrifies, heroResistsStoning, formCanBecomeStoneGolem, } from './mondata.js';
// Part of C youprop.h:Stoned(): read the runtime petrification timeout.
export function heroIsPetrifying(state = game) {
    return !!state.u?.stoned || (state.u?.stonedTurns ?? 0) > 0;
}
// Part of C potion.c:make_stoned(): start the timeout and retain its delayed killer.
export function startHeroPetrification({ state = game, turns = 5, killer = '', killerFormat = KILLED_BY_AN, } = {}) {
    const hero = state.u;
    if (heroIsPetrifying(state)
        || hero.stoneResistance)
        return false;
    hero.stonedTurns = turns;
    hero.stoned = turns > 0;
    if (hero.stoned)
        state.context.botl = true;
    hero.stoneKiller = killer;
    hero.stoneKillerFormat = killerFormat;
    return hero.stoned;
}
// Part of C potion.c:make_stoned(): clear the timeout and delayed killer.
export function clearHeroPetrification(state = game) {
    const hero = state.u;
    const wasPetrifying = heroIsPetrifying(state);
    if (wasPetrifying)
        state.context.botl = true;
    hero.stonedTurns = 0;
    hero.stoned = false;
    delete hero.stoneKiller;
    delete hero.stoneKillerFormat;
    return wasPetrifying;
}
// Part of C pickup.c:u_safe_from_fatal_corpse(): test protection from bare-handed petrifying corpse contact.
export function handlesPetrifyingCorpseBareHanded(object) {
    return object?.otyp === CORPSE && touchPetrifies(object.corpsenm)
        && !(game.uarmg || game.u?.uarmg) && !heroResistsStoning();
}
// Part of C pickup.c:fatal_corpse_mistake(): attempt stone-golem conversion before fatal corpse contact.
export async function petrifyFromCorpseContact(message, killer, beforeDeath = null) {
    // Pickup and snatching try the golem conversion before warning or
    // placing a snatched corpse on the floor for death cleanup.
    if (formCanBecomeStoneGolem(game.u.umonnum)) {
        const result = await polymonHero(PM_STONE_GOLEM);
        if (result.died)
            return { died: true };
        if (result.transformed)
            return null;
    }
    await plineWithContinuation(message);
    await beforeDeath?.();
    const result = await resolveImmediatePetrification({
        killer,
        publish: plineWithContinuation,
    });
    return { died: result.died };
}
// Part of C eat.c:fpostfx(): petrifying egg aftereffects.
export async function eatPetrifyingEgg(object) {
    if (object?.otyp !== EGG || !fleshPetrifies(object.corpsenm)
        || heroResistsStoning())
        return { started: false };
    if (formCanBecomeStoneGolem(game.u.umonnum)) {
        await polymonHero(PM_STONE_GOLEM);
        return { started: false, transformed: true };
    }
    const species = corpseSpeciesName(object);
    const started = startHeroPetrification({
        killer: `${species} egg`,
    });
    return { started, transformed: false };
}
// Part of C mthrowu.c:m_throw(): petrifying egg contact with the hero.
export async function hitByPetrifyingEgg(object, state = game) {
    if (object?.otyp !== EGG || !touchPetrifies(object.corpsenm)
        || heroResistsStoning(state)) {
        return { started: false, transformed: false };
    }
    if (formCanBecomeStoneGolem(state.u.umonnum, state)) {
        await polymonHero(PM_STONE_GOLEM);
        return { started: false, transformed: true };
    }
    const started = startHeroPetrification({ state, killer: '', killerFormat: KILLED_BY });
    return { started, transformed: false };
}
// Port only: require a corpse or egg's species-table name.
function corpseSpeciesName(object) {
    if (object.corpsenm === undefined)
        throw new Error('Petrifying contact requires a corpse or egg species.');
    return requireMonsterData(MONSTER_NAME, object.corpsenm);
}
//# sourceMappingURL=stoning.js.map