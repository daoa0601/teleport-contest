// C cfgfiles.c:config_error_init(), config_erradd(), config_error_done().
import { rawPrint, rawPrintf, truncatePlineMessage } from './pline.js';
import { game } from './gstate.js';
import { getret } from './wintty.js';
import { NO_COLOR } from './terminal.js';

export interface ConfigurationError {
    lineNumber: number;
    sourceLine: string;
    message: string;
    // C cfgfiles.c emits some diagnostics (get_uchars() syntax errors,
    // cmd.c parseautocomplete()) with raw_printf() + wait_synch() instead of
    // config_error_add(). They print immediately, are not prefixed with the
    // source line or ' * ', and do not count toward the error total, so
    // config_error_done() prints no summary for them. Their wait_synch()
    // still pauses for a key: before init_nhwindows() WIN_MAP is WIN_ERR and
    // tty_wait_synch() falls back to getret().
    raw?: boolean;
    // add_menu_cmd_alias() uses pline() without wait_synch() at startup.
    pause?: boolean;
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
    // getret() writes its prompt to the terminal; nothing to do without one.
    if (!game.nhDisplay) return;
    for (const report of reports) {
        let previousLine: number | null = null;
        for (const error of report.errors) {
            if (error.raw) {
                rawPrintf(error.message);
                if (error.pause !== false) await getret();
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
        await getret();
    }
}

function rawConfigurationMessage(message: string): void {
    // C pline.c:vpline() shortens even early raw_print() output to BUFSZ-1
    // bytes, preserving its last three bytes after an ellipsis.
    rawPrint(truncatePlineMessage(message));
}
