import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { MessagePublisher } from './display.js';
import type { FinishHeroMonsterDeath } from './hero_monster_death.js';
import type { PotionWakeMonster, PotionWakeNearby } from './potion_hit.js';
import type { ProjectileFlightCapture } from './thrown_object.js';

export interface MapPotionThrowOptions {
    state?: GameState;
    item: GameObject;
    objectClass: number;
    selectedQuantity: number;
    splitObjectId?: number | null;
    dx: number;
    dy: number;
    captureFlight?: ProjectileFlightCapture | null;
    wakeMonster?: PotionWakeMonster | null;
    wakeNearby?: PotionWakeNearby | null;
    finishKill?: FinishHeroMonsterDeath | null;
    publish?: MessagePublisher;
}

type PotionThrowAdmission = Pick<MapPotionThrowOptions,
    'item' | 'objectClass' | 'selectedQuantity' | 'dx' | 'dy'> & { state: GameState };

// Map flight and impact for potions thrown by the hero.
// C refs: dothrow.c throwit(), throwit_mon_hit(), thitmonst(), tmiss(),
// breaktest(), breakmsg(), breakobj(); zap.c bhit().

import { currentAttribute } from './attrib.js';
import { A_DEX } from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { dist2 } from './hacklib.js';
import { hurtleHero } from './hero_hurtle.js';
import { hitFloorWithObject } from './object_drop.js';
import { tossObjectUp } from './toss_up.js';
import { monsterName } from './monster_name.js';
import {
    hitMonsterWithSupportedPotion, potionImpactObjectName,
    SUPPORTED_MONSTER_POTION_TYPES,
} from './potion_hit.js';
import { rn2, rnd } from './rng.js';
import {
    detachThrownUnit, finishHeroThrownObjectLanding, flyHeroThrownObject,
    heroThrowTrajectory,
} from './thrown_object.js';
import { applyLowStaminaThrow, applyThrowSlip } from './throw_state.js';
import { cansee } from './vision.js';

const POTION_CLASS = 8;

function canResolveMapPotionThrow({
    state, item, objectClass, selectedQuantity, dx, dy,
}: PotionThrowAdmission): boolean {
    if (state.u?.uswallow || objectClass !== POTION_CLASS
        || !SUPPORTED_MONSTER_POTION_TYPES.has(item?.otyp)
        || !Number.isInteger(selectedQuantity) || selectedQuantity < 1
        || !Number.isInteger(dx) || !Number.isInteger(dy)) return false;
    return true;
}

function distanceFromHero(state: GameState, x: number, y: number) {
    return dist2(state.u.ux, state.u.uy, x, y);
}

function hitMonsterWithThrownPotion({
    state, monster, potion, wakeMonster, wakeNearby, finishKill, publish,
}: { state: GameState; monster: Monster; potion: GameObject; wakeMonster: PotionWakeMonster | null;
    wakeNearby: PotionWakeNearby | null; finishKill: FinishHeroMonsterDeath | null; publish: MessagePublisher }) {
    return hitMonsterWithSupportedPotion({
        state,
        monster,
        potion,
        wakeMonster,
        wakeNearby,
        finishKill,
        publish,
        targetVisible: cansee(monster.mx, monster.my),
        resolveVapor: true,
        distance: distanceFromHero(state, monster.mx, monster.my),
    });
}

export async function resolveMapPotionThrow({
    state = game,
    item,
    objectClass,
    selectedQuantity,
    splitObjectId = null,
    dx,
    dy,
    captureFlight = null,
    wakeMonster = null,
    wakeNearby = null,
    finishKill = null,
    publish = plineWithContinuation,
}: MapPotionThrowOptions): Promise<boolean> {
    if (!canResolveMapPotionThrow({
        state, item, objectClass, selectedQuantity, dx, dy,
    })) return false;

    const thrown = await detachThrownUnit(
        state, item, selectedQuantity, splitObjectId,
    );
    try {
        if (state.program_state?.gameover) return true;

        // In C, slipping or low stamina changes the direction after the potion
        // leaves inventory and before it begins moving across the map.
        await applyThrowSlip({ state, object: thrown, publish });
        await applyLowStaminaThrow({ state, object: thrown, publish });

        if (state.u?.dz) {
            const steed = state.u.dz > 0 ? state.u.usteed : null;
            if (steed && rn2(6) !== 0) {
                const impact = await hitMonsterWithThrownPotion({
                    state,
                    monster: steed,
                    potion: thrown,
                    wakeMonster,
                    wakeNearby,
                    finishKill,
                    publish,
                });
                if (impact?.heroDied) return true;
                state.context.move = 1;
                return true;
            }
            if (state.u.dz > 0) {
                await hitFloorWithObject(thrown, { state, publish });
            } else {
                await tossObjectUp(thrown, { state, publish });
            }
            state.context.move = 1;
            return true;
        }

        const actualDx = state.u?.dx ?? dx;
        const actualDy = state.u?.dy ?? dy;
        const underwater = state.underwater || state.u?.uinwater;
        const trajectory = underwater
            ? { range: 1, recoil: 0 }
            : heroThrowTrajectory(thrown, state);
        const flight = await flyHeroThrownObject({
            state,
            object: thrown,
            dx: actualDx,
            dy: actualDy,
            range: trajectory.range,
            captureFlight,
            publish,
        });
        if (trajectory.recoil) {
            await hurtleHero(
                -actualDx, -actualDy, trajectory.recoil, { verbose: true },
            );
        }
        if (flight.destroyed) {
            state.context.move = 1;
            return true;
        }

        if (flight.contact) {
            rnd(20); // thitmonst() computes this before the potion class test
            if (currentAttribute(A_DEX, state) > rnd(25)) {
                const impact = await hitMonsterWithThrownPotion({
                    state,
                    monster: flight.contact,
                    potion: thrown,
                    wakeMonster,
                    wakeNearby,
                    finishKill,
                    publish,
                });
                if (impact?.heroDied) return true;
                state.context.move = 1;
                return true;
            }

            const visible = cansee(flight.contact.mx, flight.contact.my);
            await publish(visible
                ? `The ${potionImpactObjectName(thrown, state)} misses ${
                    monsterName(flight.contact, { state })
                }.`
                : `The ${potionImpactObjectName(thrown, state)} misses.`);
            if (rn2(3) === 0 && (await wakeMonster?.(flight.contact))?.heroDied)
                return true;
        }

        await finishHeroThrownObjectLanding({
            state,
            object: thrown,
            x: flight.x,
            y: flight.y,
            contactedMonster: flight.contact,
            publish,
        });
        state.context.move = 1;
        return true;
    } finally {
        if (state._thrownObject === thrown) state._thrownObject = null;
    }
}
