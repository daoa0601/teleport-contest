// do_wear.js — Wearing and removing armor and accessories.
// C refs: do_wear.c dowear(), doputon(), accessory_or_armor_on(),
// armor_or_accessory_off(), dotakeoff()/doremring()/ia_dotakeoff(), and the
// Armor_off()/off_msg() completion shared with allmain.c.
import { game } from './gstate.js';
import { pline, plineWithContinuation } from './pline.js';
import { commandResultCancelled, nomul } from './command_state.js';
import { finishHeroHelplessness } from './allmain.js';
import { monsterIsHumanoid } from './monster_data.js';
import { GRAY_DRAGON_SCALES, HELM_OF_OPPOSITE_ALIGNMENT, LENSES, MEAT_RING, OBJECT_BIMANUAL, OBJECT_DELAY, } from './object_data.js';
import { GETOBJ_SUGGEST, PARANOID_REMOVE, W_ACCESSORY, W_ARMOR } from './const.js';
import { heroFingerName, heroHandName } from './body_parts.js';
import { recordRandom } from './monster_action_types.js';
import { heroHasNoHead, heroSpecies } from './hero_species.js';
import { heroHasNoHands, heroHasNoLimbs, heroIsVerySmall, } from './polyself.js';
import { makePlural } from './object_grammar.js';
import { armorOffMessage, armorSimpleName, removeHeroArmor, wearHeroArmor, } from './armor.js';
import { armorWearDecision } from './armor_wear.js';
import { removeHeroAccessory, wearHeroAccessory } from './accessory.js';
import { isEyewear, removeEyewear, wearEyewear } from './eyewear.js';
import { retouchHeroObject } from './hero_retouch.js';
import { learnObjectType } from './object_knowledge.js';
import { observeObjectForNaming } from './objnam.js';
import { inventoryItemDescription } from './invent.js';
import { chooseInventoryObject, compactInventoryLetters } from './inventory_prompt.js';
import { accessibleEquipment, equipmentClassification, wearingFullEquipment, } from './equipment_selection.js';
import { canSelectOff } from './bulk_takeoff.js';
import { resetBulkTakeoff, TAKEOFF_ORDER, takeoffSlotObject } from './takeoff_state.js';
import { isWeldedPrimary, releaseWeaponSlots } from './weapon_slots.js';
import { objectWearMessage } from './object_wear_message.js';
import { yn_function } from './query.js';
export async function doputon() {
    if (wearingFullEquipment()) {
        const prefix = monsterIsHumanoid(heroSpecies(game)) ? 'ring-' : '';
        await pline(`Your ${prefix}${makePlural(heroFingerName(game))} are full, and you're already wearing an amulet and ${game.ublindf?.otyp === LENSES ? 'some lenses' : 'a blindfold'}.`);
        game.context.move = 0;
        return;
    }
    const object = await chooseInventoryObject('put on', candidate => equipmentClassification(candidate, 'put on'));
    if (!object) {
        // do_wear.c:doputon() returns ECMD_CANCEL when getobj() is
        // declined; the rhack seam clears the queues after the command.
        commandResultCancelled();
        return;
    }
    if (object.oclass === 3) {
        await putOnArmorObject(object);
        return;
    }
    await putOnAccessoryObject(object);
}
// do_wear.c:accessory_or_armor_on() is shared by both W and P.  getobj()
// downplays the other command's class in its compact prompt but still accepts
// a directly typed inventory letter and routes it through this same owner.
async function putOnAccessoryObject(object) {
    if (object.worn) {
        await pline('You are already wearing that!');
        game.context.move = 0;
        return;
    }
    if (isEyewear(object)) {
        if (!heroHasNoHead(game) && !game.ublindf && !game.u.ublindf) {
            const touch = await retouchHeroObject(object);
            if (touch.rejected || touch.died) {
                game.context.move = 1;
                return;
            }
        }
        const worn = await wearEyewear(object);
        game.context.move = worn ? 1 : 0;
        return;
    }
    if (object.oclass === 5 || object.class === 'Amulets') {
        if (game.uamul) {
            await pline('You are already wearing an amulet.');
            game.context.move = 0;
            return;
        }
        const touch = await retouchHeroObject(object);
        if (touch.rejected || touch.died) {
            game.context.move = 1;
            return;
        }
        await wearHeroAccessory(object, 'uamul', game);
        game.context.move = 1;
        return;
    }
    if ((object.oclass === 4 || object.class === 'Rings' || object.otyp === MEAT_RING)
        && heroHasNoLimbs(game)) {
        await pline('You cannot make the ring stick to your body.');
        game.context.move = 0;
        return;
    }
    if (game.uleft && game.uright) {
        const prefix = monsterIsHumanoid(heroSpecies(game)) ? 'ring-' : '';
        await pline(`There are no more ${prefix}${makePlural(heroFingerName(game))} to fill.`);
        game.context.move = 0;
        return;
    }
    let hand;
    if (!game.uleft && !game.uright) {
        // C calls yn_function(qbuf, rightleftchars, '\0', TRUE): a queued
        // answer replays without prompting and any key outside "rl" is
        // replaced by the NUL default; a live question keeps asking until
        // 'r', 'l', or a quit key answers it, and only that final answer
        // is recorded into CQ_REPEAT for the next do-again.
        const { answer } = await yn_function(`Which ${monsterIsHumanoid(heroSpecies(game)) ? 'ring-' : ''}${heroFingerName(game)}, Right or Left?`, 'rl', '', true, { menuable: true });
        if (answer !== 'r' && answer !== 'l') {
            game.context.move = 0;
            return;
        }
        hand = answer === 'r' ? 'right' : 'left';
    }
    else {
        hand = game.uright ? 'left' : 'right';
    }
    const ringSlot = hand === 'right' ? 'uright' : 'uleft';
    const gloves = game.uarmg;
    if (gloves && (game.u.glib || (game.u.glibTurns ?? 0) > 0)) {
        await pline(`Your ${armorSimpleName(gloves)} are too slippery to remove, so you cannot put on the ring.`);
        game.context.move = 1;
        return;
    }
    if (gloves?.cursed) {
        const discovered = !gloves.bknown;
        gloves.bknown = true;
        await pline('You cannot remove your gloves to put on the ring.');
        game.context.move = discovered ? 1 : 0;
        return;
    }
    const weapon = game.uwep;
    const primary = game.u.rightHanded === false ? 'uleft' : 'uright';
    const discoveredWeld = !!weapon && !weapon.bknown;
    if (weapon && (ringSlot === primary || OBJECT_BIMANUAL[weapon.otyp])
        && isWeldedPrimary(weapon)) {
        const handName = OBJECT_BIMANUAL[weapon.otyp] ? makePlural(heroHandName(game)) : heroHandName(game);
        await pline(`You cannot free your weapon ${handName} to put on the ring.`);
        game.context.move = discoveredWeld ? 1 : 0;
        return;
    }
    const touch = await retouchHeroObject(object);
    if (touch.rejected || touch.died) {
        game.context.move = 1;
        return;
    }
    await wearHeroAccessory(object, ringSlot, game);
    // Sink effects can remove the ring inside Ring_on().
    if (game.uleft === object || game.uright === object) {
        observeObjectForNaming(object);
        await plineWithContinuation(`${object.invlet} - ${await inventoryItemDescription(object)}.`);
    }
    game.context.move = 1;
}
// C ref: objnam.c armor_simple_name() and category helpers.  Delayed armor
// nomovemsg deliberately uses a short category noun, not xname()/doname().
// C ref: do_wear.c Armor_off()/off_msg().  Delayed removal calls this from
// allmain only after negative multi has reached zero; zero-delay armor can use
// the same state owner immediately.
export async function finishArmorRemoval(object, { silent = false } = {}) {
    await removeHeroArmor(object, game, { deferArmorClass: true });
    if (silent || game.flags?.verbose === false)
        return '';
    return await armorOffMessage(object, game);
}
// C do_wear.c:dotakeoff()/doremring() share armor_or_accessory_off().
// T suggests armor and R suggests accessories; either accepts the other kind.
export async function removeWornItem(action, itemAction = false) {
    const worn = (game.inventory || []).filter(object => object.worn);
    if (!worn.length) {
        await pline(action === 'take off' && game.uskin
            ? `The dragon ${game.uskin.otyp >= GRAY_DRAGON_SCALES ? 'scales are' : 'scale mail is'} merged with your skin!`
            : action === 'remove' ? 'Not wearing any accessories or armor.'
                : 'Not wearing any armor or accessories.');
        game.context.move = 0;
        return;
    }
    let object;
    let inventoryPrompt = null;
    const preferred = accessibleEquipment(action === 'remove');
    // C ia_dotakeoff() forces getobj() to consume the queued item letter,
    // even if another accessible piece is the only normal suggestion.
    if (preferred.length === 1 && !itemAction && !((game.flags.paranoia_bits ?? 0) & PARANOID_REMOVE)) {
        [object] = preferred;
    }
    else {
        const suggested = game.inventory.filter(candidate => equipmentClassification(candidate, action, itemAction) === GETOBJ_SUGGEST);
        const letters = compactInventoryLetters(suggested.map(candidate => candidate.invlet).join(''));
        inventoryPrompt = `What do you want to ${action}? [${letters ? `${letters} or ?*` : '*'}] `;
        object = await chooseInventoryObject(action, candidate => equipmentClassification(candidate, action, itemAction));
    }
    if (!object) {
        // do_wear.c:dotakeoff()/doremring() return ECMD_CANCEL when
        // getobj() is declined; the rhack seam clears the queues.
        commandResultCancelled();
        return;
    }
    if (!((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY))) {
        await pline('You are not wearing that.');
        game.context.move = 0;
        return;
    }
    const cloak = game.uarmc;
    const suit = game.uarm;
    if (object === game.uskin || object === suit && cloak
        || object === game.uarmu && (cloak || suit)) {
        const coverings = [cloak, object === game.uarmu ? suit : null]
            .filter(covering => covering != null).map(covering => armorSimpleName(covering));
        await pline(object === game.uskin ? "You can't take that off; it's embedded."
            : `You can't take that off without taking off your ${coverings.join(' and ')} first.`);
        game.context.move = 0;
        return;
    }
    resetBulkTakeoff();
    const slot = TAKEOFF_ORDER.find(candidate => takeoffSlotObject(candidate) === object);
    if (!slot || !await canSelectOff(object, slot)) {
        game.context.move = 0;
        return;
    }
    resetBulkTakeoff();
    if (object === game.ublindf) {
        game._pending_message = '';
        const removed = await removeEyewear(object);
        if (game.program_state.gameover)
            return;
        game.context.move = removed ? 1 : 0;
        return;
    }
    if (object === game.uamul || object === game.uleft
        || object === game.uright) {
        // C armor_or_accessory_off(): a ring's off_msg() runs while it is
        // still worn, so the report keeps the "(on {right|left} hand)"
        // suffix and precedes Ring_off()'s side effects such as a
        // levitation landing or the death it causes; Amulet_off() clears
        // the slot first and reports afterwards, without a suffix.
        const ring = object === game.uleft || object === game.uright;
        if (ring && game.flags?.verbose !== false) {
            await plineWithContinuation(await armorOffMessage(object, game));
        }
        await removeHeroAccessory(object, game);
        game.context.move = 1;
        return;
    }
    const delay = OBJECT_DELAY[object.otyp] ?? 0;
    const isArmor = object.class === 'Armor' || object.oclass === 3;
    if (isArmor && delay > 0) {
        nomul(-delay);
        game._helplessReason = 'disrobing';
        game._helplessDoneMessage = `You finish taking off your ${armorSimpleName(object)}.`;
        game._afterMove = {
            kind: 'remove',
            object,
        };
        game.context.move = 1;
        return;
    }
    // do_wear.c:off_msg() is conditional on flags.verbose.  When disabled,
    // immediate zero-delay armor removal leaves getobj's selector as the
    // physical topline even though the timed state change has committed.
    game._pending_message = '';
    if (game.flags?.verbose === false && inventoryPrompt)
        game._retained_message = inventoryPrompt.trimEnd();
    const removalMessage = await finishArmorRemoval(object);
    if (removalMessage)
        await plineWithContinuation(removalMessage);
    game.context.move = 1;
}
async function putOnArmorObject(object) {
    if (object.worn) {
        await pline('You are already wearing that!');
        game.context.move = 0;
        return;
    }
    const decision = armorWearDecision(object);
    if (decision.checkedWeldedWeapon)
        decision.checkedWeldedWeapon.bknown = true;
    if (decision.refusal) {
        await pline(decision.refusal);
        game.context.move = 0;
        return;
    }
    if (object.otyp === HELM_OF_OPPOSITE_ALIGNMENT && game.u.uz?.dnum === game.quest_dnum) {
        await pline(game.u.ualignbase?.[0] === game.u.ualignbase?.[1]
            ? 'You narrowly avoid losing all chance at your goal.'
            : 'You are suddenly overcome with shame and change your mind.');
        game.u.ublessed = 0;
        learnObjectType(object.otyp, game);
        game.context.botl = true;
        game.context.move = 1;
        return;
    }
    const touch = await retouchHeroObject(object);
    if (touch.rejected || touch.died) {
        game.context.move = 1;
        return;
    }
    // C accessory_or_armor_on(): armor leaves any held slot before setworn.
    // Cursed armor does not weld to the hand.
    await releaseWeaponSlots(object, game);
    wearHeroArmor(object, game);
    // C do_wear.c installs the slot with setworn() now, but allmain.c does
    // not run find_ac() until the command's monster/global time has passed.
    // Mark that once-per-input boundary; identification and Armor_on()
    // extrinsics remain later afternmv effects.
    const delay = OBJECT_DELAY[object.otyp] ?? 0;
    game._armorClassDirty = true;
    game._afterMove = { kind: 'wear', object };
    if (delay > 0) {
        nomul(-delay);
        game._helplessReason = 'dressing up';
        game._helplessDoneMessage = 'You finish your dressing maneuver.';
    }
    else {
        await finishHeroHelplessness('');
        object._armorApplied = true;
        const onMessage = await objectWearMessage(object);
        if (onMessage)
            await plineWithContinuation(onMessage);
    }
    // C accessory_or_armor_on() discards interrupted 'A' after armor wear.
    resetBulkTakeoff();
    game.context.move = 1;
}
// C refs: do_wear.c dowear(), accessory_or_armor_on(), and the negative
// `multi`/afternmv completion in allmain.c.  Armor is installed in its worn
// slot immediately, but its known state and completion message are delayed
// until the required elapsed-turn scheduler round has finished.
function classifyWearChoice(object, action) {
    const classification = equipmentClassification(object, action);
    // Native canwearobj() checks welded() even during getobj's silent fit
    // check. Keep that knowledge change at the command boundary.
    if (action === 'wear' && object.oclass === 3) {
        const decision = armorWearDecision(object);
        if (decision.checkedWeldedWeapon)
            decision.checkedWeldedWeapon.bknown = true;
    }
    return classification;
}
export async function dowear() {
    // do_wear.c:dowear() owns this form-capability check before getobj().
    // W therefore rejects the whole transaction without exposing either
    // armor or cross-accepted accessory inventory letters.
    if (heroIsVerySmall(game) || heroHasNoHands(game)) {
        await pline("Don't even bother.");
        game.context.move = 0;
        return;
    }
    // wear_ok() downplays accessories but accepts them through the same
    // getobj transaction, including a queued inventory action.
    if (wearingFullEquipment()) {
        await pline('You are already wearing a full complement of armor.');
        game.context.move = 0;
        return;
    }
    const object = await chooseInventoryObject('wear', candidate => classifyWearChoice(candidate, 'wear'));
    if (!object) {
        // do_wear.c:dowear() returns ECMD_CANCEL when getobj() is
        // declined; the rhack seam clears the queues after the command.
        commandResultCancelled();
        return;
    }
    if (object.oclass === 3)
        await putOnArmorObject(object);
    else
        await putOnAccessoryObject(object);
}
// C do_wear.c:some_armor(). Torso priority is deterministic; each later
// occupied slot gets an independent one-in-four replacement opportunity.
// mhitu.c's disenchantment attack and steal.c's gold-less theft both pick
// their target through this pass.
export function selectHeroDisenchantmentTarget(state, random, calls) {
    let object = state?.uarmc || state?.uarm || state?.uarmu || null;
    for (const candidate of [state?.uarmh, state?.uarmg, state?.uarmf, state?.uarms]) {
        if (candidate && (!object || recordRandom(random, calls, 4) === 0)) {
            object = candidate;
        }
    }
    if (object)
        return object;
    const fallback = recordRandom(random, calls, 5);
    return ([
        null,
        state?.uright || state?.u?.uright,
        state?.uleft || state?.u?.uleft,
        state?.uamul || state?.u?.uamul,
        state?.ublindf || state?.u?.ublindf,
    ][fallback] || null);
}
//# sourceMappingURL=do_wear.js.map