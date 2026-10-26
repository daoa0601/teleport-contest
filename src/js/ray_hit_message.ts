import type { Monster } from './monster_types.js';
interface RayMessageOptions { x: number; y: number; damage?: number; ending?: string; state?: GameState; }
import type { GameState } from './game_state.js';
// C zap.c:hit()/miss(). Reporting an impact and identifying its target
// are separate decisions. Callers own whether a hit or miss is reported.
import { canSpotMonster } from './display.js';
import { game } from './gstate.js';
import { monsterName } from './monster_name.js';
import { verbForSubject } from './object_grammar.js';
import { definiteName } from './objnam.js';
import { cansee } from './vision.js';

export function rayHitMessage(effect: string, monster: Monster, { x, y, damage = 0, ending, state = game }: RayMessageOptions) {
    const inside = state.u.uswallow && state.u.ustuck === monster;
    const named = state.flags.verbose
        && (cansee(x, y) || canSpotMonster(monster) || inside);
    const target = named ? monsterName(monster, { state }) : 'it';
    const punctuation = ending ?? (damage < 0 ? '?' : damage <= 4 ? '.' : '!');
    return `${capitalizedDefiniteName(effect, state)} ${verbForSubject(effect, 'hit')} ${target}${punctuation}`;
}

export function rayMissMessage(effect: string, monster: Monster, { x, y, state = game }: RayMessageOptions) {
    const named = state.flags.verbose && (cansee(x, y) || canSpotMonster(monster));
    const target = named ? monsterName(monster, { state }) : 'it';
    return `${capitalizedDefiniteName(effect, state)} ${verbForSubject(effect, 'miss')} ${target}.`;
}

// C objnam.c:The()/the(). Capitalized object names are not all proper names:
// fruit, species titles, and compounds such as Amulet of Yendor need articles.
export function capitalizedDefiniteName(name: string, state: GameState = game): string {
    const subject = definiteName(name, state);
    return subject.charAt(0).toUpperCase() + subject.slice(1);
}
