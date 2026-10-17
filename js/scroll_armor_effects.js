// Armor and weapon scroll effects. C read.c:seffect_enchant_armor(),
// seffect_destroy_armor(), and seffect_enchant_weapon().
import { adjustArmorAttributeBonus, armorSlotFor, destroyWornArmor, disintegrateWornArmor, erodeWornArmor, someHeroArmor, wearHeroArmor, wornArmorInDestroyOrder, } from './armor.js';
import { exerciseAttribute } from './attrib.js';
import { A_CON, A_STR, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, SPE_LIM } from './const.js';
import { displayColorName, plineWithContinuation as pline } from './display.js';
import { enchantWeapon } from './enchant_weapon.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { makeStunned } from './hero_mental_status.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { objectLightRadius } from './light.js';
import { makePlural } from './object_grammar.js';
import { BLACK_DRAGON_SCALE_MAIL, BLACK_DRAGON_SCALES, CORNUTHAUM, ELVEN_BOOTS, ELVEN_CLOAK, ELVEN_LEATHER_HELM, ELVEN_MITHRIL_COAT, ELVEN_SHIELD, GRAY_DRAGON_SCALE_MAIL, GRAY_DRAGON_SCALES, OBJECT_MAGIC, OBJECT_NAMES, SCR_DESTROY_ARMOR, SCR_ENCHANT_ARMOR, SCR_ENCHANT_WEAPON, SHIELD_OF_REFLECTION, SILVER_DRAGON_SCALE_MAIL, SILVER_DRAGON_SCALES, YELLOW_DRAGON_SCALES, requireObjectData, } from './object_data.js';
import { blessObjectState, curseObjectState, uncurseObjectState } from './object_state.js';
import { ownedObjectAction } from './objnam.js';
import { rn1, rn2, rnd } from './rng.js';
import { strangeFeeling } from './scroll_strange_feeling.js';
import { heroIsBlind } from './senses.js';
import { chargeAlteredUnpaidObject, updateUnpaidObjectPrice } from './shk.js';
import { objectWeight } from './weight.js';
// Initial reading prose, Wisdom exercise, normal disposal, and discovery
// remain with seffects()/doread(). Strange feelings consume their own source.
export async function applyArmorScrollEffect(source, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    let result;
    switch (source.otyp) {
        case SCR_ENCHANT_ARMOR:
            result = await enchantArmor(source, state);
            break;
        case SCR_DESTROY_ARMOR:
            result = await destroyArmor(source, state);
            break;
        case SCR_ENCHANT_WEAPON:
            result = { known: false, consumed: await enchantWeapon(source, state) };
            break;
        default:
            throw new RangeError(`Not an armor or weapon scroll: ${source.otyp}`);
    }
    // C read.c never calls find_ac(): moveloop_core() recomputes u.uac once
    // per player input, after the monsters have moved.
    state._armorClassDirty = true;
    return { known: false, consumed: false, ...result,
        heroDied: !!state.program_state?.gameover };
}
async function enchantArmor(source, state) {
    const armor = someHeroArmor(state);
    if (!armor) {
        const result = await strangeFeeling(source, heroIsBlind(state)
            ? 'Your skin feels warm for a moment.' : 'Your skin glows then fades.', { state });
        await exerciseAttribute(A_CON, !source.cursed, state);
        await exerciseAttribute(A_STR, !source.cursed, state);
        return result;
    }
    if (isConfused(state)) {
        await proofArmor(armor, source.cursed, state);
        return {};
    }
    const special = isSpecialArmor(armor, state);
    const safeLimit = special ? 5 : 3;
    const sameColor = !heroIsBlind(state) && (source.cursed
        ? [BLACK_DRAGON_SCALES, BLACK_DRAGON_SCALE_MAIL].includes(armor.otyp)
        : [SILVER_DRAGON_SCALES, SILVER_DRAGON_SCALE_MAIL, SHIELD_OF_REFLECTION]
            .includes(armor.otyp));
    let power = armor.spe * (source.cursed ? -1 : 1);
    if (power > safeLimit && rn2(power)) {
        armor.in_use = true;
        await pline(`${armorGlow(armor, source.cursed, sameColor, true, state)} for a while, `
            + `then ${armorVerb(armor, 'evaporate')}.`);
        await destroyWornArmor(armor, state);
        return {};
    }
    power = Math.trunc((4 - Math.max(power, -100)) / 2)
        + Number(special) + Number(!OBJECT_MAGIC[armor.otyp]) + Number(!!source.blessed);
    let amount = power <= 0
        ? (armor.spe > 0 && rn2(armor.spe) === 0 ? 1 : 0)
        : rnd(power);
    amount = Math.min(amount, 11) * (source.cursed ? -1 : 1);
    if (amount >= 0 && armor.otyp >= GRAY_DRAGON_SCALES
        && armor.otyp <= YELLOW_DRAGON_SCALES) {
        await hardenDragonScales(armor, source, state);
        return {};
    }
    await pline(`${armorGlow(armor, source.cursed, sameColor, !amount, state)} `
        + `for a ${amount * amount > 1 ? 'while' : 'moment'}.`);
    if (amount < 0)
        await chargeAlteredUnpaidObject(armor, 'disenchant', state);
    const oldLight = objectLightRadius(armor, state);
    if (source.cursed && !armor.cursed)
        curseObjectState(armor);
    else if (source.blessed && !armor.blessed)
        blessObjectState(armor);
    else if (!source.cursed && armor.cursed)
        uncurseObjectState(armor);
    await adjustArmorLight(armor, oldLight, state);
    let known = false;
    if (amount) {
        const old = armor.spe ?? 0;
        setEnchantment(armor, old + amount);
        amount = armor.spe - old;
        if (amount)
            adjustArmorAttributeBonus(armor, amount, state);
        known = !!armor.known;
        if (amount > 0 && armor.unpaid)
            updateUnpaidObjectPrice(armor, state);
    }
    if (armor.spe > safeLimit && (special || rn2(7) === 0)) {
        await pline(`${ownedObjectAction(armor, 'suddenly vibrate', state)} `
            + `${heroIsBlind(state) ? 'again' : 'unexpectedly'}.`);
    }
    return { known };
}
async function proofArmor(armor, cursed, state) {
    const oldProof = !!armor.oerodeproof;
    armor.oerodeproof = false;
    if (heroIsBlind(state)) {
        armor.rknown = false;
        await pline(`${ownedObjectAction(armor, 'feel', state)} warm for a moment.`);
    }
    else {
        armor.rknown = true;
        const color = displayColorName(cursed ? 'black' : 'golden', state);
        const protection = cursed ? 'glow' : armorSlotFor(armor.otyp) === 'uarms' ? 'layer' : 'shield';
        await pline(`${ownedObjectAction(armor, 'are', state)} covered by a `
            + `${cursed ? 'mottled' : 'shimmering'} ${color} ${protection}!`);
    }
    if (!cursed && (armor.oeroded || armor.oeroded2)) {
        armor.oeroded = armor.oeroded2 = 0;
        await pline(`${ownedObjectAction(armor, heroIsBlind(state) ? 'feel' : 'look', state)} as good as new!`);
    }
    await replaceProofing(armor, oldProof, !cursed, state);
}
async function hardenDragonScales(armor, source, state) {
    await pline(`${ownedObjectAction(armor, null, state)} merges and hardens!`);
    const wasLit = armor.lamplit;
    const oldLight = objectLightRadius(armor, state);
    armor.otyp += GRAY_DRAGON_SCALE_MAIL - GRAY_DRAGON_SCALES;
    armor.lamplit = false;
    if (source.blessed) {
        setEnchantment(armor, armor.spe + 1);
        if (!armor.blessed)
            blessObjectState(armor);
    }
    else if (armor.cursed)
        uncurseObjectState(armor);
    armor.known = true;
    const name = requireObjectData(OBJECT_NAMES, armor.otyp);
    if (name === null)
        throw new Error('Hardened dragon scales require a native armor name.');
    if (armor.name !== undefined)
        armor.name = name;
    if (armor.plural !== undefined)
        armor.plural = makePlural(name);
    armor.owt = objectWeight(armor);
    wearHeroArmor(armor, state);
    if (armor.unpaid)
        updateUnpaidObjectPrice(armor, state);
    if (wasLit === undefined)
        delete armor.lamplit;
    else
        armor.lamplit = wasLit;
    await adjustArmorLight(armor, oldLight, state);
}
async function destroyArmor(source, state) {
    let armor = someHeroArmor(state);
    if (isConfused(state)) {
        if (!armor)
            return itchyFeeling(source, 'Your bones itch.', state);
        const oldProof = !!armor.oerodeproof;
        armor.oerodeproof = false;
        const color = heroIsBlind(state) ? '' : ` ${displayColorName('purple', state)}`;
        await pline(`${ownedObjectAction(armor, heroIsBlind(state) ? 'vibrate' : 'glow', state)}${color} for a moment.`);
        await replaceProofing(armor, oldProof, !!source.cursed, state);
        return {};
    }
    if (source.cursed) {
        if (armor?.cursed) {
            await pline(`${ownedObjectAction(armor, 'vibrate', state)}.`);
            if (armor.spe >= -6) {
                setEnchantment(armor, armor.spe - 1);
                adjustArmorAttributeBonus(armor, -1, state);
            }
            await makeStunned((state.u.stunnedTurns ?? 0) + rn1(10, 10), { state });
            return {};
        }
        return { known: armor ? await disintegrateWornArmor(armor, { state }) : false };
    }
    const worn = wornArmorInDestroyOrder(state);
    if (armor && source.blessed && worn.length > 1) {
        if (!state._knownObjectTypes?.has(source.otyp))
            await pline('This is a scroll of destroy armor!');
        const selected = await chooseInventoryObject('destroy', object => worn.includes(object) ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE, { forcePrompt: true });
        if (selected && worn.includes(selected))
            armor = selected;
        await disintegrateWornArmor(armor, { state });
        return { known: true };
    }
    if (source.blessed) {
        const cursed = worn.filter(object => object.cursed);
        if (cursed.length) {
            const target = cursed[rn2(cursed.length)];
            if (!target)
                throw new RangeError('Destroy armor selected no cursed worn armor.');
            if (await disintegrateWornArmor(target, { state }))
                return { known: true };
        }
    }
    if (await erodeWornArmor(state))
        return { known: true };
    return itchyFeeling(source, 'Your skin itches.', state);
}
async function itchyFeeling(source, message, state) {
    const result = await strangeFeeling(source, message, { state });
    await exerciseAttribute(A_STR, false, state);
    await exerciseAttribute(A_CON, false, state);
    return result;
}
async function replaceProofing(armor, oldProof, newProof, state) {
    if (oldProof && !newProof) {
        armor.oerodeproof = true;
        await chargeAlteredUnpaidObject(armor, 'degrade', state);
    }
    armor.oerodeproof = newProof;
}
async function adjustArmorLight(armor, oldRadius, state) {
    if (!oldRadius)
        return;
    const delta = objectLightRadius(armor, state) - oldRadius;
    if (!delta)
        return;
    state.vision_full_recalc = 1;
    if (!heroIsBlind(state)) {
        await pline(`${ownedObjectAction(armor, 'shine', state)} `
            + `${Math.abs(delta) > 1 ? 'much ' : ''}${delta > 0 ? 'brighter' : 'less brightly'}.`);
    }
}
function armorGlow(armor, cursed, sameColor, violent, state) {
    const verb = heroIsBlind(state) ? 'vibrate' : 'glow';
    const color = heroIsBlind(state) || sameColor
        ? '' : ` ${displayColorName(cursed ? 'black' : 'silver', state)}`;
    return `${ownedObjectAction(armor, `${violent ? 'violently ' : ''}${verb}`, state)}${color}`;
}
function armorVerb(armor, verb) {
    return armor.quan > 1 ? verb : `${verb}s`;
}
function isSpecialArmor(armor, state) {
    return [ELVEN_LEATHER_HELM, ELVEN_MITHRIL_COAT, ELVEN_CLOAK,
        ELVEN_SHIELD, ELVEN_BOOTS].includes(armor.otyp)
        || armor.otyp === CORNUTHAUM && state.urole?.key === 'wizard';
}
function isConfused(state) {
    return !!state.u?.confused || (state.u?.confusionTurns ?? 0) > 0;
}
function setEnchantment(armor, amount) {
    armor.spe = Math.max(-SPE_LIM, Math.min(SPE_LIM, amount));
    armor.enchantment = armor.spe;
}
//# sourceMappingURL=scroll_armor_effects.js.map