import { decodePolicyConfig, itemAt } from './session-types.mjs';
function positionKey(key) { const [x, y] = key.split(','); return [Number(x), Number(y)]; }
function previousNode(previous, node) {
    const parent = previous.get(node);
    if (parent == null)
        throw new Error(`missing path predecessor for ${node}`);
    return parent;
}
function isDirection(key) { return Object.hasOwn(DIRS, key); }
// holdout-policy.mjs — C-screen-driven holdout drivers (fuzz / explore / wide).
//
// A policy is an object driver for the native recorder: nextKey(lines, {cursor})
// returns the next single key to send (or null once the driver is done), and
// the `exhausted` getter reports completion. Keys are chosen ONLY from the
// screen the C game just drew; no game state is imported and no recorded
// traces are replayed.
//
// Exports:
//   decodeScreen(lines)            -> 24 fixed-width visible screen rows
//   parseStatus(rows)              -> {hp, hpMax, pw, dlvl, gold, turns, hunger, ...}
//   classifyPrompt(lines, cursor?) -> {kind, detail, ...}
//   createHoldoutPolicy(config)    -> {nextKey, exhausted, summary, acceptsGameExit}
const SCREEN_ROWS = 24;
const MIN_WIDTH = 80;
const ESC = '\x1b';
// DEC special graphics (NetHack symset:DECgraphics draws walls by switching
// to the alternate charset with SO/SI and printing ASCII codes).
const DEC_MAP = {
    '`': '◆', a: '▒', f: '°', g: '±', j: '┘', k: '┐', l: '┌', m: '└',
    n: '┼', o: '─', p: '─', q: '─', r: '─', s: '─', t: '├', u: '┤',
    v: '┴', w: '┬', x: '│', y: '≤', z: '≥', '{': 'π', '|': '≠',
    '}': '£', '~': '·',
};
// ---------------------------------------------------------------------------
// Screen decoding
// ---------------------------------------------------------------------------
function decodeLine(line) {
    let out = '';
    let alt = false;
    let i = 0;
    while (i < line.length) {
        const ch = line.charAt(i);
        if (ch === '\x1b') {
            const next = line[i + 1];
            if (next === '[') {
                let j = i + 2;
                let params = '';
                while (j < line.length && /[0-9;?<>= ]/.test(line.charAt(j))) {
                    params += line[j];
                    j++;
                }
                if (j < line.length) {
                    const fin = line[j];
                    if (fin === 'C') {
                        const n = Math.max(1, parseInt(params, 10) || 1);
                        out += ' '.repeat(n);
                    }
                    // Other CSI finals (SGR color, cursor moves) are invisible.
                    i = j + 1;
                    continue;
                }
                i = j;
                continue;
            }
            if (next === ']') {
                let j = i + 2;
                while (j < line.length && line[j] !== '\x07')
                    j++;
                i = j < line.length ? j + 1 : j;
                continue;
            }
            i += next === undefined ? 1 : 2;
            continue;
        }
        if (ch === '\x0e') {
            alt = true;
            i++;
            continue;
        }
        if (ch === '\x0f') {
            alt = false;
            i++;
            continue;
        }
        const code = ch.charCodeAt(0);
        if (code < 0x20 || code === 0x7f) {
            i++;
            continue;
        }
        if (alt && DEC_MAP[ch] !== undefined) {
            out += DEC_MAP[ch];
            i++;
            continue;
        }
        if (!alt && code >= 0x80 && code <= 0xff) {
            const low = String.fromCharCode(code & 0x7f);
            if (DEC_MAP[low] !== undefined) {
                out += DEC_MAP[low];
                i++;
                continue;
            }
        }
        out += ch;
        i++;
    }
    return out;
}
/** Expand a raw recorder screen payload (array of ANSI lines) into 24
 *  fixed-width visible rows. Idempotent on already-decoded rows. */
export function decodeScreen(lines) {
    const raw = typeof lines === 'string'
        ? lines.split('\n')
        : Array.from(lines ?? []);
    const rows = raw.slice(0, SCREEN_ROWS).map((l) => decodeLine(String(l ?? '')));
    while (rows.length < SCREEN_ROWS)
        rows.push('');
    let width = MIN_WIDTH;
    for (const r of rows)
        if (r.length > width)
            width = r.length;
    return rows.map((r) => r.padEnd(width, ' '));
}
// ---------------------------------------------------------------------------
// Status parsing
// ---------------------------------------------------------------------------
const HUNGER_STATES = ['Fainted', 'Fainting', 'Weak', 'Very Hungry', 'Hungry',
    'Oversatiated', 'Satiated'];
