import { exerciseAttribute } from './attrib.js';
import { A_WIS, EXPL_FIERY, PLNMSG_OBJ_GLOWS } from './const.js';
import { displayColorName, plineWithContinuation as pline } from './display.js';
import { fingersOrGloves } from './dip_water.js';
import { explode } from './explosion.js';
import { fireDamageObject } from './fire_damage.js';
import { game, requirePlayingGame } from './gstate.js';
import { recordGameLogEvent } from './gamelog.js';
import { consumeInventoryItem, inventoryItemDescription } from './invent.js';
import { MONSTER_NAME } from './monster_data.js';
import { tryCallObjectType } from './object_call.js';
import { erodeObject, objectIsVulnerableToErosion } from './object_erosion.js';
import { learnObjectType } from './object_knowledge.js';
import { obj_unpolyable, poly_obj } from './object_polymorph.js';
import { isLauncherAmmunition, isPermanentlyPoisonedObject, isPoisonableObject, isWeaponTool } from './object_properties.js';
import { objectQuantity } from './object_stack.js';
import { blessObjectState, curseObject, unblessObjectState, uncurseObjectState } from './object_state.js';
import { CORPSE, MAGIC_LAMP, OIL_LAMP, POT_ACID, POT_EXTRA_HEALING, POT_FULL_HEALING, POT_HEALING, POT_OIL, POT_POLYMORPH, POT_SICKNESS, POT_WATER, TOWEL } from './object_data.js';
import { verbForSubject, withIndefiniteArticle } from './object_grammar.js';
import { objectCombatName, objectNameIsPlural, ownedObjectAction, ownedObjectName } from './objnam.js';
import { setPropertyTimeout } from './properties.js';
import { d } from './rng.js';
import { blindfolded, heroIsBlind, heroIsBlinded, heroIsHallucinating } from './senses.js';
import { chargeAlteredUnpaidObject, chargeUnpaidUsage, updateUnpaidObjectPrice } from './shk.js';
import { waterDamageObject } from './trap.js';
import { dropCursedSecondaryWeapon } from './two_weapon.js';
import { mixPotions, neutralizePotion } from './potion_mixing.js';
export async function treatDippedObject(object, potion) {
    requirePlayingGame(game);
    if (object === potion && objectQuantity(potion) === 1) {
        await pline('That is a potion bottle, not a Klein bottle!');
        return false;
    }
    object.pickup_prev = false;
    potion.in_use = true;
    if (potion.otyp === POT_WATER) {
        if (await dipInWater(object, potion)) {
            await poof(potion);
            return true;
        }
    }
    else if (object.otyp === POT_POLYMORPH || potion.otyp === POT_POLYMORPH) {
        await dipInPolymorph(object, potion);
        return true;
    }
    else if (object.oclass === 8 && object.otyp !== potion.otyp) {
        await mixPotions(object, potion);
        return true;
    }
    if (potion.otyp === POT_ACID && object.otyp === CORPSE
        && object.corpsenm === MONSTER_NAME.indexOf('lichen')) {
        const color = heroIsBlind() ? 'wrinkled' : displayColorName(potion.odiluted ? 'orange' : 'red');
        await pline(`The ${objectCombatName(object)} ${objectNameIsPlural(object) ? 'turn' : 'turns'} ${color} around the edges.`);
        potion.in_use = false;
        if (potion.dknown)
            await tryCallObjectType(potion);
        return true;
    }
    if (potion.otyp === POT_WATER && object.otyp === TOWEL) {
        await pline('The towel soaks it up!');
        await poof(potion);
        return true;
    }
    if (isPoisonableObject(object)) {
        if (potion.otyp === POT_SICKNESS && !object.opoisoned) {
            const source = objectQuantity(potion) > 1 ? `One of the ${objectCombatName(potion)}`
                : `The ${objectCombatName(potion)}`;
            await pline(`${source} forms a coating on the ${objectCombatName(object)}.`);
            object.opoisoned = true;
            await poof(potion);
            return true;
        }
        if (object.opoisoned && !isPermanentlyPoisonedObject(object)
            && [POT_HEALING, POT_EXTRA_HEALING, POT_FULL_HEALING].includes(potion.otyp)) {
            await pline(`A coating wears off the ${objectCombatName(object)}.`);
            object.opoisoned = false;
            await poof(potion);
            return true;
        }
    }
    if (potion.otyp === POT_ACID) {
        const erosion = await erodeObject(object, 'corrosion', {
            displayName: objectCombatName(object),
        });
        if (erosion !== 'nothing') {
            await poof(potion);
            return true;
        }
    }
    if (potion.otyp === POT_OIL) {
        if (await dipInOil(object, potion))
            return true;
        if (object.otyp === OIL_LAMP || object.otyp === MAGIC_LAMP) {
            await fillLamp(object, potion);
            return true;
        }
    }
    potion.in_use = false;
    if (await neutralizePotion(object, potion))
        return true;
    await pline('Interesting...');
    return true;
}
async function poof(potion) {
    if (potion.dknown)
        await tryCallObjectType(potion);
    await consumeInventoryItem(potion);
}
async function dipInWater(object, potion) {
    let action = null;
    let color = '';
    if (potion.blessed && object.cursed) {
        action = 'uncurse';
        color = 'amber';
    }
    else if (potion.blessed && !object.blessed) {
        action = 'bless';
        color = 'light blue';
    }
    else if (potion.cursed && object.blessed) {
        action = 'unbless';
        color = 'brown';
    }
    else if (potion.cursed && !object.cursed) {
        action = 'curse';
        color = 'black';
    }
    if (!potion.blessed && !potion.cursed) {
        let mentionedWater = false;
        const result = await waterDamageObject(object, [], game, {
            force: true, publish: pline, mentionWater: () => { mentionedWater = true; },
        });
        if (mentionedWater)
            learnObjectType(POT_WATER);
        return result !== 'nothing';
    }
    if (!action)
        return false;
    const seen = !heroIsBlind() || object === game.ublindf && blindfolded() && !heroIsBlinded();
    if (seen) {
        const glow = displayColorName(color);
        const suffix = action === 'bless' || action === 'curse'
            ? `with ${withIndefiniteArticle(glow)} aura` : glow;
        await pline(`${ownedObjectAction(object, 'glow')} ${suffix}.`);
        game._lastPlineKind = PLNMSG_OBJ_GLOWS;
        object.bknown = !heroIsHallucinating();
    }
    else if (!potion.bknown || !potion.dknown)
        object.bknown = false;
    if (object.unpaid && object.otyp === POT_WATER) {
        if (action === 'bless' || action === 'curse')
            updateUnpaidObjectPrice(object);
        else
            await chargeAlteredUnpaidObject(object, action);
    }
    if (action === 'bless')
        blessObjectState(object);
    else if (action === 'uncurse')
        uncurseObjectState(object);
    else if (action === 'unbless')
        unblessObjectState(object);
    else {
        await curseObject(object);
        await dropCursedSecondaryWeapon(object);
    }
    return true;
}
async function dipInPolymorph(object, potion) {
    if (obj_unpolyable(object.otyp === POT_POLYMORPH ? potion : object)) {
        await pline('Nothing happens.');
        potion.in_use = false;
        return;
    }
    const conduct = game.u.uconduct ??= {};
    if (!conduct.polypiles)
        recordGameLogEvent(`polymorphed ${game.flags.female ? 'her' : 'his'} first item`);
    conduct.polypiles = (conduct.polypiles ?? 0) + 1;
    const oldType = object.otyp;
    const replacement = await poly_obj(object);
    if (!replacement) {
        learnObjectType(POT_POLYMORPH);
        return;
    }
    if (replacement.otyp !== oldType) {
        learnObjectType(POT_POLYMORPH);
        await consumeInventoryItem(potion);
        await pline(`${replacement.invlet} - ${await inventoryItemDescription(replacement)}.`);
    }
    else {
        await pline('Nothing seems to happen.');
        await poof(potion);
    }
}
async function dipInOil(object, potion) {
    let wisdom = false;
    if (potion.lamplit) {
        await fireDamageObject(object, { force: true, x: game.u.ux, y: game.u.uy, publish: pline });
    }
    else if (potion.cursed) {
        await pline(`The potion spills and covers your ${fingersOrGloves()} with oil.`);
        setPropertyTimeout('glib', (game.u.glibTurns ?? 0) + d(2, 10));
    }
    else if (object.oclass !== 2 && !isWeaponTool(object))
        return false;
    else if ((!objectIsVulnerableToErosion(object, 'rust') && !objectIsVulnerableToErosion(object, 'corrosion'))
        || isLauncherAmmunition(object) || !(object.oeroded || object.oeroded2)) {
        const verb = verbForSubject(objectNameIsPlural(object) ? 'they' : null, heroIsBlind() ? 'feel' : 'gleam');
        await pline(`${ownedObjectName(object)} ${verb} ${heroIsBlind() ? 'oily' : 'with an oily sheen'}.`);
    }
    else {
        const damage = object.oeroded && object.oeroded2 ? 'corroded and rusty'
            : object.oeroded ? 'rusty' : 'corroded';
        const verb = verbForSubject(objectNameIsPlural(object) ? 'they' : null, heroIsBlind() ? 'feel' : 'are');
        await pline(`${ownedObjectName(object)} ${verb} less ${damage}.`);
        object.oeroded = Math.max(0, (object.oeroded ?? 0) - 1);
        object.oeroded2 = Math.max(0, (object.oeroded2 ?? 0) - 1);
        wisdom = true;
    }
    await exerciseAttribute(A_WIS, wisdom);
    if (potion.dknown)
        learnObjectType(POT_OIL);
    await consumeInventoryItem(potion);
    return true;
}
async function fillLamp(lamp, potion) {
    if (lamp.lamplit || potion.lamplit) {
        await consumeInventoryItem(potion);
        await explode(game.u.ux, game.u.uy, 11, d(6, 6), 0, EXPL_FIERY);
        await exerciseAttribute(A_WIS, false);
        return;
    }
    if (lamp.otyp === MAGIC_LAMP && !lamp.spe) {
        lamp.otyp = OIL_LAMP;
        lamp.age = 0;
    }
    if (lamp.age > 1000) {
        await pline(`${ownedObjectAction(lamp, 'are')} full.`);
        potion.in_use = false;
    }
    else {
        await pline(`You fill ${ownedObjectName(lamp, game, { capitalized: false })} with oil.`);
        await chargeUnpaidUsage(potion);
        lamp.age = Math.min(1500, lamp.age + Math.trunc((potion.odiluted ? 3 : 4) * potion.age / 2));
        await consumeInventoryItem(potion);
        await exerciseAttribute(A_WIS, true);
    }
    if (potion.dknown)
        learnObjectType(POT_OIL);
    lamp.spe = 1;
}
//# sourceMappingURL=potion_item_dip.js.map