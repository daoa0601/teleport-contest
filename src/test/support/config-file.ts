// The recorder's config file (docs/recording-environment.md): NetHack names
// it in full wherever it mentions the config file location.
export const RECORDED_CONFIG_FILE =
    '/Users/davidbau/git/mazesofmenace/teleport/maud/test/comparison/c-harness/results/.nethackrc';

// The startup "N errors in <file>." summary as the capture keeps it: each
// raw-printed row holds at most 80 bytes, and the overflow is dropped
// rather than wrapped (termcap.c nomux_raw_putch() writes columns 0..79
// only), so the long path is cut mid-word.
export function errorsInConfigFile(count: number): RegExp {
    const line = `${count} error${count === 1 ? '' : 's'} in ${RECORDED_CONFIG_FILE}.`;
    const shown = line.slice(0, 80);
    return new RegExp(shown.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}
