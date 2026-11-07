// Persistent hero properties and the sources which grant them.
// C ref: prop.h intrinsic and extrinsic property masks.

import { game } from './gstate.js';
import { I_SPECIAL, TIMEOUT, TT_PIT, W_ART, W_ARTI } from './const.js';

import { MUMMY_WRAPPING } from './object_data.js';
import { PROPERTY_TIMEOUT_FIELDS } from './property_types.js';
import type {
    CarriedPropertySource, IntrinsicOrigin, PropertyHero, PropertyName, PropertyObject, PropertySources,
    PropertyState, StashedLevitationSources, WornPropertySlot,
} from './property_types.js';
import { monsterIsFlyer, monsterIsSwimmer } from './mondata.js';

const permanentOrigins: readonly IntrinsicOrigin[] = ['role', 'experience', 'race', 'outside'];
const movementProperties: readonly PropertyName[] = ['levitation', 'flying', 'swimming', 'stealth'];

// Port only: the TIMEOUT half of a property's intrinsic mask.
export function propertyTimeout(property: PropertyName, state: PropertyState = game): number {
    return state.u[PROPERTY_TIMEOUT_FIELDS[property]] ?? 0;
}

// C potion.c:set_itimeout(): generic property timeout write.
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

// Port only: lazily creates the property-source record.
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

// Port only: nullable read of the property-source record.
export function existingPropertyRecord(property: PropertyName, state: PropertyState = game): PropertySources | null {
    return state.u?._propertySources?.[property] || null;
}

// Port only: tests a property's timed component.
function timedSourceIsActive(property: PropertyName, hero: PropertyHero): boolean {
    return (hero[PROPERTY_TIMEOUT_FIELDS[property]] ?? 0) > 0;
}

// Port only: exported timed-source test.
export function hasTimedProperty(property: PropertyName, state: PropertyState = game): boolean {
    return timedSourceIsActive(property, state.u);
}

// Port only: tests the intrinsic (non-timed) source set.
function intrinsicSourceIsActive(record: PropertySources | null): boolean {
    return Object.keys(record?.intrinsic || {}).length > 0;
}

// Port only: any-source test across the record's masks.
export function propertySourceIsActive(property: PropertyName, state: PropertyState): boolean {
    const hero = state.u;
    const record = existingPropertyRecord(property, state);
    return intrinsicSourceIsActive(record)
        || (record?.worn.length ?? 0) > 0
        || !!record?.invoked
        || (record?.carried.length ?? 0) > 0
        || timedSourceIsActive(property, hero);
}

// Part of C youprop.h:Levitation(): the HLevitation||ELevitation half,
// ignoring the blocked mask.
// C HLevitation || ELevitation: any live levitation source, worn, invoked,
// carried (W_ART) or timed, independent of the blocked mask.
export function hasRawLevitationSource(state: PropertyState = game) {
    return propertySourceIsActive('levitation', state);
}

// Part of C youprop.h:Levitation(): source test that can ignore the boots
// slot.
export function levitationSourceIsActive(ignoreBoots: boolean, state: PropertyState): boolean {
    const record = existingPropertyRecord('levitation', state);
    return intrinsicSourceIsActive(record) || !!record?.invoked
        || !!record?.carried.length || timedSourceIsActive('levitation', state.u)
        || !!record?.worn.some(source => !ignoreBoots || source.slot !== 'uarmf');
}

// Part of C youprop.h:Levitation(), Flying(): the !blocked mask half.
// C BLevitation/BFlying are stored masks: FROMOUTSIDE (terrain, written by
// setPropertyTerrainBlocked) plus I_SPECIAL (blockedByFloat, written only by
// float_vs_flight() in polyself.js).  A mask can be stale relative to the
// current sources and u.utrap; C's macros read the stale value and so does
// this test.
export function propertyIsBlocked(property: PropertyName, state: PropertyState = game) {
    const record = existingPropertyRecord(property, state);
    if (record?.blockedByTerrain) return true;
    const hero = state.u;
    if (property === 'clairvoyant') return !!hero.clairvoyanceBlocked;
    if (property === 'invisible') {
        const cloak = state.uarmc || hero.uarmc;
        return cloak?.otyp === MUMMY_WRAPPING || !!hero.invisibilityBlocked || !!hero.invisBlocked;
    }
    if (property === 'levitation' || property === 'flying')
        return !!record?.blockedByFloat;
    return false;
}

