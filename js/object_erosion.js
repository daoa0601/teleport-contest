// Item erosion and acid damage. C trap.c:erode_obj(), acid_damage(),
// uhitm.c:erode_armor(), and mhitm.c:rustm().

import { canProjectMonster, plineWithContinuation } from './display.js';
import { isPoolAt } from './dbridge.js';
import { game } from './gstate.js';
import { heroSpecies } from './hero_species.js';
import { AD_CORR, AD_FIRE, AD_RUST } from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_NAME } from './monster_data.js';
import { destroyObjectFromMonsterInventory } from './monster_inventory.js';
import { monsterSentenceSubject } from './monster_sound.js';
import {
    DWARVISH_CLOAK, OBJECT_MATERIAL, OBJECT_NAMES, OBJECT_PROPERTY,
    OBJECT_SUBTYPE, SCR_BLANK_PAPER, TALLOW_CANDLE, WAN_FIRE, WAX_CANDLE,
} from './object_data.js';
import { deleteObject } from './object_delete.js';
import { armorUsesPairGrammar, makePlural } from './object_grammar.js';
import { hasWornProperty } from './properties.js';
import { rn2, rnl } from './rng.js';
import { heroIsBlind } from './senses.js';
import { chargeAlteredUnpaidObject } from './shk.js';
import { cansee } from './vision.js';
import { W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU } from './const.js';

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

export async function erodeAttackingWeapon(defender, weapon, {
    state = game, random = rn2, ...options
} = {}) {
    if (!weapon) return;
    const species = defender === state.u ? heroSpecies(state) : defender.mnum;
    const attacks = MONSTER_ATTACKS[species];
    const hasDamage = type => attacks.some(attack => attack[1] === type);
    const kind = hasDamage(AD_CORR) ? 'corrosion'
        : hasDamage(AD_RUST) ? 'rust'
            : hasDamage(AD_FIRE) && species !== PM_STEAM_VORTEX ? 'burn' : null;
    if (kind && random(kind === 'burn' ? 6 : 1) === 0) {
        await erodeObject(weapon, kind, { ...options, state, random, verbose: true });
    }
}

export async function erodeArmor(defender, kind, {
    state = game, random = rn2, ...options
} = {}) {
    const layers = [
        [W_ARMH], [W_ARMC, W_ARM, W_ARMU], [W_ARMS], [W_ARMG], [W_ARMF],
    ];
    const inventory = defender === state.u ? state.inventory : defender.minvent;
    for (;;) {
        const slot = random(5);
        let object = null;
        for (const mask of layers[slot]) {
            object = inventory.find(item => item.owornmask & mask);
            if (object) break;
        }
        const result = object
            ? await erodeObject(object, kind, {
                ...options, state, random, verbose: slot === 1,
            }) : 'nothing';
        if (slot === 1 || result !== 'nothing') return result;
    }
}

export async function damageObjectWithAcid(object, {
    state = game, publish = plineWithContinuation, random = rn2, ...options
} = {}) {
    if (!object) return;
    const view = objectView(object, state, options.position);
    if (view.hero && inventoryResists('corrosion', state, random)) return;
    if (object.greased) {
        await protectWithGrease(object, view, publish, random);
    } else if (object.oclass === SCROLL_CLASS && object.otyp !== SCR_BLANK_PAPER) {
        if (!heroIsBlind(state) && (view.hero || view.monsterVisible))
            await publish(`${view.subject} ${view.plural ? 'fade' : 'fades'}.`);
        object.otyp = SCR_BLANK_PAPER;
        object.spe = 0;
        object.dknown = false;
        if (object.name) object.name = 'scroll of blank paper';
        if (object.plural) object.plural = 'scrolls of blank paper';
    } else {
        await erodeObject(object, 'corrosion', {
            ...options, state, publish, random, verbose: true,
        });
    }
}

