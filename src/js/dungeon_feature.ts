import { isLavaAt, isPoolAt } from './terrain_properties.js';
// Floor features named by look_here() and describe_decor().
// C invent.c:dfeature_at(), stairs.c:stairs_description(), pager.c:ice_descr().

import { deityName } from './alignment.js';
import {
    ALTAR, AM_SANCTUM, Amask2align, A_NONE, DBWALL, DOOR,
    DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, D_BROKEN, D_ISOPEN, D_NODOOR,
    FOUNTAIN, GRAVE, ICE, IRONBARS, IS_FURNITURE, IS_LAVA, IS_POOL,
    PLNMSG_BACK_ON_GROUND, SINK, STONE, THRONE, TREE,
} from './const.js';
import { findDrawbridgeAt } from './dbridge.js';
import { drawbridgeUnderlyingType } from './drawbridge_terrain.js';
import { displayLiquidName, plineWithContinuation } from './display.js';
import type { MessagePublisher } from './display.js';
import { game, requireGameLevel } from './gstate.js';
import type { GameState } from './game_state.js';
import type { DungeonLocation } from './dungeon_types.js';
import type { Stairway } from './map_types.js';
import { dungeonDepth } from './hacklib.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { LEVEL_TIMER_KIND, levelTimers } from './object_timers.js';
import { propertyIsActive, propertyTimeout } from './properties.js';
import { heroIsHallucinating } from './senses.js';
import { cansee } from './vision.js';
import { surfaceName, waterbodyName } from './terrain_name.js';

interface FeatureOptions { state?: GameState; probing?: boolean }

function sameLevel(left: DungeonLocation, right: DungeonLocation | null | undefined): boolean {
    return !!right && left.dnum === right.dnum && left.dlevel === right.dlevel;
}

function stairwayDescription(stairway: Stairway, state: GameState): string {
    const noun = stairway.isladder ? 'ladder' : 'staircase';
    const direction = stairway.up ? 'up' : 'down';
    const here = state.u.uz;
    if (!here) throw new Error('Stair description requires the hero dungeon position');
    const destination = stairway.tolev;
    if (destination.dnum === here.dnum || !stairway.u_traversed) {
        if (!stairway.u_traversed) return `${noun} ${direction}`;
        const localDepth = destination.dnum === state.quest_dnum
            || sameLevel(destination, state.knox_level);
        const depth = localDepth ? destination.dlevel
            : dungeonDepth(destination.dnum, destination.dlevel, state.dungeons);
        return `${noun} ${direction} to level ${depth}`;
    }
    if (here.dnum === 0 && here.dlevel === 1 && stairway.up) {
        if (!state.u.uhave?.amulet) return `${noun} up out of the dungeon`;
        const elemental = [state.earth_level, state.air_level, state.fire_level, state.water_level]
            .some(level => sameLevel(destination, level));
        return `branch ${noun} up to ${elemental ? 'the Elemental Planes' : 'the end game'}`;
    }
    const descriptor = state.dungeons[destination.dnum];
    if (!descriptor) throw new Error(`Stair destination dungeon ${destination.dnum} does not exist`);
    const dungeon = descriptor.dname.replace(/^The /, 'the ');
    return `branch ${noun} ${direction} to ${dungeon}`;
}

export function iceDescriptionAt(x: number, y: number, { state = game, probing = false }: FeatureOptions = {}): string {
    const location = requireGameLevel(state).requireAt(x, y);
    const surface = location.typ === DRAWBRIDGE_UP
        ? drawbridgeUnderlyingType(location.drawbridgemask ?? 0) : location.typ;
    if (surface !== ICE) return `[ice:${location.typ}?]`;
    const radius = Math.max(state.u.xray_range ?? -1, 2);
    const distance = (x - state.u.ux) ** 2 + (y - state.u.uy) ** 2;
    const heroHere = x === state.u.ux && y === state.u.uy;
    const generic = !probing && (distance > radius * radius * 2 - radius
        || (!cansee(x, y) && (!heroHere || propertyIsActive('levitation', state))));
    const substance = heroIsHallucinating(state)
        ? `frozen ${displayLiquidName('water', state)}` : 'ice';
    if (generic) return substance;
    const timer = levelTimers(state).find(timer =>
        timer.kind === LEVEL_TIMER_KIND.MELT_ICE_AWAY && timer.x === x && timer.y === y);
    const remaining = timer ? timer.deadline - state.moves : 0;
    const strength = !remaining ? 'solid'
        : remaining > 1000 ? 'sturdy'
            : remaining > 100 ? 'steady'
                : remaining > 50 ? 'unsteady'
                    : remaining > 14 ? 'thin' : 'slushy';
    return `${strength} ${substance}`;
}

