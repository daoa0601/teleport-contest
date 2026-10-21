// Water, lava, fire, and monster rust-trap effects.
// C ref: trap.c lava_effects(), burnarmor(), trapeffect_rust_trap(),
// water_damage(), and erode_obj().

import { formatSeenMessage } from './hero_speech.js';
import {
    Is_waterlevel, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH,
    W_ARMS, W_ARMU, W_SWAPWEP, W_WEP, isok,
} from './const.js';
import { armorSimpleName, heroHasWaterWalking } from './armor.js';
import { fireDamageObject } from './fire_damage.js';
import { delobj } from './object_delete.js';
import { objectDescription as fullObjectDescription } from './object_description.js';
import { objectNameIsPlural, definiteName, objectCombatName, observeObjectForNaming, ownedObjectAction, ownedObjectName, simpleObjectName } from './objnam.js';
import { cansee, couldsee } from './vision.js';
import { endObjectBurn } from './light.js';
import { game } from './gstate.js';
import { removeHeroEquipment, removeWornHeroItem } from './hero_equipment.js';
import { useUpInventoryStack } from './hero_inventory.js';
import { getObjectLocation } from './object_location.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { heroIsFlying } from './polyself.js';
import { isPoolAt, monsterFliesOrFloats } from './terrain_properties.js';
import { objectOwnershipPrefix } from './shk.js';
import { MONSTER_FLAGS1, monsterIsHumanoid } from './monster_data.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import {
    BAG_OF_TRICKS, BRASS_LANTERN, CAN_OF_GREASE, CANDELABRUM_OF_INVOCATION, CHEST, ICE_BOX,
    FIRE_HORN, LARGE_BOX, OBJECT_BIMANUAL, OBJECT_MATERIAL_NAMES, OBJECT_NAMES, OBJECT_PROPERTY, OILSKIN_SACK,
    MAGIC_LAMP, OIL_LAMP, POT_ACID, POT_OIL, POT_WATER, RED_DRAGON_SCALE_MAIL, RED_DRAGON_SCALES,
    RIN_FIRE_RESISTANCE, SCR_BLANK_PAPER, SCR_FIRE, SPE_BLANK_PAPER,
    SPE_BOOK_OF_THE_DEAD, SPE_FIREBALL, SPE_NOVEL, TALLOW_CANDLE, TOWEL, WAN_FIRE, WAX_CANDLE,
} from './object_data.js';
import { erodeObject } from './object_erosion.js';
import { learnObjectType } from './object_knowledge.js';
import { blankNovel } from './object_cancellation.js';
import { displayLiquidName } from './display.js';
import { objectResistsDestruction } from './object_state.js';
import { objectMaterial } from './object_material.js';
import { impossible } from './diagnostics.js';
import { stopAllObjectTimers } from './object_timers.js';
import { rnl, rn2, rnd } from './rng.js';
import type { MessagePublisher } from './display.js';
import { canSeeMonster, map_trap, newsym } from './display.js';
import { dryTowel, wetTowel } from './towel.js';
import type { GameState } from './game_state.js';
import type { Hero } from './hero_types.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { Trap } from './map_types.js';
import type { MonsterCallLog, RandomBelow } from './monster_action_types.js';
import { verbForSubject } from './object_grammar.js';

type CallRecorder = Pick<MonsterCallLog, 'push'>;
type ArmorMask = typeof W_ARM | typeof W_ARMC | typeof W_ARMH
    | typeof W_ARMS | typeof W_ARMG | typeof W_ARMF | typeof W_ARMU;

// C trap.c:seetrap(). Reveal a new trap and redraw its square.
export function seeTrap(trap: Trap, state: GameState = game): void {
    if (trap.tseen) return;
    trap.tseen = true;
    if (state === game) newsym(trap.tx, trap.ty);
}

// C trap.c:feeltrap(). Touch maps even a known trap without requiring sight.
export function feelTrap(trap: Trap, state: GameState = game): void {
    trap.tseen = true;
    if (state === game) {
        map_trap(trap, true);
        newsym(trap.tx, trap.ty);
    }
}

