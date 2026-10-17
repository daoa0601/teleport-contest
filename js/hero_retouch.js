// Check hero contact with an object, including equipment after a body or alignment change.
// C artifact.c:retouch_object(), untouchable(), retouch_equipment().
import { artifactInvokeIsActive, deactivateArtifactProperty, } from './artifact_invoke.js';
import { touchArtifactByHero } from './artifact_touch.js';
import { artifactBaneApplies, artifactById } from './artifacts.js';
import { exerciseAttribute } from './attrib.js';
import { A_CON, DISMOUNT_THROWN, IS_ALTAR, W_BALL, W_QUIVER, W_SWAPWEP } from './const.js';
import { plineWithContinuation } from './display.js';
import { finishHeroDeath } from './end.js';
import { removeEyewear } from './eyewear.js';
import { game } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { heroHatesSilver } from './hero_species.js';
import { heroIsOnStairs, isInvocationPosition } from './invocation_position.js';
import { BELL_OF_OPENING, LEASH } from './object_data.js';
import { objectMaterial } from './object_material.js';
import { uncurseObjectState } from './object_state.js';
import { rnd } from './rng.js';
import { selfTouchPetrifyingWeapons } from './stoning.js';
import { dismountHero, monsterSaddle } from './steed.js';
import { dropInventoryObjectAtHero } from './hero_drop.js';
import { freeInventoryObject } from './hero_inventory.js';
import { hitFloorWithObject } from './object_drop.js';
import { definiteName, killerObjectName, objectCombatName, objectNameIsPlural, ownedObjectName } from './objnam.js';
import { propertyIsActive } from './properties.js';
import { bypassObject, clearBypasses, nextUnbypassedObject } from './object_bypass.js';
import { surfaceName } from './terrain_name.js';
const TOOL_CLASS = 6;
const SILVER = 14;
// Losing a form while handling an item can enter this routine again.
// Nested passes share C's bypass marks until the outer pass finishes.
const activeChecks = new WeakSet();
export async function retouchEquipment(dropFlag = 0, { state = game, publish = plineWithContinuation, die = finishHeroDeath, } = {}) {
    const nested = activeChecks.has(state);
    if (!nested)
        clearBypasses(state);
    activeChecks.add(state);
    const context = { state, publish, die };
    const hadGloves = !!slotObject('uarmg', state);
    const oldRingCount = ringCount(state);
    try {
        if (state.u.twoweap) {
            const secondary = slotObject('uswapwep', state);
            if (secondary)
                bypassObject(secondary, state);
            const result = await checkItem(secondary, dropFlag > 0, context);
            if (result.died)
                return result;
        }
        const primary = slotObject('uwep', state);
        if (primary)
            bypassObject(primary, state);
        const weapon = await checkItem(primary, dropFlag > 0, context);
        if (weapon.died)
            return weapon;
        const saddle = await checkItem(monsterSaddle(state.u.usteed), false, context);
        if (saddle.died)
            return saddle;
        if (saddle.rejected) {
            await dismountHero(DISMOUNT_THROWN, { state, announce: publish });
            if (state.program_state?.gameover)
                return { died: true };
        }
        let object;
        while ((object = nextUnbypassedObject(state.inventory, state))) {
            const result = await checkItem(object, dropFlag === 1, context);
            if (result.died)
                return result;
        }
        const gloves = slotObject('uarmg', state);
        if (ringCount(state) !== oldRingCount && gloves?.cursed)
            uncurseObjectState(gloves);
        if (hadGloves && !gloves) {
            return await selfTouchPetrifyingWeapons({
                state, publish, die,
                messageStart: 'After losing your gloves, you',
            });
        }
        return { died: false };
    }
    finally {
        if (!nested) {
            activeChecks.delete(state);
            clearBypasses(state);
        }
    }
}
function slotObject(slot, state) {
    return state[slot] || state.u?.[slot] || null;
}
function ringCount(state) {
    return Number(!!slotObject('uleft', state))
        + Number(!!slotObject('uright', state));
}
function inUse(object, artifact, state) {
    const excluded = W_QUIVER | W_BALL | (state.u.twoweap ? 0 : W_SWAPWEP);
    const worn = ((object.owornmask ?? 0) & ~excluded) !== 0;
    const activeTool = object.oclass === TOOL_CLASS
        && (object.lamplit || object.otyp === LEASH && object.leashmon
            || (object.contents?.length ?? 0) > 0);
    return worn || !!activeTool || !!artifact?.carriedDefense
        || (artifact?.carriedFlags.length ?? 0) > 0
        || artifactInvokeIsActive(artifact, state);
}
async function checkItem(object, dropRejected, context) {
    const { state, publish, die } = context;
    if (!object)
        return { died: false, rejected: false };
    const artifact = artifactById(object.oartifact, state);
    if (!inUse(object, artifact, state))
        return { died: false, rejected: false };
    const invoked = artifactInvokeIsActive(artifact, state);
    const result = await retouchHeroObject(object, { dropRejected, state, publish, die });
    if (result.rejected && !result.died && invoked && state.inventory.includes(object)) {
        await deactivateArtifactProperty(object, artifact, { state, publish });
        if (state.program_state.gameover)
            return { died: true, rejected: true };
    }
    return result;
}
// Explicit handling (apply, wield, invoke) also checks carried items which
// are not currently equipped. retouch_equipment() keeps its in-use filter.
export async function retouchHeroObject(object, { dropRejected = false, state = game, publish = plineWithContinuation, die = finishHeroDeath, } = {}) {
    if (object.otyp === BELL_OF_OPENING
        && isInvocationPosition(state.u.ux, state.u.uy, state)
        && !heroIsOnStairs(state))
        return { died: false, rejected: false };
    const artifact = artifactById(object.oartifact, state);
    const touch = await touchArtifactByHero(object, artifact, {
        state, publish, die,
    });
    if (touch.died)
        return { died: true, rejected: true };
    // The blast can end a monster form, changing both of these weaknesses.
    const silver = objectMaterial(object, state) === SILVER
        && heroHatesSilver(state);
    const bane = artifactBaneApplies(artifact, state);
    if (touch.allowed && !silver && !bane)
        return { died: false, rejected: false };
    if (touch.allowed) {
        const anymore = object.owornmask ? ' anymore' : '';
        await publish(`You can't handle ${ownedObjectName(object, state, { capitalized: false })}${anymore}!`);
        if (!touch.blasted) {
            let damage = silver ? rnd(10) : 0;
            if (state.u.halfPhysicalDamage)
                damage = Math.trunc((damage + 1) / 2);
            if (bane)
                damage += rnd(10);
            const cause = silver && !artifact && !bane && [4, 11].includes(object.oclass)
                ? object.oclass === 4 ? 'a silver ring' : 'a silver wand'
                : killerObjectName(object, state);
            const died = await loseHeroHp(damage, `handling ${cause}`, { state, publish, die });
            if (died)
                return { died: true, rejected: true };
            await exerciseAttribute(A_CON, false, state);
        }
    }
    if (object.owornmask) {
        if (slotObject('ublindf', state) === object)
            await removeEyewear(object, { state, publish });
        else
            await removeWornHeroItem(object, state);
    }
    if (state.program_state?.gameover)
        return { died: true, rejected: true };
    if (!state.inventory?.includes(object))
        return { died: false, rejected: true };
    if (dropRejected) {
        if (propertyIsActive('levitation', state)) {
            await freeInventoryObject(object, state);
            if (!state.program_state.gameover)
                await hitFloorWithObject(object, { state, publish, verbose: true });
        }
        else {
            const spot = state.level?.at(state.u.ux, state.u.uy);
            if (spot && !IS_ALTAR(spot.typ)) {
                const name = definiteName(objectCombatName(object, { state }), state);
                const verb = objectNameIsPlural(object, state) ? 'fall' : 'falls';
                await publish(`${name.charAt(0).toUpperCase()}${name.slice(1)} ${verb} to the ${surfaceName(state.u.ux, state.u.uy, state)}.`);
            }
            await dropInventoryObjectAtHero(object, { state, publish });
        }
    }
    return { died: !!state.program_state.gameover, rejected: true };
}
//# sourceMappingURL=hero_retouch.js.map