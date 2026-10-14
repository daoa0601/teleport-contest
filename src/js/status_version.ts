// version.c:status_version(), for the pinned recorder's patchlevel.h and
// build without NETHACK_GIT_BRANCH. Branch-only falls back to the number.
export function statusVersion(info = 1): string {
    const name = (info & 2) !== 0;
    const number = (info & 1) !== 0 || !name;
    return [name ? 'nethack' : '', number ? '5.0.0' : ''].filter(text => text.length > 0).join(' ');
}