/** Parse the two bottom status rows. Returns null when no status is shown. */
export function parseStatus(rows) {
    let statusRow = -1;
    for (let i = rows.length - 1; i >= 1; i--) {
        if (/HP:\s*\d+\s*\(\d+\)/.test(itemAt(rows, i))) {
            statusRow = i;
            break;
        }
    }
    if (statusRow < 0)
        return null;
    const text = `${rows[statusRow - 1] ?? ''} ${rows[statusRow]}`;
    const hp = text.match(/HP:\s*(\d+)\s*\((\d+)\)/);
    const pw = text.match(/Pw:\s*(\d+)\s*\((\d+)\)/);
    const dlvl = text.match(/\b(?:Dlvl|Home|End|Astral):\s*([0-9]+)\b/);
    const gold = text.match(/\$:\s*(\d+)/);
    const turns = text.match(/\bT:\s*(\d+)/);
    let hunger = null;
    for (const h of HUNGER_STATES) {
        if (new RegExp(`\\b${h}\\b`).test(text)) {
            hunger = h;
            break;
        }
    }
    const conditions = [];
    const condRe = /\b(Blind|Deaf|Stun|Conf|Hallu|Ill|FoodPois|Slime|Petrify|Strngl|Lev|Fly|Ride|Burdened|Stressed|Strained|Overtaxed|Overloaded)\b/g;
    let cm;
    while ((cm = condRe.exec(text)) !== null)
        conditions.push(itemAt(cm, 1));
    return {
        statusRow,
        hp: hp ? Number(hp[1]) : null,
        hpMax: hp ? Number(hp[2]) : null,
        pw: pw ? Number(pw[1]) : null,
        pwMax: pw ? Number(pw[2]) : null,
        dlvl: dlvl ? Number(dlvl[1]) : null,
        gold: gold ? Number(gold[1]) : null,
        turns: turns ? Number(turns[1]) : null,
        hunger,
        conditions,
    };
}
// ---------------------------------------------------------------------------
// Prompt classification
// ---------------------------------------------------------------------------
const DEATH_PATTERNS = [
    /do you want your possessions identified/i,
    /do you want an account of creatures vanquished/i,
    /do you want to see your conduct/i,
    /\byou died\b/i,
    /^you die\b/i,
    /rest in peace/i,
];
const MAP_GLYPH_RE = /[─│┌┐└┘┼├┤┴┬·◆▒±≠≤≥π£#]/;
const NAME_PROMPT_RE = /who are you|what is your name/i;
// Menu entries use exactly one space around the separator; map rows cannot
// produce that shape.
const MENU_ITEM_PAREN = /(?:^|\s)([a-zA-Z])\) \S/;
const MENU_ITEM_DASH = /(?:^|\s)([a-zA-Z]) - \S.{2,}/;
function looksLikeMenuItem(t) {
    return MENU_ITEM_PAREN.test(t) || MENU_ITEM_DASH.test(t);
}
function promptDefaultLetter(msg) {
    const m = msg.match(/\((\w)\)\s*$/);
    return m?.[1] ?? null;
}
function classifyRows(rows, cursor) {
    const msg = itemAt(rows, 0).trimEnd();
    for (const r of rows) {
        if (r.includes('--More--'))
            return { kind: 'more', detail: r.trim() };
    }
    if (/^\(?For instructions type/i.test(msg) || /^Move cursor to .+:?$/i.test(msg)) {
        return { kind: 'getpos', detail: msg };
    }
    for (const re of DEATH_PATTERNS) {
        if (re.test(msg))
            return { kind: 'death', detail: msg };
    }
    // Menus overlay the map area: lettered item rows, "(end)" marker or a
    // "(N of M)" pagination row on the last screen row.
    let items = 0;
    const itemRows = [];
    let endMarker = false;
    let pageMarker = null;
    for (let i = 0; i < rows.length - 1; i++) {
        const t = itemAt(rows, i).trim();
        // Menus can overlay the map, so markers may sit behind map glyphs.
        if (/(?:^|\s)\(end\)\s*$/.test(t)) {
            endMarker = true;
            continue;
        }
        const m = t.match(MENU_ITEM_DASH) ?? t.match(MENU_ITEM_PAREN);
        if (m && m.index !== undefined) {
            items++;
            itemRows.push({ row: i, text: t.slice(Math.max(0, t.indexOf(m[0]))) });
            continue;
        }
        const pm = t.match(/(?:^|\s)\((\d+)\s+of\s+(\d+)\)\s*$/);
        if (pm)
            pageMarker = { page: Number(pm[1]), of: Number(pm[2]) };
    }
    if (pageMarker || endMarker || items >= 2 || (items >= 1 && endMarker)) {
        return { kind: 'menu', detail: msg, items: itemRows, pageMarker, endMarker };
    }
    // A live question prompt keeps the cursor at the end of the question text
    // (long questions can wrap onto the next row). Once the cursor is back on
    // the map, away from any question text, the question is a leftover from
    // an already-answered prompt and must not be re-answered.
    const status = parseStatus(rows);
    let staleQuestion = false;
    if (cursor && status && cursor[1] >= 1 && cursor[1] < status.statusRow - 1) {
        const row = rows[cursor[1]] ?? '';
        const before = row.slice(0, Math.min(cursor[0] + 1, row.length)).trimEnd();
        // The cursor at the end of question text (including a wrapped row or
        // a trailing "(default)" group) marks a live prompt.
        staleQuestion = !(/[?:]\s*$/.test(before) || /\]\s*(\(\w\))?\s*$/.test(before));
    }
    // Question prompts live on the message line, but a long question wraps
    // onto the next row. The cursor marks the end of the live question, so
    // scan the row the cursor sits on (row 0 without a cursor).
    const qRow = cursor ? Math.min(Math.max(cursor[1], 0), 2) : 0;
    const q = (rows[qRow] ?? '').trimEnd();
    if (!staleQuestion && /^Count:\s*\d*\s*$/.test(q)) {
        return { kind: 'count', detail: q };
    }
    if (/shall i pick .* (character|role|race|gender|alignment|name)/i.test(q)) {
        return { kind: 'chargen', detail: q, answer: 'y' };
    }
    if (!staleQuestion && /in what direction\??\s*(\[[^\]]*\])?\s*$/i.test(q)) {
        return { kind: 'direction', detail: q };
    }
    const ynBracket = q.match(/\[([a-zA-Z/]{1,6})\]\s*(?:\((\w)\))?\s*$/);
    const ynSlash = /\((?:y\/n|n\/y)\)\s*$/i.test(q);
    if (!staleQuestion && (ynBracket || ynSlash)) {
        return {
            kind: 'yn',
            detail: q,
            choices: ynBracket ? itemAt(ynBracket, 1) : 'yn',
            default: ynBracket ? (ynBracket[2] ?? (/shall i pick/i.test(q) ? 'y' : null)) : null,
        };
    }
    // Text/getline and getobj prompts. A live prompt has the cursor at the
    // end of the question; a leftover '?' message at a command boundary does
    // not. getobj prompts end with an item-list bracket: "...? [e or ?*]".
    const candidates = [];
    for (let i = 0; i < rows.length - 2; i++) {
        const t = itemAt(rows, i).trimEnd();
        if (!t || MAP_GLYPH_RE.test(t) || looksLikeMenuItem(t.trim()))
            continue;
        if (/[?:]$/.test(t) || /\? \[[^\]]*[?*][^\]]*\]\s*$/.test(t)) {
            candidates.push({ row: i, text: t });
        }
    }
    let textPrompt = null;
    for (const c of candidates) {
        if (NAME_PROMPT_RE.test(c.text)) {
            textPrompt = c;
            break;
        }
    }
    if (!textPrompt) {
        const onCursor = cursor && candidates.find((c) => c.row === cursor[1]
            && Math.abs(cursor[0] - c.text.trimStart().length) <= 1);
        if (onCursor)
            textPrompt = onCursor;
        else if (!cursor && candidates.length === 1 && candidates[0]?.row === 0) {
            textPrompt = candidates[0];
        }
    }
    if (textPrompt)
        return { kind: 'text', detail: textPrompt.text, row: textPrompt.row };
    const cursorOnMap = staleQuestion;
    if (status)
        return { kind: 'command', detail: msg, cursorOnMap };
    return { kind: 'unknown', detail: msg };
}
/** Classify what the game is currently waiting for. `cursor` is the optional
 *  [cx, cy, 1] array the recorder reports; it disambiguates live prompts
 *  from leftover messages. */
export function classifyPrompt(lines, cursor) {
    return classifyRows(decodeScreen(lines), cursor);
}
// ---------------------------------------------------------------------------
// RNG
// ---------------------------------------------------------------------------
function mulberry32(a) {
    let s = a | 0;
    return function () {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
// ---------------------------------------------------------------------------
// Map helpers (explore mode)
// ---------------------------------------------------------------------------
const DIRS = {
    h: [0, -1], j: [1, 0], k: [-1, 0], l: [0, 1],
    y: [-1, -1], u: [-1, 1], b: [1, -1], n: [1, 1],
};
const DIR_KEYS = ['h', 'j', 'k', 'l', 'y', 'u', 'b', 'n'];
const WALKABLE = new Set(['·', '.', '#', "'", '>', '<', '≥', '≤', '+', 'I',
    '$', '%', ')', '[', '!', '?', '/', '=', '"', '*', '(', '0', '_', ',', ':',
    '{', '}', '°']);
const MONSTER_RE = /^[a-zA-Z]$/;
function findHero(rows, cursor, status) {
    const mapBottom = (status ? status.statusRow : rows.length) - 1;
    let best = null;
    for (let y = 1; y < mapBottom; y++) {
        const x = itemAt(rows, y).indexOf('@');
        if (x >= 0) {
            best = { x, y };
            if (!cursor || (cursor[1] === y && Math.abs(cursor[0] - x) <= 1))
                break;
        }
    }
    if (best)
        return best;
    if (cursor && cursor[1] >= 1 && cursor[1] < mapBottom) {
        return { x: cursor[0], y: cursor[1] };
    }
    return null;
}
function cellAt(rows, x, y, bottom) {
    if (y < 1 || y >= bottom || x < 0 || x >= itemAt(rows, y).length)
        return undefined;
    return itemAt(rows, y).charAt(x);
}
const WALL_GLYPHS = new Set(['─', '│', '┌', '┐', '└', '┘', '┼', '├', '┤', '┴',
    '┬', '|', '-']);
/** A '+' attached to a wall is a closed door (not passable until opened);
 *  a lone '+' on the floor is a spellbook you can step on. */
function isDoorLike(rows, x, y, bottom) {
    if (cellAt(rows, x, y, bottom) !== '+')
        return false;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy)
                continue;
            const c = cellAt(rows, x + dx, y + dy, bottom);
            if (c !== undefined && WALL_GLYPHS.has(c))
                return true;
        }
    }
    return false;
}
function walkableAt(rows, x, y, bottom, blocked, petCells) {
    const c = cellAt(rows, x, y, bottom);
    if (c === undefined || c === ' ')
        return false;
    if (MONSTER_RE.test(c)) {
        // The hero's pet can be displaced; wild monsters cannot be walked
        // through.
        return petCells?.has(`${x},${y}`) ?? false;
    }
    if (!WALKABLE.has(c))
        return false;
    if (blocked?.has(`${x},${y}`))
        return false;
    if (c === '+' && isDoorLike(rows, x, y, bottom))
        return false;
    return true;
}
/** A neighbor cell worth reaching: unknown terrain (not yet bumped) or a
 *  closed door that might open onto new space. */
