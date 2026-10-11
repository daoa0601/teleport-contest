import type { Monster } from './monster_types.js';
interface RayMessageOptions { x: number; y: number; damage?: number; ending?: string; state?: GameState; }
import type { GameState } from './game_state.js';
// C zap.c:hit()/miss(). Reporting an impact and identifying its target
// are separate decisions. Callers own whether a hit or miss is reported.
import { canSpotMonster } from './display.js';
import { artifactByName } from './artifacts.js';
import { fruitFromName } from './fruit.js';
import { game } from './gstate.js';
import { MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, monsterTypeName } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { verbForSubject } from './object_grammar.js';
import { BOGUS_MONSTERS } from './random_text_data.js';
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
    if (!name) return 'The []';
    if (/^the /iu.test(name)) return `T${name.slice(1)}`;
    if (!/^[A-Z]/u.test(name) || capitalizedMonsterTitle(name)) return `The ${name}`;
    if (fruitFromName(name, { exact: true, state })) {
        const artifact = artifactByName(name, state);
        if (!artifact || /^the /iu.test(artifact.name)) return `The ${name}`;
    }
    const lastSpace = name.lastIndexOf(' ');
    const separator = lastSpace >= 0 ? lastSpace : name.lastIndexOf('-');
    if (separator < 0) return name;
    if (!/^[A-Z]/u.test(name.slice(separator + 1)))
        return name.includes("'") ? name : `The ${name}`;
    if (name.indexOf(' ') >= separator) return name;
    const lower = name.toLowerCase();
    const named = lower.indexOf(' named ');
    const called = lower.indexOf(' called ');
    const suffix = named < 0 ? called : called < 0 ? named : Math.min(named, called);
    const of = lower.indexOf(' of ');
    if (of >= 0 && (suffix < 0 || of < suffix)
        || suffix < 0 && name.endsWith('Platinum Yendorian Express Card')) return `The ${name}`;
    return name;
}

// Native rumors.c:CapitalMon() includes capitalized species names and titles,
// but excludes individual names in both the real and hallucinatory tables.
const CAPITALIZED_MONSTER_TITLES = [
    ...MONSTER_NAME.flatMap((name, species) => {
        const unique = !!((MONSTER_GENO[species] ?? 0) & 0x1000);
        const personal = !!((MONSTER_FLAGS2[species] ?? 0) & 0x00080000);
        if (unique && (personal || name === 'high cleric' || name === 'long worm tail')) return [];
        return [name, monsterTypeName(species), monsterTypeName(species, true)];
    }),
    ...BOGUS_MONSTERS.flatMap(name => {
        const code = name.charAt(0);
        if (code && '-+='.includes(code)) return [];
        return ['_', '|'].includes(code) ? [name.slice(1)] : [name];
    }),
].filter(name => /^[A-Z]/u.test(name));

function capitalizedMonsterTitle(name: string): boolean {
    return CAPITALIZED_MONSTER_TITLES.some(title => name.startsWith(title)
        && (name.length === title.length || [' ', "'"].includes(name.charAt(title.length))));
}
