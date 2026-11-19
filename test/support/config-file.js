// The recorder's config file (docs/recording-environment.md): NetHack names
// it in full wherever it mentions the config file location.
export const RECORDED_CONFIG_FILE = '/Users/davidbau/git/mazesofmenace/teleport/maud/test/comparison/c-harness/results/.nethackrc';
// The startup "N errors in <file>." summary as the 80-column terminal wraps it.
export function errorsInConfigFile(count) {
    const line = `${count} error${count === 1 ? '' : 's'} in ${RECORDED_CONFIG_FILE}.`;
    const wrapped = line.match(/.{1,80}/g)?.join('\n') ?? line;
    return new RegExp(wrapped.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'));
}
//# sourceMappingURL=config-file.js.map