// Persistent hero properties and the sources which grant them.
// C ref: prop.h intrinsic and extrinsic property masks.

import { game } from './gstate.js';
import { I_SPECIAL, TIMEOUT, TT_PIT, W_ART, W_ARTI } from './const.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { MUMMY_WRAPPING } from './object_data.js';
import { PROPERTY_TIMEOUT_FIELDS } from './property_types.js';
import type {
    CarriedPropertySource, IntrinsicOrigin, LevitationState, PropertyHero,
    PropertyName, PropertyObject, PropertySources, PropertyState,
    StashedLevitationSources, WornPropertySlot,
} from './property_types.js';

const permanentOrigins: readonly IntrinsicOrigin[] = ['role', 'experience', 'race', 'outside'];
const movementProperties: readonly PropertyName[] = ['levitation', 'flying', 'swimming', 'stealth'];

export function propertyTimeout(property: PropertyName, state: PropertyState = game): number {
    return state.u[PROPERTY_TIMEOUT_FIELDS[property]] ?? 0;
}

// C set_itimeout() changes only TIMEOUT, leaving all permanent and extrinsic
// sources intact. Display, landing, and status messages belong to effect owners.
export function setPropertyTimeout(
    property: PropertyName, turns: number, state: PropertyState = game,
): number {
    if (!Number.isFinite(turns)) throw new RangeError(`Invalid ${property} timeout ${turns}`);
    const timeout = Math.max(0, Math.min(TIMEOUT, Math.trunc(turns)));
    state.u[PROPERTY_TIMEOUT_FIELDS[property]] = timeout;
    refreshProperty(property, state);
    return timeout;
}

function propertyRecord(property: PropertyName, state: PropertyState = game): PropertySources {
    const hero = state.u;
    if (!hero._propertySources) hero._propertySources = {};
    const existing = hero._propertySources[property];
    if (existing) return existing;
    const record: PropertySources = {
        intrinsic: {},
        worn: [],
        invoked: null,
        carried: [],
    };
    hero._propertySources[property] = record;
    return record;
}

function existingPropertyRecord(property: PropertyName, state: PropertyState = game): PropertySources | null {
    return state.u?._propertySources?.[property] || null;
}

function timedSourceIsActive(property: PropertyName, hero: PropertyHero): boolean {
    return (hero[PROPERTY_TIMEOUT_FIELDS[property]] ?? 0) > 0;
}

export function hasTimedProperty(property: PropertyName, state: PropertyState = game): boolean {
    return timedSourceIsActive(property, state.u);
}

function intrinsicSourceIsActive(record: PropertySources | null): boolean {
    return Object.keys(record?.intrinsic || {}).length > 0;
}

function propertySourceIsActive(property: PropertyName, state: PropertyState): boolean {
    const hero = state.u;
    const record = existingPropertyRecord(property, state);
    return intrinsicSourceIsActive(record)
        || (record?.worn.length ?? 0) > 0
        || !!record?.invoked
        || (record?.carried.length ?? 0) > 0
        || timedSourceIsActive(property, hero);
}

// C HLevitation || ELevitation: any live levitation source, worn, invoked,
// carried (W_ART) or timed, independent of the blocked mask.
export function hasRawLevitationSource(state: PropertyState = game) {
    return propertySourceIsActive('levitation', state);
}

// C hack.c:weight_cap() ignores the trap block on levitation, and defers
// the carrying benefit of boots whose Boots_on callback has not run yet.
export function levitationSupportsLoad(ignoreBoots: boolean, state: PropertyState = game): boolean {
    const record = existingPropertyRecord('levitation', state);
    if (record?.blockedByTerrain) return false;
    return intrinsicSourceIsActive(record) || !!record?.invoked
        || !!record?.carried.length || timedSourceIsActive('levitation', state.u)
        || !!record?.worn.some(source => !ignoreBoots || source.slot !== 'uarmf');
}

export function propertyIsBlocked(property: PropertyName, state: PropertyState = game) {
    if (existingPropertyRecord(property, state)?.blockedByTerrain) return true;
    const hero = state.u;
    if (property === 'clairvoyant') return !!hero.clairvoyanceBlocked;
    if (property === 'invisible') {
        const cloak = state.uarmc || hero.uarmc;
        return cloak?.otyp === MUMMY_WRAPPING || !!hero.invisibilityBlocked || !!hero.invisBlocked;
    }
    const trapped = (hero.utrap ?? 0) > 0 && hero.utraptype !== TT_PIT;
    const levitation = propertySourceIsActive('levitation', state);
    if (property === 'levitation') return levitation && trapped;
    if (property === 'flying') {
        const flying = propertySourceIsActive('flying', state);
        return levitation || (flying && trapped);
    }
    return false;
}