export async function erodeObject(object, kind, {
    state = game,
    publish = plineWithContinuation,
    random = rn2,
    luckRandom = rnl,
    verbose = false,
    grease = true,
    destroy = false,
    pay = false,
    position,
} = {}) {
    if (!object) return 'nothing';
    const rule = EROSION[kind];
    if (!rule) throw new TypeError(`Unknown erosion: ${kind}`);
    const view = objectView(object, state, position);
    const agreement = view.plural ? 'are' : 'is';
    if (view.hero && inventoryResists(kind, state, random)) return 'nothing';
    if (grease && kind !== 'burn' && kind !== 'rot' && object.greased) {
        await protectWithGrease(object, view, publish, random);
        return 'greased';
    }
    if (!erosionMatters(object)) return 'nothing';
    const tell = verbose && state.flags.verbose !== false;
    if (!vulnerableTo(object, kind) || (object.oerodeproof && object.rknown)) {
        if (tell && (view.hero || view.monsterVisible)) {
            await publish(
                `${view.subject} ${agreement} not affected by ${rule.cause}.`,
            );
        }
        return 'nothing';
    }
    if (object.oerodeproof || (object.blessed && luckRandom(4) === 0)) {
        if (state.flags.verbose !== false
            && (verbose || object.oerodeproof) && view.visible) {
            await publish(
                `Somehow, ${view.lowerSubject} ${agreement} not affected by the ${rule.cause}.`,
            );
        }
        if (object.oerodeproof) object.rknown = true;
        return 'nothing';
    }

    const erosion = object[rule.field] ?? 0;
    const verb = rule.verb + (view.plural ? '' : 's');
    if (erosion < 3) {
        const adverb = erosion === 2 ? ' completely' : erosion ? ' further' : '';
        if (view.visible) await publish(`${view.subject} ${verb}${adverb}!`);
        if (pay) await chargeAlteredUnpaidObject(object, rule.past, state);
        object[rule.field] = erosion + 1;
        if (view.hero) state._armorClassDirty = true;
        return 'damaged';
    }
    if (destroy) {
        object.in_use = true;
        const action = kind === 'crack'
            ? view.plural ? 'shatter' : 'shatters' : `${verb} away`;
        if (view.visible) await publish(`${view.subject} ${action}!`);
        if (pay) await chargeAlteredUnpaidObject(object, rule.past, state);
        if (view.carrier && !view.hero) {
            await destroyObjectFromMonsterInventory(
                view.carrier, object, state, { publish },
            );
        } else {
            deleteObject(object, state);
        }
        return 'destroyed';
    }
    if (tell && view.visible) {
        const sense = view.hero && heroIsBlind(state) ? 'feel' : 'look';
        await publish(
            `${view.subject} ${sense}${view.plural ? '' : 's'} completely ${rule.past}.`,
        );
    }
    return 'nothing';
}

function objectCanBurn(object) {
    if ([TALLOW_CANDLE, WAX_CANDLE, WAN_FIRE].includes(object.otyp)
        || OBJECT_PROPERTY[object.otyp] === 'fireResistance') return false;
    const material = OBJECT_MATERIAL[object.otyp];
    return (material <= 8 && material !== 1) || material === 18;
}

function erosionMatters(object) {
    return [WEAPON_CLASS, ARMOR_CLASS, BALL_CLASS, CHAIN_CLASS].includes(object.oclass)
        || (object.oclass === TOOL_CLASS && OBJECT_SUBTYPE[object.otyp] !== 0);
}

function vulnerableTo(object, kind) {
    const material = OBJECT_MATERIAL[object.otyp];
    if (kind === 'burn') return objectCanBurn(object);
    if (kind === 'rust') return material === 11;
    if (kind === 'corrosion') return material === 11 || material === 13;
    if (kind === 'rot') return (material <= 8 && material !== 1) || material === 10;
    return material === 19 && object.oclass === ARMOR_CLASS;
}

function inventoryResists(kind, state, random) {
    if (kind !== 'burn' && kind !== 'corrosion') return false;
    const property = kind === 'burn' ? 'fireResistance' : 'acidResistance';
    if (hasWornProperty(property, state)) return random(100) < 99;
    return kind === 'burn' && state.uarmc?.otyp === DWARVISH_CLOAK
        && random(100) < 90;
}

async function protectWithGrease(object, view, publish, random) {
    if (view.hero || view.monsterVisible) {
        await publish(
            `${view.subject} ${view.plural ? 'are' : 'is'} protected by the layer of grease!`,
        );
    }
    if (random(2) === 0) {
        object.greased = false;
        if (view.hero) await publish('The grease dissolves.');
    }
}

function objectView(object, state, position = { x: object.ox, y: object.oy }) {
    const hero = object.where === 'inventory';
    let carrier = null;
    if (hero) {
        carrier = state.u;
    } else if (object.where === 'minvent') {
        carrier = state.u.usteed?.m_id === object.carrierMid ? state.u.usteed
            : state.level.monsters.find(monster => monster.m_id === object.carrierMid);
    }
    const monsterVisible = !!carrier && !hero
        && canProjectMonster(carrier, carrier.mx, carrier.my);
    const { x, y } = position;
    const floorVisible = !carrier && cansee(x, y)
        && (!isPoolAt(x, y, state) || (state.u.underwater
            && Math.max(Math.abs(state.u.ux - x), Math.abs(state.u.uy - y)) <= 1));
    const owner = hero ? 'Your' : monsterVisible
        ? `${monsterSentenceSubject(carrier)}'s` : 'The';
    let name = object.name || object.description || OBJECT_NAMES[object.otyp];
    if (!object.name && !object.description && object.oclass === SCROLL_CLASS)
        name = `scroll of ${name}`;
    if (object.quan > 1) name = makePlural(name);
    const plural = object.quan > 1 || armorUsesPairGrammar(name) || name.endsWith('scales');
    const subject = `${owner} ${name}`;
    return {
        hero, carrier, monsterVisible, plural, subject,
        lowerSubject: subject.replace(/^(Your|The) /u, word => word.toLowerCase()),
        visible: hero || monsterVisible || floorVisible,
    };
}
