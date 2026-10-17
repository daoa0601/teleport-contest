// Polymorph traps triggered by monsters.
// C ref: trap.c:trapeffect_poly().

import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import type { Trap } from './map_types.js';
import type { MessagePublisher } from './display.js';
import type { MonsterDeathHandler } from './monster_death.js';
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
import { monsterTrapVisibility, seeTrap } from './trap.js';

interface PolymorphTrapBase {
    kind: 'polymorph-trap';
    trap: Trap;
    changed: boolean;
}

interface ResolvedPolymorphTrap extends PolymorphTrapBase {
    changed: false;
    finished: true;
}

export interface MonsterPolymorphChangeEvent extends PolymorphTrapBase {
    monster: Monster;
    finished: boolean;
    inSight: boolean;
    seeSquare: boolean;
    heroDied?: boolean;
    killed?: boolean;
}

export type MonsterPolymorphTrapEvent =
    | (ResolvedPolymorphTrap & { replacementShoes: GameObject })
    | (ResolvedPolymorphTrap & { shielded: true; inSight: boolean; seeSquare: boolean })
    | (ResolvedPolymorphTrap & { resisted: true; inSight: boolean; seeSquare: boolean })
    | MonsterPolymorphChangeEvent;

interface PolymorphTrapOptions {
    publish?: MessagePublisher;
    finishDeath?: MonsterDeathHandler;
    state?: GameState;
}

async function transformWornIronShoes(monster: Monster, shoes: GameObject, state: GameState) {
    await removeObjectFromMonsterInventory(monster, shoes, state, { silently: true });
    const linked = await addObjectToMonsterInventory(monster, shoes, state);
    if (!linked) throw new Error('Worn shoes were not linked into the monster inventory.');
    const replacement = await poly_obj(linked,
        shoes.otyp === IRON_SHOES ? KICKING_BOOTS : IRON_SHOES, { state });
    if (!replacement) throw new Error('Polymorphing monster shoes must leave a replacement.');
    replacement.owornmask = W_ARMF;
    replacement.worn = true;
    monster.misc_worn_check = (monster.misc_worn_check ?? 0) | W_ARMF;
    applyMonsterEquipmentProperties(monster, replacement, true);
    return replacement;
}

export async function applyMonsterPolymorphTrap(
    monster: Monster,
    trap: Trap,
    state: GameState = game,
    { random = rn2 } = {},
): Promise<MonsterPolymorphTrapEvent> {
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

export async function finishMonsterPolymorphTrap(
    event: MonsterPolymorphTrapEvent | null,
    {
        publish = async () => {},
        finishDeath,
        state = game,
    }: PolymorphTrapOptions = {},
) {
    if (!event || event.finished) return event;

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
        seeTrap(event.trap, state);
    }
    event.finished = true;
    return event;
}
