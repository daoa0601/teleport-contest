// C hack.c:u_locomotion(). Active flight and levitation take precedence
// over the movement word for the hero's current body.
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import { heroSpecies } from './hero_species.js';
import { monsterLocomotion } from './monster_locomotion.js';
import { propertyIsActive } from './properties.js';

export function heroLocomotion(fallback: string, state: GameState = game): string {
    const verb = propertyIsActive('levitation', state) ? 'float'
        : propertyIsActive('flying', state) ? 'fly' : null;
    if (verb === null) return monsterLocomotion(heroSpecies(state), fallback);
    return fallback.charAt(0) === fallback.charAt(0).toUpperCase()
        ? verb.charAt(0).toUpperCase() + verb.slice(1) : verb;
}