// Port only: writes the blocked mask's I_SPECIAL half.  C polyself.c
// float_vs_flight() is the sole writer; call floatVsFlight() (polyself.js)
// instead of touching this directly.
export function setPropertyFloatBlocked(
    property: 'levitation' | 'flying', blocked: boolean, state: PropertyState = game,
) {
    propertyRecord(property, state).blockedByFloat = blocked;
}

// Port only: writes the terrain blocker on the property record.
export function setPropertyTerrainBlocked(property: PropertyName, blocked: boolean, state: PropertyState = game) {
    propertyRecord(property, state).blockedByTerrain = blocked;
    refreshProperty(property, state);
}

// Port only: evaluates a property's youprop.h macro from its record.
export function propertyIsActive(property: PropertyName, state: PropertyState = game): boolean {
    const hero = state.u;
    // C Strangled is the intrinsic timeout, not the amulet's worn property.
    // Wearing the amulet does not strangle an immune body.
    if (property === 'strangled') return timedSourceIsActive(property, hero);
    // C Free_action reads the extrinsic mask even when a wizard sets its timer.
    if (property === 'freeAction') {
        const sources = existingPropertyRecord(property, state);
        return !!(sources?.worn.length || sources?.invoked || sources?.carried.length);
    }
    const steed = hero.usteed;
    const fromSteed = !!steed && (property === 'flying' ? monsterIsFlyer(steed.mnum)
        : property === 'swimming' && monsterIsSwimmer(steed.mnum));
    if (!propertySourceIsActive(property, state) && !fromSteed) return false;
    if (property === 'levitation' || property === 'flying' || property === 'invisible' || property === 'clairvoyant')
        return !propertyIsBlocked(property, state);
    if (property === 'stealth' && hero.usteed)
        return propertyIsActive('flying', state)
            || propertyIsActive('levitation', state);
    return true;
}

// Port only: other-source test used when dropping one source.
export function propertyHasOtherSources(property: PropertyName, state: PropertyState = game) {
    const hero = state.u;
    const record = existingPropertyRecord(property, state);
    return intrinsicSourceIsActive(record)
        || (record?.worn.length ?? 0) > 0
        || (record?.carried.length ?? 0) > 0
        || timedSourceIsActive(property, hero);
}

// C youprop.h:Lev_at_will().
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

// Part of C hack.c:spoteffects(): its timeout-1 handling
// (hack.c:3362-3363) tests !(ELevitation || (HLevitation &
// ~(I_SPECIAL | TIMEOUT))) together with a one-turn timeout —
// levitation whose only sources are the timeout counter and the
// blessed-potion at-will marker.  The worn/invoked/intrinsic decode
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

// Port only: projects a property's activity onto the hero flags.
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

// Port only: refreshes one property and its dependants.
export function refreshProperty(property: PropertyName, state: PropertyState = game) {
    const active = projectProperty(property, state);
    if (property === 'levitation' || property === 'flying') {
        projectProperty('flying', state);
        projectProperty('stealth', state);
    }
    return active;
}

// Port only: re-projects the movement properties onto the hero flags.
// The blocked masks are NOT recomputed here: C's macros read the stored
// BLevitation/BFlying (propertyIsBlocked), which only polyself.js
// floatVsFlight() — C polyself.c:float_vs_flight() — and steed.c's
// steed_vs_stealth() equivalents update.
export function refreshMovementProperties(state: PropertyState = game) {
    for (const property of movementProperties)
        projectProperty(property, state);
}

// Part of C trap.c:float_down(): the hmask/emask levitation clears,
// shared with dosinkfall.
// C float_down()/dosinkfall() mask clears.  hmask removes intrinsic
// levitation bits: TIMEOUT zeroes the timeout counter, I_SPECIAL drops the
// blessed-potion at-will origin.  emask removes extrinsic bits: W_ARTI
// clears the invoked artifact, W_ART clears carried-artifact sources pinned
// by the drop finesse (js/artifact.js).  W_SADDLE is never stored, so
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

// Port only: matches a carried property source against its object.
function carriedSourceMatches(source: CarriedPropertySource, object: PropertyObject | null): boolean {
    if (!object) return true; // mask semantics: every carried source
    const objectId = object.o_id ?? null;
    const artifactId = object.oartifact ?? null;
    if (objectId != null && source.objectId === objectId) return true;
    if (artifactId != null && source.artifactId === artifactId) return true;
    return false;
}

// Part of C artifact.c:set_artifact_intrinsic(): the W_ART carried side.
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