interface LavaInventoryOptions {
    state?: GameState;
    publish?: MessagePublisher;
    protectedObject: GameObject | null;
    showMessages?: boolean;
    previouslyAnnounced?: number;
}

interface LavaFloorOptions {
    state?: GameState;
    publish?: MessagePublisher;
    random?: RandomBelow;
    visible?: boolean;
    x?: number;
    y?: number;
}

interface WaterDamageOptions {
    force?: boolean;
    description?: string | null;
    random?: RandomBelow;
    luckRoll?: RandomBelow;
    rollOne?: typeof rnd;
    publish?: MessagePublisher;
    mentionWater?: () => void;
    acidContext?: WaterAcidContext;
}

interface WaterAcidContext {
    valid: boolean;
    knownExplosions: number;
    unknownExplosions: number;
}

export type WaterDamageOutcome = 'nothing' | 'damaged' | 'destroyed' | 'greased';

interface LightWaterEffect {
    kind: 'lantern-flickers' | 'extinguished';
    object: GameObject;
    description?: string;
}

interface RustProofEffect {
    kind: 'rustproof';
    outcome: 'nothing';
    object: GameObject;
    description: string;
}

interface RustDamageEffect {
    kind: 'rusted';
    outcome: 'damaged';
    object: GameObject;
    description: string;
    erosion: number;
}

type MetalRustResult = { outcome: 'nothing'; kind?: never }
    | RustProofEffect | RustDamageEffect;
type RustResult = MetalRustResult | { outcome: 'greased'; kind?: never }
    | (LightWaterEffect & { outcome: 'damaged' });

export type WaterObjectEffect = LightWaterEffect | RustProofEffect
    | RustDamageEffect;

export interface MonsterRustTrapEvent {
    kind: 'rust-trap';
    effects: WaterObjectEffect[];
    target: 'head' | 'left-arm' | 'right-arm' | 'body';
    damage: number;
    killed: boolean;
    completelyRusted?: boolean;
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

function lavaCanBurnObject(object: GameObject | null | undefined, random: RandomBelow): boolean {
    if (!object || object.in_use || object.oerodeproof) return false;
    const organic = objectMaterial(object) <= 8;
    if (!organic && object.oclass !== POTION_CLASS) return false;
    if (FIRE_RESISTANT_OBJECTS.has(object.otyp)
        || object.otyp === SCR_FIRE || object.otyp === SPE_FIREBALL)
        return false;
    return !objectResistsDestruction(object, 0, 0, random);
}

// C trap.c:lava_effects() flags all doomed items before any death message.
export async function markLavaInventoryForDestruction(
    state: GameState, random: RandomBelow,
): Promise<GameObject | null> {
    let protectedObject: GameObject | null = null;
    for (const object of state.inventory) {
        if (object.in_use) {
            if (!protectedObject) {
                protectedObject = object;
                object.in_use = false;
            } else {
                await impossible(`lava_effects: object #${object.o_id} is already in use; so is #${protectedObject.o_id}.`);
            }
            continue;
        }
        if (lavaCanBurnObject(object, random)) object.in_use = true;
    }
    return protectedObject;
}

export async function destroyLavaInventory({
    state = game,
    publish = async () => {},
    protectedObject,
    showMessages = false,
    previouslyAnnounced = 0,
}: LavaInventoryOptions): Promise<number> {
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
                await publish(
                    'The Book of the Dead glows a strange dark red, '
                    + 'but remains intact.',
                );
            }
            continue;
        }
        if (!object.in_use) continue;
        const wasWorn = !!object.worn || !!object.owornmask;
        if (showMessages && wasWorn) {
            await publish(`${ownedObjectAction(object, 'burst', state)} into flame!`);
            named++;
        } else {
            unnamed++;
        }
        await removeWornHeroItem(object, state);
        if (state.program_state?.gameover) return named + unnamed - previouslyAnnounced;
        await useUpInventoryStack(object, state);
        if (state.program_state?.gameover) return named + unnamed - previouslyAnnounced;
    }

    if (showMessages && unnamed) {
        const subject = named
            ? unnamed === 1 ? 'Another item' : 'Other items'
            : unnamed === 1 ? 'An item' : 'Some items';
        await publish(`${subject} in your inventory ${
            unnamed === 1 ? 'has' : 'have'
        } been destroyed.`);
    }
    return named + unnamed - previouslyAnnounced;
}

