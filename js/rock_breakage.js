// Shared statue/boulder fracture owner.
// C refs: zap.c fracture_rock() and break_statue(), trap.c sokoban_guilt().
import { CORPSTAT_HISTORIC } from './const.js';
import { shopkeeperName } from './monster_name.js';
import { newsym, pline } from './display.js';
import { game } from './gstate.js';
import { placeObject, placeObjectSynchronously, remove_object } from './floor_object.js';
import { adjustHeroAlignment } from './alignment.js';
import { costlySpot } from './shk.js';
import { shopClaimsObject } from './shop_loss.js';
import { breakObjectAtLocation } from './object_breakage.js';
import { getObjectLocation } from './object_location.js';
import { objectName } from './objnam.js';
import { BOULDER, OBJECT_USES_KNOWN, ROCK, STATUE } from './object_data.js';
import { rn2 } from './rng.js';
import { activateStatueTrapAt } from './statue_trap.js';
import { cansee, visionCellBlocksLight, vision_note_blocker_change, vision_recalc } from './vision.js';
import { objectWeight } from './weight.js';
const GEM_CLASS = 13;
// C trap.c:sokoban_guilt().  force_bolt.js previously kept this logic beside
// its own boulder conversion; the shared fracture owner now owns it.
export function sokobanGuilt(state) {
    if (!state.level?.flags?.sokoban_rules)
        return;
    if (!state.u.uconduct)
        state.u.uconduct = {};
    state.u.uconduct.sokocheat = (state.u.uconduct.sokocheat ?? 0) + 1;
    state.u.uluck = (state.u.uluck ?? 0) - 1;
}
async function dropStatueContents(statue, x, y, state) {
    for (const object of statue.contents || []) {
        object.where = 'free';
        // Statues can embed arbitrary saved inventory, including nested
        // containers; fracture is usually hero-caused, so placement is
        // awaited.
        await placeObject(object, x, y, state);
    }
    statue.contents = [];
}
export async function fractureRock(object, x, y, { state = game, random = rn2, publish = pline } = {}) {
    // C zap.c:fracture_rock() — "no texts here!" beyond the shop-billing
    // message.  Callers own any "shatters"/"falls apart" prose.
    const byYou = !state.context?.mon_moving;
    const location = getObjectLocation(object, state);
    if (byYou && location) {
        const spot = costlySpot(location.x, location.y, state);
        if (spot && shopClaimsObject(object, spot.resident, false, state)) {
            await publish(`You fracture ${shopkeeperName(spot.resident)}'s ${objectName(object, state)}.`);
            await breakObjectAtLocation(object, {
                x: location.x, y: location.y, state, publish,
                heroCaused: true, showBreakMessage: false,
            });
        }
    }
    if (byYou && object.otyp === BOULDER)
        sokobanGuilt(state);
    object.otyp = ROCK;
    object.oclass = GEM_CLASS;
    object.quan = object.quantity = 7 + random(60);
    object.dknown = object.bknown = object.rknown = false;
    object.known = !OBJECT_USES_KNOWN[ROCK];
    delete object.oextra;
    delete object.oname;
    delete object.name;
    delete object.plural;
    delete object.corpsenm;
    object.owt = objectWeight(object);
    if (object.where === 'floor') {
        // obj_extract_self() + place_object() move the rock stack back on
        // top of the pile, then the open square gets an immediate unblock.
        // A rock stack has no nested contents, so the synchronous placement
        // preserves the raw C extract+place shape (no movobj unhide pass).
        remove_object(object, state);
        placeObjectSynchronously(object, x, y, state);
        const level = state.level;
        if (!level)
            throw new Error('Floor fracture requires a level.');
        if (!visionCellBlocksLight(level, x, y)) {
            vision_note_blocker_change(x, y);
            vision_recalc(0);
        }
        if (cansee(x, y))
            newsym(x, y);
    }
}
export async function breakStatue(statue, x, y, { state = game, random = rn2, publish = pline } = {}) {
    const byYou = !state.context?.mon_moving;
    // A statue trap animates the statue instead of letting it break.
    const monster = await activateStatueTrapAt(x, y, { state, shatter: true });
    if (monster)
        return false;
    await dropStatueContents(statue, x, y, state);
    if (byYou && state.urole?.key === 'archeologist' && (statue.spe ?? 0) & CORPSTAT_HISTORIC) {
        await publish('You feel guilty about damaging such a historic statue.');
        adjustHeroAlignment(-1, state);
    }
    statue.spe = 0;
    await fractureRock(statue, x, y, { state, random, publish });
    return true;
}
//# sourceMappingURL=rock_breakage.js.map