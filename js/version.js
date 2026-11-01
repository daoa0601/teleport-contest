// version.c — build version info and the status-line version string.
export const VERSION = '0.1.0';
export const BUILD_DATE = '2026-04-18';
export const COMMIT = 'contest-skeleton';
export const COMMIT_NUMBER = '0';
export const TELEPORT_BUILD_DATE = '2026-04-18';
// C version.c:status_version(), for the pinned recorder's patchlevel.h and
// build without NETHACK_GIT_BRANCH. Branch-only falls back to the number.
export function statusVersion(info = 1) {
    const name = (info & 2) !== 0;
    const number = (info & 1) !== 0 || !name;
    return [name ? 'nethack' : '', number ? '5.0.0' : ''].filter(text => text.length > 0).join(' ');
}
//# sourceMappingURL=version.js.map