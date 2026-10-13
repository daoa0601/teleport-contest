// Water, lava, fire, and monster rust-trap effects.
// C ref: trap.c lava_effects(), burnarmor(), trapeffect_rust_trap(),
// water_damage(), and erode_obj().
import { IS_POOL, Is_waterlevel, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU, W_SWAPWEP, W_WEP, isok, } from './const.js';
import { armorSimpleName, heroHasWaterWalking } from './armor.js';
import { fireDamageObject } from './fire_damage.js';
import { delobj } from './object_delete.js';
import { objectDescription as fullObjectDescription } from './object_description.js';
import { objectCombatName, observeObjectForNaming, ownedObjectName } from './objnam.js';
import { cansee } from './vision.js';
import { endObjectBurn } from './light.js';
import { game } from './gstate.js';
import { monsterName, possessiveName } from './monster_name.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { useUpInventoryStack } from './hero_inventory.js';
import { getObjectLocation } from './object_location.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { heroIsFlying } from './polyself.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { splitMonster } from './monster_clone.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { BAG_OF_TRICKS, BRASS_LANTERN, CAN_OF_GREASE, CHEST, ICE_BOX, FIRE_HORN, LARGE_BOX, OBJECT_BIMANUAL, OBJECT_MATERIAL, OBJECT_MATERIAL_NAMES, OBJECT_NAMES, OBJECT_PROPERTY, OILSKIN_SACK, POT_ACID, POT_WATER, RED_DRAGON_SCALE_MAIL, RED_DRAGON_SCALES, RIN_FIRE_RESISTANCE, SCR_BLANK_PAPER, SCR_FIRE, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_FIREBALL, TOWEL, WAN_FIRE, } from './object_data.js';
import { objectResistsDestruction } from './object_state.js';
import { objectMaterial } from './object_material.js';
import { impossible } from './diagnostics.js';
import { stopAllObjectTimers } from './object_timers.js';
import { rnl, rn2 } from './rng.js';
import { canSeeMonster, newsym } from './display.js';
// C trap.c:seetrap(). Discovering a trap refreshes the nonliving layer;
// any object or monster still covering it keeps its usual display priority.
export function seeTrap(trap, state = game) {
    if (trap.tseen)
        return;
    trap.tseen = true;
    if (state === game)
        newsym(trap.tx, trap.ty);
}
const PM_GREMLIN = 40;
const PM_IRON_GOLEM = 259;
const M1_HUMANOID = 0x00020000;
const POTION_CLASS = 8;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const DRAGON_HIDE = 10;
const FIRE_RESISTANT_OBJECTS = new Set([
    RED_DRAGON_SCALE_MAIL,
    RED_DRAGON_SCALES,
    RIN_FIRE_RESISTANCE,
]);
function lavaCanBurnObject(object, random) {
    if (!object || object.in_use || object.oerodeproof)
        return false;
    const organic = objectMaterial(object) <= 8;
    if (!organic && object.oclass !== POTION_CLASS)
        return false;
    if (FIRE_RESISTANT_OBJECTS.has(object.otyp)
        || object.otyp === SCR_FIRE || object.otyp === SPE_FIREBALL)
        return false;
    return !objectResistsDestruction(object, 0, 0, random);
}
// C trap.c:lava_effects() flags all doomed items before any death message.
export async function markLavaInventoryForDestruction(state, random) {
    let protectedObject = null;
    for (const object of state.inventory) {
        if (object.in_use) {
            if (!protectedObject) {
                protectedObject = object;
                object.in_use = false;
            }
            else {
                await impossible(`lava_effects: object #${object.o_id} is already in use; so is #${protectedObject.o_id}.`);
            }
            continue;
        }
        if (lavaCanBurnObject(object, random))
            object.in_use = true;
    }
    return protectedObject;
}
export async function destroyLavaInventory({ state = game, publish = async () => { }, protectedObject, showMessages = false, previouslyAnnounced = 0, }) {
    let named = previouslyAnnounced;
    let unnamed = 0;
    for (const object of [...(state.inventory || [])]) {
        if (object === protectedObject) {
            object.in_use = true;
            continue;
        }
        if (object.otyp === SPE_BOOK_OF_THE_DEAD) {
            if (showMessages && !state.blind
                && !((state.u.blindTurns ?? 0) > 0)) {
                await publish('The Book of the Dead glows a strange dark red, '
                    + 'but remains intact.');
            }
            continue;
        }
        if (!object.in_use)
            continue;
        const wasWorn = !!object.worn || !!object.owornmask;
        if (showMessages && wasWorn) {
            const name = object.name || OBJECT_NAMES[object.otyp] || 'item';
            const plural = (object.quan ?? object.quantity ?? 1) > 1
                || name.endsWith('s');
            await publish(`Your ${name} ${plural ? 'burst' : 'bursts'} into flame!`);
            named++;
        }
        else {
            unnamed++;
        }
        await removeWornHeroItem(object, state);
        if (state.program_state?.gameover)
            return named + unnamed - previouslyAnnounced;
        await useUpInventoryStack(object, state);
        if (state.program_state?.gameover)
            return named + unnamed - previouslyAnnounced;
    }
    if (showMessages && unnamed) {
        const subject = named
            ? unnamed === 1 ? 'Another item' : 'Other items'
            : unnamed === 1 ? 'An item' : 'Some items';
        await publish(`${subject} in your inventory ${unnamed === 1 ? 'has' : 'have'} been destroyed.`);
    }
    return named + unnamed - previouslyAnnounced;
}
export async function destroyLavaFloorObjects(objects, { state = game, publish = async () => { }, random = rn2, visible = false, x, y, } = {}) {
    if (!objects)
        return 0;
    let destroyed = 0;
    for (const object of [...objects]) {
        // lava_damage() screens every object before checking its material.
        // A destroyed object also passes through delobj() independently.
        if (objectResistsDestruction(object, 0, 0, random)
            && object.otyp !== SPE_BOOK_OF_THE_DEAD)
            continue;
        const burnDirectly = objectMaterial(object, state) < DRAGON_HIDE
            && object.oclass !== SCROLL_CLASS && object.oclass !== SPBOOK_CLASS
            && OBJECT_PROPERTY[object.otyp] !== 'fireResistance'
            && object.otyp !== WAN_FIRE && object.otyp !== FIRE_HORN
            && !object.oerodeproof && !object.contents?.length;
        const landingX = x ?? object.ox;
        const landingY = y ?? object.oy;
        if (burnDirectly) {
            if (visible) {
                if (object === state._thrownObject || object === state._kickedObject) {
                    await publish(object.quan === 1 ? 'It burns up!' : 'They burn up!');
                }
                else {
                    observeObjectForNaming(object, { state });
                    await publish(`You see ${fullObjectDescription(object, { state })} hit lava and burn up!`);
                }
            }
            await delobj(object, state, random);
        }
        else if (!await fireDamageObject(object, {
            force: true, state, publish, random, x: landingX, y: landingY,
        })) {
            continue;
        }
        const index = objects.indexOf(object);
        if (index >= 0)
            objects.splice(index, 1);
        destroyed++;
    }
    return destroyed;
}
function recordRoll(random, calls, range) {
    calls?.push(range);
    return random(range);
}
function inventoryOf(monster) {
    return monster?.minvent || monster?.inventory || [];
}
export function monsterTrapVisibility(monster, state = game) {
    const blind = !!state?.blind || (state?.u?.blindTurns ?? 0) > 0;
    const seeSquare = !blind
        && !!((state?.viz_array?.[monster.my]?.[monster.mx] ?? 0) & 0x2);
    const inSight = state?.u?.usteed === monster
        || canSeeMonster(monster);
    return { inSight, seeSquare };
}
function wornObject(monster, mask) {
    return inventoryOf(monster).find(object => ((object.owornmask ?? 0) & mask) !== 0) || null;
}
function objectDescription(object, fallback) {
    if (!object)
        return fallback;
    return object.name || OBJECT_NAMES[object.otyp] || fallback;
}
function objectContents(object) {
    return object.contents || [];
}
function explodingPotionMessage(object, state) {
    const quantity = object.quan ?? object.quantity ?? 1;
    const typeKnown = object.typeKnown
        || state._knownObjectTypes?.has(object.otyp);
    const noun = typeKnown ? `potion of ${OBJECT_NAMES[object.otyp] || 'acid'}`
        : 'potion';
    return quantity === 1
        ? `A ${noun} explodes!`
        : `Some ${noun}s explode!`;
}
function waterObjectName(object, description = null) {
    if (description)
        return description;
    if (object.name)
        return object.name;
    const name = OBJECT_NAMES[object.otyp] || 'object';
    if (object.oclass === 8)
        return `potion of ${name}`;
    if (object.oclass === 9)
        return `scroll of ${name}`;
    if (object.oclass === 10)
        return `spellbook of ${name}`;
    return name;
}
function waterObjectIsPlural(object, description = null) {
    const name = waterObjectName(object, description);
    return (object.quan ?? object.quantity ?? 1) !== 1
        || /(?:boots|shoes|gloves|gauntlets|lenses|scales)$/u.test(name);
}
function carriedByHero(object, state) {
    return (state.inventory || []).includes(object);
}
function heroLanternIsDunked(state) {
    const location = state.level?.at?.(state.u?.ux, state.u?.uy);
    if (!location || !IS_POOL(location.typ))
        return false;
    return Is_waterlevel(state.u.uz)
        || !(state.u?.levitating || state.levitating
            || heroIsFlying(state) || heroHasWaterWalking(state));
}
export function splashLitObject(object, messages = [], state = game) {
    if (!object?.lamplit)
        return false;
    const carried = carriedByHero(object, state);
    let dunkedLantern = false;
    if (object.otyp === BRASS_LANTERN && carried) {
        const visible = !heroIsBlind(state);
        const audible = !heroIsDeaf(state);
        if (visible || audible) {
            const action = audible && visible
                ? 'crackles and flickers'
                : audible ? 'crackles' : 'flickers';
            messages.push(`Your ${waterObjectName(object)} ${action}.`);
        }
        dunkedLantern = heroLanternIsDunked(state);
        if (!dunkedLantern)
            return false;
    }
    if (!endObjectBurn(object, state, state.moves ?? 0))
        object.lamplit = false;
    if (carried && !heroIsBlind(state)) {
        const plural = waterObjectIsPlural(object);
        messages.push(`Your ${waterObjectName(object)} ${plural ? 'go' : 'goes'} out!`);
    }
    if (dunkedLantern) {
        const age = object.age ?? 0;
        object.age = age - (age > 200 ? 100 : Math.trunc(age / 2));
    }
    return true;
}
function rustMetalObject(object, description, luckRoll) {
    if (!object || (OBJECT_MATERIAL[object.otyp] ?? 0) !== 11)
        return { outcome: 'nothing' };
    const proof = !!object.oerodeproof;
    if (proof && object.rknown)
        return { outcome: 'nothing' };
    if (proof) {
        object.rknown = true;
        return {
            outcome: 'nothing', kind: 'rustproof', object, description,
        };
    }
    if (object.blessed && luckRoll(4) === 0)
        return { outcome: 'nothing' };
    const oldErosion = object.oeroded ?? 0;
    if (oldErosion >= 3)
        return { outcome: 'nothing' };
    object.oeroded = oldErosion + 1;
    return {
        outcome: 'damaged', kind: 'rusted', object, description,
        erosion: object.oeroded,
    };
}
export async function waterDamageObject(object, messages = [], state = game, { force = false, description = null, random = rn2, luckRoll = rnl, } = {}) {
    if (!object)
        return 'nothing';
    if (splashLitObject(object, messages, state))
        return 'damaged';
    const name = description ?? objectCombatName(object, { state });
    const spe = object.spe ?? 0;
    if (object.otyp === CAN_OF_GREASE && spe > 0)
        return 'nothing';
    if (object.otyp === TOWEL && spe < 7) {
        object.spe = spe + 1 + random(7 - spe);
        return 'nothing';
    }
    if (object.greased) {
        if (random(2) === 0) {
            object.greased = false;
            if (carriedByHero(object, state)) {
                observeObjectForNaming(object, { state });
                messages.push(`The grease on ${ownedObjectName(object, state, { capitalized: false })} washes off.`);
            }
            if (object.otyp === POT_ACID) {
                messages.push(explodingPotionMessage(object, state));
                return 'destroyed';
            }
        }
        return 'greased';
    }
    const isContainer = object.otyp >= LARGE_BOX
        && object.otyp <= BAG_OF_TRICKS;
    if (isContainer) {
        const waterproof = object.otyp === OILSKIN_SACK
            || object.otyp === ICE_BOX
            || object.otyp === LARGE_BOX
            || object.otyp === CHEST;
        const leaks = !waterproof || (object.cursed && random(3) === 0);
        if (leaks) {
            if (carriedByHero(object, state)) {
                messages.push(`Some water gets into your ${name}!`);
            }
            await waterDamageChain(objectContents(object), messages, state);
            return 'damaged';
        }
        if (carriedByHero(object, state)
            && !heroIsBlind(state) && !state.underwater) {
            messages.push(`The water cannot get into your ${name}.`);
        }
        return 'damaged';
    }
    if (!force && ((state.u?.uluck ?? 0) + 5) > random(20))
        return 'nothing';
    const plural = waterObjectIsPlural(object, name);
    const carried = carriedByHero(object, state);
    if (object.oclass === 9) {
        if (object.otyp !== SCR_BLANK_PAPER) {
            if (carried)
                messages.push(`Your ${name} ${plural ? 'fade' : 'fades'}.`);
            object.otyp = SCR_BLANK_PAPER;
            object.dknown = false;
            object.spe = 0;
            return 'damaged';
        }
        return 'nothing';
    }
    if (object.oclass === 10) {
        if (object.otyp === SPE_BOOK_OF_THE_DEAD) {
            const position = getObjectLocation(object, state, {
                contained: true, buried: true,
            });
            if (position) {
                object.ox = position.x;
                object.oy = position.y;
                if (isok(position.x, position.y) && cansee(position.x, position.y))
                    messages.push('Steam rises from the Book of the Dead.');
            }
            return 'nothing';
        }
        if (object.otyp !== SPE_BLANK_PAPER) {
            if (carried)
                messages.push(`Your ${name} ${plural ? 'fade' : 'fades'}.`);
            if (object.spestudied)
                object.spestudied = random(object.spestudied);
            object.otyp = SPE_BLANK_PAPER;
            object.dknown = false;
            return 'damaged';
        }
        return 'nothing';
    }
    if (object.oclass === 8) {
        if (object.otyp === POT_ACID) {
            messages.push(explodingPotionMessage(object, state));
            return 'destroyed';
        }
        if (object.odiluted) {
            if (carried) {
                messages.push(`Your ${name} ${plural ? 'dilute' : 'dilutes'} further.`);
            }
            object.otyp = POT_WATER;
            object.dknown = false;
            object.blessed = false;
            object.cursed = false;
            object.odiluted = 0;
            return 'damaged';
        }
        else if (object.otyp !== POT_WATER) {
            if (carried)
                messages.push(`Your ${name} ${plural ? 'dilute' : 'dilutes'}.`);
            object.odiluted = 1;
            return 'damaged';
        }
        return 'nothing';
    }
    const rust = rustMetalObject(object, name, luckRoll);
    if (rust.kind === 'rustproof' && carried) {
        messages.push(`Somehow, your ${name} ${plural ? 'are' : 'is'} not affected by the oxidation.`);
    }
    else if (rust.outcome === 'damaged') {
        if (carried) {
            const suffix = rust.erosion === 3
                ? ' completely' : rust.erosion > 1 ? ' further' : '';
            messages.push(`Your ${name} ${plural ? 'rust' : 'rusts'}${suffix}!`);
        }
        if (object.owornmask)
            state._armorClassDirty = true;
    }
    return rust.outcome;
}
export async function waterDamageChain(objects, messages = [], state = game) {
    if (!objects)
        return messages;
    for (const object of [...objects]) {
        const result = await waterDamageObject(object, messages, state);
        if (result !== 'destroyed')
            continue;
        const index = objects.indexOf(object);
        if (index >= 0)
            objects.splice(index, 1);
    }
    return messages;
}
function extinguishLitObject(object, monster, state) {
    if (!object?.lamplit)
        return null;
    const humanoid = !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_HUMANOID);
    if (object.otyp === BRASS_LANTERN && humanoid) {
        return { kind: 'lantern-flickers', object };
    }
    if (!endObjectBurn(object, state, state.moves ?? 0))
        object.lamplit = false;
    return { kind: 'extinguished', object };
}
function rustObject(object, description, monster, state, roll, luckRoll) {
    if (!object)
        return { outcome: 'nothing' };
    const lightEffect = extinguishLitObject(object, monster, state);
    if (lightEffect)
        return { outcome: 'damaged', ...lightEffect };
    if (object.greased) {
        const greaseWashedOff = roll(2) === 0;
        if (greaseWashedOff)
            object.greased = false;
        // C water_damage(): monster-carried grease washes off without feedback.
        return { outcome: 'greased' };
    }
    return rustMetalObject(object, description, luckRoll);
}
function addWaterEffect(event, effect) {
    if (effect?.kind)
        event.effects.push(effect);
    return effect?.outcome || 'nothing';
}
function armorAt(monster, state, mask) {
    if (monster)
        return wornObject(monster, mask);
    return {
        [W_ARM]: state.uarm,
        [W_ARMC]: state.uarmc,
        [W_ARMH]: state.uarmh,
        [W_ARMS]: state.uarms,
        [W_ARMG]: state.uarmg,
        [W_ARMF]: state.uarmf,
        [W_ARMU]: state.uarmu,
    }[mask] || null;
}
function flammableArmor(object) {
    if (!object)
        return false;
    const material = OBJECT_MATERIAL[object.otyp] ?? 0;
    return (material >= 2 && material <= 8) || material === 18;
}
async function burnArmorObject(object, description, owner, emitMessage, calls) {
    if (!object || !flammableArmor(object))
        return false;
    if (object.oerodeproof && object.rknown)
        return false;
    if (object.oerodeproof || (object.blessed && rnl(4) === 0)) {
        calls?.push('rnl(4)');
        if (object.oerodeproof)
            object.rknown = true;
        return false;
    }
    if (object.blessed)
        calls?.push('rnl(4)');
    const erosion = object.oeroded ?? 0;
    if (erosion >= 3)
        return false;
    object.oeroded = erosion + 1;
    if (owner && emitMessage) {
        const suffix = erosion + 1 === 3 ? ' completely'
            : erosion ? ' further' : '';
        const verb = /(?:boots|gloves|shoes|scales)$/iu.test(description)
            ? 'smoulder' : 'smoulders';
        await emitMessage(`${owner()} ${description} ${verb}${suffix}!`);
    }
    return true;
}
export async function burnArmorByFire(victim, state, emitMessage, calls = [], random = rn2, { visible = victim === state.u, } = {}) {
    const monster = 'mnum' in victim ? victim : null;
    if (victim !== state.u && !monster)
        throw new TypeError('Armor damage requires the live hero or a monster.');
    const hero = monster === null;
    const owner = !monster ? () => 'Your'
        : visible ? () => possessiveName(monsterName(monster, { state, capitalized: true })) : null;
    const inventory = monster ? inventoryOf(monster) : state.inventory;
    for (const towel of inventory) {
        const wetness = towel.otyp === TOWEL ? towel.spe ?? 0 : 0;
        if (wetness <= 0)
            continue;
        const newWetness = recordRoll(random, calls, wetness + 1);
        if (newWetness === wetness)
            continue;
        towel.spe = newWetness;
        if (visible && owner && emitMessage) {
            await emitMessage(`${owner()} towel dries${newWetness ? '' : ' out'}.`);
        }
        break;
    }
    for (;;) {
        const slot = recordRoll(random, calls, 5);
        let object = null;
        let description = '';
        let torso = false;
        if (slot === 0) {
            object = armorAt(monster, state, W_ARMH);
            description = object
                ? `${OBJECT_MATERIAL_NAMES[objectMaterial(object, state)]} ${armorSimpleName(object, state)}`
                : 'helmet';
        }
        else if (slot === 1) {
            torso = true;
            object = armorAt(monster, state, W_ARMC)
                || armorAt(monster, state, W_ARM)
                || armorAt(monster, state, W_ARMU);
            description = !object ? 'armor'
                : object === armorAt(monster, state, W_ARM)
                    ? objectCombatName(object, { state }) : armorSimpleName(object, state);
        }
        else if (slot === 2) {
            object = armorAt(monster, state, W_ARMS);
            description = 'wooden shield';
        }
        else if (slot === 3) {
            object = armorAt(monster, state, W_ARMG);
            description = 'gloves';
        }
        else {
            object = armorAt(monster, state, W_ARMF);
            description = 'boots';
        }
        const damaged = await burnArmorObject(object, description, owner, emitMessage, calls);
        if (hero && damaged)
            state._armorClassDirty = true;
        if (torso)
            return true;
        if (damaged)
            return false;
    }
}
export function burnHeroArmorByFire(state, emitMessage, calls = [], random = rn2) {
    return burnArmorByFire(state.u, state, emitMessage, calls, random);
}
export async function applyMonsterRustTrap(monster, state, { roll = rn2, luckRoll = rnl, } = {}) {
    const targetRoll = roll(5);
    const event = {
        kind: 'rust-trap', target: 'body', effects: [],
        damage: 0, killed: false,
    };
    if (targetRoll === 0) {
        event.target = 'head';
        const helmet = wornObject(monster, W_ARMH);
        addWaterEffect(event, rustObject(helmet, helmet ? armorSimpleName(helmet, state) : 'helm', monster, state, roll, luckRoll));
    }
    else if (targetRoll === 1) {
        event.target = 'left-arm';
        const shield = wornObject(monster, W_ARMS);
        const shieldResult = addWaterEffect(event, rustObject(shield, 'shield', monster, state, roll, luckRoll));
        if (shieldResult === 'nothing') {
            const weapon = monsterWieldedWeapon(monster);
            if (weapon && OBJECT_BIMANUAL[weapon.otyp]) {
                addWaterEffect(event, rustObject(weapon, objectDescription(weapon, 'weapon'), monster, state, roll, luckRoll));
            }
            const gloves = wornObject(monster, W_ARMG);
            addWaterEffect(event, rustObject(gloves, gloves ? armorSimpleName(gloves, state) : 'gloves', monster, state, roll, luckRoll));
        }
    }
    else if (targetRoll === 2) {
        event.target = 'right-arm';
        const weapon = monsterWieldedWeapon(monster);
        addWaterEffect(event, rustObject(weapon, objectDescription(weapon, 'weapon'), monster, state, roll, luckRoll));
        const gloves = wornObject(monster, W_ARMG);
        addWaterEffect(event, rustObject(gloves, gloves ? armorSimpleName(gloves, state) : 'gloves', monster, state, roll, luckRoll));
    }
    else {
        event.target = 'body';
        for (const object of inventoryOf(monster)) {
            if (!object.lamplit
                || ((object.owornmask ?? 0) & (W_WEP | W_SWAPWEP))) {
                continue;
            }
            const effect = extinguishLitObject(object, monster, state);
            if (effect)
                event.effects.push(effect);
        }
        const torso = wornObject(monster, W_ARMC)
            || wornObject(monster, W_ARM)
            || wornObject(monster, W_ARMU);
        addWaterEffect(event, rustObject(torso, torso ? armorSimpleName(torso, state) : 'suit', monster, state, roll, luckRoll));
    }
    if (monster.mnum === PM_IRON_GOLEM) {
        event.completelyRusted = true;
    }
    else if (monster.mnum === PM_GREMLIN && roll(3) !== 0) {
        event.clone = await splitMonster(monster, state, { monsterMoving: true });
    }
    return event;
}
//# sourceMappingURL=trap.js.map