// jsmain.js — Per-game engine and contest adapter.
// C ref: unixmain.c — nethack_main() initialization and game setup.
import { game, resetGame } from './gstate.js';
import { createGameState } from './game_state.js';
import { createHeroState } from './hero_types.js';
import { initRng, enableRngLog, getRngLog, rn2 } from './rng.js';
import { bindInputGate, InputGate, nhgetch } from './input.js';
import { bindLuaLifecycle, LuaLifecycle } from './lua/lifecycle.js';
import { newgame, moveloop_core, restoregamePreamble } from './allmain.js';
import { parseNethackOptions, parseNethackrc } from './options.js';
import { displayConfigurationErrors } from './config_errors.js';
import { findRole, findRace, findAlignment, findGender, roles, races, aligns, genders, } from './roles.js';
import { GameDisplay } from './game_display.js';
import { DEC_TO_UNICODE, NO_COLOR } from './terminal.js';
import { askAboutPanicSave, hasErrorSave, restoreGame } from './save.js';
import { panic } from './diagnostics.js';
import { FormatterPanic, PanicTermination } from './panic_termination.js';
import { discardTutorialState } from './tutorial_state.js';
import { initializeFruitRegistry } from './fruit.js';
const UNICODE_TO_DEC = new Map(Object.entries(DEC_TO_UNICODE).map(([dec, unicode]) => [unicode, dec]));
// C ref: role.c roles[].allow and races[].allow.  The JS role table keeps
// Ranger before Rogue for historical callers, while the C selection table
// deliberately keeps Rogue before Ranger; random character selection must
// use the latter order to preserve the PRNG-to-role mapping.
const CHARACTER_ROLE_ORDER = [
    'archeologist', 'barbarian', 'caveman', 'healer', 'knight', 'monk',
    'priest', 'rogue', 'ranger', 'samurai', 'tourist', 'valkyrie', 'wizard',
];
const ROLE_SELECTION_RULES = {
    archeologist: { races: ['human', 'dwarf', 'gnome'], aligns: ['lawful', 'neutral'] },
    barbarian: { races: ['human', 'orc'], aligns: ['neutral', 'chaotic'] },
    caveman: { races: ['human', 'dwarf', 'gnome'], aligns: ['lawful', 'neutral'] },
    healer: { races: ['human', 'gnome'], aligns: ['neutral'] },
    knight: { races: ['human'], aligns: ['lawful'] },
    monk: { races: ['human'], aligns: ['lawful', 'neutral', 'chaotic'] },
    priest: { races: ['human', 'elf'], aligns: ['lawful', 'neutral', 'chaotic'] },
    rogue: { races: ['human', 'orc'], aligns: ['chaotic'] },
    ranger: { races: ['human', 'elf', 'gnome', 'orc'], aligns: ['neutral', 'chaotic'] },
    samurai: { races: ['human'], aligns: ['lawful'] },
    tourist: { races: ['human'], aligns: ['neutral'] },
    valkyrie: { races: ['human', 'dwarf'], aligns: ['lawful', 'neutral'], genders: ['female'] },
    wizard: { races: ['human', 'elf', 'gnome', 'orc'], aligns: ['neutral', 'chaotic'] },
};
const RACE_SELECTION_RULES = {
    human: { aligns: ['lawful', 'neutral', 'chaotic'] },
    elf: { aligns: ['chaotic'] },
    dwarf: { aligns: ['lawful'] },
    gnome: { aligns: ['neutral'] },
    orc: { aligns: ['chaotic'] },
};
const CHARACTER_ROLE_MENU = [
    ['a', 'archeologist', 'an Archeologist'],
    ['b', 'barbarian', 'a Barbarian'],
    ['c', 'caveman', 'a Caveman/Cavewoman'],
    ['h', 'healer', 'a Healer'],
    ['k', 'knight', 'a Knight'],
    ['m', 'monk', 'a Monk'],
    ['p', 'priest', 'a Priest/Priestess'],
    ['r', 'rogue', 'a Rogue'],
    ['R', 'ranger', 'a Ranger'],
    ['s', 'samurai', 'a Samurai'],
    ['t', 'tourist', 'a Tourist'],
    ['v', 'valkyrie', 'a Valkyrie'],
    ['w', 'wizard', 'a Wizard'],
];
const CHARACTER_RACE_MENU = [
    ['h', 'H', 'human'], ['e', 'E', 'elf'], ['d', 'D', 'dwarf'],
    ['g', 'G', 'gnome'], ['o', 'O', 'orc'],
];
function validCharacterChoice(role, race, gender, alignment) {
    const rules = role && ROLE_SELECTION_RULES[role.key];
    if (!rules)
        return false;
    if (race && !rules.races.includes(race.name))
        return false;
    if (gender && rules.genders && !rules.genders.includes(gender.name))
        return false;
    if (alignment && !rules.aligns.includes(alignment.name))
        return false;
    if (race && alignment
        && !RACE_SELECTION_RULES[race.name]?.aligns.includes(alignment.name))
        return false;
    return true;
}
function hasCharacterCompletion(role, race, gender, alignment) {
    return races.some(candidateRace => (race ? candidateRace === race : true)
        && genders.some(candidateGender => (gender ? candidateGender === gender : true)
            && aligns.some(candidateAlignment => (alignment ? candidateAlignment === alignment : true)
                && validCharacterChoice(role, candidateRace, candidateGender, candidateAlignment))));
}
// Serialize semantic terminal cells back into the tty wire form recorded by
// the C harness. The frozen grid intentionally stores rendered Unicode and
// literal blank cells; C emits DEC shift sequences and cursor-forward skips.
export function serializeCapture(term) {
    if (!term)
        return '';
    const colorToFg = (color) => {
        if (typeof color !== 'number')
            return 39;
        return color === 16 || color === 0 ? 90
            : color === 7 || color === 8 || color < 0 || color > 15
                ? 39 : color < 8 ? 30 + color : 90 + color - 8;
    };
    const transition = (fg, attr, nextFg, nextAttr) => {
        if (fg === nextFg && attr === nextAttr)
            return '';
        const codes = [];
        if (attr) {
            codes.push(0);
            if (nextAttr & 2)
                codes.push(1);
            if (nextAttr & 4)
                codes.push(4);
            if (nextAttr & 1)
                codes.push(7);
            if (nextFg !== 39)
                codes.push(nextFg);
        }
        else {
            if (nextAttr & 2)
                codes.push(1);
            if (nextAttr & 4)
                codes.push(4);
            if (nextAttr & 1)
                codes.push(7);
            if (nextFg !== fg)
                codes.push(nextFg);
        }
        return codes.length ? `\x1b[${codes.join(';')}m` : '';
    };
    // Inverse-video and underlined blanks occupy terminal cells just like
    // visible glyphs; the recorder trims only unstyled trailing blanks.
    const styleMask = game._preserveLeadingStyledBlanks ? 7 : 5;
    const painted = (cell) => cell.ch !== ' ' || !!(cell.attr & styleMask);
    let lastRow = 0;
    for (const [row, cells] of term.grid.entries()) {
        if (cells.some(painted))
            lastRow = row;
    }
    const lines = [];
    const decGraphics = /^DECgraphics$/i.test(game.symset || '');
    for (const cells of term.grid.slice(0, lastRow + 1)) {
        const firstCol = cells.findIndex(painted);
        if (firstCol < 0) {
            lines.push('');
            continue;
        }
        let lastCol = firstCol;
        for (const [col, cell] of cells.entries()) {
            if (painted(cell))
                lastCol = col;
        }
        let line = firstCol > 4
            ? `\x1b[${firstCol}C` : ' '.repeat(firstCol);
        let fg = 39, attr = 0;
        let dec = false;
        for (let col = firstCol; col <= lastCol;) {
            const cell = cells[col];
            if (!cell)
                throw new Error(`Missing terminal cell at column ${col}`);
            if (cell.ch === ' ') {
                const blankFg = colorToFg(cell.color);
                const blankAttr = cell.attr | 0;
                let end = col + 1;
                while (end <= lastCol) {
                    const nextCell = cells[end];
                    if (!nextCell || nextCell.ch !== ' '
                        || colorToFg(nextCell.color) !== blankFg
                        || (nextCell.attr | 0) !== blankAttr)
                        break;
                    end++;
                }
                if (dec) {
                    line += '\x0f';
                    dec = false;
                }
                // The recorder replaces runs of at least five spaces with
                // CSI C even when they were highlighted. This is a lossy
                // recording convention: skipped cells decode as unpainted,
                // while the live display retains their native attributes.
                line += transition(fg, attr, blankFg, blankAttr);
                fg = blankFg;
                attr = blankAttr;
                const count = end - col;
                line += count > 4 ? `\x1b[${count}C` : ' '.repeat(count);
                col = end;
                continue;
            }
            const nextFg = colorToFg(cell.color);
            const nextAttr = cell.attr | 0;
            line += transition(fg, attr, nextFg, nextAttr);
            fg = nextFg;
            attr = nextAttr;
            const decChar = decGraphics ? UNICODE_TO_DEC.get(cell.ch) : null;
            const nextDec = decChar != null;
            if (nextDec !== dec) {
                line += nextDec ? '\x0e' : '\x0f';
                dec = nextDec;
            }
            line += decChar ?? cell.ch;
            col++;
        }
        if (dec)
            line += '\x0f';
        line += transition(fg, attr, 39, 0);
        lines.push(line);
    }
    return lines.join('\n');
}
class SegmentCapture {
    engine;
    screens;
    cursors;
    rngSlices;
    animationFramesByStep;
    pendingAnimationFrames;
    lastRngIndex;
    constructor(engine) {
        this.engine = engine;
        this.screens = [];
        this.cursors = [];
        this.rngSlices = [];
        this.animationFramesByStep = [];
        this.pendingAnimationFrames = [];
        this.lastRngIndex = 0;
    }
    async captureOutput() {
        this.engine.observeInput?.(game);
        const fullLog = getRngLog() || [];
        this.engine.rngLog = fullLog.slice();
        this.rngSlices.push(fullLog.slice(this.lastRngIndex));
        this.lastRngIndex = fullLog.length;
        const display = this.engine.display;
        const terminal = display?.terminal;
        this.screens.push(serializeCapture(terminal));
        this.cursors.push(display
            ? [display.cursorCol ?? 0, display.cursorRow ?? 0, 1]
            : null);
        this.animationFramesByStep.push(this.pendingAnimationFrames);
        this.pendingAnimationFrames = [];
    }
    async animationFrame() {
        const display = this.engine.display;
        const terminal = display?.terminal;
        this.pendingAnimationFrames.push({
            screen: serializeCapture(terminal),
            cursor: display
                ? [display.cursorCol ?? 0, display.cursorRow ?? 0, 1]
                : null,
        });
        if (typeof requestAnimationFrame === 'function') {
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
        else {
            await null;
        }
    }
}
export class Engine {
    _seed;
    _datetime;
    _nethackrc;
    _nethackrcFileName;
    _nethackOptions;
    storage;
    display;
    state;
    capture;
    inputGate;
    lua;
    observeInput;
    coreRng;
    displayRng;
    rngLog;
    runningTask;
    lastRunResult;
    constructor(opts = {}) {
        this._seed = opts.seed || 0;
        this._datetime = opts.datetime || null;
        this._nethackrc = opts.nethackrc || '';
        this._nethackrcFileName = opts.nethackrcFileName || '.nethackrc';
        this._nethackOptions = opts.nethackOptions ?? null;
        // Save files, bones, and records share this Web Storage interface in
        // both the browser and headless engine.
        this.storage = opts.storage || null;
        this.display = opts.display || null;
        this.observeInput = opts.observeInput ?? null;
        this.state = createGameState();
        this.capture = new SegmentCapture(this);
        this.inputGate = new InputGate({
            beforeRead: () => this.capture.captureOutput(),
            display: opts.interactive ? this.display : null,
        });
        this.lua = new LuaLifecycle();
        this.coreRng = null;
        this.displayRng = null;
        this.rngLog = [];
        this.runningTask = null;
        this.lastRunResult = null;
    }
    // Yield after painting a transient frame. The browser waits for its next
    // paint; headless callers can continue immediately.
    async animationFrame() {
        await this.capture.animationFrame();
    }
    async start() {
        if (!this.display)
            throw new Error('Engine requires a display');
        const g = resetGame(this.state);
        g.program_state = {};
        bindInputGate(this.inputGate);
        bindLuaLifecycle(this.lua);
        g.datetime = this._datetime;
        g.nethackrc = this._nethackrc;
        g.storage = this.storage;
        // Gameplay code paints a transient frame, then yields here.
        g.animationFrame = () => this.animationFrame();
        // Parse nethackrc
        const opts = parseNethackrc(this._nethackrc, {
            fileName: this._nethackrcFileName,
        });
        // Install the terminal before character creation because an unset
        // OPTIONS=name opens the editable "Who are you?" prompt.
        g.nhDisplay = this.display;
        initRng(this._seed);
        this.coreRng = g.coreCtx;
        this.displayRng = g.displayCtx;
        enableRngLog();
        this.applyStartupConfiguration(opts);
        await displayConfigurationErrors(opts.configErrors);
        if (this._nethackOptions !== null) {
            // C rcfile() waits for file errors before parsing NETHACKOPTIONS.
            const report = parseNethackOptions(this._nethackOptions, opts);
            this.applyStartupConfiguration(opts);
            await displayConfigurationErrors([report]);
        }
        if (opts.configErrors.some(report => report.errors.length > 0))
            this.display.clearScreen();
        const configuredName = opts.name || await this._readPlayerName();
        // The `-D`/playmode:debug startup path uses the traditional fixed
        // player name "wizard", regardless of OPTIONS=name.
        let playerName = opts.flags.debug ? 'wizard' : configuredName;
        // NetHack keeps the configured player name verbatim for prose, while
        // the status line and menu headings capitalize it for display.
        g.plname = playerName;
        g.displayName = playerName.charAt(0).toUpperCase() + playerName.slice(1);
        // Initialize hero struct
        g.u = createHeroState();
        g.context = { move: 0 };
        g.moves = 0;
        initializeFruitRegistry(opts.fruit, g);
        if (restoreGame(playerName, this.storage)) {
            await restoregamePreamble();
            return true;
        }
        // C ref: role_init().  Contest sessions specify these options, so
        // invalid/missing values use stable NetHack-style defaults here and
        // can later be extended with the interactive role-selection prompt.
        let selectedRole = findRole(opts.role);
        let selectedRace = findRace(opts.race);
        let selectedGender = findGender(opts.gender);
        let selectedAlignment = findAlignment(opts.align);
        if (!selectedRole || !selectedRace || !selectedGender || !selectedAlignment) {
            const selected = await this._selectCharacter({
                role: selectedRole,
                race: selectedRace,
                gender: selectedGender,
                alignment: selectedAlignment,
            });
            selectedRole = selected.role;
            selectedRace = selected.race;
            selectedGender = selected.gender;
            selectedAlignment = selected.alignment;
            if (selected.name) {
                playerName = selected.name;
                g.plname = playerName;
                g.displayName = playerName.charAt(0).toUpperCase()
                    + playerName.slice(1);
            }
            g._characterPickerUsed = true;
        }
        const role = selectedRole || roles[0];
        const race = selectedRace || races[0];
        if (!role || !race)
            throw new Error('Character tables contain no default role or race');
        g.urole = role;
        if (g.urole?.key === 'samurai'
            && !Object.prototype.hasOwnProperty.call(opts.flags, 'pickup')) {
            g.flags.pickup = false;
        }
        g.urace = race;
        const gender = selectedGender || { name: 'male', value: 0 };
        const alignment = selectedAlignment || { name: 'neutral', value: 0 };
        g.flags.female = gender.value === 1;
        g.flags.initgend = gender.value;
        g.flags.initalign = alignment.value;
        g.initAlignment = alignment;
        if (hasErrorSave(g.plname, this.storage) && !await askAboutPanicSave()) {
            this.display.clearScreen();
            return false;
        }
        // Run game startup
        await newgame();
        return true;
    }
    applyStartupConfiguration(opts) {
        const g = this.state;
        g.plname = opts.name;
        g.flags = {
            verbose: true,
            menu_style: 2, // MENU_FULL in native initoptions().
            // NetHack 5.0 starts this tty profile with autopickup off unless
            // the rc file or an in-game toggle explicitly enables it.
            pickup: false,
            legacy: true,
            tutorial: true,
            ...opts.flags,
        };
        g.iflags = { ...opts.iflags };
        g._monTelecontrol = !!opts.monTelecontrol;
        g.commandBindings = opts.commandBindings;
        g.symset = opts.symset || null;
        if (opts.preferred_pet !== undefined)
            g.preferred_pet = opts.preferred_pet;
        if (opts.tutorial_set)
            g.tutorial_set_in_config = true;
    }
    requireDisplay() {
        const display = game.nhDisplay;
        if (!display)
            throw new Error('Character selection requires an initialized display');
        return display;
    }
    _drawCharacterMenu(lines, left, cursorRow, cursorOffset = 6, preserveBackground = false) {
        const display = this.requireDisplay();
        if (preserveBackground) {
            for (let row = 0; row < lines.length; row++) {
                // tty_display_nhwindow() clears WIN_MESSAGE before a corner
                // menu but preserves the base/map underlay west of the menu
                // on subsequent rows.
                // process_menu_window() clears through the cell immediately
                // west of its text origin (the corner-window boundary).
                const firstCol = row === 0 ? 0 : Math.max(0, left - 1);
                for (let col = firstCol; col < display.cols; col++)
                    display.setCell(col, row, ' ', NO_COLOR, 0);
            }
        }
        else {
            display.clearScreen();
        }
        for (let row = 0; row < lines.length; row++) {
            const line = lines[row];
            if (!line)
                continue;
            const text = typeof line === 'string' ? line : line.text;
            const attr = typeof line === 'string' ? 0 : line.attr;
            // tty character-selection headings indent with an ordinary blank
            // and begin inverse video on the following cell.  Keep that
            // semantic split in the grid so universal styled-blank capture
            // does not turn the margin into part of the heading.
            if (attr && text.startsWith(' ')) {
                display.putstr(left, row, ' ', NO_COLOR, 0);
                display.putstr(left + 1, row, text.slice(1), NO_COLOR, attr);
            }
            else {
                display.putstr(left, row, text, NO_COLOR, attr);
            }
        }
        display.setCursor(left + cursorOffset, cursorRow);
    }
    async _selectCharacter(initial) {
        const display = this.requireDisplay();
        let selectedName = game.plname;
        let manualInitial = initial;
        const question = "Shall I pick character's race, role, gender and alignment for you? [ynaq]";
        display.clearRow(0);
        display.putstr(0, 0, question, NO_COLOR);
        display.setCursor(question.length + 1, 0);
        const auto = String.fromCharCode(await nhgetch()).toLowerCase();
        if (auto !== 'n') {
            let role = initial.role;
            let race = initial.race;
            let gender = initial.gender;
            let alignment = initial.alignment;
            if (!role) {
                const candidates = CHARACTER_ROLE_ORDER
                    .map(key => roles.find(candidate => candidate.key === key))
                    .filter((candidate) => !!candidate && hasCharacterCompletion(candidate, race, gender, alignment));
                role = candidates[rn2(candidates.length)];
            }
            if (!race || !validCharacterChoice(role, race, gender, alignment)) {
                const candidates = races.filter(candidate => hasCharacterCompletion(role, candidate, gender, alignment));
                race = candidates[rn2(candidates.length)];
            }
            if (!gender || !validCharacterChoice(role, race, gender, alignment)) {
                const candidates = genders.filter(candidate => hasCharacterCompletion(role, race, candidate, alignment));
                gender = candidates[rn2(candidates.length)];
            }
            if (!alignment || !validCharacterChoice(role, race, gender, alignment)) {
                const candidates = aligns.filter(candidate => validCharacterChoice(role, race, gender, candidate));
                alignment = candidates[rn2(candidates.length)];
            }
            if (!role || !race || !gender || !alignment)
                throw new Error('Character selection has no valid completion');
            // 'a' means randomize and start immediately.  'y' uses the same
            // choices but enters the shared confirmation transition.  A
            // rejected automatic tuple returns to a completely unresolved
            // manual picker; it is not an ordinary command after startup.
            if (auto !== 'a') {
                for (;;) {
                    const roleName = gender.value === 1 && role.name.f
                        ? role.name.f : role.name.m;
                    const identity = `${selectedName} the ${alignment.name} ${gender.name} ${race.adj} ${roleName}`;
                    const confirmLines = Array(9).fill('');
                    confirmLines[0] = { text: 'Is this ok? [ynaq]', attr: 1 };
                    confirmLines[2] = identity;
                    confirmLines[4] = 'y * Yes; start game';
                    confirmLines[5] = 'n - No; choose role again';
                    confirmLines[6] = 'a - Not yet; choose another name';
                    confirmLines[7] = 'q - Quit';
                    confirmLines[8] = '(end)';
                    const left = 80 - Math.max(39, identity.length + 2);
                    this._drawCharacterMenu(confirmLines, left, 8, 6, true);
                    const code = await nhgetch();
                    const key = String.fromCharCode(code).toLowerCase();
                    if (key === 'a') {
                        selectedName = await this._readPlayerName(10, false);
                        game.plname = selectedName;
                        continue;
                    }
                    if (key === 'n') {
                        manualInitial = {
                            role: null,
                            race: null,
                            gender: null,
                            alignment: null,
                        };
                        break;
                    }
                    if (key === 'y' || code === 10 || code === 13 || code === 32)
                        return { role, race, gender, alignment, name: selectedName };
                }
            }
            else {
                return { role, race, gender, alignment, name: selectedName };
            }
        }
        const filteredRoles = new Set();
        const filteredRaces = new Set();
        const roleByKey = (key) => {
            const entry = CHARACTER_ROLE_MENU.find(candidate => candidate[0] === key);
            return entry && roles.find(candidate => candidate.key === entry[1]);
        };
        const allSelectableRoles = () => CHARACTER_ROLE_MENU
            .map(([, key]) => roles.find(candidate => candidate.key === key))
            .filter((candidate) => !!candidate && !filteredRoles.has(candidate.key));
        const hasCompletion = (role, race, gender, alignment) => {
            const candidates = role ? [role] : allSelectableRoles();
            const candidateRaces = race ? [race]
                : races.filter(candidate => !filteredRaces.has(candidate.name));
            return candidates.some(candidateRole => candidateRaces.some(candidateRace => genders.some(candidateGender => (gender ? candidateGender === gender : true)
                && aligns.some(candidateAlignment => (alignment ? candidateAlignment === alignment : true)
                    && validCharacterChoice(candidateRole, candidateRace, candidateGender, candidateAlignment)))));
        };
        const availableRaces = (role, gender, alignment) => races.filter(race => !filteredRaces.has(race.name)
            && hasCompletion(role, race, gender, alignment));
        const availableGenders = (role, race, alignment) => genders.filter(gender => hasCompletion(role, race, gender, alignment));
        const availableAlignments = (role, race, gender) => aligns.filter(alignment => hasCompletion(role, race, gender, alignment));
        const availableRoles = (race, gender, alignment) => CHARACTER_ROLE_MENU.flatMap(entry => {
            if (filteredRoles.has(entry[1]))
                return [];
            const role = roleByKey(entry[0]);
            return role && hasCompletion(role, race, gender, alignment)
                ? [[entry, role]] : [];
        });
        const facetSummary = (role, race, gender, alignment) => [
            role ? role.name.m : '<role>',
            race ? race.name : '<race>',
            gender ? gender.name : '<gender>',
            alignment ? alignment.name : '<alignment>',
        ].join(' ');
        const roleDescription = (entry, gender) => {
            if (!gender)
                return entry[2];
            if (entry[1] === 'caveman')
                return gender.name === 'female' ? 'a Cavewoman' : 'a Caveman';
            if (entry[1] === 'priest')
                return gender.name === 'female' ? 'a Priestess' : 'a Priest';
            return entry[2];
        };
        const routeLabel = (selected, facet) => `Pick ${selected ? 'another ' : ''}${facet} first`;
        const forcedGenderOwner = (role) => {
            const roleGenders = role && ROLE_SELECTION_RULES[role.key]?.genders;
            return roleGenders?.length === 1 && roleGenders[0]
                ? { owner: 'role', name: roleGenders[0] }
                : null;
        };
        const forcedGenderRow = (role, gender) => {
            const forced = forcedGenderOwner(role);
            return forced && gender?.name === forced.name
                ? `    ${forced.owner} forces ${forced.name}`
                : `" - ${routeLabel(gender, 'gender')}`;
        };
        const forcedAlignmentOwner = (role, race) => {
            const roleAlignments = role && ROLE_SELECTION_RULES[role.key]?.aligns;
            if (roleAlignments?.length === 1 && roleAlignments[0])
                return { owner: 'role', name: roleAlignments[0] };
            const raceAlignments = race && RACE_SELECTION_RULES[race.name]?.aligns;
            if (raceAlignments?.length === 1 && raceAlignments[0])
                return { owner: 'race', name: raceAlignments[0] };
            return null;
        };
        const forcedAlignmentRow = (role, race, alignment) => {
            const forced = forcedAlignmentOwner(role, race);
            return forced && alignment?.name === forced.name
                ? `    ${forced.owner} forces ${forced.name}`
                : `[ - ${routeLabel(alignment, 'alignment')}`;
        };
        const drawRoleMenu = (candidates, race, gender, alignment) => {
            const compact = filteredRoles.size > 0 || filteredRaces.size > 0
                || !!race || !!gender || !!alignment;
            const left = compact ? 41 : 0;
            const lines = Array(candidates.length + 11 + Number(compact)).fill('');
            const prefix = compact ? '' : ' ';
            lines[0] = { text: `${prefix}Pick a role or profession`, attr: 1 };
            lines[2] = `${prefix}${facetSummary(null, race, gender, alignment)}`;
            let row = 4;
            for (const [entry] of candidates)
                lines[row++] = `${prefix}${entry[0]} - ${roleDescription(entry, gender)}`;
            lines[row++] = `${prefix}* * Random`;
            if (compact)
                row++;
            lines[row++] = `${prefix}/ - ${routeLabel(race, 'race')}`;
            lines[row++] = `${prefix}" - ${routeLabel(gender, 'gender')}`;
            const forced = forcedAlignmentOwner(null, race);
            lines[row++] = forced && alignment?.name === forced.name
                ? `${prefix}    ${forced.owner} forces ${forced.name}`
                : `${prefix}[ - ${routeLabel(alignment, 'alignment')}`;
            lines[row++] = `${prefix}~ - ${filteredRoles.size || filteredRaces.size
                ? 'Reset' : 'Set'} role/race/&c filtering`;
            lines[row++] = `${prefix}q - Quit`;
            lines[row] = `${prefix}(end)`;
            this._drawCharacterMenu(lines, left, row, 6 + Number(!compact));
        };
        const editFilters = async () => {
            for (;;) {
                const lines = Array(24).fill('');
                lines[0] = { text: ' Pick all that apply', attr: 1 };
                lines[2] = ' Unacceptable roles';
                CHARACTER_ROLE_MENU.forEach(([key, roleKey, description], index) => {
                    const mark = filteredRoles.has(roleKey) ? '+' : '-';
                    lines[index + 3] = ` ${key} ${mark} ${description}`;
                });
                lines[17] = ' Unacceptable races';
                CHARACTER_RACE_MENU.forEach(([, key, name], index) => {
                    const mark = filteredRaces.has(name) ? '+' : '-';
                    lines[index + 18] = ` ${key} ${mark} ${name}`;
                });
                lines[23] = ' (1 of 2)';
                this._drawCharacterMenu(lines, 0, 23, 9);
                const key = String.fromCharCode(await nhgetch());
                if (key === '\r' || key === '\n' || key === ' ')
                    return;
                const roleEntry = CHARACTER_ROLE_MENU.find(entry => entry[0] === key);
                if (roleEntry) {
                    if (filteredRoles.has(roleEntry[1]))
                        filteredRoles.delete(roleEntry[1]);
                    else
                        filteredRoles.add(roleEntry[1]);
                    continue;
                }
                const raceEntry = CHARACTER_RACE_MENU.find(entry => entry[1] === key);
                if (raceEntry) {
                    if (filteredRaces.has(raceEntry[2]))
                        filteredRaces.delete(raceEntry[2]);
                    else
                        filteredRaces.add(raceEntry[2]);
                }
            }
        };
        const drawRaceMenu = (role, candidates, gender, alignment) => {
            const lines = Array(candidates.length + 12).fill('');
            lines[0] = { text: 'Pick a race or species', attr: 1 };
            lines[2] = facetSummary(role, null, gender, alignment);
            let row = 4;
            for (const race of candidates) {
                const key = CHARACTER_RACE_MENU.find(entry => entry[2] === race.name)?.[0];
                lines[row++] = `${key} - ${race.name}`;
            }
            lines[row++] = '* * Random';
            row++;
            lines[row++] = `? - ${routeLabel(role, 'role')}`;
            lines[row++] = forcedGenderRow(role, gender);
            lines[row++] = forcedAlignmentRow(role, null, alignment);
            lines[row++] = `~ - ${filteredRoles.size || filteredRaces.size ? 'Reset' : 'Set'} role/race/&c filtering`;
            lines[row++] = 'q - Quit';
            lines[row] = '(end)';
            this._drawCharacterMenu(lines, 41, row);
        };
        const drawGenderMenu = (role, race, alignment) => {
            const lines = Array(14).fill('');
            lines[0] = { text: 'Pick a gender or sex', attr: 1 };
            lines[2] = facetSummary(role, race, null, alignment);
            lines[4] = 'm - male';
            lines[5] = 'f - female';
            lines[6] = '* * Random';
            lines[8] = '? - Pick another role first';
            lines[9] = '/ - Pick another race first';
            lines[8] = `? - ${routeLabel(role, 'role')}`;
            lines[9] = `/ - ${routeLabel(race, 'race')}`;
            lines[10] = forcedAlignmentRow(role, race, alignment);
            lines[11] = `~ - ${filteredRoles.size || filteredRaces.size ? 'Reset' : 'Set'} role/race/&c filtering`;
            lines[12] = 'q - Quit';
            lines[13] = '(end)';
            this._drawCharacterMenu(lines, 41, 13);
        };
        const drawAlignmentMenu = (role, race, gender, candidates) => {
            const lines = Array(candidates.length + 12).fill('');
            lines[0] = { text: 'Pick an alignment or creed', attr: 1 };
            lines[2] = facetSummary(role, race, gender, null);
            let row = 4;
            const keys = { lawful: 'l', neutral: 'n', chaotic: 'c' };
            for (const alignment of candidates)
                lines[row++] = `${keys[alignment.name]} - ${alignment.name}`;
            lines[row++] = '* * Random';
            row++;
            lines[row++] = `? - ${routeLabel(role, 'role')}`;
            lines[row++] = `/ - ${routeLabel(race, 'race')}`;
            lines[row++] = forcedGenderRow(role, gender);
            lines[row++] = `~ - ${filteredRoles.size || filteredRaces.size ? 'Reset' : 'Set'} role/race/&c filtering`;
            lines[row++] = 'q - Quit';
            lines[row] = '(end)';
            this._drawCharacterMenu(lines, 41, row);
        };
        selection: for (;;) {
            let role = manualInitial.role;
            let race = manualInitial.race;
            let gender = manualInitial.gender;
            let alignment = manualInitial.alignment;
            let nextFacet = 'role';
            // role.c:plsel_startmenu() calls rigid_role_checks() immediately
            // before constructing every facet menu.  A rigid picker still
            // consumes rn2(1) for its sole candidate; facets skipped without
            // constructing a menu do not cross this boundary.
            const applyPreMenuRigidChecks = () => {
                if (!role)
                    return;
                if (!race) {
                    const candidates = availableRaces(role, gender, alignment);
                    if (candidates.length === 1)
                        race = candidates[rn2(candidates.length)];
                }
                if (!alignment) {
                    const candidates = availableAlignments(role, race, gender);
                    if (candidates.length === 1)
                        alignment = candidates[rn2(candidates.length)];
                }
                if (!gender) {
                    const candidates = availableGenders(role, race, alignment);
                    if (candidates.length === 1)
                        gender = candidates[rn2(candidates.length)];
                }
            };
            facetSelection: for (;;) {
                if (nextFacet === 'role') {
                    if (role) {
                        nextFacet = 'race';
                        continue;
                    }
                    const candidates = availableRoles(race, gender, alignment);
                    applyPreMenuRigidChecks();
                    drawRoleMenu(candidates, race, gender, alignment);
                    const key = String.fromCharCode(await nhgetch());
                    if (key === '~') {
                        if (filteredRoles.size || filteredRaces.size) {
                            filteredRoles.clear();
                            filteredRaces.clear();
                        }
                        else
                            await editFilters();
                        continue;
                    }
                    if (key === '/') {
                        role = null;
                        race = null;
                        nextFacet = 'race';
                        continue;
                    }
                    if (key === '"') {
                        role = null;
                        gender = null;
                        nextFacet = 'gender';
                        continue;
                    }
                    if (key === '[') {
                        role = null;
                        alignment = null;
                        nextFacet = 'alignment';
                        continue;
                    }
                    const chosen = key === '*'
                        ? candidates[rn2(candidates.length)]?.[1]
                        : roleByKey(key);
                    if (!chosen || !candidates.some(([, candidate]) => candidate === chosen))
                        continue;
                    role = chosen;
                    nextFacet = 'race';
                    continue;
                }
                if (nextFacet === 'race') {
                    if (race && hasCompletion(role, race, gender, alignment)) {
                        nextFacet = role ? 'gender' : 'role';
                        continue;
                    }
                    race = null;
                    let candidates = availableRaces(role, gender, alignment);
                    if (!candidates.length)
                        candidates = availableRaces(role, null, null);
                    if (candidates.length === 1) {
                        race = candidates[0];
                        nextFacet = role ? 'gender' : 'role';
                        continue;
                    }
                    applyPreMenuRigidChecks();
                    drawRaceMenu(role, candidates, gender, alignment);
                    const key = String.fromCharCode(await nhgetch());
                    if (key === '?') {
                        role = null;
                        race = null;
                        nextFacet = 'role';
                        continue;
                    }
                    if (key === '"') {
                        gender = null;
                        race = null;
                        nextFacet = 'gender';
                        continue;
                    }
                    if (key === '[') {
                        alignment = null;
                        race = null;
                        nextFacet = 'alignment';
                        continue;
                    }
                    if (key === '~') {
                        if (filteredRoles.size || filteredRaces.size) {
                            filteredRoles.clear();
                            filteredRaces.clear();
                        }
                        else
                            await editFilters();
                        continue;
                    }
                    if (key === '*')
                        race = candidates[rn2(candidates.length)];
                    else {
                        const entry = CHARACTER_RACE_MENU.find(candidate => candidate[0] === key.toLowerCase());
                        race = candidates.find(candidate => candidate.name === entry?.[2]);
                    }
                    if (!race)
                        continue;
                    nextFacet = role ? 'gender' : 'role';
                    continue;
                }
                if (nextFacet === 'gender') {
                    if (gender && hasCompletion(role, race, gender, alignment)) {
                        nextFacet = role ? (race ? 'alignment' : 'race') : 'role';
                        continue;
                    }
                    gender = null;
                    let candidates = availableGenders(role, race, alignment);
                    if (!candidates.length)
                        candidates = availableGenders(role, race, null);
                    if (candidates.length === 1) {
                        gender = candidates[0];
                        nextFacet = role ? (race ? 'alignment' : 'race') : 'role';
                        continue;
                    }
                    applyPreMenuRigidChecks();
                    drawGenderMenu(role, race, alignment);
                    const key = String.fromCharCode(await nhgetch()).toLowerCase();
                    if (key === '?') {
                        role = null;
                        gender = null;
                        nextFacet = 'role';
                        continue;
                    }
                    if (key === '/') {
                        race = null;
                        gender = null;
                        nextFacet = 'race';
                        continue;
                    }
                    if (key === '[') {
                        alignment = null;
                        gender = null;
                        nextFacet = 'alignment';
                        continue;
                    }
                    if (key === '*')
                        gender = candidates[rn2(candidates.length)];
                    else
                        gender = candidates.find(candidate => candidate.name[0] === key);
                    if (!gender)
                        continue;
                    nextFacet = role ? (race ? 'alignment' : 'race') : 'role';
                    continue;
                }
                if (alignment && hasCompletion(role, race, gender, alignment)) {
                    nextFacet = role ? (race ? (gender ? null : 'gender') : 'race') : 'role';
                    if (!nextFacet)
                        break facetSelection;
                    continue;
                }
                alignment = null;
                let candidates = availableAlignments(role, race, gender);
                if (!candidates.length)
                    candidates = availableAlignments(role, race, null);
                if (candidates.length === 1) {
                    alignment = candidates[0];
                    nextFacet = role ? (race ? (gender ? null : 'gender') : 'race') : 'role';
                    if (!nextFacet)
                        break facetSelection;
                    continue;
                }
                applyPreMenuRigidChecks();
                drawAlignmentMenu(role, race, gender, candidates);
                const key = String.fromCharCode(await nhgetch()).toLowerCase();
                if (key === '?') {
                    role = null;
                    alignment = null;
                    nextFacet = 'role';
                    continue;
                }
                if (key === '/') {
                    race = null;
                    alignment = null;
                    nextFacet = 'race';
                    continue;
                }
                if (key === '"') {
                    gender = null;
                    alignment = null;
                    nextFacet = 'gender';
                    continue;
                }
                if (key === '*')
                    alignment = candidates[rn2(candidates.length)];
                else
                    alignment = candidates.find(candidate => candidate.name[0] === key);
                if (!alignment)
                    continue;
                nextFacet = role ? (race ? (gender ? null : 'gender') : 'race') : 'role';
                if (!nextFacet)
                    break facetSelection;
            }
            if (!role || !race || !gender || !alignment)
                throw new Error('Character selection did not resolve all choices');
            let preserveConfirmationBackground = false;
            for (;;) {
                const roleName = gender.value === 1 && role.name.f
                    ? role.name.f : role.name.m;
                const identity = `${selectedName} the ${alignment.name} ${gender.name} ${race.adj} ${roleName}`;
                const lines = Array(9).fill('');
                lines[0] = { text: 'Is this ok? [ynaq]', attr: 1 };
                lines[2] = identity;
                lines[4] = 'y * Yes; start game';
                lines[5] = 'n - No; choose role again';
                lines[6] = 'a - Not yet; choose another name';
                lines[7] = 'q - Quit';
                lines[8] = '(end)';
                const left = 80 - Math.max(39, identity.length + 2);
                this._drawCharacterMenu(lines, left, 8, 6, preserveConfirmationBackground);
                const code = await nhgetch();
                const key = String.fromCharCode(code).toLowerCase();
                if (key === 'a') {
                    selectedName = await this._readPlayerName(10, false);
                    game.plname = selectedName;
                    preserveConfirmationBackground = true;
                    continue;
                }
                if (key === 'n')
                    continue selection;
                if (key === 'y' || code === 10 || code === 13 || code === 32)
                    return { role, race, gender, alignment, name: selectedName };
            }
        }
    }
    async _readPlayerName(row = 12, showCopyright = true) {
        const display = this.requireDisplay();
        display.clearScreen();
        if (showCopyright) {
            display.putstr(0, 4, 'NetHack, Copyright 1985-2026', NO_COLOR);
            display.putstr(9, 5, 'By Stichting Mathematisch Centrum and M. Stephenson.', NO_COLOR);
            display.putstr(9, 6, 'Version 5.0.0 MacOS, built May  2 2026 12:00:00.', NO_COLOR);
            display.putstr(9, 7, 'See license for details.', NO_COLOR);
        }
        const prompt = 'Who are you? ';
        display.putstr(0, row, prompt, NO_COLOR);
        let name = '';
        for (;;) {
            display.setCursor(prompt.length + name.length, row);
            const key = await nhgetch();
            if (key === 10 || key === 13)
                break;
            if (key === 8 || key === 127) {
                if (name) {
                    name = name.slice(0, -1);
                    display.putstr(prompt.length + name.length, row, ' ', NO_COLOR);
                }
            }
            else if (key >= 32 && key <= 126 && name.length < 31) {
                name += String.fromCharCode(key);
                display.putstr(prompt.length + name.length - 1, row, String.fromCharCode(key), NO_COLOR);
            }
        }
        return name || 'player';
    }
    run() {
        if (!this.runningTask)
            this.runningTask = this.runGame();
        return this.runningTask;
    }
    async runGame() {
        let started = false;
        try {
            started = await this.start();
            if (!started)
                return;
            while (!this.state.program_state?.gameover)
                await moveloop_core();
        }
        catch (caught) {
            let error = caught;
            if (error instanceof FormatterPanic) {
                try {
                    await panic(error.message, { state: this.state });
                }
                catch (termination) {
                    error = termination;
                }
            }
            if (error instanceof PanicTermination)
                this.lastRunResult = { kind: 'panicked', reason: error.message, stack: error.stack };
            throw error;
        }
        finally {
            // Native nh_terminate emits the completed terminal once after
            // raw topten output, which has no subsequent input boundary.
            if (this.state.program_state?.gameover)
                await this.capture.captureOutput();
            this.rngLog = [...getRngLog()];
            if (!started || this.state.program_state?.gameover || this.state.program_state?.panicking) {
                await discardTutorialState(this.state);
                await this.lua.destroy();
            }
        }
    }
    async runUntilInputNeeded() {
        const stopped = this.run().then(() => ({ kind: 'stopped' }));
        const inputNeeded = this.inputGate.waitUntilBlocked()
            .then(() => ({ kind: 'input-needed' }));
        this.lastRunResult = await Promise.race([stopped, inputNeeded]);
        return this.lastRunResult;
    }
    getScreens() { return this.capture.screens; }
    getCursors() { return this.capture.cursors; }
    getRngLog() { return this.rngLog; }
    // Per-step PRNG slices, parallel to getScreens(). Each entry is the
    // log of PRNG calls that fired since the previous capture (i.e.
    // since the previous nhgetch). Useful for tooling like the PS
    // visualizer that wants to attribute calls to individual keystrokes;
    // the judge ignores this and uses getRngLog() flat.
    getRngSlices() { return this.capture.rngSlices; }
    // Per-step animation frames, parallel to getScreens().  Each entry
    // is the array of frames captured (via animationFrame()) between
    // the previous input boundary and this one — i.e. the intermediate
    // display states for that step's animation.  Empty inner arrays
    // for steps that didn't animate.  SUPPLEMENTAL metric — not part
    // of the official ranking; see API.md.
    getAnimationFramesByStep() {
        return this.capture.animationFramesByStep;
    }
}
// ── Per-segment runner — the contest contract ──
//
// The judge calls this once per segment with five input fields:
//
//   { seed: number,        // PRNG seed
//     datetime: string,    // fixed datetime "YYYYMMDDHHMMSS"
//     nethackrc: string,   // game-options rc text
//     moves: string,       // raw key sequence supplied from launch
//     storage: object }    // Web-Storage-shaped (getItem/setItem/...)
//                          //   handle for cross-segment persistence —
//                          //   shared across all segments of a
//                          //   session. The browser passes a
//                          //   localStorage-backed view so save files
//                          //   survive page reload too.
//
// Each call returns a self-contained game whose getScreens() /
// getRngLog() / getCursors() / getAnimationFramesByStep() cover ONLY
// this segment. The harness concatenates them itself. Cross-segment
// C-side state (bones, record file, save) lives in `input.storage`.
export async function runSegment(input) {
    const { seed, datetime, nethackrc, storage } = input;
    const moves = input.moves || '';
    const display = new GameDisplay(null);
    const engine = new Engine({
        seed, datetime, nethackrc, storage, display, observeInput: input.observeInput ?? null,
    });
    engine.inputGate.feed(moves);
    await engine.runUntilInputNeeded();
    return engine;
}
//# sourceMappingURL=jsmain.js.map