export function setPropertyTerrainBlocked(property: PropertyName, blocked: boolean, state: PropertyState = game) {
    propertyRecord(property, state).blockedByTerrain = blocked;
    refreshProperty(property, state);
}

export function propertyIsActive(property: PropertyName, state: PropertyState = game): boolean {
    const hero = state.u;
    // C Strangled is the intrinsic timeout, not the amulet's worn property.
    // Wearing the amulet does not strangle an immune body.
    if (property === 'strangled') return timedSourceIsActive(property, hero);
    const steedFlags = hero.usteed ? (MONSTER_FLAGS1[hero.usteed.mnum] ?? 0) : 0;
    const fromSteed = property === 'flying' ? steedFlags & 0x01
        : property === 'swimming' ? steedFlags & 0x02 : false;
    if (!propertySourceIsActive(property, state) && !fromSteed) return false;
    if (property === 'levitation' || property === 'flying' || property === 'invisible' || property === 'clairvoyant')
        return !propertyIsBlocked(property, state);
    if (property === 'stealth' && hero.usteed)
        return propertyIsActive('flying', state)
            || propertyIsActive('levitation', state);
    return true;
}

export function propertyHasOtherSources(property: PropertyName, state: PropertyState = game) {
    const hero = state.u;
    const record = existingPropertyRecord(property, state);
    return intrinsicSourceIsActive(record)
        || (record?.worn.length ?? 0) > 0
        || (record?.carried.length ?? 0) > 0
        || timedSourceIsActive(property, hero);
}

// C Lev_at_will: levitation is controllable when granted by an invoked
// artifact (ELevitation W_ARTI) or the blessed-potion flag (HLevitation
// I_SPECIAL, modelled as intrinsic origin 'potion').  Any other permanent
// intrinsic source or any worn source blocks the control. Timeouts do not.
export function levitationAtWill(state: PropertyState = game) {
    const record = existingPropertyRecord('levitation', state);
    const controllable = !!record?.invoked || !!record?.intrinsic.potion;
    const permanent = Object.keys(record?.intrinsic || {})
        .some(origin => origin !== 'potion');
    return controllable && !(record?.worn.length)
        && !(record?.carried.length) && !permanent;
}

// C spoteffects()'s timeout-1 handling (hack.c:3362-3363) tests
// !(ELevitation || (HLevitation & ~(I_SPECIAL | TIMEOUT))) together with a
// one-turn timeout: levitation whose only sources are the timeout counter
// and the blessed-potion at-will marker.  The worn/invoked/intrinsic decode
// stays here with the record owner instead of the call site.
export function levitationIsPurelyTimed(state: PropertyState = game) {
    const hero = state.u;
    const record = existingPropertyRecord('levitation', state);
    if ((hero.levitationTurns ?? 0) <= 0) return false;
    if (record?.worn.length) return false;
    if (record?.invoked) return false;
    if (record?.carried.length) return false;
    return Object.keys(record?.intrinsic || {})
        .every(origin => origin === 'potion');
}

function projectProperty(property: PropertyName, state: PropertyState): boolean {
    const record = propertyRecord(property, state);
    const hero = state.u;
    const active = propertyIsActive(property, state);
    // Prayer protection freezes timeouts; a timed INVULNERABLE must never
    // set that separate flag or it would prevent its own timeout from ending.
    if (property === 'invulnerable') return active;
    hero[property] = active;
    if (property === 'confusion') hero.confused = active;
    if (property === 'invisible') hero.invis = active;
    if (property === 'detectMonsters') hero.monsterDetection = active;
    if (property === 'teleportation') hero.teleporting = active;
    if (property === 'fast') {
        hero.veryFast = propertyTimeout('fast', state) > 0 || record.worn.length > 0
            || record.invoked !== null || record.carried.length > 0;
        hero.veryFastFromArmor = record.worn.some(source => source.slot.startsWith('uarm'));
    }
    if (property === 'levitation') hero.levitating = active;
    hero[`${property}FromArmor`] = record.worn.some(source =>
        source.slot.startsWith('uarm'));
    return active;
}

export function refreshProperty(property: PropertyName, state: PropertyState = game) {
    const active = projectProperty(property, state);
    if (property === 'levitation' || property === 'flying') {
        projectProperty('flying', state);
        projectProperty('stealth', state);
    }
    return active;
}

// C float_vs_flight()/steed_vs_stealth(): movement changes can suppress an
// ability without removing the item or body which grants it.
export function refreshMovementProperties(state: PropertyState = game) {
    for (const property of movementProperties)
        projectProperty(property, state);
}

