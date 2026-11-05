// C mkroom.c:mkundead(). Position selection precedes revival or construction.
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { level_difficulty } from './dungeon.js';
import { enexto } from './teleport.js';
import { morgueMonsterType } from './mkroom.js';
import { makemonAt } from './makemon.js';
import { reviveCorpseImmediately } from './do.js';
import { CORPSE } from './object_data.js';
import { rnd } from './rng.js';
export async function summonUndead(center, { reviveCorpses = false, flags = 0, state = game, } = {}) {
    requireLiveGame(state);
    const level = requireGameLevel(state);
    const count = Math.trunc((level_difficulty() + 1) / 10) + rnd(5);
    for (let left = count; left > 0; left--) {
        const species = morgueMonsterType();
        const position = enexto(species, center.x, center.y, { state });
        if (!position)
            continue;
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
//# sourceMappingURL=undead_summoning.js.map