import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
// Given-name storage shared by monster creation, revival, and bones.
// C do_name.c:christen_monst()/rndghostname(). No presentation imports: these
// setters also run while a new monster is still being constructed.

import { PL_PSIZ } from './const.js';
import { game } from './gstate.js';
import { rn2 } from './rng.js';

export function setMonsterGivenName<T extends Pick<Monster, 'name' | 'mgivenname' | 'mextra'>>(monster: T, value: string | null | undefined): T {
    // Names supplied by level files retain their whitespace. Only player
    // input goes through name_from_player()'s normalization.
    const name = String(value ?? '').split('\0', 1)[0]?.slice(0, PL_PSIZ - 1) || '';
    if (!name) {
        delete monster.name;
        delete monster.mgivenname;
        if (monster.mextra) delete monster.mextra.mgivenname;
    } else {
        monster.name = name;
        monster.mgivenname = name;
        monster.mextra ||= {};
        monster.mextra.mgivenname = name;
    }
    return monster;
}

const GHOST_NAMES = [
    'Adri', 'Andries', 'Andreas', 'Bert', 'David', 'Dirk',
    'Emile', 'Frans', 'Fred', 'Greg', 'Hether', 'Jay',
    'John', 'Jon', 'Karnov', 'Kay', 'Kenny', 'Kevin',
    'Maud', 'Michiel', 'Mike', 'Peter', 'Robert', 'Ron',
    'Tom', 'Wilmar', 'Nick Danger', 'Phoenix', 'Jiro', 'Mizue',
    'Stephan', 'Lance Braccus', 'Shadowhawk', 'Murphy',
];

export function randomGhostName(state: GameState = game): string {
    if (!rn2(7)) return state.plname;
    const name = GHOST_NAMES[rn2(GHOST_NAMES.length)];
    if (name === undefined) throw new RangeError('Ghost name selection is outside the name table.');
    return name;
}

export function roguePlayerName(): string {
    const options = typeof process === 'undefined' ? undefined : process.env.ROGUEOPTS;
    const start = options?.indexOf('name=') ?? -1;
    if (options !== undefined && start >= 0)
        return options.slice(start + 5).split(',', 1)[0] ?? '';
    return rn2(3) ? (rn2(2) ? 'Michael Toy' : 'Kenneth Arnold') : 'Glenn Wichman';
}
