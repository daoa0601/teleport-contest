// C ref: potion.c peffect_levitation() (upstream), dungeon.c has_ceiling().
// The quaff owner (cmd.js doquaff) consumes the potion and handles the
// potion_nothing fallback message plus identification.

import { IS_SINK, TIMEOUT } from './const.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Hero } from './hero_types.js';
import type { Stairway } from './map_types.js';
import type { MessagePublisher } from './display.js';
import { plineWithContinuation } from './display.js';
import {
    captureLevitationState, grantIntrinsicProperty, propertyIsActive,
    propertyIsBlocked, refreshMovementProperties, refreshProperty,
    revokeIntrinsicProperty,
} from './properties.js';
import { floatHeroUp } from './terrain_movement.js';
import { rnd, rn1 } from './rng.js';
import { applyHeroLocationEffects, travelStairs } from './cmd.js';
import { objectIsHardHelmet } from './armor.js';
import { loseHeroHp } from './hero_damage.js';

import { ceilingName } from './terrain_name.js';
import { heroHeadName } from './body_parts.js';
import { levelHasCeiling } from './terrain_properties.js';

// C potion.c:itimeout()/itimeout_incr(): the timeout caps at TIMEOUT.
function increaseLevitationTimeout(hero: Hero, amount: number): void {
    const current = hero.levitationTurns ?? 0;
    hero.levitationTurns = Math.min(TIMEOUT, current + amount);
}

function upStairwayAt(x: number, y: number, state: GameState): Stairway | null {
    let stairs = state.stairs;
    while (stairs && (stairs.sx !== x || stairs.sy !== y || !stairs.up))
        stairs = stairs.next;
    return stairs || null;
}

export async function applyLevitationPotion(
    potion: GameObject,
    { state = game, publish = plineWithContinuation }: {
        state?: GameState;
        publish?: MessagePublisher;
    } = {},
): Promise<{ nothingHappened: boolean }> {
    // The quaff lifecycle owns the live world: stair climbs, float_up, and
    // spot effects all run through singleton owners.
    requireLiveGame(state);
    const hero = state.u;
    let potionNothing = false;
    // BLevitation does not prevent setting or incrementing the timeout; it
    // only suppresses the float-up feedback (C potion.c:1167-1183).
    const blocked = propertyIsBlocked('levitation', state);
    const previous = captureLevitationState(state);
    if (!propertyIsActive('levitation', state) && !blocked) {
        // Kludge: C set_itimeout(&HLevitation, 1L) so float_up() sees the
        // property active; blessed and uncursed get one extra turn out of it.
        hero.levitationTurns = 1;
        refreshProperty('levitation', state);
        await floatHeroUp(state, previous);
    } else {
        potionNothing = true;
    }

    if (potion.cursed) {
        // 'already levitating' no longer blocks the cursed effects (3.6.1);
        // either way the hero can no longer descend upon demand.  BLevitation
        // is re-read here: a float_up over a floor trap has just blocked the
        // property (C potion.c:1192 reads it after float_up's side effects).
        revokeIntrinsicProperty('levitation', 'potion', state);
        if (!blocked && !propertyIsBlocked('levitation', state)) {
            if (upStairwayAt(hero.ux, hero.uy, state)) {
                await travelStairs(true);
                potionNothing = false; /* not nothing after all */
            } else if (levelHasCeiling(state)) {
                const helmet = state.uarmh || hero.uarmh;
                let damage = rnd(!helmet ? 10
                    : !objectIsHardHelmet(helmet) ? 6 : 3);
                if (hero.halfPhysicalDamage)
                    damage = Math.trunc((damage + 1) / 2);
                await publish(`You hit your ${heroHeadName(state)} on the ${
                    ceilingName(hero.ux, hero.uy, state)}.`);
                await loseHeroHp(damage, 'colliding with the ceiling',
                    { state, publish });
                potionNothing = false; /* not nothing after all */
            }
        }
    } else if (potion.blessed) {
        /* at this point, timeout is already at least 1 */
        increaseLevitationTimeout(hero, rn1(50, 250));
        // Can descend at will ('>') provided the timeout is the only source
        // keeping the hero aloft: no worn ring or boots (C I_SPECIAL).
        grantIntrinsicProperty('levitation', 'potion', state);
    } else {
        /* timeout is already at least 1 */
        increaseLevitationTimeout(hero, rn1(140, 10));
    }

    if (propertyIsActive('levitation', state)
        && IS_SINK(requireGameLevel(state).requireAt(hero.ux, hero.uy).typ)) {
        await applyHeroLocationEffects(publish, { pick: false });
    }
    /* levitating blocks flying */
    refreshMovementProperties(state);
    return { nothingHappened: potionNothing };
}
