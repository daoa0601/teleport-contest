// Poison applied by the hero's weapon.
// C ref: uhitm.c hmon_hitmon_poison().

import { adjustHeroAlignment } from './alignment.js';
import { A_LAWFUL } from './const.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { MessagePublisher } from './display.js';
import type { HeroPhysicalAttackMode } from './hero_physical_types.js';
import { monsterHasPoisonResistance } from './monster_resistance.js';
import {
    isLauncherAmmunition, isMissileObject, isPermanentlyPoisonedObject,
    isPoisonableObject,
} from './object_properties.js';
import { rn2, rnd } from './rng.js';

export interface HeroWeaponPoisonOptions {
    state?: GameState;
    mode: HeroPhysicalAttackMode;
    dieRoll: number;
    publish: MessagePublisher;
    random?: (range: number) => number;
    rollOne?: (sides: number) => number;
}

export interface HeroWeaponPoisonResult {
    damage: number;
    deadly: boolean;
    resisted: boolean;
    woreOff: boolean;
}

function hitUsesPoison(
    weapon: GameObject, mode: HeroWeaponPoisonOptions['mode'], dieRoll: number,
) {
    const poisonedMissile = mode === 'thrown' && weapon.opoisoned
        && (isLauncherAmmunition(weapon) || isMissileObject(weapon))
        && isPoisonableObject(weapon);
    const permanentPoison = isPermanentlyPoisonedObject(weapon)
        && dieRoll <= 5;
    return poisonedMissile || permanentPoison;
}

export async function resolveHeroWeaponPoison(monster: Monster, weapon: GameObject, {
    state = game,
    mode,
    dieRoll,
    publish,
    random = rn2,
    rollOne = rnd,
}: HeroWeaponPoisonOptions): Promise<HeroWeaponPoisonResult | null> {
    if (!hitUsesPoison(weapon, mode, dieRoll)) return null;

    if (state.urole?.key === 'samurai') {
        await publish('You dishonorably use a poisoned weapon!');
        adjustHeroAlignment(-Math.sign(state.u?.ualign?.type ?? 0), state);
    } else if (state.u?.ualign?.type === A_LAWFUL
        && (state.u.ualign.record ?? 0) > -10) {
        await publish(
            'You feel like an evil coward for using a poisoned weapon.',
        );
        adjustHeroAlignment(-1, state);
    }

    const permanent = isPermanentlyPoisonedObject(weapon);
    const wearOffChance = Math.max(
        2, 10 - Math.trunc((weapon.owt ?? 0) / 10),
    );
    const woreOff = !permanent && random(wearOffChance) === 0;
    if (woreOff) weapon.opoisoned = false;

    if (monsterHasPoisonResistance(monster)) {
        return { damage: 0, deadly: false, resisted: true, woreOff };
    }
    if (random(10) !== 0) {
        return {
            damage: rollOne(6), deadly: false, resisted: false, woreOff,
        };
    }
    return { damage: 0, deadly: true, resisted: false, woreOff };
}