// Port only: the W_ART carried-source test.
// Argument order follows hasIntrinsicProperty(property, origin, state):
// the optional object narrows the check to one carried artifact.
export function hasCarriedProperty(property: PropertyName, object: PropertyObject | null = null, state: PropertyState = game) {
    const carried = existingPropertyRecord(property, state)?.carried || [];
    if (!object) return carried.length > 0;
    return carried.some(source => carriedSourceMatches(source, object));
}

// Port only: copies a levitation source record.
function cloneLevitationRecord(record: PropertySources): PropertySources {
    const copy: PropertySources = {
        intrinsic: { ...record.intrinsic },
        worn: record.worn.map(source => ({ ...source })),
        invoked: record.invoked ? { ...record.invoked } : null,
        carried: record.carried.map(source => ({ ...source })),
    };
    if (record.blockedByTerrain !== undefined)
        copy.blockedByTerrain = record.blockedByTerrain;
    if (record.blockedByFloat !== undefined)
        copy.blockedByFloat = record.blockedByFloat;
    return copy;
}

// Part of C hack.c:dosinkfall(): stashing HLevitation/ELevitation before
// the crash.
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

// Part of C hack.c:dosinkfall(): restoring the stashed levitation masks.
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

// Port only: the W_ARTI invoked-source test.
export function hasInvokedProperty(property: PropertyName, state: PropertyState = game) {
    return !!existingPropertyRecord(property, state)?.invoked;
}

// Part of C artifact.c:set_artifact_intrinsic(): the W_ARTI invoked side.
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

// Port only: grants an intrinsic origin on the record.
export function grantIntrinsicProperty(property: PropertyName, origin: IntrinsicOrigin, state: PropertyState = game) {
    const record = propertyRecord(property, state);
    record.intrinsic[origin] = true;
    refreshProperty(property, state);
}

// Port only: revokes an intrinsic origin from the record.
export function revokeIntrinsicProperty(property: PropertyName, origin: IntrinsicOrigin, state: PropertyState = game) {
    const record = propertyRecord(property, state);
    const removed = !!record.intrinsic[origin];
    delete record.intrinsic[origin];
    refreshProperty(property, state);
    return removed;
}

// Port only: drops every intrinsic origin from the record.
export function removeIntrinsicProperty(property: PropertyName, state: PropertyState = game) {
    const record = propertyRecord(property, state);
    const removed = Object.keys(record.intrinsic).length > 0;
    record.intrinsic = {};
    refreshProperty(property, state);
    return removed;
}

// Port only: adds a worn (extrinsic W_*) source to the record.
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

// Port only: removes a worn source from the record.
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

// Port only: intrinsic-origin test.
export function hasIntrinsicProperty(
    property: PropertyName, origin: IntrinsicOrigin | null = null, state: PropertyState = game,
) {
    const intrinsic = existingPropertyRecord(property, state)?.intrinsic || {};
    return origin == null
        ? Object.keys(intrinsic).length > 0 : !!intrinsic[origin];
}

// Part of C prop.h:INTRINSIC(): the property-record form of the mask test
// (const.ts INTRINSIC is the mask constant).
// C INTRINSIC excludes abilities supplied only by the current monster form.
export function hasPermanentIntrinsicProperty(property: PropertyName, state: PropertyState = game) {
    const intrinsic = existingPropertyRecord(property, state)?.intrinsic || {};
    return permanentOrigins.some(origin => intrinsic[origin]);
}

// Part of C prop.h:INTRINSIC(): clearing the permanent intrinsic bits.
// C HProperty &= ~INTRINSIC preserves FROMFORM and the timed component.
export function removePermanentIntrinsicProperty(property: PropertyName, state: PropertyState = game) {
    const record = propertyRecord(property, state);
    for (const origin of permanentOrigins)
        delete record.intrinsic[origin];
    return refreshProperty(property, state);
}

// Port only: the extrinsic worn-source test.
export function hasWornProperty(property: PropertyName, state: PropertyState = game) {
    return (existingPropertyRecord(property, state)?.worn.length ?? 0) > 0;
}

// Port only: first worn source of a property.
export function firstWornPropertySource(property: PropertyName, state: PropertyState = game) {
    return existingPropertyRecord(property, state)?.worn[0] || null;
}

// Port only: whether an object grants the property while worn.
export function wornObjectGrantsProperty(object: PropertyObject, property: PropertyName, state: PropertyState = game) {
    return !!existingPropertyRecord(property, state)?.worn.some(source =>
        source.objectId === object.o_id);
}
