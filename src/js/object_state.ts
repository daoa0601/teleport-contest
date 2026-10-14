// Shared primary object-state transitions.
// C refs: mkobj.c curse(), uncurse(), bless(), and unbless().
//
// NetHack stores blessed/cursed as boolean bits.  Older JavaScript inventory
// producers can also attach a textual `buc` compatibility field, so every
// shared transition must keep that projection synchronized.

import {
    AMULET_OF_YENDOR, BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION,
    BAG_OF_HOLDING, CORPSE, FIGURINE, OBJECT_BIMANUAL, OBJECT_CHARGED, OBJECT_NAMES, OBJECT_SUBTYPE, SPE_BOOK_OF_THE_DEAD,
} from './object_data.js';
import { artifactById } from './artifacts.js';
import { game, requireLiveGame } from './gstate.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import { rn2 } from './rng.js';
import { chargeAlteredUnpaidObject } from './shk.js';
import { objectWeight } from './weight.js';
import { bookCursed } from './spellbook_study.js';
import { A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS, W_ARMG, W_ARMH, W_RING } from './const.js';
import type { AttributeIndex } from './attrib.js';
import { bot, plineWithContinuation } from './display.js';
import { freeInventoryObject, updateCarriedLuck } from './hero_inventory.js';
import { heroHandName } from './body_parts.js';
import { ownedObjectName } from './objnam.js';
import { dropObjectAtHero } from './object_drop.js';
import { shipObject } from './object_migration.js';
import { landObjectOnAltar } from './altar_object.js';
import { requireInitializedGame } from './gstate.js';
import { ALTAR } from './const.js';
import { OBJECT_TIMER_KIND, stopObjectTimer } from './object_timers.js';
import { attachCursedFigurineTimer } from './figurine_timer.js';
import { resetBulkTakeoff } from './takeoff_state.js';
import { adjustObjectLightAfterBlessing, objectLightRadius } from './light.js';

const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const TOOL_CLASS = 6;
const COIN_CLASS = 12;
const PM_DEATH = 311;
const PM_FAMINE = 313;

// C zap.c:drain_item(). Billing precedes the loss of a charge.
export async function drainObjectEnchantment(object: GameObject | null | undefined, {
    random = rn2, byHero = false, state = game,
}: { random?: typeof rn2; byHero?: boolean; state?: GameState } = {}): Promise<boolean> {
    if (!object || !(object.spe > 0)) return false;
    const weaponTool = object.oclass === TOOL_CLASS && OBJECT_SUBTYPE[object.otyp] !== 0;
    if (!OBJECT_CHARGED[object.otyp]
        && ![WEAPON_CLASS, ARMOR_CLASS].includes(object.oclass) && !weaponTool)
        return false;
    const artifact = artifactById(object.oartifact);
    if (artifact?.defense === 'life-drain' || artifact?.carriedDefense === 'life-drain'
        || objectResistsDestruction(object, 10, 90, random)) return false;
    if (byHero) await chargeAlteredUnpaidObject(object, 'drain', state);
    object.spe--;
    object.enchantment = object.spe;
    drainWornBonuses(object, state);
    if (state.context.botl) {
        requireLiveGame(state);
        await bot();
    }
    return true;
}

function drainWornBonuses(object: GameObject, state: GameState): void {
    const name = OBJECT_NAMES[object.otyp];
    const worn = object.owornmask ?? 0;
    const ring = object === (state.uleft || state.u.uleft)
        || object === (state.uright || state.u.uright);
    const attributes: AttributeIndex[] = [];
    if (ring && (worn & W_RING)) {
        if (name === 'gain strength') attributes.push(A_STR);
        else if (name === 'gain constitution') attributes.push(A_CON);
        else if (name === 'adornment') attributes.push(A_CHA);
        else if (name === 'increase accuracy') state.u.uhitinc = (state.u.uhitinc ?? 0) - 1;
        else if (name === 'increase damage') state.u.udaminc = (state.u.udaminc ?? 0) - 1;
    }
    if (ring && name === 'protection') state.context.botl = true;
    if (name === 'helm of brilliance' && (worn & W_ARMH)
        && object === (state.uarmh || state.u.uarmh)) attributes.push(A_INT, A_WIS);
    if (name === 'gauntlets of dexterity' && (worn & W_ARMG)
        && object === (state.uarmg || state.u.uarmg)) attributes.push(A_DEX);
    if (!attributes.length) return;
    state.u.abon ??= { a: [0, 0, 0, 0, 0, 0] };
    for (const attribute of attributes) state.u.abon.a[attribute]--;
    state.context.botl = true;
}

