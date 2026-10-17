// Item erosion and acid damage. C trap.c:erode_obj(), acid_damage(),
// uhitm.c:erode_armor(), and mhitm.c:rustm().
import { canSeeMonster, plineWithContinuation } from './display.js';
import { isPoolAt } from './terrain_properties.js';
import { game } from './gstate.js';
import { objectMaterial } from './object_material.js';
import { heroSpecies } from './hero_species.js';
import { AD_CORR, AD_FIRE, AD_RUST } from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_NAME } from './monster_data.js';
import { removeObjectFromMonsterInventory } from './monster_inventory.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { monsterName, possessiveName } from './monster_name.js';
import { DWARVISH_CLOAK, OBJECT_PROPERTY, OBJECT_SUBTYPE, SCR_BLANK_PAPER, TALLOW_CANDLE, WAN_FIRE, WAX_CANDLE, } from './object_data.js';
import { delobj } from './object_delete.js';
import { verbForSubject } from './object_grammar.js';
import { objectCombatName, ownedObjectAction } from './objnam.js';
import { hasWornProperty } from './properties.js';
import { rn2, rnl } from './rng.js';
import { heroIsBlind } from './senses.js';
import { chargeAlteredUnpaidObject } from './shk.js';
import { cansee } from './vision.js';
import { W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU } from './const.js';
function isHeroDefender(defender, state) {
    return defender === state.u;
}
const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const TOOL_CLASS = 6;
const SCROLL_CLASS = 9;
const BALL_CLASS = 15;
const CHAIN_CLASS = 16;
const PM_STEAM_VORTEX = MONSTER_NAME.indexOf('steam vortex');
const EROSION = {
    burn: { field: 'oeroded', verb: 'smoulder', past: 'burnt', cause: 'heat' },
    rust: { field: 'oeroded', verb: 'rust', past: 'rusted', cause: 'oxidation' },
    rot: { field: 'oeroded2', verb: 'rot', past: 'rotten', cause: 'decay' },
    corrosion: { field: 'oeroded2', verb: 'corrode', past: 'corroded', cause: 'corrosion' },
    crack: { field: 'oeroded', verb: 'crack', past: 'cracked', cause: 'impact' },
};
export async function erodeAttackingWeapon(defender, weapon, { state = game, random = rn2, ...options } = {}) {
    if (!weapon)
        return;
    const species = isHeroDefender(defender, state) ? heroSpecies(state) : defender.mnum;
    const attacks = MONSTER_ATTACKS[species];
    if (!attacks)
        throw new RangeError(`Unknown monster species: ${species}`);
    const hasDamage = (type) => attacks.some(attack => attack[1] === type);
    const kind = hasDamage(AD_CORR) ? 'corrosion'
        : hasDamage(AD_RUST) ? 'rust'
            : hasDamage(AD_FIRE) && species !== PM_STEAM_VORTEX ? 'burn' : null;
    if (kind && random(kind === 'burn' ? 6 : 1) === 0) {
        await erodeObject(weapon, kind, { ...options, state, random, verbose: true });
    }
}
export async function erodeArmor(defender, kind, { state = game, random = rn2, ...options } = {}) {
    const layers = [
        [W_ARMH], [W_ARMC, W_ARM, W_ARMU], [W_ARMS], [W_ARMG], [W_ARMF],
    ];
    const inventory = isHeroDefender(defender, state) ? state.inventory : (defender.minvent ?? []);
    for (;;) {
        const slot = random(5);
        const masks = layers[slot];
        if (!masks)
            throw new RangeError(`Invalid armor erosion slot: ${slot}`);
        let object;
        for (const mask of masks) {
            object = inventory.find(item => (item.owornmask ?? 0) & mask);
            if (object)
                break;
        }
        const result = object
            ? await erodeObject(object, kind, {
                ...options, state, random, verbose: slot === 1,
            }) : 'nothing';
        if (slot === 1 || result !== 'nothing')
            return result;
    }
}
export async function damageObjectWithAcid(object, { state = game, publish = plineWithContinuation, random = rn2, ...options } = {}) {
    if (!object)
        return;
    if (object.where === 'inventory' && inventoryResists('corrosion', state, random))
        return;
    if (object.greased) {
        await protectWithGrease(object, null, state, publish, random);
    }
    else if (object.oclass === SCROLL_CLASS && object.otyp !== SCR_BLANK_PAPER) {
        const view = objectView(object, state, options.position);
        if (!heroIsBlind(state) && (view.hero || view.monsterVisible))
            await publish(`${objectSubject(view, state)} ${view.plural ? 'fade' : 'fades'}.`);
        object.otyp = SCR_BLANK_PAPER;
        object.spe = 0;
        object.dknown = false;
        if (object.name)
            object.name = 'scroll of blank paper';
        if (object.plural)
            object.plural = 'scrolls of blank paper';
    }
    else {
        await erodeObject(object, 'corrosion', {
            ...options, state, publish, random, verbose: true,
        });
    }
}
export async function erodeObject(object, kind, { state = game, publish = plineWithContinuation, random = rn2, luckRandom = rnl, verbose = false, grease = true, destroy = false, pay = false, displayName = null, position, } = {}) {
    if (!object)
        return 'nothing';
    const rule = EROSION[kind];
    if (!rule)
        throw new TypeError(`Unknown erosion: ${kind}`);
    if (object.where === 'inventory' && inventoryResists(kind, state, random))
        return 'nothing';
    const view = objectView(object, state, position, displayName);
    const agreement = view.plural ? 'are' : 'is';
    if (grease && kind !== 'burn' && kind !== 'rot' && object.greased) {
        await protectWithGrease(object, view, state, publish, random);
        return 'greased';
    }
    if (!erosionMatters(object))
        return 'nothing';
    const tell = verbose && state.flags.verbose !== false;
    if (!objectIsVulnerableToErosion(object, kind, state) || (object.oerodeproof && object.rknown)) {
        if (tell && (view.hero || view.monsterVisible)) {
            await publish(`${objectSubject(view, state)} ${agreement} not affected by ${rule.cause}.`);
        }
        return 'nothing';
    }
    if (object.oerodeproof || (object.blessed && luckRandom(4) === 0)) {
        if (state.flags.verbose !== false
            && (verbose || object.oerodeproof) && view.visible) {
            await publish(`Somehow, ${objectSubject(view, state, false)} ${agreement} not affected by the ${rule.cause}.`);
        }
        if (object.oerodeproof)
            object.rknown = true;
        return 'nothing';
    }
    const erosion = object[rule.field] ?? 0;
    const verb = rule.verb + (view.plural ? '' : 's');
    if (erosion < 3) {
        const adverb = erosion === 2 ? ' completely' : erosion ? ' further' : '';
        if (view.visible)
            await publish(`${objectSubject(view, state)} ${verb}${adverb}!`);
        if (pay)
            await chargeAlteredUnpaidObject(object, rule.past, state);
        object[rule.field] = erosion + 1;
        if (view.hero)
            state._armorClassDirty = true;
        return 'damaged';
    }
    if (destroy) {
        object.in_use = true;
        const action = kind === 'crack'
            ? view.plural ? 'shatter' : 'shatters' : `${verb} away`;
        if (view.visible)
            await publish(`${objectSubject(view, state)} ${action}!`);
        if (pay)
            await chargeAlteredUnpaidObject(object, rule.past, state);
        if (object.owornmask) {
            if (view.hero) {
                await removeWornHeroItem(object, state);
                if (state.program_state?.gameover)
                    return 'destroyed';
            }
            else if (view.carrier) {
                await removeObjectFromMonsterInventory(view.carrier, object, state, { publish });
            }
            else {
                object.owornmask = 0;
            }
        }
        await delobj(object, state);
        return 'destroyed';
    }
    if (tell && view.visible) {
        const sense = view.hero && heroIsBlind(state) ? 'feel' : 'look';
        await publish(`${objectSubject(view, state)} ${sense}${view.plural ? '' : 's'} completely ${rule.past}.`);
    }
    return 'nothing';
}
function objectCanBurn(object, state) {
    if ([TALLOW_CANDLE, WAX_CANDLE, WAN_FIRE].includes(object.otyp)
        || OBJECT_PROPERTY[object.otyp] === 'fireResistance')
        return false;
    const material = objectMaterial(object, state);
    return (material <= 8 && material !== 1) || material === 18;
}
export function erosionMatters(object) {
    return [WEAPON_CLASS, ARMOR_CLASS, BALL_CLASS, CHAIN_CLASS].includes(object.oclass)
        || (object.oclass === TOOL_CLASS && OBJECT_SUBTYPE[object.otyp] !== 0);
}
export function objectIsVulnerableToErosion(object, kind, state = game) {
    const material = objectMaterial(object, state);
    if (kind === 'burn')
        return objectCanBurn(object, state);
    if (kind === 'rust')
        return material === 11;
    if (kind === 'corrosion')
        return material === 11 || material === 13;
    if (kind === 'rot')
        return (material <= 8 && material !== 1) || material === 10;
    return material === 19 && object.oclass === ARMOR_CLASS;
}
function inventoryResists(kind, state, random) {
    if (kind !== 'burn' && kind !== 'corrosion')
        return false;
    const property = kind === 'burn' ? 'fireResistance' : 'acidResistance';
    if (hasWornProperty(property, state))
        return random(100) < 99;
    return kind === 'burn' && state.uarmc?.otyp === DWARVISH_CLOAK
        && random(100) < 90;
}
async function protectWithGrease(object, view, state, publish, random) {
    if (view && (view.hero || view.monsterVisible)) {
        // Native grease feedback appends 's even when the name ends in s.
        const subject = view.monsterVisible && view.carrier
            ? `${monsterName(view.carrier, { state, capitalized: true })}'s ${view.name}`
            : objectSubject(view, state);
        await publish(`${subject} ${view.plural ? 'are' : 'is'} protected by the layer of grease!`);
    }
    else if (!view) {
        const carrier = objectCarrier(object, state);
        // acid_damage supplies no name; grease_protect names the object only
        // inside this feedback guard, so silent protection cannot reveal it.
        if (object.where === 'inventory' || (carrier && canSeeMonster(carrier))) {
            await publish(`${ownedObjectAction(object, 'are', state)} protected by the layer of grease!`);
        }
    }
    if (random(2) === 0) {
        object.greased = false;
        if (object.where === 'inventory')
            await publish('The grease dissolves.');
    }
}
function objectCarrier(object, state) {
    if (object.where !== 'minvent')
        return null;
    return state.u.usteed && state.u.usteed.m_id === object.carrierMid ? state.u.usteed
        : (state.level?.monsters.find(monster => monster.m_id === object.carrierMid) ?? null);
}
function objectView(object, state, position = { x: object.ox, y: object.oy }, displayName = null) {
    const hero = object.where === 'inventory';
    const carrier = objectCarrier(object, state);
    const monsterVisible = !!carrier && !hero
        && canSeeMonster(carrier);
    const { x, y } = position;
    const floorVisible = !hero && !carrier && cansee(x, y)
        && (!isPoolAt(x, y, state) || (!!state.u.underwater
            && Math.max(Math.abs(state.u.ux - x), Math.abs(state.u.uy - y)) <= 1));
    let name = displayName ?? objectCombatName(object, { state });
    if (!hero && !monsterVisible)
        name = name.replace(/^the /iu, '');
    const plural = verbForSubject(name, 'are') === 'are';
    return {
        hero, carrier, monsterVisible, plural, name,
        visible: hero || monsterVisible || floorVisible,
    };
}
function objectSubject(view, state, capitalized = true) {
    if (view.hero)
        return `${capitalized ? 'Your' : 'your'} ${view.name}`;
    if (view.monsterVisible && view.carrier) {
        const owner = monsterName(view.carrier, { state, capitalized });
        return `${possessiveName(owner)} ${view.name}`;
    }
    return `${capitalized ? 'The' : 'the'} ${view.name}`;
}
//# sourceMappingURL=object_erosion.js.map