// C float_down()/dosinkfall() mask clears.  hmask removes intrinsic
// levitation bits: TIMEOUT zeroes the timeout counter, I_SPECIAL drops the
// blessed-potion at-will origin.  emask removes extrinsic bits: W_ARTI
// clears the invoked artifact, W_ART clears carried-artifact sources pinned
// by the drop finesse (js/levitation_drop.js).  W_SADDLE is never stored, so
// it remains a documented no-op here.
export function clearLevitationMasks(hmask = 0, emask = 0, state: PropertyState = game) {
    const hero = state.u;
    if (hmask & TIMEOUT) hero.levitationTurns = 0;
    if (hmask & I_SPECIAL)
        revokeIntrinsicProperty('levitation', 'potion', state);
    if (emask & W_ARTI)
        setInvokedProperty('levitation', null, false, state);
    if (emask & W_ART)
        setCarriedProperty('levitation', null, false, state);
    refreshMovementProperties(state);
    return hero;
}

function carriedSourceMatches(source: CarriedPropertySource, object: PropertyObject | null): boolean {
    if (!object) return true; // mask semantics: every carried source
    const objectId = object.o_id ?? null;
    const artifactId = object.oartifact ?? null;
    if (objectId != null && source.objectId === objectId) return true;
    if (artifactId != null && source.artifactId === artifactId) return true;
    return false;
}

// C set_artifact_intrinsic(on, W_ART): an artifact grants the property while
// carried.  The drop finesse pins this source so the hero stays aloft until
// the explicit float-down clears it.
export function setCarriedProperty(
    property: PropertyName, object: PropertyObject | null, active: boolean, state: PropertyState = game,
) {
    const record = propertyRecord(property, state);
    if (!active) {
        record.carried = record.carried.filter(source =>
            !carriedSourceMatches(source, object));
    } else if (!record.carried.some(source =>
        carriedSourceMatches(source, object))) {
        record.carried.push({
            objectId: object?.o_id ?? null,
            artifactId: object?.oartifact ?? null,
            otyp: object?.otyp ?? null,
        });
    }
    refreshProperty(property, state);
}

// Argument order follows hasIntrinsicProperty(property, origin, state):
// the optional object narrows the check to one carried artifact.
export function hasCarriedProperty(property: PropertyName, object: PropertyObject | null = null, state: PropertyState = game) {
    const carried = existingPropertyRecord(property, state)?.carried || [];
    if (!object) return carried.length > 0;
    return carried.some(source => carriedSourceMatches(source, object));
}

function cloneLevitationRecord(record: PropertySources): PropertySources {
    const copy: PropertySources = {
        intrinsic: { ...record.intrinsic },
        worn: record.worn.map(source => ({ ...source })),
        invoked: record.invoked ? { ...record.invoked } : null,
        carried: record.carried.map(source => ({ ...source })),
    };
    if (record.blockedByTerrain !== undefined)
        copy.blockedByTerrain = record.blockedByTerrain;
    return copy;
}

// C dosinkfall() saves HLevitation/ELevitation, zeroes both, applies its
// crash damage so a fatal disclosure does not report levitation, then
// restores the masks: the rings and boots are really still worn.  Stashing
// with { clear: true } performs the zeroing; the returned snapshot is
// passed back to restoreLevitationSources().
export function stashLevitationSources(state: PropertyState = game, { clear = false } = {}) {
    const hero = state.u;
    const record = hero._propertySources?.levitation;
    const stash = {
        record: record && cloneLevitationRecord(record),
        turns: hero.levitationTurns ?? 0,
    };
    if (clear) {
        hero._propertySources ||= {};
        hero._propertySources.levitation = {
            intrinsic: {}, worn: [], invoked: null, carried: [],
        };
        hero.levitationTurns = 0;
        refreshMovementProperties(state);
    }
    return stash;
}

export function restoreLevitationSources(stash: StashedLevitationSources, state: PropertyState = game) {
    const hero = state.u;
    hero._propertySources ||= {};
    hero._propertySources.levitation = stash.record
        ? cloneLevitationRecord(stash.record)
        : { intrinsic: {}, worn: [], invoked: null, carried: [] };
    hero.levitationTurns = stash.turns;
    refreshMovementProperties(state);
    return hero;
}