export async function destroyLavaFloorObjects(
    objects: GameObject[] | null | undefined,
    {
        state = game,
        publish = async () => {},
        random = rn2,
        visible = false,
        x,
        y,
    }: LavaFloorOptions = {},
): Promise<number> {
    if (!objects) return 0;
    let destroyed = 0;
    for (const object of [...objects]) {
        // lava_damage() screens every object before checking its material.
        // A destroyed object also passes through delobj() independently.
        if (objectResistsDestruction(object, 0, 0, random)
            && object.otyp !== SPE_BOOK_OF_THE_DEAD) continue;
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
                } else {
                    observeObjectForNaming(object, { state });
                    await publish(formatSeenMessage(`${fullObjectDescription(object, { state })} hit lava and burn up!`, state));
                }
            }
            await delobj(object, state, random);
        } else if (!await fireDamageObject(object, {
            force: true, state, publish, random, x: landingX, y: landingY,
        })) {
            continue;
        }
        const index = objects.indexOf(object);
        if (index >= 0) objects.splice(index, 1);
        destroyed++;
    }
    return destroyed;
}

function recordRoll(random: RandomBelow, calls: CallRecorder | null | undefined, range: number): number {
    calls?.push(range);
    return random(range);
}

function inventoryOf(monster: Monster | null | undefined): GameObject[] {
    return monster?.minvent || monster?.inventory || [];
}

export function monsterTrapVisibility(monster: Monster, state = game): { inSight: boolean; seeSquare: boolean } {
    const blind = !!state?.blind || (state?.u?.blindTurns ?? 0) > 0;
    const seeSquare = !blind
        && !!((state?.viz_array?.[monster.my]?.[monster.mx] ?? 0) & 0x2);
    const inSight = state?.u?.usteed === monster
        || canSeeMonster(monster);
    return { inSight, seeSquare };
}

function wornObject(monster: Monster | null | undefined, mask: ArmorMask): GameObject | null {
    return inventoryOf(monster).find(object =>
        ((object.owornmask ?? 0) & mask) !== 0) || null;
}

function objectContents(object: GameObject): GameObject[] {
    return object.contents || [];
}

function carriedByHero(object: GameObject, state: GameState): boolean {
    return (state.inventory || []).includes(object);
}

function heroLanternIsDunked(state: GameState): boolean {
    if (!isPoolAt(state.u.ux, state.u.uy, state)) return false;
    return Is_waterlevel(state.u.uz)
        || !(state.u?.levitating || state.levitating
            || heroIsFlying(state) || heroHasWaterWalking(state));
}

