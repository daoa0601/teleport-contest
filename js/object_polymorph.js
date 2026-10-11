// Object transformations, system shock, and material golems.
// C zap.c:obj_shudders(), do_osshock(), poly_obj(), polyuse(), create_polymon().
import { G_GENOD, MAX_OIL_IN_FLASK, MAX_SPELL_STUDY, MM_NOMSG, NO_MINVENT, W_AMUL, W_ART, W_ARTI, W_QUIVER, W_RINGL, W_RINGR, W_SWAPWEP, W_TOOL, W_WEP, } from './const.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { rn2, rnd } from './rng.js';
import { AMULET_OF_UNCHANGING, BOULDER, CHEST, CORPSE, EGG, ENORMOUS_MEATBALL, FIGURINE, LARGE_BOX, LEASH, MAGIC_LAMP, MAGIC_MARKER, MEATBALL, MEAT_RING, MEAT_STICK, SPE_NOVEL, OBJECT_BIMANUAL, OBJECT_MAGIC, OBJECT_MERGE, OBJECT_NAMES, OIL_LAMP, POT_GAIN_ABILITY, POT_OIL, POT_POLYMORPH, POT_WATER, ROCK, SPE_BLANK_PAPER, SPE_POLYMORPH, STATUE, UNICORN_HORN, getObjectClassBounds, WAN_LIGHT, WAN_LIGHTNING, WAN_POLYMORPH, WAN_WISHING, } from './object_data.js';
import { MONSTER_BODY_META, MONSTER_FLAGS1, MONSTER_GENO, MONSTER_NAME, MONSTER_SYMBOL, requireMonsterData, } from './monster_data.js';
import { makemonAt, mkobj, mksobj, rndClass, set_corpsenm } from './mklev.js';
import { hatchableEggSpecies, eggSpeciesIsDead } from './egg_species.js';
import { getObjectLocation, replaceObject, unlinkObject } from './object_location.js';
import { objectQuantity, splitObjectStack } from './object_stack.js';
import { objectWeight } from './weight.js';
import { delobj, deleteObjectContents, stopObjectTimers } from './object_delete.js';
import { objectResistsDestruction } from './object_state.js';
import { erosionMatters, objectIsVulnerableToErosion } from './object_erosion.js';
import { isPoisonableObject } from './object_properties.js';
import { finishInventoryAddition, finishInventoryRemoval } from './hero_inventory.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { applyArmorOnEffects, armorSlotFor, wearHeroArmor } from './armor.js';
import { wearHeroAccessory } from './accessory.js';
import { isEyewear, wearEyewear } from './eyewear.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon, setTwoWeaponCombat, } from './weapon_slots.js';
import { releaseObjectLeash } from './monster_leash.js';
import { maybeUnhideAt } from './monster_hiding.js';
import { monsterName, shopkeeperName } from './monster_name.js';
import { addShopObjectToBill, costlySpot, shopkeeperInOwnShop, } from './shk.js';
import { containedBuyCost, stolenValue } from './shop_loss.js';
import { hotPursuitShopkeeper, makeAngryShopkeeper } from './shop_damage.js';
import { roomsAt } from './room.js';
import { fractureRock, sokobanGuilt } from './rock_breakage.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
import { newsym, plineWithContinuation } from './display.js';
import { cansee, vision_note_blocker_change } from './vision.js';
import { recordGameLogEvent } from './gamelog.js';
import { animateStatue } from './statue_trap.js';
import { placeObject } from './floor_object.js';
import { consumeInventoryItem } from './invent.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { vegetarianCorpse } from './food_traits.js';
import { updateInventoryPresentation } from './u_init.js';
import { objectMaterial } from './object_material.js';
import { changeBoxLockByMagic } from './box_magic.js';
import { heroFormHidesUnderObjects } from './polyself.js';
const STRANGE_OBJECT = 0;
const WEAPON_CLASS = 2, ARMOR_CLASS = 3, RING_CLASS = 4, AMULET_CLASS = 5;
const TOOL_CLASS = 6, POTION_CLASS = 8, SPBOOK_CLASS = 10, WAND_CLASS = 11;
const GEM_CLASS = 13, ROCK_CLASS = 14;
const WOOD = 8, FLESH = 4, LEATHER = 7, CLOTH = 6, BONE = 9;
const IRON = 11, METAL = 12, COPPER = 13, SILVER = 14, GOLD = 15;
const PLATINUM = 16, MITHRIL = 17, GLASS = 19, GEMSTONE = 20, MINERAL = 21;
const PAPER = 5;
const LARGEST_INT = 32767;
const PM_CROCODILE = MONSTER_NAME.indexOf('crocodile');
const PM_FLESH_GOLEM = MONSTER_NAME.indexOf('flesh golem');
const S_GOLEM = MONSTER_SYMBOL[PM_FLESH_GOLEM];
const LOW_BOOTS = OBJECT_NAMES.indexOf('low boots');
const isBox = (object) => object.otyp === CHEST || object.otyp === LARGE_BOX;
export async function polymorphFloorObject(object, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (obj_unpolyable(object, { state }))
        return { affected: false, learned: false };
    const conduct = state.u.uconduct ??= {};
    if (!conduct.polypiles)
        recordGameLogEvent(`polymorphed ${state.flags.female ? 'her' : 'his'} first object`, { state });
    conduct.polypiles = (conduct.polypiles || 0) + 1;
    if (isBox(object))
        await changeBoxLockByMagic(object, { otyp: WAN_POLYMORPH }, { state });
    if (obj_shudders(object, { state })) {
        const cover = state.level.objects[state.u.ux]?.[state.u.uy]?.[0] === object
            && state.u.uundetected && heroFormHidesUnderObjects(state);
        const learned = cansee(object.ox, object.oy);
        await do_osshock(object, { state });
        if (cover)
            maybeUnhideAt(state.u.ux, state.u.uy, state);
        return { affected: true, learned };
    }
    const replacement = await poly_obj(object, STRANGE_OBJECT, { state });
    if (!replacement)
        throw new Error(`Floor polymorph lost replacement for object ${object.o_id}`);
    newsym(replacement.ox, replacement.oy);
    return { affected: true, learned: false };
}
export function obj_unpolyable(object, { state = game } = {}) {
    return [WAN_POLYMORPH, SPE_POLYMORPH, POT_POLYMORPH, AMULET_OF_UNCHANGING]
        .includes(object.otyp) || object === (state.uball || state.u.uball)
        || object === state.uskin || objectResistsDestruction(object, 5, 95);
}
export function obj_shudders(object, { state = game } = {}) {
    if (state.context.bypasses && object.bypass)
        return false;
    let odds = object.oclass === WAND_CLASS || object.cursed ? 3
        : object.blessed ? 12 : 8;
    if (objectQuantity(object) > 4)
        odds = Math.trunc(odds / 2);
    return !rn2(odds);
}
export async function do_osshock(object, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    state.context.obj_zapped = true;
    if ((state.context.poly_zapped ?? -1) < 0) {
        const luck = (state.u.uluck || 0) + (state.u.moreluck || 0);
        for (let remaining = objectQuantity(object); remaining > 0; remaining--) {
            if (!rn2(luck + 45)) {
                state.context.poly_zapped = objectMaterial(object, state);
                break;
            }
        }
    }
    const quantity = objectQuantity(object);
    if (quantity > 1) {
        const split = splitObjectStack(object, rnd(quantity > LARGEST_INT ? 30000 : quantity - 1), state);
        if (!split)
            throw new Error(`System shock could not split object ${object.o_id}`);
        object = split;
    }
    await billDestroyedMaterial(object, state);
    await delobj(object, state);
}
export async function poly_obj(object, id = STRANGE_OBJECT, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (object.otyp === BOULDER)
        sokobanGuilt(state);
    const where = object.where;
    let replacement = await createReplacement(object, id, state);
    finishReplacementType(object, replacement, id, state);
    replacement.owt = objectWeight(replacement);
    const location = getObjectLocation(object, state, { contained: true, buried: true });
    const oldWornMask = (object.owornmask || 0) & ~(W_ART | W_ARTI);
    if (where === 'inventory')
        updateInventoryPresentation(replacement);
    replaceObject(object, replacement, state);
    if (where === 'inventory') {
        await finishInventoryRemoval(object, state);
        if (state.program_state.gameover)
            return replacement;
        await finishInventoryAddition(replacement, state);
        if (oldWornMask)
            replacement = await replaceWornItem(object, replacement, oldWornMask, state);
        if (state.program_state.gameover)
            return replacement;
    }
    else if (where === 'floor') {
        if (!location)
            throw new Error(`Floor object ${object.o_id} has no location`);
        if (object.otyp !== BOULDER && replacement.otyp === BOULDER
            && (isPoolAt(location.x, location.y, state) || isLavaAt(location.x, location.y, state)))
            await fractureRock(replacement, location.x, location.y, { state, publish: plineWithContinuation });
        if (object.otyp === BOULDER || replacement.otyp === BOULDER)
            vision_note_blocker_change(location.x, location.y);
    }
    await angerObjectOwner(object, replacement, location, state);
    await delobj(object, state);
    return replacement;
}
async function createReplacement(object, id, state) {
    let replacement;
    if (id === STRANGE_OBJECT) {
        const magic = object.otyp === UNICORN_HORN && object.degraded_horn
            ? 0 : OBJECT_MAGIC[object.otyp];
        replacement = await mkobj(object.oclass, false);
        for (let attempt = 1; attempt < 3 && OBJECT_MAGIC[replacement.otyp] !== magic; attempt++) {
            await delobj(replacement, state);
            replacement = await mkobj(object.oclass, false);
        }
    }
    else {
        replacement = await mksobj(id, false, false);
        if ([CORPSE, STATUE, FIGURINE].includes(object.otyp)
            && [CORPSE, STATUE, FIGURINE].includes(id))
            set_corpsenm(replacement, representedSpecies(object));
    }
    replacement.quan = replacement.quantity = objectQuantity(object);
    if (object.no_charge === undefined)
        delete replacement.no_charge;
    else
        replacement.no_charge = object.no_charge;
    if (object.where === 'inventory') {
        if (object.invlet === undefined)
            delete replacement.invlet;
        else
            replacement.invlet = object.invlet;
    }
    if (object.otyp === EGG && object.spe)
        makeHeroLaidEgg(replacement, state);
    if ([WAND_CLASS, WEAPON_CLASS, ARMOR_CLASS].includes(replacement.oclass))
        replacement.spe = object.spe;
    replacement.recharged = object.recharged || 0;
    replacement.cursed = !!object.cursed;
    replacement.blessed = !!object.blessed;
    copyErosion(object, replacement, state);
    if (object.otrapped && isBox(replacement))
        replacement.otrapped = true;
    if (object.opoisoned && isPoisonableObject(replacement))
        replacement.opoisoned = true;
    if (id === STRANGE_OBJECT && object.otyp === CORPSE && object.corpsenm === PM_CROCODILE) {
        replacement.otyp = LOW_BOOTS;
        replacement.oclass = ARMOR_CLASS;
        replacement.spe = replacement.oeroded = 0;
        replacement.oerodeproof = true;
        replacement.quan = replacement.quantity = 1;
        replacement.cursed = false;
    }
    if (object.otyp === LEASH && object.leashmon) {
        if (replacement.otyp === LEASH) {
            replacement.leashmon = object.leashmon;
            object.leashmon = 0;
        }
        else
            releaseObjectLeash(object, state);
    }
    await deleteObjectContents(replacement, state);
    return replacement;
}
function makeHeroLaidEgg(object, state) {
    if (object.otyp === EGG)
        stopObjectTimers(object, state);
    object.otyp = EGG;
    object.corpsenm = -1;
    object.spe = 0;
    for (let attempt = 0; attempt < 100; attempt++) {
        const species = hatchableEggSpecies(rn2(MONSTER_NAME.length));
        if (species >= 0 && !eggSpeciesIsDead(species, state)) {
            object.spe = 1;
            set_corpsenm(object, species);
            return;
        }
    }
}
function copyErosion(source, target, state) {
    if (!erosionMatters(target))
        return;
    const primary = ['burn', 'rust', 'crack'].some(kind => objectIsVulnerableToErosion(target, kind, state));
    const secondary = ['corrosion', 'rot'].some(kind => objectIsVulnerableToErosion(target, kind, state));
    if (primary)
        target.oeroded = source.oeroded || 0;
    if (secondary)
        target.oeroded2 = source.oeroded2 || 0;
    if (primary || secondary)
        target.oerodeproof = !!source.oerodeproof;
}
function finishReplacementType(source, target, id, state) {
    if (target.quan > 1 && (!OBJECT_MERGE[target.otyp]
        || (id === STRANGE_OBJECT && target.quan > rn2(1000))))
        target.quan = target.quantity = 1;
    switch (target.oclass) {
        case TOOL_CLASS:
            if (target.otyp === MAGIC_LAMP) {
                target.otyp = OIL_LAMP;
                target.age = 1500;
            }
            else if (target.otyp === MAGIC_MARKER)
                target.recharged = 1;
            break;
        case WAND_CLASS:
            while ([WAN_WISHING, WAN_POLYMORPH].includes(target.otyp))
                target.otyp = rndClass(WAN_LIGHT, WAN_LIGHTNING);
            if (target.recharged < rn2(7))
                target.recharged++;
            break;
        case POTION_CLASS:
            while (target.otyp === POT_POLYMORPH)
                target.otyp = rndClass(POT_GAIN_ABILITY, POT_WATER);
            if (target.otyp === POT_OIL)
                target.age = source.otyp === POT_OIL ? source.age : MAX_OIL_IN_FLASK;
            else if (source.otyp === POT_OIL) {
                if (target.age === source.age)
                    target.age = state.moves;
                if (source.age < MAX_OIL_IN_FLASK)
                    target.odiluted = true;
            }
            break;
        case SPBOOK_CLASS:
            while (target.otyp === SPE_POLYMORPH)
                target.otyp = rndClass(getObjectClassBounds(SPBOOK_CLASS).first, SPE_BLANK_PAPER);
            if (![SPE_BLANK_PAPER, SPE_NOVEL].includes(target.otyp)) {
                target.spestudied = (source.spestudied || 0) + 1;
                if (target.spestudied > MAX_SPELL_STUDY) {
                    target.otyp = SPE_BLANK_PAPER;
                    target.spestudied = rn2(target.spestudied);
                }
            }
            break;
        case GEM_CLASS:
            if (target.quan > rnd(4) && objectMaterial(source, state) === MINERAL
                && objectMaterial(target, state) !== MINERAL) {
                target.otyp = ROCK;
                target.quan = target.quantity = Math.trunc(target.quan / 2);
            }
            break;
    }
}
async function replaceWornItem(old, replacement, mask, state) {
    const twoHanded = !!OBJECT_BIMANUAL[old.otyp];
    const twoWeapons = !!state.u.twoweap;
    const oldArmorSlot = armorSlotFor(old.otyp);
    await removeWornHeroItem(old, state);
    if (state.program_state.gameover)
        return replacement;
    if (mask & W_WEP) {
        if (twoHanded || !OBJECT_BIMANUAL[replacement.otyp] || !state.uarms)
            await setPrimaryWeapon(replacement, state);
        if (twoWeapons && state.uwep && !OBJECT_BIMANUAL[state.uwep.otyp])
            setTwoWeaponCombat(true, state);
    }
    else if (mask & W_SWAPWEP) {
        if (twoHanded || !OBJECT_BIMANUAL[replacement.otyp])
            await setSecondaryWeapon(replacement, state);
        if (twoWeapons && state.uswapwep)
            setTwoWeaponCombat(true, state);
    }
    else if (mask & W_QUIVER) {
        await setQuiverObject(replacement, state);
    }
    else if (oldArmorSlot && oldArmorSlot === armorSlotFor(replacement.otyp)) {
        wearHeroArmor(replacement, state);
        await applyArmorOnEffects(replacement, state);
        return state[oldArmorSlot] ?? null;
    }
    else if ((mask & (W_RINGL | W_RINGR))
        && (replacement.oclass === RING_CLASS || replacement.otyp === MEAT_RING)) {
        const slot = mask & W_RINGL ? 'uleft' : 'uright';
        await wearHeroAccessory(replacement, slot, state);
        return state[slot] ?? null;
    }
    else if ((mask & W_AMUL) && replacement.oclass === AMULET_CLASS) {
        await wearHeroAccessory(replacement, 'uamul', state);
        return state.uamul ?? null;
    }
    else if ((mask & W_TOOL) && isEyewear(replacement)) {
        await wearEyewear(replacement, { checkHead: false });
        return state.ublindf ?? null;
    }
    return replacement;
}
async function angerObjectOwner(old, replacement, location, state) {
    const shopRelevant = old.unpaid || (replacement && replacement.where !== 'inventory');
    if (!location || !shopRelevant)
        return;
    const { x, y } = location;
    const keeper = costlySpot(x, y, state)?.resident;
    if (!keeper || !shopkeeperInOwnShop(keeper, state)
        || (old.no_charge && !containedBuyCost(old, keeper, { unpaidOnly: false, state })))
        return;
    if (keeper.mpeaceful && state.u.ushops?.length
        && roomsAt(state.level, state.u.ux, state.u.uy, 0)[0]
            === roomsAt(state.level, keeper.mx, keeper.my, 0)[0]
        && !costlySpot(state.u.ux, state.u.uy, state)) {
        await makeAngryShopkeeper(keeper, state);
    }
    else {
        await plineWithContinuation(`${shopkeeperName(keeper, { state, capitalized: true })} ${keeper.mpeaceful ? 'gets angry' : 'is furious'}!`, { noRepeat: !keeper.mpeaceful });
        if (keeper.mpeaceful)
            hotPursuitShopkeeper(keeper, state);
    }
}
async function billDestroyedMaterial(object, state) {
    if (!costlySpot(object.ox, object.oy, state))
        return;
    if (state.u.ushops?.length)
        await addShopObjectToBill(object, state, { ininv: false });
    else
        await stolenValue(object, object.ox, object.oy, false, { silent: false, state });
}
export async function createPolymorphMonsterFromPile(x, y, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const kind = state.context.poly_zapped ?? -1;
    if (kind < 0)
        return null;
    const pile = state.level.objects[x]?.[y] || [];
    let start = 0;
    if (state.context.bypasses)
        while (pile[start]?.bypass)
            start++;
    const first = pile[start];
    if (!first || (start === pile.length - 1 && objectQuantity(first) === 1))
        return null;
    const { species, material } = golemForMaterial(kind);
    const genocided = (state.mvitals?.[species]?.mvflags || 0) & G_GENOD;
    const monster = await makemonAt(genocided ? null : species, x, y, MM_NOMSG);
    let remaining = requireMonsterData(MONSTER_BODY_META, species)[0];
    for (const object of pile.slice(start)) {
        if (remaining <= 0)
            break;
        if ((state.context.bypasses && object.bypass)
            || object === (state.uball || state.u.uball)
            || object === (state.uchain || state.u.uchain)
            || objectResistsDestruction(object, 0, 0))
            continue;
        if ((objectMaterial(object, state) === kind) !== (rn2(remaining + 1) !== 0))
            continue;
        await billDestroyedMaterial(object, state);
        remaining -= objectQuantity(object) < LARGEST_INT ? objectQuantity(object) : remaining;
        await delobj(object, state);
    }
    if (monster && cansee(monster.mx, monster.my))
        await plineWithContinuation(`Some ${material}objects meld, and ${monsterName(monster, { article: 'a', state })} arises from the pile!`);
    return monster;
}
function golemForMaterial(kind) {
    let name, material;
    switch (kind) {
        case IRON:
        case METAL:
        case MITHRIL:
            name = 'iron golem';
            material = 'metal ';
            break;
        case COPPER:
        case SILVER:
        case PLATINUM:
        case GEMSTONE:
        case MINERAL:
            name = rn2(2) ? 'stone golem' : 'clay golem';
            material = 'lithic ';
            break;
        case 0:
        case FLESH:
            name = 'flesh golem';
            material = 'organic ';
            break;
        case WOOD:
            name = 'wood golem';
            material = 'wood ';
            break;
        case LEATHER:
            name = 'leather golem';
            material = 'leather ';
            break;
        case CLOTH:
            name = 'rope golem';
            material = 'cloth ';
            break;
        case BONE:
            name = 'skeleton';
            material = 'bony ';
            break;
        case GOLD:
            name = 'gold golem';
            material = 'gold ';
            break;
        case GLASS:
            name = 'glass golem';
            material = 'glassy ';
            break;
        case PAPER:
            name = 'paper golem';
            material = 'paper ';
            break;
        default:
            name = 'straw golem';
            material = '';
    }
    return { species: MONSTER_NAME.indexOf(name), material };
}
// C zap.c:stone_to_flesh_obj(). Animation uses the same owners as traps.
export async function stone_to_flesh_obj(object, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (![MINERAL, GEMSTONE].includes(objectMaterial(object, state))
        || objectResistsDestruction(object, 2, 98))
        return 0;
    const { x = 0, y = 0 } = getObjectLocation(object, state) || {};
    let affected = 1, smell = false;
    if (object.oclass === ROCK_CLASS || object.oclass === TOOL_CLASS) {
        if (object.otyp === BOULDER) {
            await poly_obj(object, ENORMOUS_MEATBALL, { state });
            smell = true;
        }
        else if (object.otyp === STATUE || object.otyp === FIGURINE) {
            const species = representedSpecies(object);
            const golem = MONSTER_SYMBOL[species] === S_GOLEM;
            if (!golem && vegetarianCorpse(species)) {
                await poly_obj(object, MEATBALL, { state });
                smell = true;
            }
            else
                affected = await animateStoneObject(object, x, y, golem, state);
        }
        else
            affected = 0;
    }
    else {
        const type = object.oclass === RING_CLASS ? MEAT_RING
            : object.oclass === WAND_CLASS ? MEAT_STICK
                : object.oclass === GEM_CLASS ? MEATBALL : null;
        if (type !== null) {
            await poly_obj(object, type, { state });
            smell = true;
        }
        else
            affected = 0;
    }
    if (smell) {
        const vegetarian = state.urole.key === 'monk' || !state.u.uconduct?.unvegetarian
            || !(requireMonsterData(MONSTER_FLAGS1, state.u.umonnum) & 0x20000000);
        await plineWithContinuation(vegetarian
            ? 'You smell the odor of meat.' : 'You smell a delicious smell.', { noRepeat: true });
    }
    newsym(x, y);
    return affected;
}
async function animateStoneObject(object, x, y, golem, state) {
    let species = representedSpecies(object);
    let monster;
    const flesh = golem && species !== PM_FLESH_GOLEM;
    if (object.otyp === STATUE) {
        ({ monster } = await animateStatue(object, x, y, { state, magic: true }));
    }
    else {
        if (flesh)
            species = PM_FLESH_GOLEM;
        monster = await makemonAt(species, x, y, NO_MINVENT | MM_NOMSG);
        if (monster) {
            const keeper = costlySpot(x, y, state)?.resident;
            if (keeper && (object.where === 'inventory' ? object.unpaid : !object.no_charge))
                await stolenValue(object, x, y, !!keeper.mpeaceful, { silent: false, state });
            stopObjectTimers(object, state);
            if (object.where === 'inventory')
                await consumeInventoryItem(object);
            else
                await delobj(object, state);
            if (cansee(monster.mx, monster.my))
                await plineWithContinuation(`The figurine ${flesh ? 'turns to flesh and ' : ''}animates!`);
        }
    }
    if (monster) {
        if (MONSTER_SYMBOL[monster.mnum] === S_GOLEM && monster.mnum !== PM_FLESH_GOLEM)
            await changeMonsterForm(monster, PM_FLESH_GOLEM);
        return 1;
    }
    if (requireMonsterData(MONSTER_GENO, species) & (0x0010 | 0x1000))
        return 0;
    for (;;) {
        const content = object.contents?.[0];
        if (!content)
            break;
        content.bypass = true;
        state.context.bypasses = true;
        unlinkObject(content, state);
        await placeObject(content, x, y, state);
    }
    await poly_obj(object, CORPSE, { state });
    return 1;
}
function representedSpecies(object) {
    if (object.corpsenm === undefined)
        throw new Error(`Object ${object.o_id} has no represented monster species`);
    return object.corpsenm;
}
//# sourceMappingURL=object_polymorph.js.map