// C trap.c:float_down()/float_up() read the stored HLevitation/ELevitation/
// BLevitation/BFlying masks before any caller removes a levitation source.
// Equipment and effect setters refresh the derived state while removing that
// source, so they snapshot first and pass the result through the landing
// owner's `previous` argument.  Both blocked bits are captured separately:
// terrain and a floor trap can block levitation at the same time, and only a
// sole floor-trap block (C BLevitation == I_SPECIAL) gets feedback.
export function captureLevitationState(state: PropertyState = game): LevitationState {
    const hero = state.u;
    const trapped = (hero.utrap ?? 0) > 0 && hero.utraptype !== TT_PIT;
    const hasSource = propertySourceIsActive('levitation', state);
    return {
        // HLevitation || ELevitation
        hasSource,
        // Levitation macro: sources and not blocked
        active: propertyIsActive('levitation', state),
        // BLevitation FROMOUTSIDE: solid rock or a wall of water
        blockedByTerrain:
            !!existingPropertyRecord('levitation', state)?.blockedByTerrain,
        // BLevitation I_SPECIAL: floor-trap hold over live levitation sources
        blockedByTrap: hasSource && trapped,
        // Flying macro
        flying: propertyIsActive('flying', state),
        // BFlying: flight suppressed by levitation or a floor trap
        flyingBlocked: propertyIsBlocked('flying', state),
    };
}

export function hasInvokedProperty(property: PropertyName, state: PropertyState = game) {
    return !!existingPropertyRecord(property, state)?.invoked;
}

export function setInvokedProperty(
    property: PropertyName, object: PropertyObject | null, active: boolean, state: PropertyState = game,
) {
    const record = propertyRecord(property, state);
    record.invoked = active ? {
        objectId: object?.o_id ?? null,
        artifactId: object?.oartifact ?? null,
        objectType: object?.otyp ?? null,
    } : null;
    return refreshProperty(property, state);
}

export function grantIntrinsicProperty(property: PropertyName, origin: IntrinsicOrigin, state: PropertyState = game) {
    const record = propertyRecord(property, state);
    record.intrinsic[origin] = true;
    refreshProperty(property, state);
}

export function revokeIntrinsicProperty(property: PropertyName, origin: IntrinsicOrigin, state: PropertyState = game) {
    const record = propertyRecord(property, state);
    const removed = !!record.intrinsic[origin];
    delete record.intrinsic[origin];
    refreshProperty(property, state);
    return removed;
}

export function removeIntrinsicProperty(property: PropertyName, state: PropertyState = game) {
    const record = propertyRecord(property, state);
    const removed = Object.keys(record.intrinsic).length > 0;
    record.intrinsic = {};
    refreshProperty(property, state);
    return removed;
}

export function grantWornProperty(
    property: PropertyName, object: PropertyObject | null, slot: WornPropertySlot, state: PropertyState = game,
) {
    const record = propertyRecord(property, state);
    const objectId = object?.o_id ?? null;
    const alreadyPresent = record.worn.some(source =>
        source.slot === slot
        && (objectId == null || source.objectId === objectId));
    if (!alreadyPresent) {
        record.worn.push({
            slot,
            otyp: object?.otyp ?? null,
            objectId,
        });
    }
    refreshProperty(property, state);
}

export function removeWornProperty(
    property: PropertyName, object: PropertyObject | null, slot: WornPropertySlot, state: PropertyState = game,
) {
    const record = propertyRecord(property, state);
    const objectId = object?.o_id ?? null;
    const oldLength = record.worn.length;
    record.worn = record.worn.filter(source => {
        if (source.slot !== slot) return true;
        if (objectId == null) return source.otyp !== object?.otyp;
        return source.objectId !== objectId;
    });
    refreshProperty(property, state);
    return record.worn.length !== oldLength;
}

export function hasIntrinsicProperty(
    property: PropertyName, origin: IntrinsicOrigin | null = null, state: PropertyState = game,
) {
    const intrinsic = existingPropertyRecord(property, state)?.intrinsic || {};
    return origin == null
        ? Object.keys(intrinsic).length > 0 : !!intrinsic[origin];
}

// C INTRINSIC excludes abilities supplied only by the current monster form.
export function hasPermanentIntrinsicProperty(property: PropertyName, state: PropertyState = game) {
    const intrinsic = existingPropertyRecord(property, state)?.intrinsic || {};
    return permanentOrigins.some(origin => intrinsic[origin]);
}

// C HProperty &= ~INTRINSIC preserves FROMFORM and the timed component.
export function removePermanentIntrinsicProperty(property: PropertyName, state: PropertyState = game) {
    const record = propertyRecord(property, state);
    for (const origin of permanentOrigins)
        delete record.intrinsic[origin];
    return refreshProperty(property, state);
}

export function hasWornProperty(property: PropertyName, state: PropertyState = game) {
    return (existingPropertyRecord(property, state)?.worn.length ?? 0) > 0;
}

export function firstWornPropertySource(property: PropertyName, state: PropertyState = game) {
    return existingPropertyRecord(property, state)?.worn[0] || null;
}

export function wornObjectGrantsProperty(object: PropertyObject, property: PropertyName, state: PropertyState = game) {
    return !!existingPropertyRecord(property, state)?.worn.some(source =>
        source.objectId === object.o_id);
}
