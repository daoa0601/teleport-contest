// Persistent hero properties and the sources which grant them.
// C ref: prop.h intrinsic and extrinsic property masks.

import { game } from './gstate.js';

function propertyRecord(property, state = game) {
    const hero = state.u || (state.u = {});
    if (!hero._propertySources) hero._propertySources = {};
    if (!hero._propertySources[property]) {
        hero._propertySources[property] = {
            intrinsic: {},
            worn: [],
            invoked: null,
        };
    }
    const record = hero._propertySources[property];
    if (!Object.prototype.hasOwnProperty.call(record, 'invoked'))
        record.invoked = null;
    return record;
}

function existingPropertyRecord(property, state = game) {
    return state.u?._propertySources?.[property] || null;
}

function timedSourceIsActive(property, hero) {
    if (property === 'antimagic')
        return (hero.magicResistanceTurns ?? 0) > 0;
    return (hero[`${property}Turns`] ?? 0) > 0;
}

function intrinsicSourceIsActive(record) {
    return Object.keys(record?.intrinsic || {}).length > 0;
}

export function propertyIsActive(property, state = game) {
    const hero = state.u || {};
    const record = existingPropertyRecord(property, state);
    return intrinsicSourceIsActive(record)
        || (record?.worn.length ?? 0) > 0
        || !!record?.invoked
        || timedSourceIsActive(property, hero);
}

export function propertyHasOtherSources(property, state = game) {
    const hero = state.u || {};
    const record = existingPropertyRecord(property, state);
    return intrinsicSourceIsActive(record)
        || (record?.worn.length ?? 0) > 0
        || timedSourceIsActive(property, hero);
}

export function refreshProperty(property, state = game) {
    const record = propertyRecord(property, state);
    const hero = state.u;
    hero[property] = propertyIsActive(property, state);
    hero[`${property}FromArmor`] = record.worn.some(source =>
        source.slot?.startsWith('uarm'));
    return hero[property];
}

export function hasInvokedProperty(property, state = game) {
    return !!existingPropertyRecord(property, state)?.invoked;
}

export function setInvokedProperty(
    property, object, active, state = game,
) {
    const record = propertyRecord(property, state);
    record.invoked = active ? {
        objectId: object?.o_id ?? null,
        artifactId: object?.oartifact ?? null,
        objectType: object?.otyp ?? null,
    } : null;
    return refreshProperty(property, state);
}

export function grantIntrinsicProperty(property, origin, state = game) {
    const record = propertyRecord(property, state);
    record.intrinsic[origin] = true;
    refreshProperty(property, state);
}

export function revokeIntrinsicProperty(property, origin, state = game) {
    const record = propertyRecord(property, state);
    const removed = !!record.intrinsic[origin];
    delete record.intrinsic[origin];
    refreshProperty(property, state);
    return removed;
}

export function removeIntrinsicProperty(property, state = game) {
    const record = propertyRecord(property, state);
    const removed = Object.keys(record.intrinsic).length > 0;
    record.intrinsic = {};
    refreshProperty(property, state);
    return removed;
}

export function grantWornProperty(
    property, object, slot, state = game,
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
    property, object, slot, state = game,
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
    property, origin = null, state = game,
) {
    const intrinsic = existingPropertyRecord(property, state)?.intrinsic || {};
    return origin == null
        ? Object.keys(intrinsic).length > 0 : !!intrinsic[origin];
}

export function hasWornProperty(property, state = game) {
    return (existingPropertyRecord(property, state)?.worn.length ?? 0) > 0;
}

export function firstWornPropertySource(property, state = game) {
    return existingPropertyRecord(property, state)?.worn[0] || null;
}