export function splashLitObject(object: GameObject | null | undefined, messages: string[] = [], state = game): boolean {
    if (!object?.lamplit) return false;
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
        } else if (object.where === 'minvent' && object.ocarry
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
            messages.push(`${ownedObjectName(object, state)} ${action}.`);
        }
        if (!dunkedLantern && !snuff) return false;
    }

    const position = getObjectLocation(object, state);
    const visible = object.where === 'minvent'
        ? !!position && cansee(position.x, position.y) : !heroIsBlind(state);
    if (visible) {
        const candle = object.otyp === TALLOW_CANDLE || object.otyp === WAX_CANDLE;
        if (candle || object.otyp === CANDELABRUM_OF_INVOCATION) {
            const many = candle ? object.quan > 1 : object.spe > 1;
            messages.push(`${objectOwnershipPrefix(object, state, { capitalized: true })}${
                candle ? '' : "candelabrum's "}candle${many ? "s' flames are" : "'s flame is"} extinguished.`);
        } else {
            const plural = objectNameIsPlural(object, state);
            messages.push(`${ownedObjectName(object, state)} ${plural ? 'go' : 'goes'} out!`);
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

function rustMetalObject(object: GameObject | null | undefined, description: string, luckRoll: RandomBelow): MetalRustResult {
    if (!object || objectMaterial(object.otyp) !== 11)
        return { outcome: 'nothing' };

    const proof = !!object.oerodeproof;
    if (proof && object.rknown) return { outcome: 'nothing' };
    if (proof) {
        object.rknown = true;
        return {
            outcome: 'nothing', kind: 'rustproof', object, description,
        };
    }
    if (object.blessed && luckRoll(4) === 0)
        return { outcome: 'nothing' };

    const oldErosion = object.oeroded ?? 0;
    if (oldErosion >= 3) return { outcome: 'nothing' };
    object.oeroded = oldErosion + 1;
    return {
        outcome: 'damaged', kind: 'rusted', object, description,
        erosion: object.oeroded,
    };
}

export async function waterDamageObject(
    object: GameObject | null | undefined,
    messages: string[] = [],
    state = game,
    { force = false, description = null, random = rn2, luckRoll = rnl,
        rollOne = rnd, publish, mentionWater, acidContext }: WaterDamageOptions = {},
): Promise<WaterDamageOutcome> {
    if (!object) return 'nothing';
    const emit: MessagePublisher = async message => {
        if (publish) await publish(message);
        else messages.push(message);
    };
    const lightMessages: string[] = [];
    if (splashLitObject(object, lightMessages, state)) {
        for (const message of lightMessages) await emit(message);
        return 'damaged';
    }
    for (const message of lightMessages) await emit(message);
    const name = description ?? objectCombatName(object, { state });
    const carried = carriedByHero(object, state);
    const plural = verbForSubject(name, 'are') === 'are';
    const spe = object.spe ?? 0;
    if (object.otyp === CAN_OF_GREASE && spe > 0) return 'nothing';
    if (object.otyp === TOWEL && spe < 7) {
        await wetTowel(object, -rollOne(7 - spe), { state, verbose: true, publish: emit });
        return 'nothing';
    }
    if (object.greased) {
        if (random(2) !== 0) return 'greased';
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
                if (!heroIsHallucinating(state)) mentionWater?.();
            }
            await damageWaterChain(objectContents(object), messages, state,
                { random, luckRoll, rollOne, publish: emit,
                    ...(acidContext ? { acidContext } : {}) });
        } else if (carried && !heroIsBlind(state) && !state.underwater) {
            await emit(`The ${displayLiquidName('water', state)} cannot get into your ${name}.`);
            if (!heroIsHallucinating(state)) mentionWater?.();
            learnObjectType(object.otyp, state);
        }
        return 'damaged';
    }
    const luck = (state.u.uluck ?? 0) + (state.u.moreluck ?? 0);
    if (!force && luck + 5 > random(20)) return 'nothing';
    if (object.oclass === 9) {
        if (object.otyp === SCR_BLANK_PAPER) return 'nothing';
        if (carried) await emit(`Your ${name} ${plural ? 'fade' : 'fades'}.`);
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
        if (object.otyp === SPE_BLANK_PAPER) return 'nothing';
        const novel = object.otyp === SPE_NOVEL;
        if (carried) await emit(`Your ${name} ${plural ? 'fade' : 'fades'}.`);
        if (object.spestudied) object.spestudied = random(object.spestudied);
        object.otyp = SPE_BLANK_PAPER;
        object.dknown = false;
        if (novel) blankNovel(object);
        return 'damaged';
    }
    if (object.oclass === 8) {
        if (object.otyp === POT_ACID) {
            return await destroyWetAcidPotion(object, false, emit, state, acidContext);
        }
        if (object.odiluted) {
            if (carried) await emit(`Your ${name} ${plural ? 'dilute' : 'dilutes'} further.`);
            object.otyp = POT_WATER;
            object.dknown = false;
            object.blessed = false;
            object.cursed = false;
            object.buc = 'uncursed';
            object.odiluted = false;
            return 'damaged';
        }
        if (object.otyp === POT_WATER) return 'nothing';
        if (carried) await emit(`Your ${name} ${plural ? 'dilute' : 'dilutes'}.`);
        object.odiluted = true;
        return 'damaged';
    }
    return erodeObject(object, 'rust', { state, publish: emit, random, luckRandom: luckRoll,
        grease: false, displayName: name });
}

