// C invent.c:hold_another_object(). Admission uses the same inventory,
// artifact-touch, encumbrance, and floor owners as ordinary hero actions.
import { game, requireLiveGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { MessagePublisher } from './display.js';
import { artifactById } from './artifacts.js';
import { touchArtifactByHero } from './artifact_touch.js';
import { plineWithContinuation } from './display.js';
import { placeObject } from './floor_object.js';
import { freeInventoryObject } from './hero_inventory.js';
import { dropInventoryObjectAtHero } from './hero_drop.js';
import { dropObjectAtHero, hitFloorWithObject } from './object_drop.js';
import { heroCanReachFloor } from './floor_reach.js';
import { inventoryItemDescription } from './invent.js';
import { reassignInventoryLetters } from './inventory_prompt.js';
import { unlinkObject } from './object_location.js';
import { observeObject } from './object_knowledge.js';
import { observeObjectForNaming } from './objnam.js';
import { objectQuantity, splitObjectStack } from './object_stack.js';
import { isMissileObject } from './object_properties.js';
import { ammunitionMatchesLauncher } from './weapon_type.js';
import { setQuiverObject } from './weapon_slots.js';
import { propertyIsActive } from './properties.js';
import { heroIsBlind } from './senses.js';
import { heroIsPolymorphed } from './polyself.js';
import { heroResistsStoning, touchPetrifies } from './stoning.js';
import { addInventoryItem } from './u_init.js';
import { nearCapacity } from './weight.js';
import { pickupBurden } from './lift_object.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { CORPSE, CRYSKNIFE, GOLD_PIECE, LOADSTONE } from './object_data.js';

// The argument must be free. Messages are already formatted by the caller,
// as native callers preserve doname() before addinv() can merge the object.
export async function holdAnotherObject(object: GameObject, {
    state = game, dropMessage = null, holdMessage = null,
    publish = plineWithContinuation,
}: {
    state?: GameState;
    dropMessage?: string | null;
    holdMessage?: string | null;
    publish?: MessagePublisher;
} = {}): Promise<{ object: GameObject | null; heroDied: boolean }> {
    requireLiveGame(state);
    if (object.where !== 'free') throw new Error('holding requires a free object');
    if (!heroIsBlind(state)) observeObject(object, state);
    if (object.oartifact) {
        const crysknife = object.otyp === CRYSKNIFE;
        const proofing = object.oerodeproof;
        const wasPolymorphed = heroIsPolymorphed(state);
        await placeObject(object, state.u.ux, state.u.uy, state);
        const touch = await touchArtifactByHero(object, artifactById(object.oartifact, state), { state, publish });
        if (touch.died || state.program_state?.gameover)
            return { object, heroDied: true };
        if (!touch.allowed || wasPolymorphed && !heroIsPolymorphed(state)) {
            if (touch.allowed && dropMessage) await publish(dropMessage);
            unlinkObject(object, state);
            await dropObjectAtHero(object, { state, publish });
            return { object, heroDied: !!state.program_state?.gameover };
        }
        unlinkObject(object, state);
        if (crysknife) {
            object.otyp = CRYSKNIFE;
            if (proofing === undefined) delete object.oerodeproof;
            else object.oerodeproof = proofing;
        }
    }

    const unsafeWish = object.otyp === CORPSE && object.wishedfor
        && !(state.uarmg || state.u.uarmg)
        && touchPetrifies(object.corpsenm) && !heroResistsStoning(state);
    const forcedDrop = propertyIsActive('fumbling', state) || unsafeWish;
    if (propertyIsActive('fumbling', state)) object.nomerge = true;
    else if (unsafeWish) object.wishedfor = false;
    const count = objectQuantity(object);
    const limit = Math.max(nearCapacity(state), pickupBurden(state));
    object = await addInventoryItem(object, null, false);
    if (state.program_state?.gameover) return { object, heroDied: true };
    const slots = state.inventory.filter(item => item.otyp !== GOLD_PIECE && item.oclass !== 12).length;
    const tooHeavy = !(object.otyp === LOADSTONE && object.cursed)
        && nearCapacity(state) > limit;
    if (forcedDrop || slots > 52 || tooHeavy) {
        if (!forcedDrop && objectQuantity(object) > count) {
            const parent = object;
            const split = splitObjectStack(parent, count, state);
            if (!split) throw new Error(`Cannot split ${count} items from object ${parent.o_id}`);
            object = split;
        }
        if (dropMessage) await publish(dropMessage);
        object.nomerge = false;
        if (heroCanReachFloor(state, { checkPit: true }) || state.u.uswallow)
            await dropInventoryObjectAtHero(object, { state, publish });
        else {
            await freeInventoryObject(object, state);
            if (!state.program_state?.gameover)
                await hitFloorWithObject(object, { verbose: false, state, publish });
        }
        return { object: null, heroDied: !!state.program_state?.gameover };
    }
    if (state.flags.autoquiver && !(state.uquiver || state.u.uquiver) && !object.owornmask
        && (isMissileObject(object) || ammunitionMatchesLauncher(object, state.uwep)
            || ammunitionMatchesLauncher(object, state.uswapwep)))
        await setQuiverObject(object, state);
    if (holdMessage !== null || dropMessage !== null) {
        if (state.flags.fixinv === false) reassignInventoryLetters();
        await publish(await heldInventoryMessage(object, count, holdMessage, state));
    }
    await reportHeroEncumbrance(state);
    return { object, heroDied: !!state.program_state?.gameover };
}

// C prinv()/xprname(): name only the acquired quantity, while retaining
// the actual inventory identity for wielded, worn, and quivered descriptions.
async function heldInventoryMessage(
    object: GameObject, count: number, prefix: string | null, state: GameState,
): Promise<string> {
    const letter = object.invlet;
    if (!letter) throw new Error(`Held object ${object.o_id} has no inventory letter`);
    const total = objectQuantity(object);
    const merged = count > 0 && count < total;
    const savedQuantity = object.quantity;
    // C prinv() formats with doname(), whose xname() records what the hero
    // sees (a cleric learns beatitude) before the knowledge fields are read.
    observeObjectForNaming(object, { state });
    let description;
    object.quan = count || total;
    object.quantity = object.quan;
    try {
        description = await inventoryItemDescription(object);
    } finally {
        object.quan = total;
        if (savedQuantity === undefined) delete object.quantity;
        else object.quantity = savedQuantity;
    }
    const suffix = merged ? state.flags.verbose ? ` (${total} in total).` : '' : '.';
    return `${prefix ? `${prefix} ` : ''}${letter} - ${description}${suffix}`;
}
