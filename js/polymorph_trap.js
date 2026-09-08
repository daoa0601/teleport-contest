// Polymorph traps triggered by monsters.
// C ref: trap.c:trapeffect_poly().

import {
    monsterHasMagicResistance, monsterWornIronShoes,
} from './anti_magic_trap.js';
import { W_ARMF } from './const.js';
import { game } from './gstate.js';
import { mksobj } from './mklev.js';
import {
    addObjectToMonsterInventory, unlinkMonsterObject,
} from './monster_inventory.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { monsterResistsEffect } from './monster_resistance.js';
import {
    IRON_SHOES, KICKING_BOOTS,
} from './object_data.js';
import { rn2 } from './rng.js';
import { monsterTrapVisibility } from './trap.js';
import { objectWeight } from './weight.js';

function copyBootState(source, replacement) {
    const quantity = source.quan ?? source.quantity ?? 1;
    replacement.quan = quantity;
    replacement.quantity = quantity;
    replacement.no_charge = !!source.no_charge;
    replacement.spe = source.spe ?? replacement.spe;
    if (Number.isInteger(source.enchantment))
        replacement.enchantment = source.enchantment;
    replacement.recharged = source.recharged ?? replacement.recharged;
    replacement.cursed = !!source.cursed;
    replacement.blessed = !!source.blessed;
    replacement.oeroded = source.oeroded ?? 0;
    replacement.oeroded2 = source.oeroded2 ?? 0;
    replacement.oerodeproof = !!source.oerodeproof;
    replacement.owt = objectWeight(replacement);
}

function transformWornIronShoes(monster, shoes, state) {
    monster.misc_worn_check = (monster.misc_worn_check ?? 0) & ~W_ARMF;
    shoes.owornmask = (shoes.owornmask ?? 0) & ~W_ARMF;
    shoes.worn = (shoes.owornmask ?? 0) !== 0;
    unlinkMonsterObject(monster, shoes);
    const linked = addObjectToMonsterInventory(monster, shoes, state);

    const replacement = mksobj(
        shoes.otyp === IRON_SHOES ? KICKING_BOOTS : IRON_SHOES,
        false,
        false,
    );
    copyBootState(shoes, replacement);

    const inventory = monster.minvent || monster.inventory || [];
    const index = inventory.indexOf(linked);
    if (index >= 0) inventory[index] = replacement;
    replacement.where = 'minvent';
    replacement.carrierMid = monster.m_id ?? null;
    replacement.owornmask = W_ARMF;
    replacement.worn = true;
    monster.misc_worn_check = (monster.misc_worn_check ?? 0) | W_ARMF;
    monster.minvent = inventory;
    monster.inventory = inventory;
    monster.hasInventory = inventory.length > 0;

    shoes.where = 'gone';
    shoes.owornmask = 0;
    shoes.worn = false;
    delete shoes.carrierMid;
    return replacement;
}

export function applyMonsterPolymorphTrap(
    monster,
    trap,
    state = game,
    { random = rn2 } = {},
) {
    const shoes = monsterWornIronShoes(monster);
    if (shoes) {
        return {
            kind: 'polymorph-trap',
            trap,
            changed: false,
            replacementShoes: transformWornIronShoes(
                monster, shoes, state,
            ),
            finished: true,
        };
    }

    const visibility = monsterTrapVisibility(monster, state);
    if (monsterHasMagicResistance(monster)) {
        return {
            kind: 'polymorph-trap',
            trap,
            changed: false,
            shielded: true,
            finished: true,
            ...visibility,
        };
    }
    if (monsterResistsEffect(monster, 12, random)) {
        return {
            kind: 'polymorph-trap',
            trap,
            changed: false,
            resisted: true,
            finished: true,
            ...visibility,
        };
    }

    return {
        kind: 'polymorph-trap',
        monster,
        trap,
        changed: false,
        finished: false,
        ...visibility,
    };
}

export async function finishMonsterPolymorphTrap(
    event,
    {
        publish = async () => {},
        revealTrap = () => {},
        finishDeath,
        state = game,
    } = {},
) {
    if (!event || event.finished) return event;

    const change = await changeMonsterForm(event.monster, null, state, {
        showMessage: true, finishDeath, publish, polyspot: false,
    });
    event.changed = !!change;
    event.killed = !!change && !change.selfTouch.survived;

    if (event.inSight) {
        event.trap.tseen = true;
        revealTrap(event.trap);
    }
    event.finished = true;
    return event;
}
