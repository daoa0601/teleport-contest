// C wizcmds.c:wiz_panic()/wiz_fuzzer(). Crash and autonomous fuzzing are
// unavailable in the browser runtime; declining their native prompts is safe.
import { plineWithContinuation } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { paranoidQuery } from './query.js';
export async function wizPanic() {
    requirePlayingGame(game);
    if (game.iflags.debug_fuzzer) {
        game.u.uhp = game.u.uhpmax = 1000;
        game.u.uen = game.u.uenmax = 1000;
    }
    else if (await paranoidQuery(true, 'Do you want to call panic() and end your game?')) {
        await plineWithContinuation('Crash testing is unavailable in this runtime.');
    }
    game.context.move = 0;
}
export async function wizFuzzer() {
    if (!fuzzerWarningSuppressed()) {
        await plineWithContinuation('The fuzz tester will make NetHack execute random keypresses.');
        await plineWithContinuation('There is no conventional way out of this mode.');
    }
    if (await paranoidQuery(true, 'Do you want to start fuzz testing?'))
        await plineWithContinuation('Fuzz testing is unavailable in this runtime.');
    game.context.move = 0;
}
function fuzzerWarningSuppressed() {
    const version = game.flags.suppress_alert?.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!version)
        return false;
    const major = Number(version[1]), minor = Number(version[2]);
    return major > 3 || major === 3 && minor >= 7;
}
//# sourceMappingURL=wizard_debug_commands.js.map