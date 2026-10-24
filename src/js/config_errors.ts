// C cfgfiles.c:config_error_init(), config_erradd(), config_error_done().
import { rawPrint } from './display.js';
import { truncatePlineMessage } from './pline_text.js';
import { game } from './gstate.js';
import { nhgetch } from './input.js';
import { NO_COLOR } from './terminal.js';

export interface ConfigurationError {
    lineNumber: number;
    sourceLine: string;
    message: string;
    // C cfgfiles.c emits some diagnostics (get_uchars() syntax errors,
    // cmd.c parseautocomplete()) with raw_printf() + wait_synch() instead of
    // config_error_add(). They print immediately, are not prefixed with the
    // source line or ' * ', and do not count toward the error total, so
    // config_error_done() prints no summary and waits for no return key.
    raw?: boolean;
}

export interface ConfigurationErrorReport {
    source: string;
    errors: ConfigurationError[];
}

// Startup parses options before init_nhwindows(), so pline() uses raw_print.
// Each source ends with wait_synch()/getret(), before asking for a hero name
// or creating the game windows. It does not use the gameplay message pager.
// Keep earlier sources visible until the caller leaves configuration startup.
export async function displayConfigurationErrors(reports: readonly ConfigurationErrorReport[]): Promise<void> {
    const display = game.nhDisplay;
    if (!display) return;
    for (const report of reports) {
        let previousLine: number | null = null;
        for (const error of report.errors) {
            if (error.raw) {
                rawConfigurationMessage(error.message);
                continue;
            }
            if (error.lineNumber !== previousLine) rawConfigurationMessage(`\n${error.sourceLine}`);
            previousLine = error.lineNumber;
            const line = error.lineNumber > 0 ? `Line ${error.lineNumber}: ` : '';
            const punctuation = /[.!?]$/.test(error.message) ? '' : '.';
            rawConfigurationMessage(` * ${line}${error.message}${punctuation}`);
        }
        const count = report.errors.filter(error => !error.raw).length;
        // C config_error_done() prints its summary (and waits) only when at
        // least one config_error_add() fired; raw diagnostics never count.
        if (!count) continue;
        rawConfigurationMessage(`\n${count} error${count === 1 ? '' : 's'} in ${report.source}.\n`);
        // C wintty.c:getret() prints one more newline, then xwaitforspace().
        rawPrint('');
        // Before init_nhwindows(), cbreak is off and standout capabilities are unset.
        const prompt = 'Hit return to continue: ';
        display.putstr(0, display.cursorRow, prompt, NO_COLOR, 0);
        display.setCursor(prompt.length, display.cursorRow);
        display.flush();
        let key;
        do key = await nhgetch();
        while (key !== 10 && key !== 13);
    }
}

function rawConfigurationMessage(message: string): void {
    // C pline.c:vpline() shortens even early raw_print() output to BUFSZ-1
    // bytes, preserving its last three bytes after an ellipsis.
    rawPrint(truncatePlineMessage(message));
}
