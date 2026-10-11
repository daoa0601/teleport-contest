// C mkroom.c:mkundead(). Position selection precedes revival or construction.
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { Position } from './map_types.js';
import { level_difficulty } from './dungeon.js';
import { findMonsterNearPosition, makemonAt, morgueMonsterType } from './mklev.js';
import { reviveCorpseImmediately } from './corpse_revival.js';
import { CORPSE } from './object_data.js';
import { rnd } from './rng.js';

export async function summonUndead(center: Position, {
    reviveCorpses = false, flags = 0, state = game,
}: { reviveCorpses?: boolean; flags?: number; state?: GameState } = {}): Promise<void> {
    requireLiveGame(state);
    const level = requireGameLevel(state);
    const count = Math.trunc((level_difficulty() + 1) / 10) + rnd(5);
    for (let left = count; left > 0; left--) {
        const species = morgueMonsterType();
        if (species == null) continue;
        const position = findMonsterNearPosition(species, center.x, center.y, { state });
        if (!position) continue;
        if (reviveCorpses) {
            const corpse = level.objects?.[position.x]?.[position.y]
                ?.find(object => object.otyp === CORPSE);
            if (corpse && (await reviveCorpseImmediately(corpse, state))?.kind === 'revived')
                continue;
        }
        await makemonAt(species, position.x, position.y, flags);
    }
    level.flags.graveyard = true;
}