function updateBlessingEffects(object: GameObject | null | undefined, state: GameState): void {
    if (object && state.inventory.includes(object)) updateCarriedLuck(object, state);
    if (object?.otyp === BAG_OF_HOLDING) object.owt = objectWeight(object);
}

function stopFigurineTransformation(object: GameObject): void {
    if (object.otyp === FIGURINE && object.timed)
        stopObjectTimer(object, OBJECT_TIMER_KIND.FIG_TRANSFORM);
}

export function objectResistsDestruction(
    object: GameObject | null | undefined, ordinaryChance: number, artifactChance: number, random = rn2,
): boolean {
    if (!object) return false;
    if (object.otyp === AMULET_OF_YENDOR
        || object.otyp === SPE_BOOK_OF_THE_DEAD
        || object.otyp === CANDELABRUM_OF_INVOCATION
        || object.otyp === BELL_OF_OPENING
        || (object.otyp === CORPSE
            && object.corpsenm !== undefined
            && object.corpsenm >= PM_DEATH
            && object.corpsenm <= PM_FAMINE)) return true;
    return random(100) < (object.oartifact || object.artifact
        ? artifactChance : ordinaryChance);
}

export function curseObjectState(object: GameObject | null | undefined, state: GameState = game): boolean {
    if (!object || object.oclass === COIN_CLASS) return false;
    const changed = !object.cursed || !!object.blessed;
    object.blessed = false;
    object.cursed = true;
    object.buc = 'cursed';
    if (object === (state.uwep || state.u.uwep) && OBJECT_BIMANUAL[object.otyp])
        resetBulkTakeoff(state);
    updateBlessingEffects(object, state);
    if (object.otyp === FIGURINE
        && (object.where === 'inventory' || object.where === 'minvent'))
        attachCursedFigurineTimer(object, state);
    return changed;
}

// Live gameplay curses can interrupt an active study through its real input
// boundary. Constructors and bones retain the atomic state initializer.
export async function curseObject(
    object: GameObject | null | undefined, { state = game }: { state?: GameState } = {},
): Promise<boolean> {
    const wasCursed = !!object?.cursed;
    const oldLight = objectLightRadius(object, state);
    const changed = curseObjectState(object, state);
    if (object && object === (state.uswapwep || state.u.uswapwep) && state.u.twoweap)
        await dropCursedAlternateWeapon(object, state);
    if (object && changed && !wasCursed && object.oclass === 10)
        await bookCursed(object, { state });
    if (object?.lamplit) await adjustObjectLightAfterBlessing(object, oldLight, state);
    return changed;
}

// C wield.c:drop_uswapwep() and do.c:dropx(): announce before extraction,
// then handle shipping and altar contact before placing the dropped weapon.
async function dropCursedAlternateWeapon(object: GameObject, state: GameState): Promise<void> {
    await plineWithContinuation(`Your left ${heroHandName(state)} spasms and drops ${
        ownedObjectName(object, state, { capitalized: false, includeQuantity: true })}!`);
    await freeInventoryObject(object, state);
    if (!state.u.uswallow) {
        const initialized = requireInitializedGame(state);
        if (await shipObject(object, state.u.ux, state.u.uy, {
            state: initialized, publish: plineWithContinuation,
        })) return;
        if (state.level?.at(state.u.ux, state.u.uy)?.typ === ALTAR)
            await landObjectOnAltar(object, { state });
    }
    await dropObjectAtHero(object, { state });
}

export function blessObjectState(object: GameObject | null | undefined, state: GameState = game): boolean {
    if (!object || object.oclass === COIN_CLASS) return false;
    const changed = !object.blessed || !!object.cursed;
    object.blessed = true;
    object.cursed = false;
    object.buc = 'blessed';
    updateBlessingEffects(object, state);
    stopFigurineTransformation(object);
    return changed;
}

export function uncurseObjectState(object: GameObject | null | undefined, state: GameState = game): boolean {
    if (!object) return false;
    const changed = !!object.cursed;
    object.cursed = false;
    object.buc = object.blessed ? 'blessed' : 'uncursed';
    updateBlessingEffects(object, state);
    stopFigurineTransformation(object);
    return changed;
}

export function unblessObjectState(object: GameObject | null | undefined, state: GameState = game): boolean {
    if (!object) return false;
    const changed = !!object.blessed;
    object.blessed = false;
    object.buc = object.cursed ? 'cursed' : 'uncursed';
    updateBlessingEffects(object, state);
    return changed;
}
