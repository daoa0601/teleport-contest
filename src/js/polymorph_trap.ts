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
import { mksobj } from './mklev.js';
import { addObjectToMonsterInventory, unlinkMonsterObject } from './monster_inventory.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { IRON_SHOES, KICKING_BOOTS } from './object_data.js';
import { rn2 } from './rng.js';
import { monsterTrapVisibility } from './trap.js';
import { objectWeight } from './weight.js';

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
    revealTrap?: (trap: Trap) => void;
    finishDeath?: MonsterDeathHandler;
    state?: GameState;
}

function copyBootState(source: GameObject, replacement: GameObject) {
    const quantity = source.quan ?? source.quantity ?? 1;
    replacement.quan = quantity;
    replacement.quantity = quantity;
    replacement.no_charge = !!source.no_charge;
    replacement.spe = source.spe ?? replacement.spe;
    if (source.enchantment !== undefined && Number.isInteger(source.enchantment))
        replacement.enchantment = source.enchantment;
    replacement.recharged = source.recharged ?? replacement.recharged;
    replacement.cursed = !!source.cursed;
    replacement.blessed = !!source.blessed;
    replacement.oeroded = source.oeroded ?? 0;
    replacement.oeroded2 = source.oeroded2 ?? 0;
    replacement.oerodeproof = !!source.oerodeproof;
    replacement.owt = objectWeight(replacement);
}

async function transformWornIronShoes(monster: Monster, shoes: GameObject, state: GameState) {
    monster.misc_worn_check = (monster.misc_worn_check ?? 0) & ~W_ARMF;
    shoes.owornmask = (shoes.owornmask ?? 0) & ~W_ARMF;
    shoes.worn = (shoes.owornmask ?? 0) !== 0;
    unlinkMonsterObject(monster, shoes);
    const linked = await addObjectToMonsterInventory(monster, shoes, state);
    if (!linked) throw new Error('Worn shoes were not linked into the monster inventory.');

    const replacement = await mksobj(
        shoes.otyp === IRON_SHOES ? KICKING_BOOTS : IRON_SHOES,
        false,
        false,
    );
    copyBootState(shoes, replacement);

    const inventory = monster.minvent || monster.inventory || [];
    const index = inventory.indexOf(linked);
    if (index >= 0) inventory[index] = replacement;
    replacement.where = 'minvent';
    replacement.ocarry = monster;
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
    shoes.ocarry = null;
    delete shoes.carrierMid;
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
        revealTrap = () => {},
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
        event.trap.tseen = true;
        revealTrap(event.trap);
    }
    event.finished = true;
    return event;
}
