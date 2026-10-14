// C wizcmds.c:wiz_panic()/wiz_fuzzer(). Both confirmations take no time.
import { FUZZER_IMPOSSIBLE_CONTINUE, FUZZER_IMPOSSIBLE_PANIC, panic } from './diagnostics.js';
import { plineWithContinuation } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { paranoidQuery, promptYesNo } from './query.js';

export async function wizPanic(): Promise<void> {
    requirePlayingGame(game);
    if (game.iflags.debug_fuzzer) {
        game.u.uhp = game.u.uhpmax = 1000;
        game.u.uen = game.u.uenmax = 1000;
    } else if (await paranoidQuery(true, 'Do you want to call panic() and end your game?')) {
        await panic('Crash test (#panic).');
    }
    game.context.move = 0;
}

export async function wizFuzzer(): Promise<void> {
    if (!fuzzerWarningSuppressed()) {
        await plineWithContinuation('The fuzz tester will make NetHack execute random keypresses.');
        await plineWithContinuation('There is no conventional way out of this mode.');
    }
    if (await paranoidQuery(true, 'Do you want to start fuzz testing?')) {
        const answer = await promptYesNo('Do you want to call panic() after impossible()?');
        game.flags.debug_fuzzer = answer === 'n' ? FUZZER_IMPOSSIBLE_CONTINUE : FUZZER_IMPOSSIBLE_PANIC;
        game.iflags.debug_fuzzer = true;
    }
    game.context.move = 0;
}

function fuzzerWarningSuppressed(): boolean {
    const version = game.flags.suppress_alert?.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!version) return false;
    const major = Number(version[1]), minor = Number(version[2]);
    return major > 3 || major === 3 && minor >= 7;
}