function isFrontierNeighbor(rows, x, y, bottom, blockedCells) {
    if (blockedCells?.has(`${x},${y}`))
        return false;
    const c = cellAt(rows, x, y, bottom);
    if (c === ' ')
        return true;
    if (c === '+' && isDoorLike(rows, x, y, bottom))
        return true;
    return false;
}
function frontierBfs(rows, hero, bottom, blocked, blockedCells, petCells, wantDoor) {
    // BFS over known walkable cells toward the closest cell adjacent to a
    // closed door (wantDoor) or to unknown terrain.
    const start = `${hero.x},${hero.y}`;
    const prev = new Map([[start, null]]);
    const queue = [start];
    let goal = null;
    let goalDoor = false;
    let head = 0;
    while (head < queue.length && !goal) {
        const cur = itemAt(queue, head++);
        const [cx, cy] = positionKey(cur);
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (!dx && !dy)
                    continue;
                const nx = cx + dx, ny = cy + dy;
                const key = `${nx},${ny}`;
                if (prev.has(key))
                    continue;
                const c = cellAt(rows, nx, ny, bottom);
                if (c === undefined)
                    continue;
                const door = c === '+' && isDoorLike(rows, nx, ny, bottom);
                const unknown = c === ' ' && !blockedCells?.has(key);
                if ((wantDoor ? door : unknown) && !goal) {
                    goal = cur;
                    goalDoor = door;
                    break;
                }
                if (walkableAt(rows, nx, ny, bottom, blocked, petCells)) {
                    prev.set(key, cur);
                    queue.push(key);
                }
            }
            if (goal)
                break;
        }
    }
    return { goal, goalDoor, prev, start };
}
function frontierStep(rows, hero, bottom, blocked, blockedCells, petCells) {
    // Closed doors lead somewhere far more often than bare rock, so try a
    // door frontier first, then any unknown terrain.
    let found = frontierBfs(rows, hero, bottom, blocked, blockedCells, petCells, true);
    if (!found.goal) {
        found = frontierBfs(rows, hero, bottom, blocked, blockedCells, petCells, false);
    }
    const { goal, prev, start } = found;
    if (!goal)
        return null;
    if (goal === start) {
        // Already at the frontier: open a closed door if one is adjacent,
        // else step into the unknown neighbor.
        let unknownDir = null;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (!dx && !dy)
                    continue;
                const x = hero.x + dx, y = hero.y + dy;
                const dir = DIR_KEYS.find((d) => DIRS[d][0] === dy && DIRS[d][1] === dx);
                if (cellAt(rows, x, y, bottom) === '+' && isDoorLike(rows, x, y, bottom)
                    && !blockedCells?.has(`${x},${y}`) && dir) {
                    return { door: true, dir };
                }
                if (unknownDir === null && cellAt(rows, x, y, bottom) === ' '
                    && !blockedCells?.has(`${x},${y}`) && dir) {
                    unknownDir = dir;
                }
            }
        }
        return unknownDir ? { door: false, dir: unknownDir } : null;
    }
    // Walk prev chain back to the start for the first step.
    let node = goal;
    while (prev.get(node) !== start)
        node = previousNode(prev, node);
    const [nx, ny] = positionKey(node);
    const dy = Math.sign(ny - hero.y), dx = Math.sign(nx - hero.x);
    const dir = DIR_KEYS.find((d) => DIRS[d][0] === dy && DIRS[d][1] === dx);
    return dir ? { door: false, dir } : null;
}
function stepToward(rows, hero, target, bottom, blocked, petCells) {
    const start = `${hero.x},${hero.y}`;
    const prev = new Map([[start, null]]);
    const queue = [start];
    const goalKey = `${target.x},${target.y}`;
    let head = 0;
    while (head < queue.length) {
        const cur = itemAt(queue, head++);
        if (cur === goalKey)
            break;
        const [cx, cy] = positionKey(cur);
        for (const d of DIR_KEYS) {
            const nx = cx + DIRS[d][1], ny = cy + DIRS[d][0];
            const key = `${nx},${ny}`;
            if (prev.has(key))
                continue;
            if (!walkableAt(rows, nx, ny, bottom, blocked))
                continue;
            prev.set(key, cur);
            queue.push(key);
        }
    }
    if (!prev.has(goalKey) || goalKey === start)
        return null;
    let node = goalKey;
    while (prev.get(node) !== start)
        node = previousNode(prev, node);
    const [nx, ny] = positionKey(node);
    const dy = Math.sign(ny - hero.y), dx = Math.sign(nx - hero.x);
    return DIR_KEYS.find((d) => DIRS[d][0] === dy && DIRS[d][1] === dx) ?? null;
}
/** BFS to the farthest reachable walkable cell; returns the first step. */
function farthestCellStep(rows, hero, bottom, blocked, petCells) {
    const start = `${hero.x},${hero.y}`;
    const prev = new Map([[start, null]]);
    const queue = [start];
    let last = start;
    for (let head = 0; head < queue.length; head++) {
        const cur = itemAt(queue, head);
        last = cur;
        const [cx, cy] = positionKey(cur);
        for (const d of DIR_KEYS) {
            const nx = cx + DIRS[d][1], ny = cy + DIRS[d][0];
            const key = `${nx},${ny}`;
            if (prev.has(key))
                continue;
            if (!walkableAt(rows, nx, ny, bottom, blocked, petCells))
                continue;
            prev.set(key, cur);
            queue.push(key);
        }
    }
    if (last === start)
        return null;
    let node = last;
    while (prev.get(node) !== start)
        node = previousNode(prev, node);
    const [nx, ny] = positionKey(node);
    const dy = Math.sign(ny - hero.y), dx = Math.sign(nx - hero.x);
    return DIR_KEYS.find((d) => DIRS[d][0] === dy && DIRS[d][1] === dx) ?? null;
}
/** BFS to the closest walkable cell the hero has not stood on yet. */
function nearestUnvisitedStep(rows, hero, bottom, blocked, petCells, visited) {
    const start = `${hero.x},${hero.y}`;
    const prev = new Map([[start, null]]);
    const queue = [start];
    let goal = null;
    let head = 0;
    while (head < queue.length && !goal) {
        const cur = itemAt(queue, head++);
        const [cx, cy] = positionKey(cur);
        for (const d of DIR_KEYS) {
            const nx = cx + DIRS[d][1], ny = cy + DIRS[d][0];
            const key = `${nx},${ny}`;
            if (prev.has(key))
                continue;
            if (!walkableAt(rows, nx, ny, bottom, blocked, petCells))
                continue;
            prev.set(key, cur);
            if (!visited.has(key)) {
                goal = key;
                break;
            }
            queue.push(key);
        }
    }
    if (!goal || goal === start)
        return null;
    let node = goal;
    while (prev.get(node) !== start)
        node = previousNode(prev, node);
    const [nx, ny] = positionKey(node);
    const dy = Math.sign(ny - hero.y), dx = Math.sign(nx - hero.x);
    return DIR_KEYS.find((d) => DIRS[d][0] === dy && DIRS[d][1] === dx) ?? null;
}
function adjacentMonster(rows, hero, bottom) {
    const out = [];
    for (const d of DIR_KEYS) {
        const c = cellAt(rows, hero.x + DIRS[d][1], hero.y + DIRS[d][0], bottom);
        if (c !== undefined && MONSTER_RE.test(c) && c !== '@') {
            out.push({ dir: d, ch: c });
        }
    }
    return out;
}
// ---------------------------------------------------------------------------
// Policy factory
// ---------------------------------------------------------------------------
const FOOD_RE = /(ration|apple|egg|food|lichen|corpse|banana|orange|pear|plum|candy|pancake|kelp|melon|carrot|cookie|eucalyptus|garlic|\btin\b|meat|lembas|cram|mold|slime|mango|grape|sprig|tomato|honey|royal jelly|fortune cookie|candy bar|crayon)/i;
function pickWeighted(rand, entries) {
    let total = 0;
    for (const [, w] of entries)
        total += w;
    let r = rand() * total;
    for (const [v, w] of entries) {
        r -= w;
        if (r <= 0)
            return v;
    }
    return itemAt(entries, entries.length - 1)[0];
}
/**
 * Create a holdout driver.
 * config: { kind: 'fuzz'|'explore'|'wide', seed: integer, maxSteps: integer,
 *           name?: string }
 */
