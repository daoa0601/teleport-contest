// Charging scrolls and artifacts share these item effects.
// C read.c:charge_ok(), recharge(), stripspe(), wand_explode().
import { removeHeroAccessory, wearHeroAccessory } from './accessory.js';
import { findArmorClass } from './armor.js';
import { exerciseAttribute } from './attrib.js';
import { A_STR, SPE_LIM } from './const.js';
import { displayColorName, plineWithContinuation as pline } from './display.js';
import { game } from './gstate.js';
import { finishHeroDeath } from './end.js';
import { loseHeroHp } from './hero_damage.js';
import { consumeInventoryItem } from './invent.js';
import { compactInventoryLetters, promptInventoryObject, } from './inventory_prompt.js';
import { endObjectBurn } from './light.js';
import { BAG_OF_TRICKS, BELL_OF_OPENING, BRASS_LANTERN, CAN_OF_GREASE, CRYSTAL_BALL, DRUM_OF_EARTHQUAKE, EXPENSIVE_CAMERA, FIRE_HORN, FROST_HORN, HORN_OF_PLENTY, LOADSTONE, MAGIC_FLUTE, MAGIC_HARP, MAGIC_LAMP, MAGIC_MARKER, OBJECT_CHARGED, OBJECT_DIR, OBJECT_NAMES, OIL_LAMP, TINNING_KIT, WAN_CANCELLATION, WAN_COLD, WAN_DEATH, WAN_FIRE, WAN_LIGHTNING, WAN_MAGIC_MISSILE, WAN_POLYMORPH, WAN_UNDEAD_TURNING, WAN_WISHING, } from './object_data.js';
import { isWeaponTool } from './object_properties.js';
import { objectQuantity, splitObjectStack } from './object_stack.js';
import { blessObjectState, curseObject, uncurseObjectState, } from './object_state.js';
import { objectName, ownedObjectName } from './objnam.js';
import { observeObject } from './object_knowledge.js';
import { d, rn1, rn2, rnd } from './rng.js';
import { heroIsBlind } from './senses.js';
import { chargeAlteredUnpaidObject, objectTypeKnown, updateUnpaidObjectPrice, } from './shk.js';
import { isWeldedPrimary } from './weapon_slots.js';
const RING_CLASS = 4;
const TOOL_CLASS = 6;
const WAND_CLASS = 11;
const NODIR = 1;
const WAN_NOTHING = OBJECT_NAMES.indexOf('nothing');
function chargingChoice(object, state) {
    if (object.oclass === WAND_CLASS)
        return 'suggest';
    const discovered = object.dknown && objectTypeKnown(object, state);
    if (object.oclass === RING_CLASS && OBJECT_CHARGED[object.otyp]
        && discovered)
        return 'suggest';
    if (isWeaponTool(object))
        return 'exclude';
    if (object.oclass !== TOOL_CLASS)
        return 'selectable';
    if (object.otyp === OIL_LAMP || object.otyp === BRASS_LANTERN
        || object.otyp === MAGIC_LAMP && !objectTypeKnown(object, state))
        return 'suggest';
    if (OBJECT_CHARGED[object.otyp])
        return discovered ? 'suggest' : 'downplay';
    return 'exclude';
}
export async function chooseObjectToCharge(state = game) {
    const inventory = state.inventory;
    const suggested = inventory.filter(object => chargingChoice(object, state) === 'suggest');
    const letterOrder = '$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ#';
    const letters = compactInventoryLetters(suggested.map(object => object.invlet)
        .filter((letter) => letter != null)
        .sort((a, b) => letterOrder.indexOf(a) - letterOrder.indexOf(b)).join(''));
    const choices = letters ? `[${letters} or ?*]` : '[*]';
    const selection = await promptInventoryObject(`What do you want to charge? ${choices} `, inventory, {
        verb: 'charge',
        allowMenu: true,
        allowNone: true,
        allowCount: true,
        allowGold: true,
        menuItems: suggested.length ? suggested : inventory.filter(object => chargingChoice(object, state) === 'downplay'),
    });
    if (selection.none) {
        await pline('You mime charging something.');
        return null;
    }
    const { object, count } = selection;
    if (!object)
        return null;
    if (chargingChoice(object, state) === 'exclude') {
        await pline('That is a silly thing to charge.');
        return null;
    }
    if (count && count < objectQuantity(object)
        && !(object.otyp === LOADSTONE && object.cursed)
        && !isWeldedPrimary(object, state)) {
        const part = splitObjectStack(object, count, state);
        if (part)
            return part;
    }
    return object;
}
export async function rechargeObject(object, blessing, state = game) {
    if (object.oclass === WAND_CLASS) {
        await rechargeWand(object, blessing, state);
    }
    else if (object.oclass === RING_CLASS && OBJECT_CHARGED[object.otyp]) {
        return rechargeRing(object, blessing, state);
    }
    else if (object.oclass === TOOL_CLASS) {
        await rechargeTool(object, blessing, state);
    }
    else {
        await pline('You have a feeling of loss.');
    }
    if (state.program_state.gameover)
        return { heroDied: true };
    if (object.where !== 'gone' && object.where !== 'onbill')
        object.spe = Math.max(-SPE_LIM, Math.min(object.spe, SPE_LIM));
    return { heroDied: false };
}
async function rechargeWand(wand, blessing, state) {
    const limit = wand.otyp === WAN_WISHING ? 1
        : OBJECT_DIR[wand.otyp] === NODIR ? 15 : 8;
    if (wand.spe === -1)
        wand.spe = 0;
    const previous = wand.recharged;
    if (previous > 0 && (wand.otyp === WAN_WISHING || previous ** 3 > rn2(343))) {
        await explodeWand(wand, rnd(limit), state);
        return;
    }
    wand.recharged = previous + 1;
    if (blessing < 0) {
        await stripCharges(wand, state);
        return;
    }
    let charges = limit === 1 ? 1 : rn1(5, limit - 4);
    if (blessing === 0)
        charges = rnd(charges);
    wand.spe = wand.spe < charges ? charges : wand.spe + 1;
    if (wand.otyp === WAN_WISHING && wand.spe > 3) {
        await explodeWand(wand, 1, state);
    }
    else {
        await glow(wand, state, limit === 1 || wand.spe >= limit ? 'blue' : null, limit === 1);
    }
}
export async function rechargeRing(ring, blessing, state = game, { publish = pline, random = rn2, rollOne = rnd, die = finishHeroDeath, } = {}) {
    const adjustment = blessing > 0 ? rollOne(3) : blessing < 0 ? -rollOne(2) : 1;
    const slot = ['uleft', 'uright'].find(slot => state[slot] === ring || state.u[slot] === ring);
    if (ring.spe > random(7) || ring.spe <= -5) {
        if (!heroIsBlind(state))
            observeObject(ring, state);
        await publish(`${ownedObjectName(ring, state)} pulsates momentarily, then explodes!`);
        if (slot)
            await removeHeroAccessory(ring, state);
        if (state.program_state.gameover)
            return { damage: 0, heroDied: true };
        const damage = physicalDamage(rollOne(3 * Math.abs(ring.spe)), state);
        await consumeInventoryItem(ring, state);
        if (state.program_state.gameover)
            return { damage: 0, heroDied: true };
        findArmorClass(state);
        const heroDied = await loseHeroHp(damage, 'exploding ring', { state, publish, die });
        return { damage, heroDied };
    }
    const direction = adjustment < 0 ? 'counterclockwise' : 'clockwise';
    if (!heroIsBlind(state))
        observeObject(ring, state);
    await publish(`${ownedObjectName(ring, state)} spins ${direction} for a moment.`);
    if (adjustment < 0)
        await chargeAlteredUnpaidObject(ring, 'disenchant', state);
    if (slot)
        await removeHeroAccessory(ring, state);
    if (state.program_state.gameover)
        return { damage: 0, heroDied: true };
    ring.spe += adjustment;
    if (slot)
        await wearHeroAccessory(ring, slot, state);
    if (state.program_state.gameover)
        return { damage: 0, heroDied: true };
    findArmorClass(state);
    if (adjustment > 0 && ring.unpaid)
        updateUnpaidObjectPrice(ring, state);
    ring.spe = Math.max(-SPE_LIM, Math.min(ring.spe, SPE_LIM));
    return { damage: 0, heroDied: false };
}
async function rechargeTool(tool, blessing, state) {
    const previous = tool.recharged;
    if (OBJECT_CHARGED[tool.otyp] && previous < 7)
        tool.recharged++;
    switch (tool.otyp) {
        case BELL_OF_OPENING:
            if (blessing < 0)
                await stripCharges(tool, state);
            else
                tool.spe += blessing > 0 ? rnd(3) : 1;
            tool.spe = Math.min(tool.spe, 5);
            return;
        case MAGIC_MARKER:
        case TINNING_KIT:
        case EXPENSIVE_CAMERA:
            if (blessing < 0) {
                await stripCharges(tool, state);
            }
            else if (previous && tool.otyp === MAGIC_MARKER) {
                tool.recharged = 1;
                await pline(tool.spe < 3 ? 'Your marker seems permanently dried out.' : 'Nothing happens.');
            }
            else if (blessing > 0) {
                const charges = tool.spe + rn1(16, 15);
                tool.spe = charges <= 50 ? 50 : charges <= 75 ? 75 : Math.min(charges, 127);
                await glow(tool, state, 'blue');
            }
            else {
                tool.spe = Math.min(Math.max(tool.spe + rn1(11, 10), 50), SPE_LIM);
                await glow(tool, state, 'white');
            }
            return;
        case OIL_LAMP:
        case BRASS_LANTERN:
            if (blessing < 0) {
                await stripCharges(tool, state);
                if (tool.lamplit) {
                    if (!heroIsBlind(state))
                        await pline(`The ${objectName(tool, state)} goes out!`);
                    endObjectBurn(tool, state);
                }
            }
            else {
                tool.spe = 1;
                tool.age = blessing > 0 ? 1500 : Math.min(tool.age + 750, 1500);
                await glow(tool, state, blessing > 0 ? 'blue' : null);
            }
            return;
        case CRYSTAL_BALL:
            if (tool.spe === -1)
                tool.spe = 0;
            if (blessing < 0) {
                if (!tool.cursed) {
                    await glow(tool, state, 'black');
                    await curseObject(tool);
                }
                else {
                    await pline(`${ownedObjectName(tool, state)} vibrates briefly.`);
                }
                if (tool.spe > 0)
                    await chargeAlteredUnpaidObject(tool, 'uncharge', state);
                tool.spe = 0;
            }
            else if (blessing > 0) {
                tool.spe = 7;
                await glow(tool, state, tool.blessed ? 'blue' : 'light blue');
                if (!tool.blessed)
                    blessObjectState(tool);
            }
            else if (tool.spe < 7 || tool.cursed) {
                tool.spe = Math.min(tool.spe + rnd(2), 7);
                await glow(tool, state, tool.cursed ? 'amber' : null);
                if (tool.cursed)
                    uncurseObjectState(tool);
            }
            else {
                await pline('Nothing happens.');
            }
            return;
        case HORN_OF_PLENTY:
        case BAG_OF_TRICKS:
        case CAN_OF_GREASE:
            if (blessing < 0) {
                await stripCharges(tool, state);
            }
            else {
                const charges = blessing > 0 ? rn1(tool.spe <= 10 ? 10 : 5, 6) : rn1(5, 2);
                tool.spe = Math.min(tool.spe + charges, 50);
                await glow(tool, state, blessing > 0 ? 'blue' : null);
            }
            return;
        case MAGIC_FLUTE:
        case MAGIC_HARP:
        case FROST_HORN:
        case FIRE_HORN:
        case DRUM_OF_EARTHQUAKE:
            if (blessing < 0) {
                await stripCharges(tool, state);
            }
            else {
                tool.spe = Math.min(tool.spe + (blessing > 0 ? d(2, 4) : rnd(4)), 20);
                await glow(tool, state, blessing > 0 ? 'blue' : null);
            }
            return;
        default:
            await pline('You have a feeling of loss.');
    }
}
async function stripCharges(object, state) {
    if (object.blessed || object.spe <= 0) {
        await pline('Nothing happens.');
        return;
    }
    await pline(`${ownedObjectName(object, state)} vibrates briefly.`);
    await chargeAlteredUnpaidObject(object, 'uncharge', state);
    object.spe = 0;
    if (object.otyp === OIL_LAMP || object.otyp === BRASS_LANTERN)
        object.age = 0;
}
async function glow(object, state, color = null, feeble = false) {
    const blind = heroIsBlind(state);
    const verb = blind ? 'vibrates' : 'glows';
    const hue = !blind && color ? ` ${displayColorName(color, state)}` : '';
    const duration = color ? 'for a moment' : 'briefly';
    await pline(`${ownedObjectName(object, state)} ${verb}${feeble ? ' feebly' : ''}${hue} ${duration}.`);
}
export async function explodeWand(wand, extraCharges = 0, state = game) {
    let sides;
    switch (wand.otyp) {
        case WAN_WISHING:
            sides = 12;
            break;
        case WAN_CANCELLATION:
        case WAN_DEATH:
        case WAN_POLYMORPH:
        case WAN_UNDEAD_TURNING:
            sides = 10;
            break;
        case WAN_COLD:
        case WAN_FIRE:
        case WAN_LIGHTNING:
        case WAN_MAGIC_MISSILE:
            sides = 8;
            break;
        case WAN_NOTHING:
            sides = 4;
            break;
        default: sides = 6;
    }
    const damage = d(Math.max(2, wand.spe + (extraCharges || 2)), sides);
    wand.in_use = true;
    const motion = extraCharges ? 'vibrates violently and' : 'suddenly';
    await pline(`${ownedObjectName(wand, state)} ${motion} explodes!`);
    if (await loseHeroHp(physicalDamage(damage, state), 'exploding wand', { state }))
        return;
    await consumeInventoryItem(wand, state);
    await exerciseAttribute(A_STR, false, state);
}
function physicalDamage(amount, state) {
    return state.u.halfPhysicalDamage
        ? Math.trunc((amount + 1) / 2) : amount;
}
//# sourceMappingURL=recharge.js.map