export function dungeonFeatureAt(x: number, y: number, { state = game, probing = false }: FeatureOptions = {}): string | null {
    const location = requireGameLevel(state).requireAt(x, y);
    const type = location.typ;
    if (type === DOOR) {
        if (findDrawbridgeAt(x, y, state)) return 'open drawbridge portcullis';
        return location.doormask === D_NODOOR ? 'doorway'
            : location.doormask === D_ISOPEN ? 'open door'
                : location.doormask === D_BROKEN ? 'broken door' : 'closed door';
    }
    if (type === FOUNTAIN) return 'fountain';
    if (type === THRONE) return 'opulent throne';
    if (isLavaAt(x, y, state)) return 'molten lava';
    const surface = type === DRAWBRIDGE_UP
        ? drawbridgeUnderlyingType(location.drawbridgemask ?? 0) : type;
    if (surface === ICE) return iceDescriptionAt(x, y, { state, probing });
    if (isPoolAt(x, y, state)) return 'pool of water';
    if (type === SINK) return 'sink';
    if (type === ALTAR) {
        const alignment = Amask2align(location.flags);
        const name = alignment === A_NONE ? 'unaligned'
            : alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
        const deity = deityName(alignment, state).replace(/^_/, '');
        return `${location.flags & AM_SANCTUM ? 'high ' : ''}altar to ${deity} (${name})`;
    }
    for (let stairway = state.stairs; stairway; stairway = stairway.next)
        if (stairway.sx === x && stairway.sy === y)
            return stairwayDescription(stairway, state);
    if (type === DRAWBRIDGE_DOWN) return 'lowered drawbridge';
    if (type === DBWALL) return 'raised drawbridge';
    if (type === GRAVE) return 'grave';
    if (type === TREE) return 'tree';
    if (type === IRONBARS) return 'set of iron bars';
    return null;
}

export function dungeonFeatureSentenceAt(x: number, y: number): string {
    return dungeonFeatureSentence(dungeonFeatureAt(x, y));
}

export function dungeonFeatureSentence(feature: string | null): string {
    if (!feature || feature === 'pool of water' && (game.underwater || game.u.uinwater))
        return '';
    const noArticle = feature === 'molten lava' || feature === 'ice'
        || feature.startsWith('frozen ') || feature.slice(feature.indexOf(' ')) === ' ice';
    return `There is ${noArticle ? feature : withIndefiniteArticle(feature)} here.`;
}

// C trap.c:back_on_ground(). Both ordinary pool exit and rescue name
// the current surface, including ice beneath a raised drawbridge.
export function backOnGroundMessage(rescued: boolean, state: GameState): string {
    const { ux, uy } = state.u;
    let surface = surfaceName(ux, uy, state);
    let preposition = state.u.levitating || state.u.levitation || state.u.flying ? 'over' : 'on';
    switch (surface) {
    case 'floor': case 'ground':
        surface = 'solid ground';
        break;
    case 'ice':
        surface = iceDescriptionAt(ux, uy, { state });
        break;
    case 'bridge': case 'altar': case 'headstone':
        surface = withIndefiniteArticle(surface);
        break;
    case 'stairs': case 'lava': case 'bottom':
        surface = `the ${surface}`;
        break;
    case 'air':
        surface = 'the air';
        preposition = 'in';
        break;
    default:
        surface = withIndefiniteArticle(surface);
        preposition = 'in';
    }
    const subject = rescued ? 'You find yourself' : state.flags.verbose ? 'You are back' : 'Back';
    return `${subject} ${preposition} ${surface}.`;
}