export function createHoldoutPolicy(input) {
    const config = decodePolicyConfig(input);
    const kind = config.kind;
    const seed = config?.seed;
    const maxSteps = config?.maxSteps;
    if (kind !== 'fuzz' && kind !== 'explore' && kind !== 'wide') {
        throw new Error(`holdout policy kind must be 'fuzz', 'explore', or 'wide': ${kind}`);
    }
    if (!Number.isInteger(seed))
        throw new Error('holdout policy needs an integer seed');
    if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 1_000_000) {
        throw new Error(`holdout policy needs 1..1000000 maxSteps: ${maxSteps}`);
    }
    if (kind === 'wide')
        return createWidePolicy(config);
    const playerName = typeof config.name === 'string' && config.name.trim()
        ? config.name.trim().slice(0, 32) : null;
    const rand = mulberry32(seed);
    const drainBudget = 96 + Math.floor(maxSteps / 8);
    const st = {
        keysSent: 0,
        calls: 0,
        stopReason: null,
        dead: false,
        deadKeys: 0,
        drainLeft: drainBudget,
        menuTries: 0,
        lastClass: null,
        lastDir: null,
        lastKey: null,
        lastMoveKey: null,
        lastHeroKey: null,
        lastHeroPos: null,
        hpHistory: [],
        stuckMoves: 0,
        eatCooldown: 0,
        pendingEat: false,
        eatDrain: 0,
        restBudget: 400,
        restRun: 0,
        searchRun: 0,
        dlvl: null,
        turns: null,
        maxTurns: null,
        hp: null,
        hpMax: null,
        hunger: null,
        explored: 0,
        descends: 0,
        attacks: 0,
        moves: 0,
        promptCounts: { more: 0, menu: 0, yn: 0, text: 0, direction: 0, count: 0, getpos: 0, chargen: 0 },
        nameIdx: 0,
        foodLetters: [],
        petCells: new Set(),
        visited: new Set(),
        seenStairs: new Set(),
        stairsDlvl: null,
        pendingOpen: null,
        doorsOpened: 0,
        blockedCells: new Set(),
    };
    function send(key) {
        st.keysSent++;
        st.lastKey = key;
        return key;
    }
    function updateObservation(rows, cls, status, cursor) {
        st.lastClass = cls.kind;
        if (status) {
            st.hp = status.hp;
            st.hpMax = status.hpMax;
            if (status.hp !== null) {
                st.hpHistory.push(status.hp);
                if (st.hpHistory.length > 16)
                    st.hpHistory.shift();
            }
            st.hunger = status.hunger;
            if (status.dlvl !== null && status.dlvl !== undefined)
                st.dlvl = status.dlvl;
            if (status.turns !== null) {
                st.turns = status.turns;
                if (st.maxTurns === null || status.turns > st.maxTurns)
                    st.maxTurns = status.turns;
            }
        }
        // Message cues run on every screen with status, including --More--
        // and question screens, so locked-door or refusal messages that only
        // appear transiently are still acted on.
        if (status) {
            const bottom = status.statusRow - 1;
            const hero0 = findHero(rows, cursor, status);
            const msg = itemAt(rows, 0);
            const prevHeroPos = st.lastHeroPos;
            if (/anything to eat/i.test(msg))
                st.eatCooldown = 400;
            if (/swap places with your \w+/i.test(msg) && prevHeroPos) {
                // After a swap the pet occupies the hero's previous cell.
                st.petCells = new Set([`${prevHeroPos.x},${prevHeroPos.y}`]);
            }
            if (/your \w+ is in the way/i.test(msg) && prevHeroPos && st.lastKey && isDirection(st.lastKey)) {
                st.petCells.add(`${prevHeroPos.x + DIRS[st.lastKey][1]},${prevHeroPos.y + DIRS[st.lastKey][0]}`);
            }
            if (/can't go down|cannot go down/i.test(msg) && hero0) {
                st.seenStairs.delete(`${hero0.x},${hero0.y}`);
            }
            if (/locked/i.test(msg) && prevHeroPos && st.lastKey && isDirection(st.lastKey)) {
                // The faced cell (movement or open-answer direction) will not
                // open; stop treating it as a way through.
                st.blockedCells.add(`${prevHeroPos.x + DIRS[st.lastKey][1]},${prevHeroPos.y + DIRS[st.lastKey][0]}`);
            }
            st.lastHeroPos = hero0 ? { x: hero0.x, y: hero0.y } : null;
            if (hero0 && cls.kind === 'command')
                st.visited.add(`${hero0.x},${hero0.y}`);
            // A movement key sent at a command prompt that did not move the
            // hero hit something impassable; remember it so pathing stops
            // trying. Keys that answer prompts (direction answers) are not
            // movements, and attacking a monster also leaves the hero in
            // place, so never block cells holding a monster glyph.
            if (st.lastMoveKey && hero0 && prevHeroPos && st.lastKey === st.lastMoveKey) {
                const fx = prevHeroPos.x + DIRS[st.lastMoveKey][1];
                const fy = prevHeroPos.y + DIRS[st.lastMoveKey][0];
                const faced = cellAt(rows, fx, fy, bottom);
                const moved = hero0.x !== prevHeroPos.x || hero0.y !== prevHeroPos.y;
                const attack = faced !== undefined && MONSTER_RE.test(faced);
                if (!moved && !attack)
                    st.blockedCells.add(`${fx},${fy}`);
            }
        }
        if (cls.kind === 'command' && status) {
            const bottom = status.statusRow - 1;
            const seen = new Set();
            for (let y = 1; y < bottom; y++) {
                for (let x = 0; x < itemAt(rows, y).length; x++) {
                    if (itemAt(rows, y).charAt(x) !== ' ')
                        seen.add(`${x},${y}`);
                }
            }
            st.explored = seen.size;
            if (st.stairsDlvl !== st.dlvl) {
                st.stairsDlvl = st.dlvl;
                st.seenStairs.clear();
                st.blockedCells.clear();
                st.visited.clear();
            }
            for (let y = 1; y < bottom; y++) {
                for (let x = 0; x < itemAt(rows, y).length; x++) {
                    if (itemAt(rows, y).charAt(x) === '>')
                        st.seenStairs.add(`${x},${y}`);
                }
            }
        }
        if (st.eatCooldown > 0)
            st.eatCooldown--;
        if (cls.kind !== 'menu')
            st.menuTries = 0;
        if (cls.kind === 'command') {
            st.pendingEat = false;
            st.pendingOpen = null;
        }
    }
    function ynKey(cls) {
        const choices = cls.choices ?? '';
        const def = cls.default && choices.includes(cls.default)
            ? cls.default : null;
        if (def)
            return send(def);
        // Not every bracketed question is yes/no (e.g. "[rl]" ring finger,
        // "[abc]" selections): answer from the advertised letters.
        const yesNo = /n/.test(choices) || /y/.test(choices);
        if (yesNo)
            return send(/shall i pick/i.test(cls.detail) ? 'y' : 'n');
        if (choices)
            return send(choices.charAt(0));
        return send(/shall i pick/i.test(cls.detail) ? 'y' : 'n');
    }
    function menuKey(cls) {
        st.menuTries++;
        if (st.menuTries > 24) {
            st.stopReason = 'menu-overrun';
            throw new Error(`holdout policy ${kind} seed ${seed}: still in a menu after ${st.menuTries} menu keys (${st.keysSent} keys sent)`);
        }
        if (cls.items?.length) {
            st.foodLetters = cls.items
                .flatMap(item => {
                const letter = item.text.match(/^([a-zA-Z])/)?.[1];
                return letter && FOOD_RE.test(item.text) ? [{ letter, text: item.text }] : [];
            })
                .slice(0, 8);
        }
        if (st.pendingEat && cls.items?.length) {
            for (const item of cls.items) {
                const letter = item.text.match(/^([a-zA-Z])/)?.[1];
                if (letter && FOOD_RE.test(item.text)) {
                    st.pendingEat = false;
                    return send(letter);
                }
            }
            st.pendingEat = false;
        }
        return send(st.menuTries % 2 === 1 ? ESC : ' ');
    }
    function chargenKey() {
        return send('y');
    }
    function textKey(cls) {
        if (NAME_PROMPT_RE.test(cls.detail)) {
            const name = playerName ?? 'Holdout';
            if (st.nameIdx < name.length)
                return send(name.charAt(st.nameIdx++));
            st.nameIdx = 0;
            return send('\r');
        }
        if (st.pendingEat && /what do you want to eat/i.test(cls.detail)) {
            if (st.foodLetters.length) {
                st.pendingEat = false;
                return send(itemAt(st.foodLetters, 0).letter);
            }
            // No known food letters yet: '?' lists them one per line.
            if (++st.eatDrain < 12)
                return send('?');
            st.pendingEat = false;
            return send(ESC);
        }
        st.pendingEat = false;
        return send(ESC);
    }
    function deathKey(cls) {
        st.deadKeys++;
        if (st.deadKeys > 100 || st.keysSent >= maxSteps + drainBudget) {
            st.stopReason = 'death-bound';
            return null;
        }
        if (cls.kind === 'more')
            return send(' ');
        if (cls.kind === 'menu')
            return send(' ');
        if (cls.kind === 'yn' || cls.kind === 'death') {
            // Wizard-mode death confirmation: accept the death for a clean
            // outcome instead of resurrecting forever.
            if (/\bDie\?/i.test(cls.detail))
                return send('y');
            const def = promptDefaultLetter(cls.detail);
            return send(def ?? 'n');
        }
        if (cls.kind === 'command' || cls.kind === 'unknown')
            return send(' ');
        return send(ESC);
    }
    function chooseFuzzMove(rows, hero, bottom, blocked) {
        const known = [];
        const unknown = [];
        for (const d of DIR_KEYS) {
            const x = hero.x + DIRS[d][1], y = hero.y + DIRS[d][0];
            const c = cellAt(rows, x, y, bottom);
            if (c === undefined || blocked.has(`${x},${y}`))
                continue;
            if (c === ' ') {
                unknown.push(d);
                continue;
            }
            if (WALKABLE.has(c) && !(c === '+' && isDoorLike(rows, x, y, bottom)))
                known.push(d);
        }
        // Prefer known-walkable steps: dark unknown cells are often rock.
        const pool = known.length && (unknown.length === 0 || rand() < 0.85)
            ? known : unknown;
        if (pool.length === 0)
            return itemAt(DIR_KEYS, Math.floor(rand() * 8));
        if (st.lastDir && pool.includes(st.lastDir) && rand() < 0.45)
            return st.lastDir;
        return itemAt(pool, Math.floor(rand() * pool.length));
    }
    function fuzzAction(rows, hero, status) {
        const bottom = (status ? status.statusRow : rows.length) - 1;
        const monsters = hero ? adjacentMonster(rows, hero, bottom) : [];
        const onStairs = hero
            && (itemAt(rows, hero.y).charAt(hero.x) === '>' || st.seenStairs.has(`${hero.x},${hero.y}`));
        const hungry = !!status?.hunger && status.hunger !== 'Satiated' && status.hunger !== 'Oversatiated';
        const action = pickWeighted(rand, [
            ['move', onStairs ? 0.40 : 0.68],
            ['descend', onStairs ? 0.25 : 0],
            ['search', monsters.length ? 0 : 0.12],
            ['inventory', 0.06],
            ['pickup', 0.06],
            ['rest', monsters.length ? 0 : 0.03],
            ['eat', hungry && st.eatCooldown === 0 ? 0.10 : 0.02],
            ['apply', 0.03],
            ['wield', 0.02],
        ]);
        switch (action) {
            case 'descend':
                st.descends++;
                return send('>');
            case 'search':
                st.searchRun++;
                return send('s');
            case 'inventory':
                return send('i');
            case 'pickup':
                return send(',');
            case 'rest':
                return send('.');
            case 'eat':
                st.pendingEat = true;
                st.eatDrain = 0;
                st.eatCooldown = 80;
                return send('e');
            case 'apply':
                return send('a');
            case 'wield':
                return send('w');
            default: {
                if (!hero)
                    return send(itemAt(DIR_KEYS, Math.floor(rand() * 8)));
                const dir = chooseFuzzMove(rows, hero, bottom, st.blockedCells);
                st.lastDir = dir;
                if (monsters.some((m) => m.dir === dir))
                    st.attacks++;
                return send(dir);
            }
        }
    }
    function exploreAction(rows, hero, status) {
        const bottom = (status ? status.statusRow : rows.length) - 1;
        if (!hero)
            return send(itemAt(DIR_KEYS, Math.floor(rand() * 8)));
        const hp = status?.hp ?? 1;
        const hpMax = status?.hpMax ?? 1;
        const frac = hpMax > 0 ? hp / hpMax : 1;
        const monsters = adjacentMonster(rows, hero, bottom);
        const hungry = !!status?.hunger
            && ['Weak', 'Fainting', 'Fainted', 'Hungry', 'Very Hungry'].includes(status.hunger)
            && st.eatCooldown === 0;
        if (hungry && frac > 0.15) {
            st.pendingEat = true;
            st.eatDrain = 0;
            st.eatCooldown = 80;
            return send('e');
        }
        // Adjacent letters are often the hero's own pet; only treat them as
        // hostiles once hp is actually dropping. Compare against a few keys
        // ago so slow regeneration does not count as fresh damage.
        const ref = st.hpHistory[Math.max(0, st.hpHistory.length - 3)];
        const damageRecently = st.hpHistory.length > 0 && ref !== undefined
            && hp < ref;
        if (frac < 0.35 && !damageRecently && st.restBudget > 0 && st.restRun < 60) {
            st.restBudget--;
            st.restRun++;
            return send('.');
        }
        st.restRun = 0;
        if (monsters.length && damageRecently && frac < 0.3) {
            let bestDir = null, bestDist = -1;
            for (const d of DIR_KEYS) {
                const nx = hero.x + DIRS[d][1], ny = hero.y + DIRS[d][0];
                if (!walkableAt(rows, nx, ny, bottom, st.blockedCells, st.petCells))
                    continue;
                let dist = 1e9;
                for (const m of monsters) {
                    const mx = hero.x + DIRS[m.dir][1], my = hero.y + DIRS[m.dir][0];
                    dist = Math.min(dist, Math.abs(nx - mx) + Math.abs(ny - my));
                }
                if (dist > bestDist) {
                    bestDist = dist;
                    bestDir = d;
                }
            }
            if (bestDir) {
                st.lastDir = bestDir;
                return send(bestDir);
            }
            st.attacks++;
            return send(itemAt(monsters, 0).dir);
        }
        if (monsters.length && (damageRecently || st.stuckMoves > 4)) {
            st.attacks++;
            return send(itemAt(monsters, 0).dir);
        }
        if (itemAt(rows, hero.y).charAt(hero.x) === '>'
            || st.seenStairs.has(`${hero.x},${hero.y}`)) {
            st.descends++;
            return send('>');
        }
        const heroKey = `${hero.x},${hero.y}`;
        if (st.lastHeroKey === heroKey)
            st.stuckMoves++;
        else {
            st.stuckMoves = 0;
            st.lastHeroKey = heroKey;
        }
        if (st.stuckMoves > 8) {
            st.stuckMoves = 0;
            const dir = chooseFuzzMove(rows, hero, bottom, st.blockedCells);
            st.lastDir = dir;
            return send(dir);
        }
        const step = frontierStep(rows, hero, bottom, st.blockedCells, st.blockedCells, st.petCells);
        if (step?.door) {
            st.pendingOpen = step.dir;
            st.doorsOpened++;
            return send('o');
        }
        let dir = step?.dir ?? null;
        if (!dir) {
            // No frontier reachable: go to remembered stairs, else search or wander.
            let stairs = null;
            for (const key of st.seenStairs) {
                const [sx, sy] = positionKey(key);
                if (cellAt(rows, sx, sy, bottom) === '>'
                    || st.seenStairs.has(`${hero.x},${hero.y}`)) {
                    stairs = { x: sx, y: sy };
                    break;
                }
            }
            if (!stairs) {
                for (let y = 1; y < bottom && !stairs; y++) {
                    const x = itemAt(rows, y).indexOf('>');
                    if (x >= 0)
                        stairs = { x, y };
                }
            }
            if (stairs && (stairs.x !== hero.x || stairs.y !== hero.y)) {
                dir = stepToward(rows, hero, stairs, bottom, st.blockedCells, st.petCells);
            }
        }
        if (!dir) {
            dir = nearestUnvisitedStep(rows, hero, bottom, st.blockedCells, st.petCells, st.visited);
        }
        if (!dir) {
            // Everything reachable is already walked: head for the far
            // corner of the known map so the viewport can reveal more.
            dir = farthestCellStep(rows, hero, bottom, st.blockedCells, st.petCells);
        }
        if (!dir) {
            // Fully walked region: a couple of searches, then move on.
            if (st.searchRun < 3 && rand() < 0.3) {
                st.searchRun++;
                return send('s');
            }
            st.searchRun = 0;
            dir = chooseFuzzMove(rows, hero, bottom, st.blockedCells);
        }
        st.lastDir = dir;
        return send(dir);
    }
    function nextKey(lines, info) {
        st.calls++;
        if (st.stopReason)
            return null;
        const rows = decodeScreen(lines);
        const cursor = Array.isArray(info?.cursor) && info.cursor.length >= 2
            ? [info.cursor[0], info.cursor[1]] : null;
        let cls;
        try {
            cls = classifyRows(rows, cursor);
        }
        catch (err) {
            st.stopReason = 'classify-error';
            throw err;
        }
        const status = parseStatus(rows);
        if (st.dead) {
            if (cls.kind === 'command' && status && status.hp !== null
                && status.hp > 0) {
                // The hero is alive again (debug resurrection or life
                // saving): resume normal play instead of draining death
                // keys forever.
                st.dead = false;
                st.deadKeys = 0;
            }
            else {
                return deathKey(cls);
            }
        }
        if (cls.kind === 'death' || (status && status.hp === 0 && (status.hpMax ?? 0) > 0)) {
            st.dead = true;
            return deathKey(cls);
        }
        updateObservation(rows, cls, status, cursor);
        // Boundary: stop only at a normal command prompt (game waiting for a
        // fresh command, cursor on the map), after ~maxSteps keys.
        if (st.keysSent >= maxSteps) {
            if (cls.kind === 'command' && (!cursor || cls.cursorOnMap)) {
                st.stopReason = 'max-steps';
                return null;
            }
            if (st.drainLeft-- <= 0) {
                st.stopReason = 'prompt-overrun';
                throw new Error(`holdout policy ${kind} seed ${seed}: no command boundary after ${st.keysSent} keys (stuck at ${cls.kind})`);
            }
        }
        switch (cls.kind) {
            case 'more':
                st.promptCounts.more++;
                if (st.pendingEat && ++st.eatDrain < 12) {
                    for (const raw of rows) {
                        const t = raw.replace(/--More--\s*$/, '').trim();
                        const m = t.match(/^([a-zA-Z])\s+-\s+(\S.*)$/);
                        if (m && FOOD_RE.test(itemAt(m, 2))) {
                            if (!st.foodLetters.some((f) => f.letter === m[1])) {
                                st.foodLetters.push({ letter: itemAt(m, 1), text: itemAt(m, 2) });
                            }
                        }
                    }
                    if (st.foodLetters.length) {
                        return send(' ');
                    }
                }
                if (st.pendingEat && st.eatDrain >= 12)
                    st.pendingEat = false;
                return send(' ');
            case 'getpos':
                st.promptCounts.getpos++;
                return send(ESC);
            case 'count':
                st.promptCounts.count++;
                return send(ESC);
            case 'direction':
                st.promptCounts.direction++;
                if (st.pendingOpen) {
                    const d = st.pendingOpen;
                    st.pendingOpen = null;
                    return send(d);
                }
                if (kind === 'fuzz' && rand() < 0.9) {
                    return send(itemAt(DIR_KEYS, Math.floor(rand() * 8)));
                }
                return send(ESC);
            case 'menu':
                st.promptCounts.menu++;
                return menuKey(cls);
            case 'chargen':
                st.promptCounts.chargen++;
                return chargenKey();
            case 'yn':
                st.promptCounts.yn++;
                return ynKey(cls);
            case 'text':
                st.promptCounts.text++;
                return textKey(cls);
            case 'command': break;
            case 'unknown': return send(ESC);
        }
        const hero = findHero(rows, cursor, status);
        const key = kind === 'fuzz'
            ? fuzzAction(rows, hero, status)
            : exploreAction(rows, hero, status);
        if (isDirection(key))
            st.lastMoveKey = key;
        return key;
    }
    return {
        nextKey,
        acceptsGameExit: true,
        get exhausted() { return st.stopReason !== null; },
        get summary() {
            return {
                kind,
                seed,
                maxSteps,
                keysSent: st.keysSent,
                calls: st.calls,
                stopReason: st.stopReason,
                dead: st.dead,
                dlvl: st.dlvl,
                turns: st.turns,
                maxTurns: st.maxTurns,
                hp: st.hp,
                hpMax: st.hpMax,
                hunger: st.hunger,
                exploredCells: st.explored,
                descends: st.descends,
                attacks: st.attacks,
                doorsOpened: st.doorsOpened,
                blockedCells: st.blockedCells.size,
                promptKeys: { ...st.promptCounts },
                lastClass: st.lastClass,
            };
        },
    };
}
// cmd.c:extcmdlist. Host commands (shell, suspend, bug reporting), saving and
// quitting do not belong in a policy which must keep supplying game input.
const WIDE_EXTENDED = ['pray', 'chat', 'offer', 'turn', 'monster', 'ride', 'sit',
    'force', 'loot', 'tip', 'wipe', 'jump', 'invoke', 'rub', 'untrap', 'terrain',
    'overview', 'conduct', 'annotate', 'name', 'adjust', 'dip', 'enhance', 'quiver',
    'vanquished', 'genocided', 'history', 'lookaround', 'herecmdmenu', 'therecmdmenu'];
