// C worn.c:mon_set_minvis() and mon_adjust_speed(). Permanent monster
// invisibility and speed changes.
import { MFAST, MSLOW, NON_PM } from './const.js';
import { game } from './gstate.js';
import { MONSTER_MOVE, MONSTER_NAME } from './monster_data.js';
import { OBJECT_PROPERTY } from './object_data.js';
import { naturalMonsterSpeed } from './mon.js';
import { artifactById } from './artifacts.js';
import { see_monsters } from './display.js';
import { grantWornProperty, hasCarriedProperty, removeWornProperty, setCarriedProperty } from './properties.js';
// C worn.c:mon_set_minvis(). The map refresh and worm-tail reveal that the
// native function performs when visibility flips stay with its callers.
export function setMonsterPermanentInvisibility(monster, permanent = true) {
    const oldPermanent = !!monster.perminvis;
    const oldInvisible = !!monster.minvis;
    monster.perminvis = permanent ? 1 : 0;
    if (!monster.invis_blkd)
        monster.minvis = monster.perminvis;
    return {
        oldPermanent,
        oldInvisible,
        permanent: !!monster.perminvis,
        invisible: !!monster.minvis,
        changed: oldInvisible !== !!monster.minvis,
    };
}
function wearsSpeedItem(monster) {
    return (monster?.minvent || monster?.inventory || []).some(object => OBJECT_PROPERTY[object.otyp] === 'fast' && (object.owornmask ?? 0) !== 0);
}
export function adjustMonsterSpeed(monster, amount) {
    const oldSpeed = monster.mspeed ?? 0;
    if (amount === 2) {
        monster.permspeed = MFAST;
    }
    else if (amount === 1) {
        monster.permspeed = monster.permspeed === MSLOW ? 0 : MFAST;
    }
    else if (amount === -1) {
        monster.permspeed = monster.permspeed === MFAST ? 0 : MSLOW;
    }
    else if (amount === -2) {
        monster.permspeed = MSLOW;
    }
    else if (amount === -3 || amount === -4) {
        if (monster.permspeed === MFAST)
            monster.permspeed = 0;
    }
    monster.mspeed = wearsSpeedItem(monster)
        ? MFAST : monster.permspeed ?? 0;
    return {
        amount,
        oldSpeed,
        speed: monster.mspeed,
        changed: monster.mspeed !== oldSpeed,
        much: monster.mspeed + oldSpeed === MFAST + MSLOW,
        canDescribe: naturalMonsterSpeed(monster) !== 0
            && !(monster.mfrozen ?? 0) && !monster.msleeping,
    };
}
export function monsterSpeedMessage(change, subject, state = game) {
    if (state.in_mklev || [2, -2, -4].includes(change.amount)
        || (!change.changed && change.amount !== -3) || !change.canDescribe)
        return null;
    if (change.amount === -3)
        return state.flags.verbose ? `${subject} is slowing down.` : null;
    const much = change.much ? 'much ' : '';
    if (change.amount > 0 || change.speed === MFAST)
        return `${subject} is suddenly moving ${much}faster.`;
    return `${subject} seems to be moving ${much}slower.`;
}
// worn.c counts all ordinary worn TELEPAT objects, plus one source for
// every carried ESP artifact together, regardless of their number.
// C worn.c:recalc_telepat_range().
export function recalculateTelepathyRange(state) {
    const worn = [state.uarm, state.uarmc, state.uarmh, state.uarms,
        state.uarmg, state.uarmf, state.uarmu, state.uamul, state.uleft,
        state.uright, state.ublindf, state.uwep, state.uswapwep, state.uquiver];
    const ordinary = worn.filter(object => object && object.owornmask
        && OBJECT_PROPERTY[object.otyp] === 'telepathy').length;
    const sources = ordinary + Number(hasCarriedProperty('telepathy', null, state));
    state.u.unblind_telepat_range = sources ? 64 * sources : -1;
}
// C worn.c:bypass_obj(), bypass_objlist(), nxt_unbypassed_obj/loot(),
// clear_bypasses(). Marks are shared by inventory traversal and magic.
const PM_LONG_WORM = MONSTER_NAME.indexOf('long worm');
export function bypassObject(object, state = game) {
    object.bypass = true;
    state.context.bypasses = true;
}
// C worn.c:bypass_objlist().
export function bypassObjectList(objects, on, state = game) {
    if (on && objects.length)
        state.context.bypasses = true;
    for (const object of objects)
        object.bypass = on;
}
// Pass the current chain each time: an action may remove or add objects.
// A sorted traversal also supplies its original order; stale entries are skipped.
// C worn.c:nxt_unbypassed_obj().
export function nextUnbypassedObject(objects, state = game, order = objects) {
    for (const object of order) {
        if (object.bypass || !objects.includes(object))
            continue;
        bypassObject(object, state);
        return object;
    }
    return null;
}
export function clearBypasses(state = game) {
    for (const column of state.level?.objects ?? [])
        for (const pile of column ?? [])
            clearChain(pile);
    clearChain(state.inventory);
    clearChain(state.migratingObjects);
    clearChain(state.level?.buriedObjects);
    clearChain(state.billObjects);
    for (const monster of state.level?.monsters ?? []) {
        if (monster.dead || monster.mhp <= 0)
            continue;
        clearChain(monster.minvent ?? monster.inventory);
        if (monster.mnum !== PM_LONG_WORM)
            continue;
        if (monster.mcorpsenm !== undefined)
            monster.mcorpsenm = NON_PM;
        if (monster.mextra?.mcorpsenm !== undefined)
            monster.mextra.mcorpsenm = NON_PM;
    }
    for (const monster of state._migratingMonsters ?? [])
        clearChain(monster.minvent ?? monster.inventory);
    // A swallowed hero's ball and chain can be outside every object chain.
    if (state.uball)
        state.uball.bypass = false;
    if (state.uchain)
        state.uchain.bypass = false;
    state.context.bypasses = false;
}
// C worn.c:clear_bypass().
function clearChain(objects) {
    for (const object of objects ?? []) {
        object.bypass = false;
        clearChain(object.contents);
    }
}
//# sourceMappingURL=worn.js.map