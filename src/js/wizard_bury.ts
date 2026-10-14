// C dig.c:wiz_debug_cmd_bury(). Counts floor objects, including rocks which
// disappear into the ground rather than joining the buried-object list.
import { buryFloorObjectsAt } from './buried_object.js';
import { isok } from './const.js';
import { plineWithContinuation } from './display.js';
import { game, requirePlayingGame } from './gstate.js';

export async function wizBury(): Promise<void> {
    requirePlayingGame(game);
    const level = game.level;
    let before = 0, after = 0;
    for (let x = game.u.ux - 1; x <= game.u.ux + 1; x++) {
        for (let y = game.u.uy - 1; y <= game.u.uy + 1; y++) {
            if (!isok(x, y)) continue;
            before += level.objects[x]?.[y]?.length ?? 0;
            await buryFloorObjectsAt(x, y);
            after += level.objects[x]?.[y]?.length ?? 0;
        }
    }
    const buried = before - after;
    await plineWithContinuation(before === 0 ? 'No objects here or adjacent to bury.'
        : buried === 0 ? 'No objects buried.'
            : `${buried} object${buried === 1 ? '' : 's'} buried.`);
    game.context.move = 0;
}
