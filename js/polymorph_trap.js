// Polymorph traps triggered by monsters.
// C ref: trap.c:trapeffect_poly().

import {
    monsterHasMagicResistance, monsterWornIronShoes,
} from './anti_magic_trap.js';
import { W_ARMF } from './const.js';
import { game } from './gstate.js';
import { mksobj } from './mklev.js';
import {
    addObjectToMonsterInventory, removeObjectFromMonsterInventory,
} from './monster_inventory.js';
import { monsterSelfTouchAfterPolymorph } from './monster_stoning.js';
import { MONSTER_FLAGS2, monsterTypeName } from './monster_data.js';
import { changeMonsterFormWithAppearance } from './monster_polymorph.js';
import { monsterResistsEffect } from './monster_resistance.js';
import {
    IRON_SHOES, KICKING_BOOTS,
} from './object_data.js';
import { rn2 } from './rng.js';
import { monsterTrapVisibility } from './trap.js';
import { objectWeight } from './weight.js';

const M2_NEUTER = 0x00040000;

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
    removeObjectFromMonsterInventory(monster, shoes);
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

function monsterSubject(monster, name = monsterTypeName(
    monster?.mnum, !!monster?.female,
)) {
    if (monster?.name) return monster.name;
    return monster?.mtame ? `Your ${name}` : `The ${name}`;
}

function leashReleaseMessage(monster, visible) {
    if (!visible) return 'Your leash falls slack.';
    const subject = monsterSubject(monster);
    const sentenceSubject = subject.charAt(0).toUpperCase() + subject.slice(1);
    const neuter = (MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_NEUTER;
    const pronoun = neuter ? 'its' : monster.female ? 'her' : 'his';
    return `${sentenceSubject} pulls free of ${pronoun} leash!`;
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

    const change = changeMonsterFormWithAppearance(monster, null, state);
    const changed = !!change;
    return {
        kind: 'polymorph-trap',
        monster,
        trap,
        changed,
        leashReleaseMessage: change?.leashReleased
            ? leashReleaseMessage(monster, change.leashReleaseVisible) : null,
        formChangeMessage: change?.message ?? null,
        finished: !changed && !visibility.inSight,
        ...visibility,
    };
}

export async function finishMonsterPolymorphTrap(
    event,
    {
        publish = async () => {},
        revealTrap = () => {},
        finishDeath,
        rollOne,
        state = game,
    } = {},
) {
    if (!event || event.finished) return event;

    if (event.leashReleaseMessage)
        await publish(event.leashReleaseMessage);

    if (event.formChangeMessage)
        await publish(event.formChangeMessage);

    if (event.changed) {
        const selfTouch = await monsterSelfTouchAfterPolymorph(event.monster, {
            finishDeath,
            publish,
            rollOne,
            state,
        });
        if (!selfTouch.survived) event.killed = true;
    }

    if (event.inSight) {
        event.trap.tseen = true;
        revealTrap(event.trap);
    }
    event.finished = true;
    return event;
}
