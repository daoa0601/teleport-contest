import { errorMessage, itemAt } from '../lib/session-types.mjs';
import { ITEM_RECIPES, validateItemRecipe } from './item-recipes.mjs';
// recipes.mjs — Reusable holdout scenario recipes and character strata.
//
// Exports:
//   LEGAL_CHARACTERS — every legal {role, race, gender, align} combination,
//                      derived from the pinned C role.c allow masks.
//   RECIPE_NAMES     — ordered recipe name list.
//   RECIPES          — metadata map: name -> { roles, description, success, ... }.
//   makeRecipe(name, { seed, datetime, character, options, name })
//                    — build a v5 session skeleton for scripts/record-session.mjs.
//
// Skeleton shape (clean v5, what record-session.mjs consumes):
//   { version: 5,
//     segments: [ { seed, datetime, nethackrc, moves }        // fixed key plan
//               | { seed, datetime, nethackrc, driver } ] }   // adaptive plan
//
// Conventions (agreed with the holdout batch layer):
//   * Segment 0 gets `seed` unchanged.
//   * Restore segments reuse `seed` unchanged (RNG state comes from the save
//     file; NETHACK_SEED only matters for fresh games).
//   * Fresh-game segments after a death use `seed + 1`.
//   * `datetime` applies to every segment of the skeleton.
//   * Baseline nethackrc adds !legacy, !tutorial, !news, time,
//     symset:DECgraphics to the explicit legal character, so there is no
//     tutorial/news/legacy prompt to answer and the status line carries T:.
//   * In playmode:debug NetHack forces the player name to "wizard"
//     (sys/unix/unixmain.c set_playmode); the `name:` option is ignored.
//
// RECIPES[name].success lists the observable game effects a recording must
// show; validateRecipeRecording() turns them into machine checks. A recipe
// never claims success merely because a command was issued.
// ---------------------------------------------------------------------------
// Legal character combinations (pinned C data: src/role.c)
// ---------------------------------------------------------------------------
//
// roles[].allow and races[].allow are short bit masks (include/role.h):
//   ROLE_RACEMASK: MH_HUMAN|MH_ELF|MH_DWARF|MH_GNOME|MH_ORC
//   ROLE_GENDMASK: ROLE_MALE|ROLE_FEMALE
//   ROLE_ALIGNMASK: ROLE_LAWFUL|ROLE_NEUTRAL|ROLE_CHAOTIC
// A combination is legal exactly when the role's mask and the race's mask
// intersect on every chosen axis (role.c ok_role/ok_race/ok_gend/ok_align;
// rigid_role_checks adds nothing further).
//
// Race masks from role.c races[] (name -> races allowed for genders/aligns):
const RACE_CONSTRAINTS = {
    human: { genders: ['male', 'female'], aligns: ['lawful', 'neutral', 'chaotic'] },
    elf: { genders: ['male', 'female'], aligns: ['chaotic'] },
    dwarf: { genders: ['male', 'female'], aligns: ['lawful'] },
    gnome: { genders: ['male', 'female'], aligns: ['neutral'] },
    orc: { genders: ['male', 'female'], aligns: ['chaotic'] },
};
// Role masks from role.c roles[].allow (races the role permits, then the
// genders and alignments the role permits).
const ROLE_CONSTRAINTS = {
    archeologist: { races: ['human', 'dwarf', 'gnome'], genders: ['male', 'female'], aligns: ['lawful', 'neutral'] },
    barbarian: { races: ['human', 'orc'], genders: ['male', 'female'], aligns: ['neutral', 'chaotic'] },
    caveman: { races: ['human', 'dwarf', 'gnome'], genders: ['male', 'female'], aligns: ['lawful', 'neutral'] },
    healer: { races: ['human', 'gnome'], genders: ['male', 'female'], aligns: ['neutral'] },
    knight: { races: ['human'], genders: ['male', 'female'], aligns: ['lawful'] },
    monk: { races: ['human'], genders: ['male', 'female'], aligns: ['lawful', 'neutral', 'chaotic'] },
    priest: { races: ['human', 'elf'], genders: ['male', 'female'], aligns: ['lawful', 'neutral', 'chaotic'] },
    rogue: { races: ['human', 'orc'], genders: ['male', 'female'], aligns: ['chaotic'] },
    ranger: { races: ['human', 'elf', 'gnome', 'orc'], genders: ['male', 'female'], aligns: ['neutral', 'chaotic'] },
    samurai: { races: ['human'], genders: ['male', 'female'], aligns: ['lawful'] },
    tourist: { races: ['human'], genders: ['male', 'female'], aligns: ['neutral'] },
    valkyrie: { races: ['human', 'dwarf'], genders: ['female'], aligns: ['lawful', 'neutral'] },
    wizard: { races: ['human', 'elf', 'gnome', 'orc'], genders: ['male', 'female'], aligns: ['neutral', 'chaotic'] },
};
/** Every legal {role, race, gender, align} combination from the C masks. */
export function legalCharacters() {
    const out = [];
    for (const [role, rc] of Object.entries(ROLE_CONSTRAINTS)) {
        for (const race of rc.races) {
            const rcc = RACE_CONSTRAINTS[race];
            if (!rcc)
                throw new Error(`unknown race ${race}`);
            for (const gender of rc.genders) {
                if (!rcc.genders.includes(gender))
                    continue;
                for (const align of rc.aligns) {
                    if (!rcc.aligns.includes(align))
                        continue;
                    out.push({ role, race, gender, align });
                }
            }
        }
    }
    return out;
}
export const LEGAL_CHARACTERS = legalCharacters();
/** True when the character is a legal combination AND usable by `recipeName`. */
export function acceptsCharacter(recipeName, character) {
    const recipe = RECIPES[recipeName];
    if (!recipe)
        return false;
    if (!isLegalCharacter(character))
        return false;
    if (recipe.roles && !recipe.roles.includes(character.role))
        return false;
    return true;
}
export function isLegalCharacter(character) {
    if (!character || typeof character !== 'object' || !('role' in character) || !('race' in character) || !('gender' in character) || !('align' in character))
        return false;
    return LEGAL_CHARACTERS.some((c) => c.role === character.role && c.race === character.race
        && c.gender === character.gender && c.align === character.align);
}
// ---------------------------------------------------------------------------
// Skeleton construction helpers
// ---------------------------------------------------------------------------
const BASELINE_OPTIONS = ['!legacy', '!tutorial', '!news', 'time', 'symset:DECgraphics'];
function buildNethackrc({ character, playerName, extraOptions }) {
    const head = [
        `name:${playerName}`,
        `role:${character.role}`,
        `race:${character.race}`,
        `gender:${character.gender}`,
        `align:${character.align}`,
    ];
    const lines = [`OPTIONS=${head.join(',')}`];
    lines.push(`OPTIONS=${BASELINE_OPTIONS.join(',')}`);
    for (const opt of extraOptions)
        lines.push(`OPTIONS=${opt}`);
    return `${lines.join('\n')}\n`;
}
function key(...parts) {
    return parts.join('');
}
/**
 * Build a v5 session skeleton for one recipe.
 *
 * @param {string} recipeName  entry of RECIPE_NAMES
 * @param {object} args
 * @param {number} args.seed            integer seed (>= 10000 recommended);
 *                                      restore segments reuse it, fresh-game
 *                                      segments use seed + 1.
 * @param {string} args.datetime        'YYYYMMDDHHMMSS'; applies to all segments.
 * @param {{role:string,race:string,gender:string,align:string}} args.character
 * @param {string[]|string} [args.options] extra OPTIONS lines appended to the rc.
 * @param {string} [args.name]          player name (default 'Nomad'; ignored in
 *                                      debug mode, NetHack forces "wizard").
 */
