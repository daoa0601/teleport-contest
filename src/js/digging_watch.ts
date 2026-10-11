// C dig.c:watch_dig(). Town vandalism is witnessed from the hero's location.
import {
    D_CLOSED, D_LOCKED, DOOR, FOUNTAIN, IS_DOOR, IS_OBSTRUCTED,
    IS_TREE, IS_WALL, MON_OFFMAP, SDOOR,
} from './const.js';
import { plineWithContinuation } from './display.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { MessagePublisher } from './display.js';
import { ensureDiggingContext, isDigging } from './hero_digging.js';
import { angerWatchGuards } from './monster_anger.js';
import { MONSTER_NAME } from './monster_data.js';
import { monsterHasLineOfSightToHero } from './monster_perception.js';
import { stopHeroOccupation } from './occupation.js';
import { inTown } from './room.js';
import { heroIsDeaf } from './senses.js';

const WATCH = new Set(['watchman', 'watch captain']);

export interface WatchDiggingOptions {
    state?: GameState;
    monster?: Monster | null;
    magic?: boolean;
    publish?: MessagePublisher;
}

export async function watchDigging(x: number, y: number, {
    state = game, monster = null, magic = true, publish = plineWithContinuation,
}: WatchDiggingOptions = {}): Promise<boolean> {
    requireLiveGame(state);
    const level = requireGameLevel(state);
    const location = level.at(x, y);
    const closedDoor = location?.typ === DOOR
        && !!(location.doormask & (D_CLOSED | D_LOCKED));
    if (!location || !inTown(level, x, y)
        || !(closedDoor || location.typ === SDOOR || IS_WALL(location.typ)
            || location.typ === FOUNTAIN || IS_TREE(location.typ))) return false;

    // A supplied witness has passed watch_on_duty's own admission checks.
    const witness = monster || [...level.monsters].reverse().find(candidate =>
        candidate.mhp > 0 && !((candidate.mstate ?? 0) & MON_OFFMAP)
        && WATCH.has(MONSTER_NAME[candidate.mnum] ?? '') && candidate.mcansee
        && candidate.mpeaceful && monsterHasLineOfSightToHero(candidate, state));
    if (!witness) return false;

    const digging = ensureDiggingContext(state);
    if (magic || digging.warned) {
        await publish('"Halt, vandal!  You\'re under arrest!"');
        await angerWatchGuards(heroIsDeaf(state), { publish });
    } else {
        const target = IS_DOOR(location.typ) ? 'door' : IS_TREE(location.typ) ? 'tree'
            : IS_OBSTRUCTED(location.typ) ? 'wall' : 'fountain';
        await publish(`"Hey, stop damaging that ${target}!"`);
        digging.warned = true;
    }
    if (isDigging(state)) await stopHeroOccupation(state, publish);
    return true;
}
