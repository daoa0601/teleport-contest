const NETHACKRC_KEY = 'teleport:nethackrc';
// Fallback applied when localStorage['teleport:nethackrc'] is unset —
// so a first-time visitor gets sensible options without needing to
// stop by /nethackrc/ first. KEEP IN SYNC with mazesofmenace/nethackrc/
// editor.js DEFAULT_RC; the editor saves the same string to localStorage
// on first visit.
const DEFAULT_RC = `# .nethackrc — Teleport Coding Challenge
#
# These options apply to every fork in /play/.
# Visit /nethackrc/ to edit.

# Uncomment any of these to fix your character; otherwise NetHack
# prompts at the start of each game.
# OPTIONS=name:Hero
# OPTIONS=role:random
# OPTIONS=race:random
# OPTIONS=gender:random
# OPTIONS=align:random

OPTIONS=!tutorial
OPTIONS=color,hilite_pet,sortpack
OPTIONS=showexp,showscore,time
OPTIONS=mention_walls,autodescribe
OPTIONS=symset:DECGraphics
# Restore travel-friendly glyphs that DECgraphics overrides:
# sink defaults to '{' (collides with fountain); altar defaults to 'π'.
SYMBOLS=S_sink:#
SYMBOLS=S_altar:_
OPTIONS=pickup_types:$
OPTIONS=runmode:walk
OPTIONS=disclose:+i +a +v +g +c +o
`;
async function main() {
    const snapshot = await loadSnapshot();
    if (snapshot?.owner)
        window.__TELEPORT_VFS_PREFIX = `vfs:${snapshot.owner}:`;
    if (snapshot?.owner && snapshot.fork)
        showFork(snapshot.owner, snapshot.fork);
    // Storage reads the fork prefix at module initialization.
    const [{ GameDisplay }, { Engine }, { vfsReadFile }] = await Promise.all([
        import('./game_display.js'),
        import('./jsmain.js'),
        import('./storage.js'),
    ]);
    const display = new GameDisplay('game-container');
    display.flags = { color: true };
    const seed = Math.floor(Math.random() * 10000);
    const savedOptions = readSavedOptions();
    const nethackrc = savedOptions || DEFAULT_RC;
    display.putstr(0, 0, `Starting NetHack with seed ${seed}...`);
    display.putstr(0, 1, savedOptions
        ? 'Using your saved .nethackrc options.'
        : 'Using default options — visit /nethackrc/ to edit.');
    display.putstr(0, 3, 'Click here and press any key.');
    await display.readKey();
    display.clearScreen();
    const persistentStorage = new ForkStorage(window.__TELEPORT_VFS_PREFIX || 'vfs:');
    window.__TELEPORT_STORAGE = persistentStorage;
    const engine = new Engine({
        seed, nethackrc, storage: persistentStorage, display, interactive: true,
    });
    wireToolbarButton('save-btn', () => {
        display.pushKey('S'.charCodeAt(0));
        display.pushKey('y'.charCodeAt(0));
    });
    wireToolbarButton('new-game-btn', () => location.reload());
    wireToolbarButton('play-again-btn', () => location.reload());
    wireToolbarButton('clear-saves-btn', () => {
        if (!confirm("Delete this fork's saved games from your browser? "
            + 'Any in-progress save will be lost.'))
            return;
        const count = clearSavedGames();
        alert(`Removed ${count} VFS entries for this fork.`);
    });
    await engine.run();
    showGameOver(vfsReadFile('/record'));
}
async function loadSnapshot() {
    try {
        const response = await fetch('./snapshot.json', { cache: 'no-store' });
        if (!response.ok)
            return null;
        const value = await response.json();
        if (typeof value !== 'object' || value === null)
            return null;
        return {
            owner: 'owner' in value && typeof value.owner === 'string' ? value.owner : null,
            fork: 'fork' in value && typeof value.fork === 'string' ? value.fork : null,
        };
    }
    catch {
        return null;
    }
}
function showFork(owner, fork) {
    const subtitle = document.getElementById('play-subtitle');
    if (!subtitle)
        return;
    const ownerLink = document.createElement('a');
    ownerLink.href = `https://github.com/${fork}`;
    const name = document.createElement('strong');
    name.textContent = owner;
    ownerLink.append(name);
    subtitle.replaceChildren('JavaScript port of NetHack 5.0 submitted by ', ownerLink, '.', document.createElement('br'));
    const links = [
        [`https://github.com/${fork}`, 'GitHub source'],
        ['https://mazesofmenace.ai/guidebook/', 'NetHack Guidebook'],
        ['https://mazesofmenace.ai/spoilers/', 'Traveler’s Companion to NetHack'],
        ['https://mazesofmenace.ai/nethackrc/', 'Edit nethackrc options'],
    ];
    for (const [index, [url, label]] of links.entries()) {
        if (index)
            subtitle.append(' · ');
        const link = document.createElement('a');
        link.href = url;
        link.textContent = label;
        subtitle.append(link);
    }
}
function readSavedOptions() {
    try {
        const stored = localStorage.getItem(NETHACKRC_KEY);
        return stored?.trim() ? stored : null;
    }
    catch {
        return null;
    }
}
function showGameOver(record) {
    const panel = document.getElementById('game-over-panel');
    const recordDisplay = document.getElementById('game-over-record');
    if (!panel || !recordDisplay)
        return;
    recordDisplay.textContent = record
        ? record.split('\n').filter(Boolean).slice(-5).reverse().join('\n')
        : '(no record file)';
    panel.classList.add('visible');
}
function wireToolbarButton(id, activate) {
    const button = document.getElementById(id);
    if (!(button instanceof HTMLButtonElement))
        return;
    // Keep Space/Enter directed to the terminal after a toolbar click.
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', () => {
        button.blur();
        activate();
    });
}
function clearSavedGames() {
    const prefix = window.__TELEPORT_VFS_PREFIX || 'vfs:';
    const keys = [];
    for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (key?.startsWith(prefix))
            keys.push(key);
    }
    for (const key of keys)
        localStorage.removeItem(key);
    return keys.length;
}
// Engine storage keys use vfs:. Browser persistence adds the fork owner.
class ForkStorage {
    prefix;
    constructor(prefix) {
        this.prefix = prefix;
    }
    browserKey(key) {
        return key.startsWith('vfs:') ? this.prefix + key.slice(4) : key;
    }
    getItem(key) { return localStorage.getItem(this.browserKey(key)); }
    setItem(key, value) { localStorage.setItem(this.browserKey(key), value); }
    removeItem(key) { localStorage.removeItem(this.browserKey(key)); }
    get length() {
        let count = 0;
        for (let index = 0; index < localStorage.length; index++) {
            if (localStorage.key(index)?.startsWith(this.prefix))
                count++;
        }
        return count;
    }
    key(index) {
        let count = 0;
        for (let position = 0; position < localStorage.length; position++) {
            const key = localStorage.key(position);
            if (!key?.startsWith(this.prefix))
                continue;
            if (count === index)
                return 'vfs:' + key.slice(this.prefix.length);
            count++;
        }
        return null;
    }
}
void main().catch((error) => {
    console.error(error);
    const container = document.getElementById('game-container');
    if (container)
        container.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
});
export {};
//# sourceMappingURL=browser.js.map