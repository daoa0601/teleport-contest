// Native weapon.c:special_dmgval(): blessed armor and silver contact.
import { W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU, W_RINGL, W_RINGR, } from './const.js';
import { game } from './gstate.js';
import { heroSpecies } from './hero_species.js';
import { monsterHatesBlessings, monsterHatesSilver } from './monster_data.js';
import { objectMaterial } from './object_material.js';
import { rnd } from './rng.js';
const SILVER = 14;
const ARMOR_SLOTS = new Map([
    [W_ARM, 'uarm'], [W_ARMC, 'uarmc'], [W_ARMH, 'uarmh'],
    [W_ARMS, 'uarms'], [W_ARMG, 'uarmg'], [W_ARMF, 'uarmf'], [W_ARMU, 'uarmu'],
]);
export function specialContactDamage(attacker, defender, mask, { state = game } = {}) {
    const left = !!(mask & W_RINGL);
    const right = !!(mask & W_RINGR);
    const target = contactDefender(defender, state);
    let armor = null;
    if (mask & (W_ARMC | W_ARM | W_ARMU)) {
        for (const layer of [W_ARMC, W_ARM, W_ARMU]) {
            if (!(mask & layer))
                continue;
            armor = wornArmor(attacker, layer, state);
            if (armor) {
                mask = layer;
                break;
            }
        }
    }
    else if (mask & (W_ARMG | W_RINGL | W_RINGR)) {
        armor = wornArmor(attacker, W_ARMG, state);
        mask = armor ? W_ARMG : 0;
    }
    else
        armor = wornArmor(attacker, mask, state);
    let damage = 0;
    let silverMask = 0;
    if (armor) {
        if (armor.blessed && monsterHatesBlessings(target))
            damage += rnd(4);
        if (objectMaterial(armor, state) === SILVER && monsterHatesSilver(target)) {
            damage += rnd(20);
            silverMask = mask;
        }
    }
    else if ((left || right) && attacker === state.u) {
        const rings = [
            [left, 'uleft', W_RINGL], [right, 'uright', W_RINGR],
        ];
        for (const [selected, slot, ringMask] of rings) {
            const ring = state[slot] || state.u[slot];
            if (selected && ring && objectMaterial(ring, state) === SILVER
                && monsterHatesSilver(target)) {
                if (!silverMask)
                    damage += rnd(20);
                silverMask |= ringMask;
            }
        }
    }
    return { damage, silverMask };
}
function contactDefender(actor, state) {
    if ('mnum' in actor)
        return actor;
    if (actor !== state.u)
        throw new Error('Contact damage requires the hero from its game state.');
    const body = { mnum: heroSpecies(state) };
    if (state.u.mcham !== undefined)
        body.cham = state.u.mcham;
    return body;
}
function wornArmor(actor, mask, state) {
    if (actor !== state.u) {
        if (!('mnum' in actor))
            throw new Error('Contact damage requires the hero from its game state.');
        return (actor.minvent || []).find(object => (object.owornmask || 0) & mask) || null;
    }
    const slot = ARMOR_SLOTS.get(mask);
    return slot ? state[slot] || state.u[slot] || null : null;
}
//# sourceMappingURL=contact_damage.js.map