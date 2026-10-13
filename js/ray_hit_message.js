// C zap.c:hit()/miss(). Reporting an impact and identifying its target
// are separate decisions. Callers own whether a hit or miss is reported.
import { canSpotMonster } from './display.js';
import { game } from './gstate.js';
import { monsterName } from './monster_name.js';
import { verbForSubject } from './object_grammar.js';
import { definiteName } from './objnam.js';
import { cansee } from './vision.js';
export function rayHitMessage(effect, monster, { x, y, damage = 0, ending, state = game }) {
    const inside = state.u.uswallow && state.u.ustuck === monster;
    const named = state.flags.verbose
        && (cansee(x, y) || canSpotMonster(monster) || inside);
    const target = named ? monsterName(monster, { state }) : 'it';
    const punctuation = ending ?? (damage < 0 ? '?' : damage <= 4 ? '.' : '!');
    return `${capitalizedDefiniteName(effect, state)} ${verbForSubject(effect, 'hit')} ${target}${punctuation}`;
}
export function rayMissMessage(effect, monster, { x, y, state = game }) {
    const named = state.flags.verbose && (cansee(x, y) || canSpotMonster(monster));
    const target = named ? monsterName(monster, { state }) : 'it';
    return `${capitalizedDefiniteName(effect, state)} ${verbForSubject(effect, 'miss')} ${target}.`;
}
// C objnam.c:The()/the(). Capitalized object names are not all proper names:
// fruit, species titles, and compounds such as Amulet of Yendor need articles.
export function capitalizedDefiniteName(name, state = game) {
    const subject = definiteName(name, state);
    return subject.charAt(0).toUpperCase() + subject.slice(1);
}
//# sourceMappingURL=ray_hit_message.js.map