export function makeRecipe(recipeName, { seed, datetime, character, options = [], name = 'Nomad', targets, }) {
    const recipe = RECIPES[recipeName];
    if (!recipe) {
        throw new Error(`unknown recipe: ${recipeName} (see RECIPE_NAMES)`);
    }
    if (!Number.isInteger(seed))
        throw new Error('seed must be an integer');
    if (!/^\d{14}$/.test(String(datetime || ''))) {
        throw new Error(`datetime must be YYYYMMDDHHMMSS, got ${datetime}`);
    }
    if (!isLegalCharacter(character)) {
        throw new Error(`illegal character for C role rules: ${JSON.stringify(character)}`);
    }
    if (recipe.roles && !recipe.roles.includes(character.role)) {
        throw new Error(`recipe ${recipeName} supports roles [${recipe.roles.join(', ')}], `
            + `got ${character.role} (preflight via acceptsCharacter)`);
    }
    const userOptions = typeof options === 'string' ? [options] : options.slice();
    const rc = (overrides = []) => buildNethackrc({
        character,
        playerName: name,
        extraOptions: [...userOptions, ...(recipe.options ?? []), ...overrides],
    });
    const segments = recipe.build({ seed, datetime, rc, character }, recipeName === 'depth-tour' ? normalizeTargets(targets) : undefined);
    return { version: 5, segments };
}
// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------
// Each recipe documents its ACTUAL success requirements. Recorded steps must
// show the named effect; issuing the command alone is not success.
function saveQuitTail() {
    // S -> "Really save? [yn] (n)" -> y -> save file written, clean exit
    // ("Be seeing you..."). Any pending --More-- before the S is dismissed
    // automatically by dismissMore.
    return 'Sy';
}
// Every segment is an adaptive driver segment: dismissMore dismisses
// variable-depth --More-- queues (long welcome wraps, pet combat, look
// output) before each planned key and after the last one, so recipes carry
// only semantic keys. ESC appears only to close menus (inventory).
function keysAction(value, expectExit = false) {
    // expectExit marks a segment whose key plan ends in the game process
    // exiting by itself (save+quit, death); the recorder then waits for the
    // native exit instead of finishing at the last marker.
    return { type: 'keys', value, dismissMore: true, ...(expectExit ? { expectExit: true } : {}) };
}
function menuAction(target, openKeys) {
    return { type: 'select-menu-entry', target, ...(openKeys ? { openKeys } : {}), dismissMore: true };
}
function segment(seed, datetime, nethackrc, actions) {
    return { seed, datetime, nethackrc, driver: actions };
}
function normalizeTargets(targets) {
    if (targets === undefined || targets === null)
        return undefined;
    const list = Array.isArray(targets) ? targets : [targets];
    return list.map(String);
}
const RECIPES = {};
RECIPES['save-restore'] = {
    roles: null, // any legal character
    options: [],
    description: 'Two segments: play, save, quit; restart and restore, play more.',
    success: [
        'Segment 0 ends "Be seeing you..." after the save confirmation; the recorder process exits cleanly.',
        'Segment 1 first screen contains "welcome back to NetHack" (restore of the same character).',
        'Segment 1 status T: continues segment 0 final T: (same game resumed, not a new game).',
    ],
    build: ({ seed, datetime, rc }) => [
        segment(seed, datetime, rc(), [keysAction('jjjkkklllhhh' + saveQuitTail(), true)]),
        segment(seed, datetime, rc(), [keysAction('kkkjjjhhhi\x1b')]),
    ],
};
RECIPES['save-chain'] = {
    roles: null,
    options: [],
    description: 'Four segments: three save/restore cycles chained on one game.',
    success: [
        'Every restore segment opens with "welcome back to NetHack".',
        'The status T: strictly increases across restore segments (one continuous game).',
        'Each save segment ends "Be seeing you..." with a clean process exit.',
    ],
    build: ({ seed, datetime, rc }) => [
        segment(seed, datetime, rc(), [keysAction('hhhhhjjjjj' + saveQuitTail(), true)]),
        segment(seed, datetime, rc(), [keysAction('kkkkklllll s' + saveQuitTail(), true)]),
        segment(seed, datetime, rc(), [keysAction('lllllkkkkk s' + saveQuitTail(), true)]),
        segment(seed, datetime, rc(), [keysAction('jjjjjhhhhhi\x1b')]),
    ],
};
RECIPES['debug-wish-items'] = {
    roles: ['knight'],
    options: ['playmode:debug', '!autopickup'],
    description: 'Wizard mode on a Knight. The knight kit has no random items and no '
        + 'random stack counts, so inventory letters are stable: a long '
        + 'sword, b lance, c ring mail, d helm, e shield, f gloves, g apples, '
        + 'h carrots; three wishes then land on i, j, k in order. Wishes: a '
        + 'silver saber (wielded, swapped away, original weapon wielded '
        + 'back), a healing potion (drunk), a striking wand (zapped west). '
        + 'All actions are single-turn, so pet-combat message queues cannot '
        + 'desync the key plan (dismissMore drains them).',
    success: [
        'Each wish grants an object into the predicted slot ("<letter> - a silver saber." / "murky potion" / "steel wand").',
        'The saber is wielded ("(weapon in right hand)"), swapped out via x, and the long sword is wielded back.',
        'The potion is drunk ("You feel completely healed.").',
        'The wand is aimed and zapped west ("In what direction?" answered; a turn passes).',
    ],
    build: ({ seed, datetime, rc }) => [
        segment(seed, datetime, rc(), [keysAction('\x17blessed +2 silver saber\r'
                + 'wixwa'
                + '\x17blessed potion of full healing\r'
                + 'qj'
                + '\x17wand of striking\r'
                + 'zkh'
                + 'i\x1b')]),
    ],
};
RECIPES['equipment'] = {
    roles: ['knight'],
    options: ['!autopickup'],
    description: 'Knight only (deterministic starting kit: a long sword, b lance, '
        + 'c ring mail, d helm, e small shield, f gloves). Swaps wielded and '
        + 'alternate weapons, cycles helm and shield off and back on, wields '
        + 'each weapon, reviews inventory.',
    success: [
        'Both weapon swaps change "(weapon in ... hand)" assignments and consume a turn each.',
        'Taking the helm off raises AC, wearing it lowers AC again (status line AC changes).',
        'The small shield cycles off and on the same way.',
        'Both wield commands flip which weapon is wielded (left-hand/right-hand assignment changes).',
    ],
    build: ({ seed, datetime, rc }) => [
        segment(seed, datetime, rc(), [keysAction('xxTdWdTeWewbwai\x1b')]),
    ],
};
RECIPES['spellcasting'] = {
    roles: ['wizard'],
    options: [],
    description: 'Wizard starts knowing force bolt. Cast it in a direction, open the '
        + 'spell menu, cast again at too-low energy for the failure path, and '
        + 'put on / remove a starting ring. Known limitation: on draws where '
        + 'the starting pet sits west, the bolt kills it and a naming prompt '
        + 'desyncs the plan; such recordings fail validation (about one in '
        + 'eight seeds in sampling).',
    success: [
        'First cast reaches the direction prompt and consumes power (Pw drops on the status line).',
        "The low-energy cast produces \"You don't have enough energy to cast that spell.\"",
        'A starting ring goes on ("on right hand" or "on left hand") and comes back off.',
    ],
    build: ({ seed, datetime, rc }) => [
        segment(seed, datetime, rc(), [keysAction('ZahZaPdrRi\x1b')]),
    ],
};
RECIPES['engraving'] = {
    roles: null,
    options: [],
    description: 'Engrave "Elbereth" in the dust with a fingertip, then look at the square.',
    success: [
        'Engraving reaches the dust prompt and writes the text (a full turn passes).',
        'The quick look reports "Something is written here in the dust."',
    ],
    build: ({ seed, datetime, rc }) => [
        segment(seed, datetime, rc(), [keysAction('E-Elbereth\r:')]),
    ],
};
RECIPES['prayer'] = {
    roles: null,
    options: [],
    description: 'Pray: covers the confirm prompt, the three-turn prayer and a god verdict.',
    success: [
        'The prayer confirmation ("Are you sure you want to pray? [yn]") is answered.',
        '"You begin praying to <god>. You finish your prayer." appears; at least three turns pass.',
        'A god verdict message follows (booming voice, displeasure, malignant aura or benediction).',
    ],
    build: ({ seed, datetime, rc }) => [
        segment(seed, datetime, rc(), [keysAction('#pray\ry')]),
    ],
};
// Named destinations verified to appear as selectable letters in the
// native m-^V "Level teleport to where:" menu (probe on the pinned
// recorder, seeds 41001+). Match is a case-insensitive substring of the
// whole menu line, so precise fragments ('tower1' not 'tower', which would
// match the "Stair to Vlad's Tower" branch entry first) select reliably.
export const DEPTH_TOUR_TARGETS = [
    'Gnomish Mines', 'Sokoban', 'castle', 'valley', 'medusa', 'oracle',
    'asmodeus', 'juiblex', 'baalz', 'orcus', 'sanctum', 'wizard1',
    'tower1', 'tower2', 'tower3', 'minetn', 'minend', 'soko1', 'strt',
];
RECIPES['depth-tour'] = {
    roles: null,
    options: ['playmode:debug', '!autopickup'],
    description: 'Wizard mode. Level-teleports to a numbered depth, looks around, '
        + 'then jumps to named destinations chosen through the m-^V level '
        + 'menu (adaptive select-menu-entry). Default destinations are '
        + "['Gnomish Mines', 'Sokoban']; pass makeRecipe(..., { targets }) "
        + 'with entries from DEPTH_TOUR_TARGETS to build deep tours '
        + '(castle DL26+, valley/Gehennom DL27+, medusa, sanctum DL47, '
        + "Vlad's Tower, quest home via 'strt').",
    success: [
        'Numbered teleport reports "You materialize on a different level!" and the status Dlvl changes.',
        'Each named-destination teleport changes Dlvl (menu selection worked).',
    ],
    build: ({ seed, datetime, rc }, targets) => {
        const list = (targets && targets.length ? targets : ['Gnomish Mines', 'Sokoban']);
        for (const t of list) {
            if (!DEPTH_TOUR_TARGETS.includes(t)) {
                throw new Error(`unknown depth-tour target: ${t} (see DEPTH_TOUR_TARGETS)`);
            }
        }
        const actions = [keysAction('\x165\r:')];
        for (const t of list)
            actions.push(menuAction(t));
        return [segment(seed, datetime, rc(), actions)];
    },
};
RECIPES['death-newgame'] = {
    roles: null,
    options: [],
    description: 'Segment 0 (debug): deterministic suicide through level teleport to '
        + '"Nowhere", saving bones. Segment 1 (normal, seed+1): a fresh game '
        + 'searches twice and reviews inventory. The bones ghost can kill '
        + 'the fresh character on unlucky draws; such recordings fail '
        + 'validation.',
    success: [
        'Segment 0 passes "Go to Nowhere. Are you sure?" and "Die? [yn]" with yes answers.',
        'Bones are kept ("Save bones?" answered y) and a bonD*.Z file appears in the install dir.',
        'Segment 0 shows the wizard-mode end note and exits with all keys consumed.',
        'Segment 1 starts a NEW game of the given character (no "welcome back"), records its keys, ends clean.',
    ],
    build: ({ seed, datetime, rc }) => {
        const dieRc = rc(['playmode:debug', 'disclose:-i -a -v -g -c -o']);
        const freshRc = rc(['!autopickup']);
        return [
            // ^V 0 <ret> -> "Go to Nowhere. Are you sure? [ynq]" y ->
            // agony -> cease to exist -> "Die? [yn] (n)" y -> RIP ->
            // "Save bones? [yn] (n)" y -> tombstone -> wizard-mode end note
            // -> process exit. --More-- queues are drained automatically.
            segment(seed, datetime, dieRc, [keysAction('\x160\ryyy', true)]),
            segment(seed + 1, datetime, freshRc, [keysAction('ssi\x1b')]),
        ];
    },
};
RECIPES['throw-fight'] = {
    roles: ['knight', 'samurai'],
    options: ['!autopickup'],
    description: 'Throw the spare weapon (knight lance b / samurai wakizashi b) west, '
        + 'then force-attack west twice. Every attack costs a real turn even '
        + 'against empty air.',
    success: [
        'The throw reaches the direction prompt and the weapon leaves the pack (inventory count drops).',
        'Both F attacks advance the turn counter (a target is struck or "You harmlessly attack the wall").',
    ],
    build: ({ seed, datetime, rc }) => [
        segment(seed, datetime, rc(), [keysAction('tbhFhFhi\x1b')]),
    ],
};
for (const [name, recipe] of Object.entries(ITEM_RECIPES))
    RECIPES[name] = recipe;
