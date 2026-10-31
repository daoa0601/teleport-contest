// C wizcmds.c:wiz_flip_level(): transpose a live map without taking a turn.
import { docrt } from './display.js';
import { plineWithContinuation } from './pline.js';
import { game } from './gstate.js';
import { flipSpecialLevel, flipSpecialLevelRandom } from './sp_lev.js';
import { yn_function } from './query.js';
export async function wizFlipLevel() {
    if (game.flags.debug) {
        const { answer } = await yn_function('Flip 0=randomly, 1=vertically, 2=horizontally, 3=both:', '0123');
        if (answer && '0123'.includes(answer)) {
            if (answer === '0')
                await flipSpecialLevelRandom(3, true);
            else
                await flipSpecialLevel(Number(answer), true);
            await docrt();
        }
        else
            await plineWithContinuation('Never mind.');
    }
    game.context.move = 0;
}
//# sourceMappingURL=wizard_flip_level.js.map