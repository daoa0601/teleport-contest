// Water, lava, fire, and monster rust-trap effects.
// C ref: trap.c lava_effects(), burnarmor(), trapeffect_rust_trap(),
// water_damage(), and erode_obj().
import { formatSeenMessage } from './hero_speech.js';
import { ANTI_MAGIC, ARROW_TRAP, BEAR_TRAP, DART_TRAP, FIRE_TRAP, HOLE, LANDMINE, LEVEL_TELEP, MAGIC_PORTAL, MAGIC_TRAP, MMOVE_DIED, MMOVE_MOVED, MMOVE_NOTHING, PIT, POLY_TRAP, ROCKTRAP, ROLLING_BOULDER_TRAP, RUST_TRAP, SLP_GAS_TRAP, SQKY_BOARD, SPIKED_PIT, STATUE_TRAP, TELEP_TRAP, TRAPDOOR, VIBRATING_SQUARE, WEB, Is_waterlevel, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU, W_SWAPWEP, W_WEP, isok, } from './const.js';
import { armorSimpleName, heroHasWaterWalking } from './armor.js';
import { fireDamageObject } from './fire_damage.js';
import { delobj } from './object_delete.js';
import { objectDescription as fullObjectDescription } from './object_description.js';
import { objectNameIsPlural, definiteName, objectCombatName, objectName, observeObjectForNaming, ownedObjectAction, ownedObjectName, simpleObjectName } from './objnam.js';
import { cansee, couldsee } from './vision.js';
import { endObjectBurn } from './light.js';
import { game, requireInitializedGame } from './gstate.js';
import { removeHeroEquipment, removeWornHeroItem } from './hero_equipment.js';
import { useUpInventoryStack } from './hero_inventory.js';
import { getObjectLocation } from './object_location.js';
import { MONSTER_FLAGS1, MONSTER_SIZE, MONSTER_SYMBOL, monsterIsHumanoid } from './monster_data.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { heroIsFlying } from './polyself.js';
import { isPoolAt, levelHasCeiling, monsterFliesOrFloats, monsterInAir } from './terrain_properties.js';
import { objectOwnershipPrefix } from './shk.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { BAG_OF_TRICKS, BRASS_LANTERN, CAN_OF_GREASE, CANDELABRUM_OF_INVOCATION, CHEST, ICE_BOX, FIRE_HORN, LARGE_BOX, OBJECT_BIMANUAL, OBJECT_MATERIAL_NAMES, OBJECT_NAMES, OBJECT_PROPERTY, OILSKIN_SACK, MAGIC_LAMP, OIL_LAMP, POT_ACID, POT_OIL, POT_WATER, RED_DRAGON_SCALE_MAIL, RED_DRAGON_SCALES, RIN_FIRE_RESISTANCE, SCR_BLANK_PAPER, SCR_FIRE, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_FIREBALL, SPE_NOVEL, TALLOW_CANDLE, TOWEL, WAN_FIRE, WAX_CANDLE, } from './object_data.js';
import { erodeObject } from './object_erosion.js';
import { learnObjectType, observeObject } from './object_knowledge.js';
import { blankNovel } from './object_cancellation.js';
import { displayColorName, displayLiquidName } from './display.js';
import { objectResistsDestruction } from './object_state.js';
import { objectMaterial } from './object_material.js';
import { impossible } from './diagnostics.js';
import { stopAllObjectTimers } from './object_timers.js';
import { d, rnl, rn2, rnd } from './rng.js';
import { DISCARDED_CALL_LOG, recordRandom } from './monster_action_types.js';
import { plineWithContinuation } from './pline.js';
import { canSeeMonster, canSpotMonster, map_trap, newsym } from './display.js';
import { dryTowel, wetTowel } from './towel.js';
import { verbForSubject } from './object_grammar.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { applyMonsterAntiMagicTrap, finishMonsterAntiMagicTrap, monsterHasMagicResistance, } from './anti_magic_trap.js';
import { beginMonsterBearTrap, finishMonsterBearTrap } from './bear_trap.js';
import { beginMonsterFireTrap, finishMonsterFireTrap } from './fire_trap.js';
import { beginMonsterLandMine, finishMonsterLandMine, landMineNeedsResume, } from './landmine_trap.js';
import { beginMonsterPitTrap, finishMonsterPitTrap } from './monster_pit_trap.js';
import { beginMonsterRockTrap, finishMonsterRockTrap, rockTrapNeedsResume } from './rock_trap.js';
import { beginMonsterProjectileTrap, finishMonsterProjectileTrap, projectileTrapNeedsResume, } from './projectile_trap.js';
import { beginMonsterSleepGasTrap, finishMonsterSleepGasTrap, sleepGasTrapNeedsResume, } from './sleep_gas_trap.js';
import { beginMonsterSqueakyBoard, finishMonsterSqueakyBoard } from './squeaky_board_trap.js';
import { beginMonsterVibratingSquare, finishMonsterVibratingSquare, } from './vibrating_square_trap.js';
import { applyMonsterPolymorphTrap, finishMonsterPolymorphTrap } from './polymorph_trap.js';
import { beginMonsterRustTrap, finishMonsterRustTrap } from './rust_trap.js';
import { finishMonsterWebTrap } from './web_trap.js';
import { tryMonsterTrapEscape } from './monster_trap_escape.js';
import { launchRollingBoulder } from './rolling_boulder.js';
import { teleportMonsterFromTrap, teleportMonsterThroughHole, teleportMonsterThroughPortal, teleportMonsterToRandomLevel, } from './teleport.js';
import { canFallThrough } from './mklev.js';
import { monsterKnowsTrap, monsterLearnsTrap, monstersSeeTrap } from './trap_knowledge.js';
import { angerMonster } from './monster_anger.js';
import { monsterName as canonicalMonsterName } from './monster_name.js';
import { monsterResistsSleep } from './monster_sleep.js';
import { monsterHasFireResistance } from './monster_resistance.js';
import { maybeUnhideAt } from './monster_hiding.js';
import { completeMovedMonsterAction, moveMonsterAfterTrap, requireMovementCapabilities, } from './monmove.js';
// C trap.c:seetrap(). Reveal a new trap and redraw its square.
export async function seeTrap(trap, state = game) {
    if (trap.tseen)
        return;
    trap.tseen = true;
    if (state === game)
        await newsym(trap.tx, trap.ty);
}
// C trap.c:feeltrap(). Touch maps even a known trap without requiring sight.
export async function feelTrap(trap, state = game) {
    trap.tseen = true;
    if (state === game) {
        await map_trap(trap, true);
        await newsym(trap.tx, trap.ty);
    }
}
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
const M1_FLY = 0x00000001;
const M1_AMORPHOUS = 0x00000004;
const M1_CLING = 0x00000010;
const M1_MINDLESS = 0x00010000;
const M1_UNSOLID = 0x00100000;
const S_EYE = 5;
const S_LIGHT = 25;
const S_VORTEX = 22;
const PM_AIR_ELEMENTAL = 154;
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
            // C: The(xname(obj)) glows a strange hcolor("dark red").
            if (showMessages && !heroIsBlind(state)) {
                observeObject(object, state);
                await publish(`The ${objectName(object, state)} glows a strange ${displayColorName('dark red', state)}, but remains intact.`);
            }
            continue;
        }
        if (!object.in_use)
            continue;
        const wasWorn = !!object.worn || !!object.owornmask;
        if (showMessages && wasWorn) {
            await publish(`${ownedObjectAction(object, 'burst', state)} into flame!`);
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
                    await publish(formatSeenMessage(`${await fullObjectDescription(object, { state })} hit lava and burn up!`, state));
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
function objectContents(object) {
    return object.contents || [];
}
function carriedByHero(object, state) {
    return (state.inventory || []).includes(object);
}
function heroLanternIsDunked(state) {
    if (!isPoolAt(state.u.ux, state.u.uy, state))
        return false;
    return Is_waterlevel(state.u.uz)
        || !(state.u?.levitating || state.levitating
            || heroIsFlying(state) || heroHasWaterWalking(state));
}
// C splash_lit()/snuff_lit(): each message precedes end_burn(), so the
// darkened view waits for the next flush instead of preceding the message.
export async function splashLitObject(object, publish, state = game) {
    if (!object?.lamplit)
        return false;
    // snuff_lit() handles flames and lanterns, not magical light sources.
    if (![OIL_LAMP, MAGIC_LAMP, BRASS_LANTERN, POT_OIL,
        TALLOW_CANDLE, WAX_CANDLE, CANDELABRUM_OF_INVOCATION].includes(object.otyp))
        return false;
    const carried = carriedByHero(object, state);
    let dunkedLantern = false;
    if (object.otyp === BRASS_LANTERN) {
        let visible = false, audible = false, snuff = true;
        if (carried) {
            visible = !heroIsBlind(state);
            audible = !heroIsDeaf(state);
            dunkedLantern = heroLanternIsDunked(state);
            snuff = false;
        }
        else if (object.where === 'minvent' && object.ocarry
            && monsterIsHumanoid(object.ocarry.mnum)) {
            const carrier = object.ocarry;
            const position = getObjectLocation(object, state);
            visible = !!position && cansee(position.x, position.y);
            audible = couldsee(carrier.mx, carrier.my)
                && (carrier.mx - state.u.ux) ** 2 + (carrier.my - state.u.uy) ** 2 < 25;
            dunkedLantern = isPoolAt(carrier.mx, carrier.my, state)
                && (!monsterFliesOrFloats(carrier) || Is_waterlevel(state.u.uz));
            snuff = false;
        }
        if (visible || audible) {
            const action = audible && visible
                ? 'crackles and flickers'
                : audible ? 'crackles' : 'flickers';
            await publish(`${ownedObjectName(object, state)} ${action}.`);
        }
        if (!dunkedLantern && !snuff)
            return false;
    }
    const position = getObjectLocation(object, state);
    const visible = object.where === 'minvent'
        ? !!position && cansee(position.x, position.y) : !heroIsBlind(state);
    if (visible) {
        const candle = object.otyp === TALLOW_CANDLE || object.otyp === WAX_CANDLE;
        if (candle || object.otyp === CANDELABRUM_OF_INVOCATION) {
            const many = candle ? object.quan > 1 : object.spe > 1;
            await publish(`${objectOwnershipPrefix(object, state, { capitalized: true })}${candle ? '' : "candelabrum's "}candle${many ? "s' flames are" : "'s flame is"} extinguished.`);
        }
        else {
            const plural = objectNameIsPlural(object, state);
            await publish(`${ownedObjectName(object, state)} ${plural ? 'go' : 'goes'} out!`);
        }
    }
    if (!endObjectBurn(object, state, state.moves ?? 0))
        object.lamplit = false;
    if (dunkedLantern) {
        const age = object.age ?? 0;
        object.age = age - (age > 200 ? 100 : Math.trunc(age / 2));
    }
    return true;
}
function rustMetalObject(object, description, luckRoll) {
    if (!object || objectMaterial(object.otyp) !== 11)
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
export async function waterDamageObject(object, messages = [], state = game, { force = false, description = null, random = rn2, luckRoll = rnl, rollOne = rnd, publish, mentionWater, acidContext, position } = {}) {
    if (!object)
        return 'nothing';
    const emit = async (message) => {
        if (publish)
            await publish(message);
        else
            messages.push(message);
    };
    if (await splashLitObject(object, emit, state))
        return 'damaged';
    const name = description ?? objectCombatName(object, { state });
    const carried = carriedByHero(object, state);
    const plural = verbForSubject(name, 'are') === 'are';
    const spe = object.spe ?? 0;
    if (object.otyp === CAN_OF_GREASE && spe > 0)
        return 'nothing';
    if (object.otyp === TOWEL && spe < 7) {
        await wetTowel(object, -rollOne(7 - spe), { state, verbose: true, publish: emit });
        return 'nothing';
    }
    if (object.greased) {
        if (random(2) !== 0)
            return 'greased';
        object.greased = false;
        if (carried) {
            observeObjectForNaming(object, { state });
            await emit(`The grease on ${ownedObjectName(object, state, { capitalized: false })} washes off.`);
        }
        // C water_damage(): washed-off acid bypasses luck protection.
        if (object.otyp === POT_ACID)
            return await destroyWetAcidPotion(object, carried, emit, state, acidContext);
        return 'greased';
    }
    if (object.otyp >= LARGE_BOX && object.otyp <= BAG_OF_TRICKS) {
        const waterproof = [OILSKIN_SACK, ICE_BOX, LARGE_BOX, CHEST].includes(object.otyp);
        if (!waterproof || object.cursed && random(3) === 0) {
            if (carried) {
                await emit(`Some ${displayLiquidName('water', state)} gets into your ${name}!`);
                if (!heroIsHallucinating(state))
                    mentionWater?.();
            }
            await damageWaterChain(objectContents(object), messages, state, { random, luckRoll, rollOne, publish: emit,
                ...(position ? { position } : {}),
                ...(acidContext ? { acidContext } : {}) });
        }
        else if (carried && !heroIsBlind(state) && !state.underwater) {
            await emit(`The ${displayLiquidName('water', state)} cannot get into your ${name}.`);
            if (!heroIsHallucinating(state))
                mentionWater?.();
            learnObjectType(object.otyp, state);
        }
        return 'damaged';
    }
    const luck = (state.u.uluck ?? 0) + (state.u.moreluck ?? 0);
    if (!force && luck + 5 > random(20))
        return 'nothing';
    if (object.oclass === 9) {
        if (object.otyp === SCR_BLANK_PAPER)
            return 'nothing';
        if (carried)
            await emit(`Your ${name} ${plural ? 'fade' : 'fades'}.`);
        object.otyp = SCR_BLANK_PAPER;
        object.dknown = false;
        object.spe = 0;
        return 'damaged';
    }
    if (object.oclass === 10) {
        if (object.otyp === SPE_BOOK_OF_THE_DEAD) {
            const position = getObjectLocation(object, state, { contained: true, buried: true });
            if (position) {
                object.ox = position.x;
                object.oy = position.y;
                if (isok(position.x, position.y) && cansee(position.x, position.y))
                    await emit(`Steam rises from ${definiteName(objectCombatName(object, { state, includeCorpseSpecies: false }), state)}.`);
            }
            return 'nothing';
        }
        if (object.otyp === SPE_BLANK_PAPER)
            return 'nothing';
        const novel = object.otyp === SPE_NOVEL;
        if (carried)
            await emit(`Your ${name} ${plural ? 'fade' : 'fades'}.`);
        if (object.spestudied)
            object.spestudied = random(object.spestudied);
        object.otyp = SPE_BLANK_PAPER;
        object.dknown = false;
        if (novel)
            blankNovel(object);
        return 'damaged';
    }
    if (object.oclass === 8) {
        if (object.otyp === POT_ACID) {
            return await destroyWetAcidPotion(object, false, emit, state, acidContext);
        }
        if (object.odiluted) {
            if (carried)
                await emit(`Your ${name} ${plural ? 'dilute' : 'dilutes'} further.`);
            object.otyp = POT_WATER;
            object.dknown = false;
            object.blessed = false;
            object.cursed = false;
            object.buc = 'uncursed';
            object.odiluted = false;
            return 'damaged';
        }
        if (object.otyp === POT_WATER)
            return 'nothing';
        if (carried)
            await emit(`Your ${name} ${plural ? 'dilute' : 'dilutes'}.`);
        object.odiluted = true;
        return 'damaged';
    }
    return erodeObject(object, 'rust', { state, publish: emit, random, luckRandom: luckRoll,
        grease: false, displayName: name, ...(position ? { position } : {}) });
}
// C pot_acid_damage(): water destroys the bottle without impact or vapors.
async function destroyWetAcidPotion(object, described, emit, state, context) {
    if (heroIsBlind(state) && !carriedByHero(object, state))
        object.dknown = false;
    const plural = object.quan !== 1;
    const repeated = context?.valid && (object.dknown
        ? context.knownExplosions : context.unknownExplosions) > 0;
    const prefix = repeated ? plural ? 'More' : 'Another' : plural ? 'Some' : 'A';
    await emit(described ? `The potion${plural ? 's explode' : ' explodes'}!`
        : `${prefix} ${simpleObjectName(object, state)} ${plural ? 'explode' : 'explodes'}!`);
    if (context?.valid) {
        if (object.dknown)
            context.knownExplosions++;
        else
            context.unknownExplosions++;
    }
    await removeHeroEquipment(object, state);
    await delobj(object, state);
    return 'destroyed';
}
export async function waterDamageChain(objects, messages = [], state = game, options = {}) {
    if (!objects)
        return messages;
    await damageWaterChain(objects, messages, state, options);
    return messages;
}
async function damageWaterChain(objects, messages, state, options) {
    if (!objects.length)
        return;
    const context = options.acidContext ?? {
        valid: false, knownExplosions: 0, unknownExplosions: 0,
    };
    context.valid = true;
    context.knownExplosions = context.unknownExplosions = 0;
    try {
        for (const object of [...objects]) {
            const result = await waterDamageObject(object, messages, state, { ...options, acidContext: context });
            if (result !== 'destroyed')
                continue;
            const index = objects.indexOf(object);
            if (index >= 0)
                objects.splice(index, 1);
        }
    }
    finally {
        // Native nested chains end the shared acid context rather than restoring it.
        context.valid = false;
        context.knownExplosions = context.unknownExplosions = 0;
    }
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
export async function burnArmorByFire(victim, state, emitMessage, calls = [], random = rn2, { visible = victim === state.u, } = {}) {
    const monster = 'mnum' in victim ? victim : null;
    if (victim !== state.u && !monster)
        throw new TypeError('Armor damage requires the live hero or a monster.');
    const hero = monster === null;
    const inventory = monster ? inventoryOf(monster) : state.inventory;
    for (const towel of inventory) {
        const wetness = towel.otyp === TOWEL ? towel.spe ?? 0 : 0;
        if (wetness <= 0)
            continue;
        const newWetness = recordRoll(random, calls, wetness + 1);
        if (newWetness === wetness)
            continue;
        await dryTowel(towel, newWetness, { state, verbose: visible, publish: emitMessage ?? null });
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
        const result = await erodeObject(object, 'burn', {
            state,
            random,
            luckRandom: range => {
                calls.push(`rnl(${range})`);
                return rnl(range);
            },
            displayName: description,
            publish: async (message) => {
                if (emitMessage && (hero || visible))
                    await emitMessage(message);
            },
        });
        if (torso)
            return true;
        if (result !== 'nothing')
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
                addWaterEffect(event, rustObject(weapon, objectCombatName(weapon, { state }), monster, state, roll, luckRoll));
            }
            const gloves = wornObject(monster, W_ARMG);
            addWaterEffect(event, rustObject(gloves, gloves ? armorSimpleName(gloves, state) : 'gloves', monster, state, roll, luckRoll));
        }
    }
    else if (targetRoll === 2) {
        event.target = 'right-arm';
        const weapon = monsterWieldedWeapon(monster);
        addWaterEffect(event, rustObject(weapon, weapon ? objectCombatName(weapon, { state }) : 'weapon', monster, state, roll, luckRoll));
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
    // A gremlin's split_mon() follows the gush report (finishMonsterRustTrap).
    if (monster.mnum === PM_IRON_GOLEM)
        event.completelyRusted = true;
    return event;
}
// ---------------------------------------------------------------------------
// C trap.c:mintrap() and the monster trap-effect completions it defers.
// ---------------------------------------------------------------------------
// C trap.c:t_at(). The level keeps at most one trap per square.
export function trapAt(state, x, y) {
    return state?.level?.traps?.find((trap) => trap.tx === x && trap.ty === y);
}
// C trap.c:floor_trigger(). These traps require contact with the floor even
// when their eventual effect (a dart or falling rock) could hit a flyer.
export function trapTriggeredByFloor(trap) {
    return [ARROW_TRAP, DART_TRAP, ROCKTRAP, SQKY_BOARD, BEAR_TRAP,
        LANDMINE, ROLLING_BOULDER_TRAP, SLP_GAS_TRAP, RUST_TRAP, FIRE_TRAP,
        PIT, SPIKED_PIT, HOLE, TRAPDOOR].includes(trap.ttyp);
}
// C ref: trap.c:m_harmless_trap().  mfndpos() marks only harmful traps in
// candidate info; dog_move() then applies its separate hero-seen 1/40 rule.
export function monsterTrapIsHarmless(monster, trap, state) {
    const speciesFlags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[monster.mnum];
    const airborne = speciesFlags & M1_FLY || symbol === S_EYE || symbol === S_LIGHT;
    const sokoban = state.level.flags.sokoban_rules;
    const floorTriggered = trapTriggeredByFloor(trap);
    if (!sokoban && floorTriggered && airborne)
        return true;
    const whirly = symbol === S_VORTEX || monster.mnum === PM_AIR_ELEMENTAL;
    switch (trap.ttyp) {
        case BEAR_TRAP:
            return ((MONSTER_SIZE[monster.mnum] ?? 2) <= 1 ||
                !!(speciesFlags & (M1_AMORPHOUS | M1_UNSOLID)) ||
                whirly);
        case WEB:
            return (!!(speciesFlags & (M1_AMORPHOUS | M1_UNSOLID)) ||
                [94, 96].includes(monster.mnum) ||
                whirly);
        case SLP_GAS_TRAP:
            return monsterResistsSleep(monster);
        case RUST_TRAP:
            return monster.mnum !== PM_IRON_GOLEM;
        case FIRE_TRAP:
            return monsterHasFireResistance(monster);
        case PIT:
        case SPIKED_PIT:
        case HOLE:
        case TRAPDOOR:
            return !!(speciesFlags & M1_CLING) && !sokoban;
        case ANTI_MAGIC:
            return monsterHasMagicResistance(monster);
        case STATUE_TRAP:
        case MAGIC_TRAP:
        case VIBRATING_SQUARE:
            return true;
        default:
            return false;
    }
}
// C trap.c:mintrap(). Called from m_move()/postmov() after a monster steps
// onto a square, and from the source effects below via the immediate entry.
export async function triggerMonsterTrap(monster, state, movement, random, rollDice, rollOne, calls, publish = plineWithContinuation) {
    const trap = trapAt(state, monster.mx, monster.my);
    if (!trap || monster.mtrapped)
        return null;
    const sokobanFall = state.level.flags.sokoban_rules && !trap.madeby_u
        && [PIT, SPIKED_PIT, HOLE, TRAPDOOR].includes(trap.ttyp);
    const fixedTeleport = trap.ttyp === TELEP_TRAP && trap.teledest
        && isok(trap.teledest.x, trap.teledest.y);
    const forced = movement.forcedTrapLanding || fixedTeleport;
    if (monster !== state.u.usteed && !sokobanFall && !forced) {
        if (monsterFliesOrFloats(monster) && trapTriggeredByFloor(trap))
            return null;
        const alreadyKnown = monsterKnowsTrap(monster, trap)
            || trap.ttyp === HOLE && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_MINDLESS);
        if (alreadyKnown && recordRandom(random, calls, 4) !== 0
            && !movement.forcedTrapBungle) {
            const event = { kind: 'known-trap-avoided', trap, damage: 0 };
            movement.trap = event;
            return event;
        }
    }
    monsterLearnsTrap(monster, trap);
    monstersSeeTrap(state, trap);
    if (trap.madeby_u && rnl(5))
        await angerMonster(monster);
    if (trap.ttyp === STATUE_TRAP) {
        // C mintrap() teaches the type before trapeffect_statue_trap()
        // declines to animate statues for monsters.
        return null;
    }
    if (trap.ttyp === MAGIC_PORTAL) {
        const event = await teleportMonsterThroughPortal(monster, trap, {
            state, random, force: !!movement.forcedTrapLanding, publish,
        });
        if (event) {
            movement.trap = event;
            movement.actorLeftLevel = true;
            movement.postMoveStatus = MMOVE_DIED;
            movement.actionCompleted = true;
        }
        return event;
    }
    if (trap.ttyp === LEVEL_TELEP) {
        const event = await teleportMonsterToRandomLevel(monster, trap, {
            state, random, rollOne, force: !!movement.forcedTrapLanding,
        });
        if (event) {
            movement.trap = event;
            movement.actorLeftLevel = true;
            movement.postMoveStatus = MMOVE_DIED;
            movement.actionCompleted = true;
        }
        return event;
    }
    if (trap.ttyp === TELEP_TRAP) {
        const event = await teleportMonsterFromTrap(monster, trap, {
            state,
            calls,
            random,
            rollOne,
            publish,
        });
        movement.trap = event;
        movement.postMoveStatus = MMOVE_DIED;
        movement.actionCompleted = true;
        if (event.relocation) {
            movement.x = event.relocation.x;
            movement.y = event.relocation.y;
            movement.moved = movement.oldx !== movement.x || movement.oldy !== movement.y;
        }
        return event;
    }
    if (trap.ttyp === RUST_TRAP) {
        const event = await beginMonsterRustTrap(monster, trap, state, {
            random: (range) => recordRandom(random, calls, range),
        });
        movement.trap = event;
        movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === PIT || trap.ttyp === SPIKED_PIT) {
        const event = beginMonsterPitTrap(monster, trap, state, {
            forced: !!movement.forcedTrapLanding,
        });
        if (!event)
            return null;
        movement.trap = event;
        movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === HOLE || trap.ttyp === TRAPDOOR) {
        // mintrap() handles avoidance and learning before trapeffect_hole()
        // discovers that this level has nowhere to fall.
        if (!canFallThrough(state.u.uz))
            return null;
        const clinging = !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_CLING) && levelHasCeiling(state);
        const airborne = monsterFliesOrFloats(monster) || clinging;
        const tooLarge = (MONSTER_SIZE[monster.mnum] ?? 2) >= 4;
        const longWorm = !!monster.wormno && (monster.wormSegments?.length ?? 0) > 5;
        if (airborne || tooLarge || longWorm) {
            const seen = canSeeMonster(monster) || monster === state.u.usteed;
            if (movement.forcedTrapLanding && !state.level.flags.sokoban_rules) {
                if (seen) {
                    await seeTrap(trap, state);
                    await publish(trap.ttyp === TRAPDOOR
                        ? `A trap door opens, but ${canonicalMonsterName(monster, { state })} doesn't fall through.`
                        : `${canonicalMonsterName(monster, { state, capitalized: true })} doesn't fall through the hole.`);
                }
                return null;
            }
            if (!movement.forcedTrapLanding && !sokobanFall)
                return null;
            if (seen) {
                await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} seems to be yanked down!`);
                await seeTrap(trap, state);
            }
        }
        const event = await teleportMonsterThroughHole(monster, trap, {
            state, force: !!movement.forcedTrapLanding, publish,
        });
        if (!event)
            return null;
        movement.trap = event;
        movement.actorLeftLevel = true;
        movement.postMoveStatus = MMOVE_DIED;
        movement.actionCompleted = true;
        return event;
    }
    if (trap.ttyp === ROLLING_BOULDER_TRAP) {
        // trap.c:trapeffect_rolling_boulder_trap()->launch_obj().  Airborne
        // actors do not depress the trigger even when forced.
        if (monsterInAir(monster, state))
            return null;
        const inSight = state.u.usteed === monster
            || cansee(monster.mx, monster.my) && canSpotMonster(monster);
        const wasSeen = !!trap.tseen;
        await newsym(monster.mx, monster.my);
        if (inSight)
            await publish(`${heroIsDeaf(state) ? '' : 'Click!  '}${canonicalMonsterName(monster, { state, capitalized: true })} triggers ${wasSeen ? 'a rolling boulder trap' : 'something'}.`);
        const launch = trap.launch;
        const endpoint = trap.launch2 ?? launch;
        const released = await launchRollingBoulder(launch, endpoint, {
            state, unseen: !inSight, publish, random, rollOne, rollDice,
        });
        if (released && inSight)
            trap.tseen = true;
        const event = {
            kind: 'rolling-boulder', trap,
            released, killed: !!monster.dead || monster.mhp <= 0,
            heroDied: !!state.program_state.gameover,
        };
        movement.trap = event;
        if (event.killed) {
            movement.actorDied = true;
            movement.postMoveStatus = MMOVE_DIED;
            movement.actionCompleted = true;
        }
        return event;
    }
    if (trap.ttyp === SQKY_BOARD) {
        const event = beginMonsterSqueakyBoard(monster, trap, state);
        if (!event)
            return null;
        movement.trap = event;
        movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === SLP_GAS_TRAP) {
        const event = await beginMonsterSleepGasTrap(monster, trap, state, {
            rollOne: (range) => {
                const result = rollOne(range);
                calls.push(`rnd(${range})`);
                return result;
            },
        });
        movement.trap = event;
        if (sleepGasTrapNeedsResume(event))
            movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === ARROW_TRAP || trap.ttyp === DART_TRAP) {
        const event = await beginMonsterProjectileTrap(monster, trap, state, {
            random: (range) => recordRandom(random, calls, range),
            rollOne: (range) => {
                const result = rollOne(range);
                calls.push(`rnd(${range})`);
                return result;
            },
        });
        movement.trap = event;
        if (projectileTrapNeedsResume(event))
            movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === ROCKTRAP) {
        const event = await beginMonsterRockTrap(monster, trap, state, {
            random: (range) => recordRandom(random, calls, range),
            rollDice: (count, sides) => {
                const result = rollDice(count, sides);
                calls.push(`d(${count},${sides})`);
                return result;
            },
        });
        movement.trap = event;
        if (rockTrapNeedsResume(event))
            movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === LANDMINE) {
        const event = beginMonsterLandMine(monster, trap, state, {
            random: (range) => recordRandom(random, calls, range),
            rollOne: (range) => {
                const result = rollOne(range);
                calls.push(`rnd(${range})`);
                return result;
            },
        });
        movement.trap = event;
        if (landMineNeedsResume(event))
            movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === FIRE_TRAP) {
        const event = beginMonsterFireTrap(monster, trap, state, {
            rollDice: (count, sides) => {
                const result = rollDice(count, sides);
                calls.push(`d(${count},${sides})`);
                return result;
            },
        });
        movement.trap = event;
        movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === WEB) {
        // trap.c:mintrap() checks learned-trap avoidance, then projects trap
        // knowledge, before delegating to trapeffect_web().  Only the effect
        // discovers that webmakers cross safely, so they still learn an
        // unknown web and own later avoidance probes.
        if ([94, 96].includes(monster.mnum))
            return null;
        const { inSight } = monsterTrapVisibility(monster, state);
        const event = {
            kind: 'web-trap',
            trap,
            visible: inSight,
            damage: 0,
            killed: false,
        };
        movement.trap = event;
        movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === MAGIC_TRAP) {
        // mintrap() still triggers traps which m_harmless_trap() allowed the
        // monster to enter.  A monster which has learned this trap type gets
        // the ordinary 3-in-4 avoidance check before the effect selector.
        const fire = recordRandom(random, calls, 21) === 0;
        if (fire) {
            const event = beginMonsterFireTrap(monster, trap, state, {
                rollDice: (count, sides) => {
                    const result = rollDice(count, sides);
                    calls.push(`d(${count},${sides})`);
                    return result;
                },
            });
            movement.trap = event;
            movement.deferredAfterMonsterTrap = true;
            return event;
        }
        const event = {
            kind: 'magic-trap',
            trap,
            damage: 0,
            killed: false,
        };
        movement.trap = event;
        return event;
    }
    if (trap.ttyp === ANTI_MAGIC) {
        const effect = await applyMonsterAntiMagicTrap(monster, {
            trap, state,
            rollDice: (count, sides) => {
                const result = rollDice(count, sides);
                calls.push(`d(${count},${sides})`);
                return result;
            },
            rollOne: (sides) => {
                const result = rollOne(sides);
                calls.push(`rnd(${sides})`);
                return result;
            },
        });
        const { inSight, seeSquare } = monsterTrapVisibility(monster, state);
        const event = {
            trap,
            ...effect,
            inSight,
            seeSquare,
            visible: inSight,
        };
        if (inSight && effect.energyDrain > 0)
            movement.deferredAfterMonsterTrap = true;
        if (effect.kind === 'anti-magic-damage')
            movement.deferredAfterMonsterTrap = true;
        if (effect.killed) {
            movement.actorDied = true;
            movement.actionCompleted = true;
        }
        movement.trap = event;
        return event;
    }
    if (trap.ttyp === POLY_TRAP) {
        const event = await applyMonsterPolymorphTrap(monster, trap, state, {
            random: (range) => recordRandom(random, calls, range),
        });
        movement.trap = event;
        if (!event.finished)
            movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === VIBRATING_SQUARE) {
        const event = beginMonsterVibratingSquare(monster, trap, state);
        movement.trap = event;
        if (!event.finished)
            movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp !== BEAR_TRAP)
        return null;
    const event = beginMonsterBearTrap(monster, trap, state, {
        forced: !!movement.forcedTrapLanding,
    });
    movement.trap = event;
    if (!event.finished || event.forced)
        movement.deferredAfterMonsterTrap = true;
    return event;
}
// C trap.c:mintrap() entry for actors placed by a source effect rather than
// by m_move()/postmov().  The trap engine remains the single state/RNG owner;
// this boundary intentionally does not run tunneling, pickup, concealment,
// distfleeck(), or an attack tail.  Callers must present and resume any
// deferred trap event before continuing their own source transaction.
export async function triggerImmediateMonsterTrap(monster, state = requireInitializedGame(), { inAir = false, force = false, forceBungle = false, random = rn2, rollDice = d, rollOne = rnd, publish = plineWithContinuation, } = {}) {
    const calls = DISCARDED_CALL_LOG;
    const movement = {
        oldx: monster?.mx,
        oldy: monster?.my,
        x: monster?.mx,
        y: monster?.my,
        moved: false,
        immediateTrap: true,
        forcedTrapLanding: force,
        forcedTrapBungle: forceBungle,
    };
    const trap = trapAt(state, monster.mx, monster.my);
    if (!trap) {
        monster.mtrapped = 0;
        return { monster, movement, event: null, calls };
    }
    const floorTriggered = trapTriggeredByFloor(trap);
    const sokobanFall = state.level.flags.sokoban_rules &&
        !trap.madeby_u &&
        [PIT, SPIKED_PIT, HOLE, TRAPDOOR].includes(trap.ttyp);
    // C mintrap() takes its already-trapped branch before any check_in_air().
    if (monster.mtrapped) {
        movement.escapingTrap = true;
        return { monster, movement, event: null, calls };
    }
    if (inAir && floorTriggered && !sokobanFall)
        return { monster, movement, event: null, calls };
    const event = await triggerMonsterTrap(monster, state, movement, random, rollDice, rollOne, calls, publish);
    return { monster, movement, event, calls };
}
// Finish the m_move()/postmov() tail which was interrupted by a deferred
// trap effect presentation. This is the continuation m_move() would have
// run synchronously in C.
async function continueAfterMonsterTrap(action, state, random, rollDice, rollOne, calls) {
    if (action.movement?.immediateTrap)
        return action;
    if (action.movement.postMoveStatus === MMOVE_MOVED)
        requireMovementCapabilities(action.movement).species = action.monster.mnum;
    await completeMovedMonsterAction(action.monster, action.movement, state, random, rollDice, rollOne, calls, action.dochugContext, { trapAlreadyHandled: true });
    return action;
}
// Complete mintrap() for a source effect without running a movement tail.
// C mintrap() gives an already trapped monster its escape roll whatever the
// caller's flags, so a monster caught mid-hurtle rolls again on landing.
export async function finishImmediateMonsterTrap(action, state = requireInitializedGame(), { publish = plineWithContinuation, random = rn2, rollOne = rnd, rollDice = d, finishDeath, describeMonster } = {}) {
    if (action.event?.kind === 'rolling-boulder')
        return action;
    await resumeDeferredMonsterTrap(action, state, {
        publish, random, rollOne, rollDice,
        ...(finishDeath ? { finishDeath } : {}),
        ...(describeMonster ? { describeMonster } : {}),
    });
    return action;
}
// Resume a deferred monster trap event: the trapped monster's escape roll,
// the deferred trap-effect completions, and the m_move() tail that follows.
export async function resumeDeferredMonsterTrap(action, state, { random = rn2, rollDice = d, rollOne = rnd, publish = plineWithContinuation, describeMonster, finishDeath = (monster, options) => finishEnvironmentalMonsterDeath(monster, state, options), } = {}) {
    const movement = action?.movement;
    if (movement?.escapingTrap) {
        await tryMonsterTrapEscape(action.monster, state, {
            random,
            publish,
            ...(describeMonster ? { describeMonster } : {}),
        });
        delete movement.escapingTrap;
        if (!movement.immediateTrap) {
            const held = action.monster.mtrapped
                ? {
                    ...movement,
                    trapped: true,
                    postMoveStatus: MMOVE_NOTHING,
                    movementStage: 'dochug',
                }
                : null;
            const next = await moveMonsterAfterTrap(action.monster, state, random, rollDice, rollOne, action.calls, action.dochugContext, held);
            action.movement = next.movement;
        }
        return action;
    }
    const event = movement?.trap;
    if (!movement?.deferredAfterMonsterTrap)
        return action;
    delete movement.deferredAfterMonsterTrap;
    const calls = action.calls || DISCARDED_CALL_LOG;
    const recordedRandom = (range) => recordRandom(random, calls, range);
    const recordedRollOne = (range) => {
        const result = rollOne(range);
        calls.push(`rnd(${range})`);
        return result;
    };
    if (!event)
        throw new Error('A deferred monster trap must retain its event');
    switch (event.kind) {
        case 'web-trap':
            await finishMonsterWebTrap(action.monster, event.trap, {
                state,
                publish,
                ...(describeMonster ? { subject: describeMonster } : {}),
            });
            break;
        case 'bear-trap':
            await finishMonsterBearTrap(action.monster, event, state, {
                publish,
                random,
                rollDice,
                ...(describeMonster ? { describeMonster } : {}),
            });
            break;
        case 'rust-trap':
            await finishMonsterRustTrap(action.monster, event, state, {
                publish,
                random: recordedRandom,
            });
            break;
        case 'projectile-trap':
        case 'spent-projectile-trap':
            await finishMonsterProjectileTrap(action.monster, event, state, {
                publish,
                random,
                rollOne: recordedRollOne,
                ...(describeMonster ? { describeMonster } : {}),
            });
            break;
        case 'anti-magic-drain':
        case 'anti-magic-damage': {
            const death = await finishMonsterAntiMagicTrap(action.monster, event, state, {
                random,
                publish,
                ...(describeMonster ? { describeMonster } : {}),
            });
            if (death) {
                event.death = death;
                if (death.survived) {
                    event.killed = false;
                    movement.actorDied = false;
                    movement.actionCompleted = false;
                }
            }
            break;
        }
        case 'fire-trap':
            await finishMonsterFireTrap(action.monster, event, state, {
                publish,
                random,
                rollOne,
                ...(describeMonster ? { describeMonster } : {}),
            });
            break;
        case 'land-mine': {
            // A victim relocated by the blast meets mintrap(FORCETRAP) at
            // its new square, which may end its stay on this level.
            const relocated = { action: null };
            await finishMonsterLandMine(action.monster, event, state, {
                finishDeath,
                publish,
                random: recordedRandom,
                rollOne: recordedRollOne,
                ...(describeMonster ? { describeMonster } : {}),
                forceTrapAtMonster: async (victim) => {
                    relocated.action = await finishImmediateMonsterTrap(await triggerImmediateMonsterTrap(victim, state, {
                        force: true, random: recordedRandom, rollOne: recordedRollOne,
                        rollDice, publish,
                    }), state, {
                        publish, random: recordedRandom, rollOne: recordedRollOne, rollDice,
                        finishDeath,
                        ...(describeMonster ? { describeMonster } : {}),
                    });
                },
            });
            const nested = relocated.action?.movement;
            if (nested?.heroDied)
                movement.heroDied = true;
            if (nested?.actorLeftLevel && !movement.heroDied) {
                movement.actorLeftLevel = true;
                movement.actionCompleted = true;
                return action;
            }
            break;
        }
        case 'pit-trap':
            await finishMonsterPitTrap(action.monster, event, {
                publish,
                random,
                rollOne: recordedRollOne,
                ...(describeMonster ? { describeMonster } : {}),
                state,
            });
            break;
        case 'falling-rock':
        case 'spent-rock-trap':
            await finishMonsterRockTrap(action.monster, event, state, {
                publish,
                random,
                ...(describeMonster ? { describeMonster } : {}),
            });
            break;
        case 'sleep-gas':
            await finishMonsterSleepGasTrap(action.monster, event, {
                state,
                publish,
                ...(describeMonster ? { describeMonster } : {}),
            });
            break;
        case 'squeaky-board':
            await finishMonsterSqueakyBoard(action.monster, event, state, {
                publish,
            });
            break;
        case 'vibrating-square':
            await finishMonsterVibratingSquare(action.monster, event, {
                state,
                publish,
            });
            break;
        case 'polymorph-trap':
            await finishMonsterPolymorphTrap(event, {
                finishDeath,
                publish,
                state,
            });
            break;
        case 'anti-magic':
        case 'anti-magic-shoes':
        case 'known-trap-avoided':
        case 'level-fall-migration':
        case 'level-migration':
        case 'limbo-migration':
        case 'magic-portal-migration':
        case 'magic-trap':
        case 'rolling-boulder':
        case 'shop-return':
        case 'teleport-trap':
            throw new Error(`Trap ${event.kind} has no ordinary deferred continuation`);
    }
    // C trap.c:3831-3837: a monster newly caught by the trap cannot stay
    // hidden under an object; a first sighting reports that it appears.
    if (!action.monster.dead && (action.monster.mhp ?? 0) > 0
        && action.monster.mtrapped) {
        const alreadySpotted = canSpotMonster(action.monster);
        await maybeUnhideAt(action.monster.mx, action.monster.my, state);
        if (!alreadySpotted && canSeeMonster(action.monster)) {
            await publish(`${canonicalMonsterName(action.monster, {
                state, capitalized: true, article: 'a',
            })} appears.`);
        }
    }
    if (('heroDied' in event && event.heroDied)
        || ('death' in event && event.death?.heroDied)
        || state.program_state.gameover) {
        movement.heroDied = true;
        return action;
    }
    if ('killed' in event && event.killed) {
        movement.actorDied = true;
        movement.postMoveStatus = MMOVE_DIED;
        movement.actionCompleted = true;
        return action;
    }
    await continueAfterMonsterTrap(action, state, random, rollDice, rollOne, calls);
    return action;
}
//# sourceMappingURL=trap.js.map