export { RECIPES };
export const RECIPE_NAMES = Object.keys(RECIPES);
export const ROLES = Object.keys(ROLE_CONSTRAINTS);
export const RACES = Object.keys(RACE_CONSTRAINTS);
export const GENDERS = ['male', 'female'];
export const ALIGNMENTS = ['lawful', 'neutral', 'chaotic'];
// ---------------------------------------------------------------------------
// Recording validation — machine checks for the documented requirements
// ---------------------------------------------------------------------------
const ANSI_RE = /\x1b\[[0-?]*[ -/]*[@-~]/g;
function stripAnsi(text) {
    return String(text).replace(ANSI_RE, '').replace(/[\x0e\x0f]/g, '');
}
function screenLines(step) {
    return String(step?.screen ?? '').split('\n').map(stripAnsi);
}
function segText(seg) {
    return (seg?.steps ?? []).map((st) => screenLines(st).join('\n')).join('\n');
}
function parseStatus(line) {
    if (typeof line !== 'string')
        return null;
    const out = {};
    for (const m of line.matchAll(/\b(Dlvl|HP|Pw|AC|Xp|T):(-?\d+)/g)) {
        const field = m[1];
        if (field === 'Dlvl' || field === 'HP' || field === 'Pw' || field === 'AC' || field === 'Xp' || field === 'T')
            out[field] = Number(m[2]);
    }
    return Object.keys(out).length ? out : null;
}
function statusSeries(seg) {
    const series = [];
    for (const st of seg?.steps ?? []) {
        const lines = screenLines(st);
        for (let i = lines.length - 1; i >= 0; i--) {
            const s = parseStatus(lines[i]);
            if (s) {
                series.push(s);
                break;
            }
        }
    }
    return series;
}
function firstStatus(seg) { return statusSeries(seg)[0] ?? null; }
function lastStatus(seg) {
    const s = statusSeries(seg);
    return s.length ? s[s.length - 1] : null;
}
function countIn(text, needle) {
    let n = 0, i = 0;
    for (;;) {
        i = text.indexOf(needle, i);
        if (i < 0)
            return n;
        n++;
        i += needle.length;
    }
}
function check(name, ok, evidence) {
    return { check: name, ok: !!ok, evidence: evidence ?? '' };
}
// The recorder emits per-segment recording.state = { saves, bones } when
// RECORD_SESSION_METADATA=1 (file counts in the private install dir after
// the segment finished). The check fails closed when the metadata is
// absent: run the recorder with the env set for state verification.
function stateOf(seg) {
    return seg?.recording?.state ?? {};
}
function stateText(seg) {
    const st = stateOf(seg);
    return Object.keys(st).length ? JSON.stringify(st) : 'no recorder state (set RECORD_SESSION_METADATA=1)';
}
function checkStateAtLeast(name, seg, field, min) {
    const st = stateOf(seg);
    return check(name, (st[field] ?? 0) >= min, stateText(seg));
}
function structuralChecks(session, expectedSegments) {
    const out = [];
    out.push(check('version 5', session?.version === 5));
    out.push(check(`segment count ${expectedSegments}`, Array.isArray(session?.segments) && session.segments.length === expectedSegments, `got ${session?.segments?.length ?? 'none'}`));
    out.push(check('every segment recorded steps', (session?.segments ?? []).every((s) => Array.isArray(s.steps) && s.steps.length >= 2)));
    return out;
}
const VALIDATORS = {};
VALIDATORS['save-restore'] = (s) => [
    ...structuralChecks(s, 2),
    checkStateAtLeast('save file written (recorder state)', s.segments[0], 'saves', 1),
    check('save exits the process', segText(s.segments[0]).includes('Be seeing you')),
    check('restore says welcome back', screenLines(s.segments[1]?.steps?.[0]).join('\n').toLowerCase().includes('welcome back')),
    check('turn counter continues across restore', (lastStatus(s.segments[1])?.T ?? -1) > (lastStatus(s.segments[0])?.T ?? 1e9)),
];
VALIDATORS['save-chain'] = (s) => {
    const out = [...structuralChecks(s, 4)];
    for (let i = 0; i < 3; i++) {
        out.push(checkStateAtLeast(`segment ${i} leaves a save file (recorder state)`, s.segments[i], 'saves', 1));
        out.push(check(`segment ${i} saves cleanly`, segText(s.segments[i]).includes('Be seeing you')));
    }
    for (let i = 1; i < 4; i++) {
        out.push(check(`segment ${i} restores the game`, screenLines(s.segments[i]?.steps?.[0]).join('\n').toLowerCase().includes('welcome back')));
    }
    for (let i = 1; i < 4; i++) {
        out.push(check(`turns advance at junction ${i - 1}->${i}`, (lastStatus(s.segments[i])?.T ?? -1) > (lastStatus(s.segments[i - 1])?.T ?? 1e9)));
    }
    return out;
};
VALIDATORS['debug-wish-items'] = (s) => {
    const text = segText(s.segments[0]);
    const series = statusSeries(s.segments[0]);
    return [
        ...structuralChecks(s, 1),
        check('saber wish granted and wielded', text.includes('- a silver saber.') && countIn(text, '(weapon in') >= 3),
        check('potion wish granted', /- an? (\w+ )+potion\./.test(text)),
        check('wand wish granted', /- an? (\w+ )+wand\./.test(text)),
        check('original weapon wielded back', /long sword \(weapon in (right|left) hand\)/.test(text)),
        check('potion drunk with effect', text.includes('You feel completely healed.')),
        check('wand aimed at a direction', text.includes('What do you want to zap?') && text.includes('In what direction?')),
        check('turns consumed', (series.at(-1)?.T ?? 0) - (series[0]?.T ?? 99) >= 4, `T ${series[0]?.T} -> ${series.at(-1)?.T}`),
    ];
};
VALIDATORS['equipment'] = (s) => {
    const text = segText(s.segments[0]);
    const series = statusSeries(s.segments[0]);
    const acValues = [...new Set(series.map((x) => x.AC).filter((v) => v != null))];
    return [
        ...structuralChecks(s, 1),
        check('weapon swaps recorded', countIn(text, '(weapon in') >= 4),
        check('helm taken off', text.includes('You finish taking off your helm.')),
        check('armor worn back', text.includes('You finish your dressing maneuver.')),
        check('shield cycled', /You (were wearing|are now wearing) .*(small shield|shield)/.test(text)),
        check('AC changed during the segment', acValues.length >= 2, `AC values ${acValues.join(',')}`),
        check('turns consumed', (series.at(-1)?.T ?? 0) - (series[0]?.T ?? 99) >= 6, `T ${series[0]?.T} -> ${series.at(-1)?.T}`),
    ];
};
VALIDATORS['spellcasting'] = (s) => {
    const text = segText(s.segments[0]);
    const series = statusSeries(s.segments[0]);
    const pw = series.map((x) => x.Pw).filter((v) => v != null);
    return [
        ...structuralChecks(s, 1),
        check('spell menu opened twice', countIn(text, 'Choose which spell to cast') >= 2),
        check('cast reached the direction prompt', text.includes('In what direction?')),
        check('power consumed by the cast', pw.length >= 2 && itemAt(pw, 0) > Math.min(...pw), `Pw ${pw.join(',')}`),
        check('low-energy failure shown', text.includes("You don't have enough energy to cast that spell.")),
        check('ring worn and removed', /(on (right|left) hand)/.test(text) && text.includes('You were wearing')),
    ];
};
VALIDATORS['engraving'] = (s) => {
    const text = segText(s.segments[0]);
    const series = statusSeries(s.segments[0]);
    return [
        ...structuralChecks(s, 1),
        check('dust prompt reached', text.includes('What do you want to write in the dust here?')),
        check('text entered at the prompt', text.includes('dust here? Elbereth')),
        check('engraving observable afterwards', text.includes('Something is written here in the dust.')),
        check('engraving cost a turn', (series.at(-1)?.T ?? 0) > (series[0]?.T ?? 1e9), `T ${series[0]?.T} -> ${series.at(-1)?.T}`),
    ];
};
VALIDATORS['prayer'] = (s) => {
    const text = segText(s.segments[0]);
    const series = statusSeries(s.segments[0]);
    return [
        ...structuralChecks(s, 1),
        check('pray confirmation answered', text.includes('Are you sure you want to pray?')),
        check('prayer performed', text.includes('You begin praying to')
            && text.includes('You finish your prayer')),
        check('god verdict received', /booms|thunders|rings out|displeased|angered|malignant aura|benediction/i.test(text)),
        check('prayer took at least three turns', (series.at(-1)?.T ?? 0) - (series[0]?.T ?? 1e9) >= 3, `T ${series[0]?.T} -> ${series.at(-1)?.T}`),
    ];
};
VALIDATORS['depth-tour'] = (s) => {
    const text = segText(s.segments[0]);
    const depths = statusSeries(s.segments[0]).map((x) => x.Dlvl).filter((v) => v != null);
    const transitions = depths.filter((v, i) => i > 0 && v !== depths[i - 1]).length;
    const levelports = countIn(String(s.segments[0]?.moves ?? ''), '\x16');
    return [
        ...structuralChecks(s, 1),
        check('numbered teleport prompted', text.includes('To what level do you want to teleport?')),
        check('named menus used (m-^V pressed three times)', levelports >= 3, `${levelports} level-teleport invocations in moves`),
        check('teleports landed', text.includes('You materialize on a different level')),
        check('depth actually changed', transitions >= 2, `Dlvl sequence ${depths.join(',')} (${transitions} transitions)`),
    ];
};
VALIDATORS['death-newgame'] = (s) => {
    const seg0 = segText(s.segments[0]);
    const seg1First = screenLines(s.segments[1]?.steps?.[0]).join('\n');
    return [
        ...structuralChecks(s, 2),
        check('Nowhere suicide offered', seg0.includes('Go to Nowhere')),
        check('death confirmed past the wizard keep-playing prompt', seg0.includes('Die?')),
        check('bones offer answered', seg0.includes('Save bones?')),
        checkStateAtLeast('bones file written (recorder state)', s.segments[0], 'bones', 1),
        check('death flow completed', seg0.includes('Since you were in wizard mode')
            || seg0.includes('You made the top ten list')
            || seg0.includes('Do not pass Go')),
        check('fresh game started (not a restore)', seg1First.includes('welcome to NetHack') && !seg1First.toLowerCase().includes('welcome back')),
        check('fresh game recorded status', firstStatus(s.segments[1]) != null),
    ];
};
VALIDATORS['throw-fight'] = (s) => {
    const text = segText(s.segments[0]);
    const series = statusSeries(s.segments[0]);
    return [
        ...structuralChecks(s, 1),
        check('throw prompted for an item', text.includes('What do you want to throw?')),
        check('throw reached the direction prompt', text.includes('In what direction?')),
        check('attacks had in-game effects', /harmlessly attack|hits|misses|attack thin air|attack the innocent/i.test(text)),
        check('turns consumed', (series.at(-1)?.T ?? 0) - (series[0]?.T ?? 1e9) >= 2, `T ${series[0]?.T} -> ${series.at(-1)?.T}`),
    ];
};
/**
 * Check a recorded session against its recipe's documented requirements.
 *
 * @param {string} name recipe name
 * @param {object} session recorded v5 session (segments[].steps[].screen)
 * @returns {{ recipe: string, ok: boolean, checks: Array<{check:string, ok:boolean, evidence:string}>, error?: string }}
 */
export function validateRecipeRecording(name, session) {
    const validator = VALIDATORS[name] ?? (ITEM_RECIPES[name]
        ? (recording) => validateItemRecipe(name, recording) : undefined);
    if (!validator)
        return { recipe: name, ok: false, checks: [], error: 'unknown recipe' };
    let checks;
    try {
        checks = validator(session);
    }
    catch (err) {
        return { recipe: name, ok: false, checks: [], error: errorMessage(err) };
    }
    return { recipe: name, ok: checks.every((c) => c.ok), checks };
}
//# sourceMappingURL=recipes.mjs.map