const WIDE_ITEM_KEYS = 'qrztfZpPRWTAxXdDaiIewCE';
const WIDE_INFO_KEYS = 'OvV:;/?\\`$+="[()*^@&|\x18\x10\x0f\x06\x14\x05\x12\x01';
const EXIT_CHOICE = /\b(quit|save|shell|suspend|exploremode)\b|no return|leave the dungeon|escape the dungeon/i;
// The '?' help menu's "List of game options." entry runs option_help(),
// whose first screen prints the recorder's own configuration file path.
// That path is environment-specific, so the wide policy must never select it.
const ENV_SPECIFIC_CHOICE = /^List of game options\.$/;
/** A separate policy keeps legacy fuzz/explore choices and random draws intact. */
function createWidePolicy(config) {
    const { seed, maxSteps } = config;
    const rand = mulberry32(seed);
    const choose = (values) => itemAt(values, Math.floor(rand() * values.length));
    const drainBudget = 96 + Math.floor(maxSteps / 8);
    const summary = {
        kind: 'wide', seed, maxSteps, keysSent: 0, calls: 0, stopReason: null,
        dead: false, dlvl: null, turns: null, maxTurns: null, hp: null, hpMax: null,
        hunger: null, exploredCells: 0, descends: 0, attacks: 0, doorsOpened: 0,
        promptKeys: {}, lastClass: null,
    };
    let prefix = '';
    let extended = null;
    let lineInput = null;
    let targetingMoves = null;
    let menuHeading = null;
    let menuPicks = new Set();
    let menuLimit = 0;
    function send(key) {
        summary.keysSent++;
        return key;
    }
    function startLine(query, target) {
        lineInput = { query, target, remaining: target + '\r' };
        return continueLine(query);
    }
    function continueLine(visible) {
        if (!lineInput)
            return send(ESC);
        // tty_get_ext_cmd() can complete a whole word before we type it all.
        if (lineInput.query === '#' && visible.slice(1).trim() === lineInput.target) {
            lineInput = null;
            return send('\r');
        }
        const key = lineInput.remaining.charAt(0);
        lineInput.remaining = lineInput.remaining.slice(1);
        if (!lineInput.remaining)
            lineInput = null;
        return send(key);
    }
    function nextKey(lines, info) {
        summary.calls++;
        if (summary.stopReason)
            return null;
        const rows = decodeScreen(lines);
        const cursor = info?.cursor;
        const status = parseStatus(rows);
        const cls = classifyRows(rows, cursor);
        const active = rows[cursor?.[1] ?? 0]?.trim() ?? '';
        summary.lastClass = cls.kind;
        if (status) {
            summary.hp = status.hp;
            summary.hpMax = status.hpMax;
            summary.hunger = status.hunger;
            summary.dlvl = status.dlvl;
            summary.turns = status.turns;
            if (status.turns !== null)
                summary.maxTurns = Math.max(summary.maxTurns ?? 0, status.turns);
        }
        if (cls.kind === 'death' || status?.hp === 0)
            summary.dead = true;
        if (summary.keysSent >= maxSteps + drainBudget) {
            summary.stopReason = summary.dead ? 'death-bound' : 'prompt-overrun';
            if (!summary.dead) {
                throw new Error(`wide policy seed ${seed}: no command boundary after ${summary.keysSent} keys (${cls.kind}: ${active.slice(0, 120)})`);
            }
            return null;
        }
        if (summary.dead) {
            if (cls.kind === 'more' || cls.kind === 'unknown')
                return send(' ');
            if (cls.kind === 'menu')
                return send('\r');
            return send(/\bDie\?/i.test(cls.detail) ? 'y' : 'n');
        }
        if (cls.kind !== 'command' && cls.kind !== 'unknown') {
            summary.promptKeys[cls.kind] = (summary.promptKeys[cls.kind] ?? 0) + 1;
        }
        if (cls.kind === 'more')
            return send(' ');
        const draining = summary.keysSent >= maxSteps;
        if (lineInput) {
            if (active.startsWith(lineInput.query)) {
                if (!draining)
                    return continueLine(active);
                lineInput = null;
                return send(ESC);
            }
            lineInput = null;
        }
        if ((!cursor || cursor[1] <= 2) && /^#\s*\w*$/.test(active)) {
            const command = extended ?? choose(WIDE_EXTENDED);
            extended = null;
            return draining ? send(ESC) : startLine('#', command);
        }
        if (cls.kind === 'getpos' && targetingMoves === null) {
            targetingMoves = 1 + Math.floor(rand() * 3);
            if (rand() < 0.12) {
                targetingMoves = null;
                return send(ESC);
            }
        }
        if (targetingMoves !== null && (cls.kind === 'getpos' || cls.kind === 'command')) {
            if (draining) {
                targetingMoves = null;
                return send(ESC);
            }
            if (targetingMoves-- > 0)
                return send(choose(DIR_KEYS));
            targetingMoves = null;
            return send(rand() < 0.5 ? '.' : ',');
        }
        // Menus have the same footer for PICK_ONE, PICK_ANY and PICK_NONE.
        // Reobserve after every selector: PICK_ONE may already have closed.
        if (cls.kind === 'menu')
            return menuKey(rows, draining);
        menuHeading = null;
        menuPicks.clear();
        if (cls.kind === 'chargen')
            return send('y');
        if (cls.kind === 'direction') {
            if (prefix)
                return sendPrefix();
            return send(draining || rand() < 0.12 ? ESC : choose([...DIR_KEYS, '.', '<', '>']));
        }
        if (cls.kind === 'yn') {
            if (EXIT_CHOICE.test(cls.detail))
                return send(cls.choices?.includes('n') ? 'n' : ESC);
            if (draining || rand() < 0.10)
                return send(ESC);
            return send(choose((cls.choices ?? 'yn').replaceAll('/', '').split('')));
        }
        // Unlike the narrow legacy classifier, wide must accept object-class
        // punctuation and inventory ranges, including questions wrapped to row 1.
        const liveTop = !cursor || cursor[1] <= 2;
        const bracket = liveTop ? active.match(/\[([^\]]+)\]\s*(?:\([^)]*\))?\s*$/) : null;
        if (bracket) {
            const choices = wideObjectChoices(itemAt(bracket, 1));
            if (draining || rand() < 0.12)
                return send(ESC);
            if (choices.length)
                return send(choose(choices));
            return send(active.includes('?') ? '?' : ESC);
        }
        if (cls.kind === 'text') {
            if (draining || rand() < 0.15)
                return send(ESC);
            if (NAME_PROMPT_RE.test(cls.detail)) {
                return startLine(cls.detail.trim(), config.name?.trim().slice(0, 32) || 'Holdout');
            }
            if (/what (?:do you want to (?:write|engrave)|should.*(?:name|call))|name|call|annotat|write|engrave|search for/i.test(cls.detail)) {
                return startLine(cls.detail.trim(), 'wide');
            }
            return send(ESC);
        }
        if (cls.kind === 'count') {
            if (prefix)
                return sendPrefix();
            return send(draining ? ESC : choose([...DIR_KEYS, 's', '.']));
        }
        if (cls.kind !== 'command') {
            prefix = '';
            return send(ESC);
        }
        if (prefix)
            return sendPrefix();
        if (draining && (!cursor || cls.cursorOnMap)) {
            summary.stopReason = 'max-steps';
            return null;
        }
        if (draining)
            return send(ESC);
        return commandKey(rows, cursor, status);
    }
    function menuKey(rows, draining) {
        const entries = rows.flatMap((row, index) => {
            const match = row.match(/(?:^|\s)([a-zA-Z$]) ([-+*#]) (\S.*)/);
            // decodeScreen() pads rows to the screen width; drop that padding
            // so anchored entry patterns see only the entry's own text.
            return match ? [{ key: itemAt(match, 1), selected: match[2] !== '-', text: itemAt(match, 3).trimEnd(), row: index }] : [];
        });
        const heading = rows.slice(0, entries[0]?.row ?? 1).join('\n');
        if (menuHeading !== heading) {
            menuHeading = heading;
            menuPicks = new Set();
            menuLimit = rand() < 0.5 ? 1 : 2;
            if (!draining && rand() < 0.12)
                return send(ESC);
        }
        const available = entries.filter(entry => !entry.selected && !menuPicks.has(entry.key)
            && !EXIT_CHOICE.test(entry.text) && !ENV_SPECIFIC_CHOICE.test(entry.text));
        if (draining || menuPicks.size >= menuLimit)
            return send('\r');
        if (!available.length) {
            const page = rows.join('\n').match(/\((\d+) of (\d+)\)/);
            return send(page && Number(page[1]) < Number(page[2]) ? ' ' : '\r');
        }
        const entry = choose(available);
        menuPicks.add(entry.key);
        return send(entry.key);
    }
    function sendPrefix() {
        const key = prefix.charAt(0);
        prefix = prefix.slice(1);
        return send(key);
    }
    function commandKey(rows, cursor, status) {
        const hero = findHero(rows, cursor, status);
        const bottom = (status?.statusRow ?? rows.length) - 1;
        summary.exploredCells = rows.slice(1, bottom).reduce((count, row) => count + row.replaceAll(' ', '').length, 0);
        const action = pickWeighted(rand, [['move', 36], ['item', 22], ['door', 6],
            ['info', 10], ['extended', 16], ['travel', 4], ['prefix', 8],
            ['pickup', 4], ['search', 4], ['rest', 2], ['eat', status?.hunger ? 8 : 2]]);
        if (action === 'item')
            return send(choose(WIDE_ITEM_KEYS.split('')));
        if (action === 'door') {
            const key = choose(['c', 'o', '\x04']);
            if (key === 'o')
                summary.doorsOpened++;
            return send(key);
        }
        if (action === 'info')
            return send(choose(WIDE_INFO_KEYS.split('')));
        if (action === 'extended') {
            extended = choose(WIDE_EXTENDED);
            return send('#');
        }
        if (action === 'travel') {
            const key = choose(['_', '<', '>']);
            if (key === '>')
                summary.descends++;
            return send(key);
        }
        if (action === 'pickup')
            return send(',');
        if (action === 'search')
            return send('s');
        if (action === 'rest')
            return send('.');
        if (action === 'eat')
            return send('e');
        const walkable = hero ? DIR_KEYS.filter(dir => {
            const x = hero.x + DIRS[dir][1], y = hero.y + DIRS[dir][0];
            const cell = cellAt(rows, x, y, bottom);
            return cell !== undefined && (WALKABLE.has(cell) || MONSTER_RE.test(cell));
        }) : [];
        const dir = choose(walkable.length && rand() < 0.85 ? walkable : DIR_KEYS);
        if (action === 'prefix') {
            const modifier = choose(['m', 'g', 'G', 'F', 'shift', 'count', 'count-n']);
            if (modifier === 'shift')
                return send(dir.toUpperCase());
            // Small counts exercise parse()/get_count() without long occupations.
            // 'n' introduces a count with number_pad; otherwise it moves southeast
            // before the ordinary digit-prefixed move.
            if (modifier === 'count-n') {
                prefix = String(2 + Math.floor(rand() * 4)) + dir;
                return send('n');
            }
            prefix = dir;
            return send(modifier === 'count' ? String(2 + Math.floor(rand() * 4)) : modifier);
        }
        if (hero && adjacentMonster(rows, hero, bottom).some(monster => monster.dir === dir))
            summary.attacks++;
        return send(dir);
    }
    return {
        nextKey, acceptsGameExit: true,
        get exhausted() { return summary.stopReason !== null; },
        get summary() { return { ...summary, promptKeys: { ...summary.promptKeys } }; },
    };
}
function wideObjectChoices(advertised) {
    const options = (advertised.split(/\bor\b/)[0] ?? '').replaceAll(/\s/g, '');
    const expanded = options.replaceAll(/([a-z])-([a-z])|([A-Z])-([A-Z])/g, (_match, lowerStart, lowerEnd, upperStart, upperEnd) => {
        const first = (lowerStart ?? upperStart ?? '').charCodeAt(0);
        const last = (lowerEnd ?? upperEnd ?? '').charCodeAt(0);
        if (last < first)
            return '';
        return Array.from({ length: last - first + 1 }, (_, offset) => String.fromCharCode(first + offset)).join('');
    });
    return Array.from(new Set(expanded.replaceAll(/[?*]/g, '').split('')));
}
//# sourceMappingURL=holdout-policy.mjs.map