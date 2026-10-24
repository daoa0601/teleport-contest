// C cfgfiles.c:config_error_init(), config_erradd(), config_error_done().
import { rawPrint } from './display.js';
import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { NO_COLOR } from './terminal.js';
// Startup parses options before init_nhwindows(), so pline() uses raw_print.
// Each source ends with wait_synch()/getret(), before asking for a hero name
// or creating the game windows. It does not use the gameplay message pager.
export async function displayConfigurationErrors(reports) {
    const display = game.nhDisplay;
    if (!display)
        return;
    let reported = false;
    for (const report of reports) {
        if (!report.errors.length)
            continue;
        reported = true;
        let previousLine = null;
        for (const error of report.errors) {
            if (error.lineNumber !== previousLine)
                rawPrint(`\n${error.sourceLine}`);
            previousLine = error.lineNumber;
            const line = error.lineNumber > 0 ? `Line ${error.lineNumber}: ` : '';
            const punctuation = /[.!?]$/.test(error.message) ? '' : '.';
            rawPrint(` * ${line}${error.message}${punctuation}`);
        }
        const count = report.errors.length;
        rawPrint(`\n${count} error${count === 1 ? '' : 's'} in ${report.source}.\n`);
        // C wintty.c:getret() prints one more newline, then xwaitforspace().
        rawPrint('');
        const prompt = 'Hit space to continue: ';
        display.putstr(0, display.cursorRow, prompt, NO_COLOR);
        display.setCursor(prompt.length, display.cursorRow);
        display.flush();
        let key;
        do
            key = await nhgetch();
        while (![27, 32, 10, 13].includes(key));
    }
    if (reported)
        display.clearScreen();
}
//# sourceMappingURL=config_errors.js.map