interface DecorOptions {
    state?: GameState;
    publish?: MessagePublisher;
    /** C gd.decor_fumble_override: force_decor() never defers. */
    fumbleOverride?: boolean;
    /** C gd.decor_levitate_override: probing reads the real ice condition. */
    levitateOverride?: boolean;
}

// C pickup.c:describe_decor(). Feature feedback on arrival; FALSE means the
// surface was the same non-furniture type, so look_here() shows its own
// feature line instead of skipping it.
export async function describeDecor({
    state = game,
    publish = plineWithContinuation,
    fumbleOverride = false,
    levitateOverride = false,
}: DecorOptions = {}): Promise<boolean> {
    // One turn of fumbling left: slip_or_trip() interrupts the hero at the
    // end of this turn, so hold the decor message back until after it.
    if (propertyTimeout('fumbling', state) === 1 && !state.iflags.deferDecor && !fumbleOverride) {
        await deferredDecor(true, state, publish);
        return false;
    }
    const { ux: x, uy: y } = state.u;
    const location = requireGameLevel(state).requireAt(x, y);
    const surface = location.typ === DRAWBRIDGE_UP
        ? drawbridgeUnderlyingType(location.drawbridgemask ?? 0) : location.typ;
    const previous = state._prevDecorType ?? STONE;
    const underwater = !!(state.underwater || state.u?.uinwater);
    let feature = dungeonFeatureAt(x, y, { state, probing: levitateOverride });
    const doorHere = feature === 'open door' || feature === 'doorway';
    const waterHere = feature === 'pool of water';
    if (doorHere || underwater || (surface === ICE && IS_POOL(previous)))
        feature = null;

    let described = true;
    if (surface === previous && !IS_FURNITURE(surface)) {
        described = false;
    } else if (feature) {
        if (waterHere) feature = waterbodyName(x, y, state);
        if (feature !== 'swamp' && surface !== ICE) feature = withIndefiniteArticle(feature);
        // C flags.verbose defaults on.
        const message = state.flags.verbose !== false
            ? `There is ${feature} here.`
            : `${feature.charAt(0).toUpperCase()}${feature.slice(1)}.`;
        await publish(message, {
            noRepeat: surface === ICE && !!state.flags.mention_decor,
        });
    } else if (!underwater) {
        if (IS_POOL(previous) || IS_LAVA(previous) || previous === ICE) {
            if (state._lastPlineKind !== PLNMSG_BACK_ON_GROUND) {
                await publish(backOnGroundMessage(false, state));
                state._lastPlineKind = PLNMSG_BACK_ON_GROUND;
            }
        }
    }
    state._prevDecorType = state.flags.mention_decor ? surface : STONE;
    return described;
}

// C pickup.c:deferred_decor(). Setup holds the arrival feature back behind
// an imminent fumble; catch-up describes it only while mention_decor is
// still set, otherwise the pending message is simply dropped.
export async function deferredDecor(setup: boolean, state: GameState = game,
    publish: MessagePublisher = plineWithContinuation,
): Promise<void> {
    if (!state.flags.mention_decor) {
        state.iflags.deferDecor = false;
    } else if (setup) {
        state.iflags.deferDecor = true;
    } else {
        await describeDecor({ state, publish });
        state.iflags.deferDecor = false;
    }
}

// C pickup.c:force_decor(). Probing reports the real floor even when
// blindness or levitation would hide its condition during an ordinary look.
export async function forceDescribeDecor({ state = game, probing = false }: FeatureOptions = {}): Promise<void> {
    const { ux: x, uy: y } = state.u;
    const location = requireGameLevel(state).requireAt(x, y);
    state._prevDecorType = STONE;
    await describeDecor({
        state, fumbleOverride: true, levitateOverride: probing,
    });
    location.lastseentyp = location.typ;
}
