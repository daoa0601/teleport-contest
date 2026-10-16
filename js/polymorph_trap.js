// Polymorph traps triggered by monsters.
// C ref: trap.c:trapeffect_poly().
import { monsterHasMagicResistance, monsterWornIronShoes } from './anti_magic_trap.js';
import { W_ARMF } from './const.js';
import { game } from './gstate.js';
import { addObjectToMonsterInventory, removeObjectFromMonsterInventory } from './monster_inventory.js';
import { applyMonsterEquipmentProperties } from './monster_equipment.js';
import { poly_obj } from './object_polymorph.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { IRON_SHOES, KICKING_BOOTS } from './object_data.js';
import { rn2 } from './rng.js';
import { monsterTrapVisibility } from './trap.js';
async function transformWornIronShoes(monster, shoes, state) {
    await removeObjectFromMonsterInventory(monster, shoes, state, { silently: true });
    const linked = await addObjectToMonsterInventory(monster, shoes, state);
    if (!linked)
        throw new Error('Worn shoes were not linked into the monster inventory.');
    const replacement = await poly_obj(linked, shoes.otyp === IRON_SHOES ? KICKING_BOOTS : IRON_SHOES, { state });
    if (!replacement)
        throw new Error('Polymorphing monster shoes must leave a replacement.');
    replacement.owornmask = W_ARMF;
    replacement.worn = true;
    monster.misc_worn_check = (monster.misc_worn_check ?? 0) | W_ARMF;
    applyMonsterEquipmentProperties(monster, replacement, true);
    return replacement;
}
export async function applyMonsterPolymorphTrap(monster, trap, state = game, { random = rn2 } = {}) {
    const shoes = monsterWornIronShoes(monster);
    if (shoes) {
        return {
            kind: 'polymorph-trap',
            trap,
            changed: false,
            replacementShoes: await transformWornIronShoes(monster, shoes, state),
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
export async function finishMonsterPolymorphTrap(event, { publish = async () => { }, revealTrap = () => { }, finishDeath, state = game, } = {}) {
    if (!event || event.finished)
        return event;
    const change = await changeMonsterForm(event.monster, null, state, {
        showMessage: true,
        publish,
        polyspot: false,
        ...(finishDeath ? { finishDeath } : {}),
    });
    if (change?.heroDied) {
        event.heroDied = true;
        return event;
    }
    event.changed = !!change;
    event.killed = !!change && !change.selfTouch.survived;
    if (event.inSight) {
        event.trap.tseen = true;
        revealTrap(event.trap);
    }
    event.finished = true;
    return event;
}
//# sourceMappingURL=polymorph_trap.js.map