// C pot_acid_damage(): water destroys the bottle without impact or vapors.
async function destroyWetAcidPotion(
    object: GameObject, described: boolean, emit: MessagePublisher, state: GameState,
    context?: WaterAcidContext,
): Promise<'destroyed'> {
    if (heroIsBlind(state) && !carriedByHero(object, state)) object.dknown = false;
    const plural = object.quan !== 1;
    const repeated = context?.valid && (object.dknown
        ? context.knownExplosions : context.unknownExplosions) > 0;
    const prefix = repeated ? plural ? 'More' : 'Another' : plural ? 'Some' : 'A';
    await emit(described ? `The potion${plural ? 's explode' : ' explodes'}!`
        : `${prefix} ${simpleObjectName(object, state)} ${plural ? 'explode' : 'explodes'}!`);
    if (context?.valid) {
        if (object.dknown) context.knownExplosions++;
        else context.unknownExplosions++;
    }
    await removeHeroEquipment(object, state);
    await delobj(object, state);
    return 'destroyed';
}

export async function waterDamageChain(
    objects: GameObject[] | null | undefined,
    messages: string[] = [],
    state = game,
    options: Pick<WaterDamageOptions, 'publish'> = {},
): Promise<string[]> {
    if (!objects) return messages;
    await damageWaterChain(objects, messages, state, options);
    return messages;
}

async function damageWaterChain(
    objects: GameObject[], messages: string[], state: GameState,
    options: WaterDamageOptions,
): Promise<void> {
    if (!objects.length) return;
    const context = options.acidContext ?? {
        valid: false, knownExplosions: 0, unknownExplosions: 0,
    };
    context.valid = true;
    context.knownExplosions = context.unknownExplosions = 0;
    try {
        for (const object of [...objects]) {
            const result = await waterDamageObject(object, messages, state,
                { ...options, acidContext: context });
            if (result !== 'destroyed') continue;
            const index = objects.indexOf(object);
            if (index >= 0) objects.splice(index, 1);
        }
    } finally {
        // Native nested chains end the shared acid context rather than restoring it.
        context.valid = false;
        context.knownExplosions = context.unknownExplosions = 0;
    }
}

function extinguishLitObject(object: GameObject | null | undefined, monster: Monster, state: GameState): LightWaterEffect | null {
    if (!object?.lamplit) return null;
    const humanoid = !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_HUMANOID);
    if (object.otyp === BRASS_LANTERN && humanoid) {
        return { kind: 'lantern-flickers', object };
    }
    if (!endObjectBurn(object, state, state.moves ?? 0))
        object.lamplit = false;
    return { kind: 'extinguished', object };
}

function rustObject(
    object: GameObject | null | undefined,
    description: string,
    monster: Monster,
    state: GameState,
    roll: RandomBelow,
    luckRoll: RandomBelow,
): RustResult {
    if (!object) return { outcome: 'nothing' };

    const lightEffect = extinguishLitObject(object, monster, state);
    if (lightEffect) return { outcome: 'damaged', ...lightEffect };

    if (object.greased) {
        const greaseWashedOff = roll(2) === 0;
        if (greaseWashedOff) object.greased = false;
        // C water_damage(): monster-carried grease washes off without feedback.
        return { outcome: 'greased' };
    }

    return rustMetalObject(object, description, luckRoll);
}

function addWaterEffect(event: MonsterRustTrapEvent, effect: RustResult): WaterDamageOutcome {
    if (effect?.kind) event.effects.push(effect);
    return effect?.outcome || 'nothing';
}

