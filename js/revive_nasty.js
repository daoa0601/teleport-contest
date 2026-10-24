// C hack.c:revive_nasty(). Revive protected corpses before crushing a pile.
import { reviveCorpseImmediately } from './corpse_revival.js';
import { isRider } from './corpse_species.js';
import { plineWithContinuation } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { MONSTER_NAME } from './monster_data.js';
import { monsterAtPosition } from './monster_location.js';
import { CORPSE } from './object_data.js';
import { relocateMonsterTo } from './teleport.js';
import { findNearbyMonsterPosition, goodPosition } from './teleport_rules.js';
export async function reviveNastyAt(x, y, message = null, state = game) {
    requirePlayingGame(state);
    let revived = false;
    for (const corpse of [...state.level.objects[x]?.[y] ?? []]) {
        if (corpse.otyp !== CORPSE
            || !(isRider(corpse.corpsenm)
                || MONSTER_NAME[corpse.corpsenm ?? -1] === 'Wizard of Yendor'))
            continue;
        const occupant = monsterAtPosition(state.level, x, y);
        if (occupant)
            await moveRevivalOccupant(occupant, x, y, state);
        if (message)
            await plineWithContinuation(message, { noRepeat: true });
        const revival = await reviveCorpseImmediately(corpse, state);
        if (revival)
            for (const line of revival.messages)
                await plineWithContinuation(line);
        revived = revival?.kind === 'revived';
    }
    const monster = revived ? monsterAtPosition(state.level, x, y) : null;
    if (monster && !goodPosition(x, y, { kind: 'monster', monster }, { state }))
        await moveRevivalOccupant(monster, x, y, state);
    return revived;
}
async function moveRevivalOccupant(monster, x, y, state) {
    const position = findNearbyMonsterPosition(monster.mnum, x, y, { state });
    if (position)
        await relocateMonsterTo(monster, position.x, position.y, { state });
}
//# sourceMappingURL=revive_nasty.js.map