function armorAt(monster: Monster | null, state: GameState, mask: ArmorMask): GameObject | null {
    if (monster) return wornObject(monster, mask);
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

export async function burnArmorByFire(
    victim: Hero | Monster, state: GameState,
    emitMessage: MessagePublisher | null | undefined,
    calls: CallRecorder = [], random = rn2, {
        visible = victim === state.u,
    } = {},
): Promise<boolean> {
    const monster = 'mnum' in victim ? victim : null;
    if (victim !== state.u && !monster)
        throw new TypeError('Armor damage requires the live hero or a monster.');
    const hero = monster === null;
    const inventory = monster ? inventoryOf(monster) : state.inventory;
    for (const towel of inventory) {
        const wetness = towel.otyp === TOWEL ? towel.spe ?? 0 : 0;
        if (wetness <= 0) continue;
        const newWetness = recordRoll(random, calls, wetness + 1);
        if (newWetness === wetness) continue;
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
        } else if (slot === 1) {
            torso = true;
            object = armorAt(monster, state, W_ARMC)
                || armorAt(monster, state, W_ARM)
                || armorAt(monster, state, W_ARMU);
            description = !object ? 'armor'
                : object === armorAt(monster, state, W_ARM)
                    ? objectCombatName(object, { state }) : armorSimpleName(object, state);
        } else if (slot === 2) {
            object = armorAt(monster, state, W_ARMS);
            description = 'wooden shield';
        } else if (slot === 3) {
            object = armorAt(monster, state, W_ARMG);
            description = 'gloves';
        } else {
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
            publish: async message => {
                if (emitMessage && (hero || visible)) await emitMessage(message);
            },
        });
        if (torso) return true;
        if (result !== 'nothing') return false;
    }
}

export function burnHeroArmorByFire(
    state: GameState, emitMessage: MessagePublisher | null | undefined,
    calls: CallRecorder = [], random = rn2,
): Promise<boolean> {
    return burnArmorByFire(state.u, state, emitMessage, calls, random);
}

export async function applyMonsterRustTrap(
    monster: Monster,
    state: GameState,
    {
        roll = rn2,
        luckRoll = rnl,
    }: { roll?: RandomBelow; luckRoll?: RandomBelow } = {},
): Promise<MonsterRustTrapEvent> {
    const targetRoll = roll(5);
    const event: MonsterRustTrapEvent = {
        kind: 'rust-trap', target: 'body', effects: [],
        damage: 0, killed: false,
    };

    if (targetRoll === 0) {
        event.target = 'head';
        const helmet = wornObject(monster, W_ARMH);
        addWaterEffect(event, rustObject(
            helmet, helmet ? armorSimpleName(helmet, state) : 'helm',
            monster, state, roll, luckRoll,
        ));
    } else if (targetRoll === 1) {
        event.target = 'left-arm';
        const shield = wornObject(monster, W_ARMS);
        const shieldResult = addWaterEffect(event, rustObject(
            shield, 'shield', monster, state, roll, luckRoll,
        ));
        if (shieldResult === 'nothing') {
            const weapon = monsterWieldedWeapon(monster);
            if (weapon && OBJECT_BIMANUAL[weapon.otyp]) {
                addWaterEffect(event, rustObject(
                    weapon, objectCombatName(weapon, { state }),
                    monster, state, roll, luckRoll,
                ));
            }
            const gloves = wornObject(monster, W_ARMG);
            addWaterEffect(event, rustObject(
                gloves, gloves ? armorSimpleName(gloves, state) : 'gloves',
                monster, state, roll, luckRoll,
            ));
        }
    } else if (targetRoll === 2) {
        event.target = 'right-arm';
        const weapon = monsterWieldedWeapon(monster);
        addWaterEffect(event, rustObject(
            weapon, weapon ? objectCombatName(weapon, { state }) : 'weapon',
            monster, state, roll, luckRoll,
        ));
        const gloves = wornObject(monster, W_ARMG);
        addWaterEffect(event, rustObject(
            gloves, gloves ? armorSimpleName(gloves, state) : 'gloves',
            monster, state, roll, luckRoll,
        ));
    } else {
        event.target = 'body';
        for (const object of inventoryOf(monster)) {
            if (!object.lamplit
                || ((object.owornmask ?? 0) & (W_WEP | W_SWAPWEP))) {
                continue;
            }
            const effect = extinguishLitObject(object, monster, state);
            if (effect) event.effects.push(effect);
        }
        const torso = wornObject(monster, W_ARMC)
            || wornObject(monster, W_ARM)
            || wornObject(monster, W_ARMU);
        addWaterEffect(event, rustObject(
            torso, torso ? armorSimpleName(torso, state) : 'suit',
            monster, state, roll, luckRoll,
        ));
    }

    // A gremlin's split_mon() follows the gush report (finishMonsterRustTrap).
    if (monster.mnum === PM_IRON_GOLEM) event.completelyRusted = true;
    return event;
}
