// jsmain.js — Per-game engine and contest adapter.
// C ref: unixmain.c — nethack_main() initialization and game setup.

import { game, resetGame } from './gstate.js';
import { createGameState } from './game_state.js';
import type { GameState } from './game_state.js';
import { createHeroState } from './hero_types.js';
import type { Isaac64Context } from './isaac64.js';
import type { StorageBackend } from './storage.js';
import type { Terminal, TerminalCell, TerminalColor } from './terminal.js';
import { initRng, enableRngLog, getRngLog, rn2 } from './rng.js';
import { bindInputGate, InputGate, nhgetch } from './input.js';
import { bindLuaLifecycle, LuaLifecycle } from './lua/lifecycle.js';
import { newgame, moveloop_core, restoregamePreamble } from './allmain.js';
import { parseNethackOptions, parseNethackrc } from './options.js';
import type { NethackConfiguration } from './options.js';
import { displayConfigurationErrors } from './config_errors.js';
import { plineWithContinuation } from './display.js';
import {
    findRole, findRace, findAlignment, findGender, randomCharacterOption,
    roles, races, aligns, genders,
} from './roles.js';
import { parseCharacterName } from './character_name.js';
import type { AlignmentChoice, CharacterChoices, CharacterFacet, GenderChoice, RaceChoice, RoleChoice } from './character_choices.js';
import {
    characterSelectionQuestion, hasCharacterCompletion, nativeRoleChoices, pickCharacterChoice, rigidCharacterChecks,
    ROLE_SELECTION_RULES, RACE_SELECTION_RULES, validCharacterAlignment,
    validCharacterChoice, validCharacterGender, validCharacterRace,
} from './character_choices.js';
import type { ParsedCharacterName } from './character_name.js';
import { createCharacterFilters, editCharacterFilters, hasCharacterFilters } from './character_filters.js';
import type {
    Role, Race, Gender, Alignment, RoleKey, RaceName,
    GenderName, AlignmentName,
} from './roles.js';
import { GameDisplay } from './game_display.js';
import { DEC_TO_UNICODE, NO_COLOR } from './terminal.js';
import { askAboutPanicSave, hasErrorSave, restoreGame } from './save.js';
import { PanicTermination } from './panic_termination.js';
import { discardTutorialState } from './tutorial_state.js';
import { initializeFruitRegistry } from './fruit.js';

export interface EngineOptions {
    seed?: number;
    datetime?: string | null;
    nethackrc?: string;
    nethackrcFileName?: string;
    nethackOptions?: string;
    storage?: StorageBackend | null;
    display?: GameDisplay | null;
    interactive?: boolean;
    observeInput?: InputObserver | null;
}

export interface SegmentInput {
    seed: number;
    datetime: string;
    nethackrc: string;
    moves: string;
    storage: StorageBackend;
    // Diagnostic tooling only: called with the live state at each input
    // boundary, before the step's screen is captured. Play ignores it.
    observeInput?: InputObserver | null;
}

export type InputObserver = (state: GameState) => void;

export type EngineRunResult =
    | { kind: 'stopped' }
    | { kind: 'input-needed' }
    | { kind: 'panicked'; reason: string; stack: string | undefined };

export type CaptureCursor = [column: number, row: number, visible: 1] | null;

export interface AnimationFrame {
    screen: string;
    cursor: CaptureCursor;
}

interface SelectedCharacter {
    role: Role;
    race: Race;
    gender: Gender;
    alignment: Alignment;
    name: string;
}

type CharacterMenuLine = string | { text: string; attr: number };
type RoleMenuEntry = readonly [key: string, role: RoleKey, description: string];
type RaceMenuEntry = readonly [key: string, filterKey: string, race: RaceName];
type RoleCandidate = readonly [entry: RoleMenuEntry, role: Role];

const UNICODE_TO_DEC = new Map(
    Object.entries(DEC_TO_UNICODE).map(([dec, unicode]) => [unicode, dec]),
);

const CHARACTER_ROLE_MENU: readonly RoleMenuEntry[] = [
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

const CHARACTER_RACE_MENU: readonly RaceMenuEntry[] = [
    ['h', 'H', 'human'], ['e', 'E', 'elf'], ['d', 'D', 'dwarf'],
    ['g', 'G', 'gnome'], ['o', 'O', 'orc'],
];

// Serialize semantic terminal cells back into the tty wire form recorded by
// the C harness. The frozen grid intentionally stores rendered Unicode and
// literal blank cells; C emits DEC shift sequences and cursor-forward skips.
export function serializeCapture(term: Terminal | null | undefined): string {
    if (!term) return '';

    const colorToFg = (color: TerminalColor): number => {
        if (typeof color !== 'number') return 39;
        return color === 16 || color === 0 ? 90
            : color === 7 || color === 8 || color < 0 || color > 15
                ? 39 : color < 8 ? 30 + color : 90 + color - 8;
    };
    const transition = (fg: number, attr: number, nextFg: number, nextAttr: number): string => {
        if (fg === nextFg && attr === nextAttr) return '';
        const codes = [];
        if (attr) {
            codes.push(0);
            if (nextAttr & 2) codes.push(1);
            if (nextAttr & 4) codes.push(4);
            if (nextAttr & 1) codes.push(7);
            if (nextFg !== 39) codes.push(nextFg);
        } else {
            if (nextAttr & 2) codes.push(1);
            if (nextAttr & 4) codes.push(4);
            if (nextAttr & 1) codes.push(7);
            if (nextFg !== fg) codes.push(nextFg);
        }
        return codes.length ? `\x1b[${codes.join(';')}m` : '';
    };

    // Inverse-video and underlined blanks occupy terminal cells just like
    // visible glyphs; the recorder trims only unstyled trailing blanks.
    const styleMask = game._preserveLeadingStyledBlanks ? 7 : 5;
    const painted = (cell: TerminalCell): boolean =>
        cell.ch !== ' ' || !!(cell.attr & styleMask);
    let lastRow = 0;
    for (const [row, cells] of term.grid.entries()) {
        if (cells.some(painted)) lastRow = row;
    }

    const lines: string[] = [];
    const decGraphics = /^DECgraphics$/i.test(game.symset || '');
    for (const cells of term.grid.slice(0, lastRow + 1)) {
        const firstCol = cells.findIndex(painted);
        if (firstCol < 0) {
            lines.push('');
            continue;
        }
        let lastCol = firstCol;
        for (const [col, cell] of cells.entries()) {
            if (painted(cell)) lastCol = col;
        }

        let line = firstCol > 4
            ? `\x1b[${firstCol}C` : ' '.repeat(firstCol);
        let fg = 39, attr = 0;
        let dec = false;
        for (let col = firstCol; col <= lastCol;) {
            const cell = cells[col];
            if (!cell) throw new Error(`Missing terminal cell at column ${col}`);
            if (cell.ch === ' ') {
                const blankFg = colorToFg(cell.color);
                const blankAttr = cell.attr | 0;
                let end = col + 1;
                while (end <= lastCol) {
                    const nextCell = cells[end];
                    if (!nextCell || nextCell.ch !== ' '
                        || colorToFg(nextCell.color) !== blankFg
                        || (nextCell.attr | 0) !== blankAttr) break;
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
        if (dec) line += '\x0f';
        line += transition(fg, attr, 39, 0);
        lines.push(line);
    }
    return lines.join('\n');
}

class SegmentCapture {
    readonly engine: Engine;
    readonly screens: string[];
    readonly cursors: CaptureCursor[];
    readonly rngSlices: string[][];
    readonly animationFramesByStep: AnimationFrame[][];
    pendingAnimationFrames: AnimationFrame[];
    lastRngIndex: number;

    constructor(engine: Engine) {
        this.engine = engine;
        this.screens = [];
        this.cursors = [];
        this.rngSlices = [];
        this.animationFramesByStep = [];
        this.pendingAnimationFrames = [];
        this.lastRngIndex = 0;
    }

    async captureOutput(): Promise<void> {
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

    async animationFrame(): Promise<void> {
        const display = this.engine.display;
        const terminal = display?.terminal;
        this.pendingAnimationFrames.push({
            screen: serializeCapture(terminal),
            cursor: display
                ? [display.cursorCol ?? 0, display.cursorRow ?? 0, 1]
                : null,
        });
        if (typeof requestAnimationFrame === 'function') {
            await new Promise<number>(resolve => requestAnimationFrame(resolve));
        } else {
            await null;
        }
    }
}

export class Engine {
    readonly _seed: number;
    readonly _datetime: string | null;
    readonly _nethackrc: string;
    readonly _nethackrcFileName: string;
    readonly _nethackOptions: string | null;
    readonly storage: StorageBackend | null;
    readonly display: GameDisplay | null;
    readonly state: GameState;
    readonly capture: SegmentCapture;
    readonly inputGate: InputGate;
    readonly lua: LuaLifecycle;
    readonly observeInput: InputObserver | null;
    coreRng: Isaac64Context | null;
    displayRng: Isaac64Context | null;
    rngLog: string[];
    runningTask: Promise<void> | null;
    lastRunResult: EngineRunResult | null;

    constructor(opts: EngineOptions = {}) {
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
    async animationFrame(): Promise<void> {
        await this.capture.animationFrame();
    }

    async start(): Promise<boolean> {
        if (!this.display) throw new Error('Engine requires a display');
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
        if (opts.configErrors.some(report => report.errors.length > 0)) this.display.clearScreen();
        // The `-D`/playmode:debug startup path uses the traditional fixed
        // player name "wizard", regardless of OPTIONS=name.
        let configuredName = parseCharacterName(opts.flags.debug ? 'wizard' : opts.name);
        for (;;) {
            if (configuredName.role) opts.role = configuredName.role;
            if (configuredName.race) opts.race = configuredName.race;
            if (configuredName.gender) opts.gender = configuredName.gender;
            if (configuredName.align) opts.align = configuredName.align;
            if (configuredName.name) break;
            configuredName = await this._readPlayerName();
        }
        let playerName = configuredName.name;
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
        let selectedRole = findRole(opts.role);
        let selectedRace = findRace(opts.race);
        let selectedGender = findGender(opts.gender);
        let selectedAlignment = findAlignment(opts.align);
        if (!selectedRole || !selectedRace || !selectedGender || !selectedAlignment
            || !validCharacterChoice(selectedRole, selectedRace, selectedGender, selectedAlignment)) {
            const random = new Set<CharacterFacet>();
            if (!selectedRole && randomCharacterOption(opts.role)) random.add('role');
            if (!selectedRace && randomCharacterOption(opts.race)) random.add('race');
            if (!selectedGender && randomCharacterOption(opts.gender)) random.add('gender');
            if (!selectedAlignment && randomCharacterOption(opts.align)) random.add('alignment');
            const selected = await this._selectCharacter({
                role: selectedRole,
                race: selectedRace,
                gender: selectedGender,
                alignment: selectedAlignment,
            }, random);
            if (!selected) return false;
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
        if (!role || !race) throw new Error('Character tables contain no default role or race');
        g.urole = role;
        if (g.urole?.key === 'samurai'
            && !Object.prototype.hasOwnProperty.call(opts.flags, 'pickup')) {
            g.flags.pickup = false;
        }
        g.urace = race;
        const gender: Gender = selectedGender || { name: 'male', value: 0 };
        const alignment: Alignment = selectedAlignment || { name: 'neutral', value: 0 };
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

    private applyStartupConfiguration(opts: NethackConfiguration): void {
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
        if (opts.preferred_pet !== undefined) g.preferred_pet = opts.preferred_pet;
        if (opts.tutorial_set) g.tutorial_set_in_config = true;
    }

    private requireDisplay(): GameDisplay {
        const display = game.nhDisplay;
        if (!display) throw new Error('Character selection requires an initialized display');
        return display;
    }

    _drawCharacterMenu(lines: readonly CharacterMenuLine[], left: number, cursorRow: number,
        cursorOffset = 6, preserveBackground = false): void {
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
        } else {
            display.clearScreen();
        }
        for (let row = 0; row < lines.length; row++) {
            const line = lines[row];
            if (!line) continue;
            const text = typeof line === 'string' ? line : line.text;
            const attr = typeof line === 'string' ? 0 : line.attr;
            // tty character-selection headings indent with an ordinary blank
            // and begin inverse video on the following cell.  Keep that
            // semantic split in the grid so universal styled-blank capture
            // does not turn the margin into part of the heading.
            if (attr && text.startsWith(' ')) {
                display.putstr(left, row, ' ', NO_COLOR, 0);
                display.putstr(left + 1, row, text.slice(1), NO_COLOR, attr);
            } else {
                display.putstr(left, row, text, NO_COLOR, attr);
            }
        }
        display.setCursor(left + cursorOffset, cursorRow);
    }

    async _selectCharacter(configured: CharacterChoices, random: ReadonlySet<CharacterFacet> = new Set()): Promise<SelectedCharacter | null> {
        const display = this.requireDisplay();
        let selectedName = game.plname;
        const needsConfirmation = (!configured.role && !random.has('role'))
            || (!configured.race && !random.has('race'))
            || (!configured.gender && !random.has('gender'))
            || (!configured.alignment && !random.has('alignment'));
        const initial = rigidCharacterChecks(configured, random);
        // A random choice which rigid checks could not resolve stays random
        // until its own facet is visited; it does not enable pick-for-you.
        const pendingRandom = new Set([...random].filter(facet => !initial[facet]));
        let manualInitial = initial;
        const hasUnspecifiedChoice = (!initial.role && !random.has('role'))
            || (!initial.race && !random.has('race'))
            || (!initial.gender && !random.has('gender'))
            || (!initial.alignment && !random.has('alignment'));
        let auto = 'n';
        if (hasUnspecifiedChoice) {
            const question = characterSelectionQuestion(initial, random);
            do {
                display.clearRow(0);
                display.putstr(0, 0, question, NO_COLOR);
                display.setCursor(question.length + 1, 0);
                auto = String.fromCharCode(await nhgetch()).toLowerCase();
                if (auto === 'q' || auto === '\x1b') return null;
                if (auto === ' ' || auto === '\n') auto = 'y';
                else if (auto === '*' || auto === '@') auto = 'a';
            } while (auto !== 'y' && auto !== 'n' && auto !== 'a');
        }

        if (auto !== 'n') {
            let role = initial.role;
            let race = initial.race;
            let gender = initial.gender;
            let alignment = initial.alignment;

            if (!role) {
                const candidates = nativeRoleChoices()
                    .filter(candidate => hasCharacterCompletion(
                        candidate, race, gender, alignment,
                    ));
                if (!candidates.length) await plineWithContinuation('Incompatible role!');
                role = pickCharacterChoice(candidates.length ? candidates : nativeRoleChoices());
            }
            if (!race || !validCharacterRace(role, race, null)) {
                const candidates = races.filter(candidate => validCharacterRace(role, candidate, alignment));
                if (candidates.length) race = pickCharacterChoice(candidates);
                else {
                    await plineWithContinuation('Incompatible race!');
                    const permitted = races.filter(candidate => validCharacterRace(role, candidate, null));
                    race = permitted[Math.trunc(rn2(permitted.length * 100) / 100)];
                }
            }
            if (!gender || !validCharacterGender(role, gender)) {
                gender = pickCharacterChoice(genders.filter(candidate => validCharacterGender(role, candidate)));
            }
            if (!alignment || !validCharacterAlignment(role, race, alignment)) {
                alignment = pickCharacterChoice(aligns.filter(candidate => validCharacterAlignment(role, race, candidate)));
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
                    const confirmLines = Array<CharacterMenuLine>(9).fill('');
                    confirmLines[0] = { text: 'Is this ok? [ynaq]', attr: 1 };
                    confirmLines[2] = identity;
                    confirmLines[4] = 'y * Yes; start game';
                    confirmLines[5] = 'n - No; choose role again';
                    confirmLines[6] = 'a - Not yet; choose another name';
                    confirmLines[7] = 'q - Quit';
                    confirmLines[8] = '(end)';
                    const left = 80 - Math.max(39, identity.length + 2);
                    this._drawCharacterMenu(
                        confirmLines, left, 8, 6, true,
                    );
                    const code = await nhgetch();
                    const key = String.fromCharCode(code).toLowerCase();
                    if (key === 'q' || code === 27) return null;
                    if (key === 'a') {
                        do {
                            selectedName = (await this._readPlayerName(10, false)).name;
                        } while (!selectedName);
                        game.plname = selectedName;
                        continue;
                    }
                    if (key === 'n') {
                        pendingRandom.clear();
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
            } else {
                return { role, race, gender, alignment, name: selectedName };
            }
        }

        const filters = createCharacterFilters();
        const { roles: filteredRoles, races: filteredRaces, genders: filteredGenders, alignments: filteredAlignments } = filters;
        const roleByKey = (key: string): Role | undefined => {
            const entry = CHARACTER_ROLE_MENU.find(candidate => candidate[0] === key);
            return entry && roles.find(candidate => candidate.key === entry[1]);
        };
        const allSelectableRoles = (): Role[] => CHARACTER_ROLE_MENU
            .map(([, key]) => roles.find(candidate => candidate.key === key))
            .filter((candidate): candidate is Role => !!candidate && !filteredRoles.has(candidate.key));
        const hasCompletion = (
            role: RoleChoice, race: RaceChoice, gender: GenderChoice, alignment: AlignmentChoice,
        ): boolean => {
            const candidates = role ? [role] : allSelectableRoles();
            const candidateRaces = race ? [race]
                : races.filter(candidate => !filteredRaces.has(candidate.name));
            return candidates.some(candidateRole => candidateRaces.some(candidateRace =>
                genders.some(candidateGender => !filteredGenders.has(candidateGender.name)
                    && (gender ? candidateGender === gender : true)
                    && aligns.some(candidateAlignment =>
                        !filteredAlignments.has(candidateAlignment.name)
                        && (alignment ? candidateAlignment === alignment : true)
                        && validCharacterChoice(
                            candidateRole, candidateRace,
                            candidateGender, candidateAlignment,
                        )))));
        };
        const availableRaces = (
            role: RoleChoice, gender: GenderChoice, alignment: AlignmentChoice,
        ): Race[] => races.filter(race =>
            !filteredRaces.has(race.name)
            && validCharacterRace(role, race, alignment));
        const availableGenders = (
            role: RoleChoice, race: RaceChoice, alignment: AlignmentChoice,
        ): Gender[] => genders.filter(gender => !filteredGenders.has(gender.name)
            && validCharacterGender(role, gender));
        const availableAlignments = (
            role: RoleChoice, race: RaceChoice, gender: GenderChoice,
        ): Alignment[] => aligns.filter(alignment => !filteredAlignments.has(alignment.name)
            && validCharacterAlignment(role, race, alignment));
        const availableRoles = (
            race: RaceChoice, gender: GenderChoice, alignment: AlignmentChoice,
        ): RoleCandidate[] => CHARACTER_ROLE_MENU.flatMap(entry => {
            if (filteredRoles.has(entry[1])) return [];
            const role = roleByKey(entry[0]);
            return role && hasCompletion(role, race, gender, alignment)
                ? [[entry, role] satisfies RoleCandidate] : [];
        });

        const facetSummary = (
            role: RoleChoice, race: RaceChoice, gender: GenderChoice, alignment: AlignmentChoice,
        ): string => [
            role ? role.name.m : '<role>',
            race ? race.name : '<race>',
            gender ? gender.name : '<gender>',
            alignment ? alignment.name : '<alignment>',
        ].join(' ');
        const roleDescription = (entry: RoleMenuEntry, gender: GenderChoice): string => {
            if (!gender) return entry[2];
            if (entry[1] === 'caveman')
                return gender.name === 'female' ? 'a Cavewoman' : 'a Caveman';
            if (entry[1] === 'priest')
                return gender.name === 'female' ? 'a Priestess' : 'a Priest';
            return entry[2];
        };
        const routeLabel = (
            selected: RoleChoice | RaceChoice | GenderChoice | AlignmentChoice,
            facet: CharacterFacet,
        ): string => `Pick ${selected ? 'another ' : ''}${facet} first`;

        const forcedGenderOwner = (role: RoleChoice): { owner: 'role'; name: GenderName } | null => {
            const roleGenders = role && ROLE_SELECTION_RULES[role.key]?.genders;
            return roleGenders?.length === 1 && roleGenders[0]
                ? { owner: 'role', name: roleGenders[0] }
                : null;
        };

        const forcedGenderRow = (role: RoleChoice, gender: GenderChoice): string => {
            const forced = forcedGenderOwner(role);
            return forced && gender?.name === forced.name
                ? `    ${forced.owner} forces ${forced.name}`
                : `" - ${routeLabel(gender, 'gender')}`;
        };

        const forcedAlignmentOwner = (
            role: RoleChoice, race: RaceChoice,
        ): { owner: 'role' | 'race'; name: AlignmentName } | null => {
            const roleAlignments = role && ROLE_SELECTION_RULES[role.key]?.aligns;
            if (roleAlignments?.length === 1 && roleAlignments[0])
                return { owner: 'role', name: roleAlignments[0] };
            const raceAlignments = race && RACE_SELECTION_RULES[race.name]?.aligns;
            if (raceAlignments?.length === 1 && raceAlignments[0])
                return { owner: 'race', name: raceAlignments[0] };
            return null;
        };

        const forcedAlignmentRow = (
            role: RoleChoice, race: RaceChoice, alignment: AlignmentChoice,
        ): string => {
            const forced = forcedAlignmentOwner(role, race);
            return forced && alignment?.name === forced.name
                ? `    ${forced.owner} forces ${forced.name}`
                : `[ - ${routeLabel(alignment, 'alignment')}`;
        };

        const drawRoleMenu = (
            candidates: readonly RoleCandidate[], race: RaceChoice,
            gender: GenderChoice, alignment: AlignmentChoice,
        ): void => {
            const compact = hasCharacterFilters(filters)
                || !!race || !!gender || !!alignment;
            const left = compact ? 41 : 0;
            const lines = Array<CharacterMenuLine>(candidates.length + 11 + Number(compact)).fill('');
            const prefix = compact ? '' : ' ';
            lines[0] = { text: `${prefix}Pick a role or profession`, attr: 1 };
            lines[2] = `${prefix}${facetSummary(null, race, gender, alignment)}`;
            let row = 4;
            for (const [entry] of candidates)
                lines[row++] = `${prefix}${entry[0]} - ${roleDescription(entry, gender)}`;
            lines[row++] = `${prefix}* * Random`;
            if (compact) row++;
            lines[row++] = `${prefix}/ - ${routeLabel(race, 'race')}`;
            lines[row++] = `${prefix}" - ${routeLabel(gender, 'gender')}`;
            const forced = forcedAlignmentOwner(null, race);
            lines[row++] = forced && alignment?.name === forced.name
                ? `${prefix}    ${forced.owner} forces ${forced.name}`
                : `${prefix}[ - ${routeLabel(alignment, 'alignment')}`;
            lines[row++] = `${prefix}~ - ${hasCharacterFilters(filters)
                ? 'Reset' : 'Set'} role/race/&c filtering`;
            lines[row++] = `${prefix}q - Quit`;
            lines[row] = `${prefix}(end)`;
            this._drawCharacterMenu(lines, left, row, 6 + Number(!compact));
        };

        const drawRaceMenu = (
            role: RoleChoice, candidates: readonly Race[],
            gender: GenderChoice, alignment: AlignmentChoice,
        ): void => {
            const lines = Array<CharacterMenuLine>(candidates.length + 12).fill('');
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
            lines[row++] = `~ - ${hasCharacterFilters(filters) ? 'Reset' : 'Set'} role/race/&c filtering`;
            lines[row++] = 'q - Quit';
            lines[row] = '(end)';
            this._drawCharacterMenu(lines, 41, row);
        };

        const drawGenderMenu = (
            role: RoleChoice, race: RaceChoice, alignment: AlignmentChoice,
            candidates: readonly Gender[],
        ): void => {
            const lines = Array<CharacterMenuLine>(candidates.length + 12).fill('');
            lines[0] = { text: 'Pick a gender or sex', attr: 1 };
            lines[2] = facetSummary(role, race, null, alignment);
            let row = 4;
            for (const gender of candidates) lines[row++] = `${gender.name.charAt(0)} - ${gender.name}`;
            lines[row++] = '* * Random';
            row++;
            lines[row++] = `? - ${routeLabel(role, 'role')}`;
            lines[row++] = `/ - ${routeLabel(race, 'race')}`;
            lines[row++] = forcedAlignmentRow(role, race, alignment);
            lines[row++] = `~ - ${hasCharacterFilters(filters) ? 'Reset' : 'Set'} role/race/&c filtering`;
            lines[row++] = 'q - Quit';
            lines[row] = '(end)';
            this._drawCharacterMenu(lines, 41, row);
        };

        const drawAlignmentMenu = (
            role: RoleChoice, race: RaceChoice, gender: GenderChoice,
            candidates: readonly Alignment[],
        ): void => {
            const lines = Array<CharacterMenuLine>(candidates.length + 12).fill('');
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
            lines[row++] = `~ - ${hasCharacterFilters(filters) ? 'Reset' : 'Set'} role/race/&c filtering`;
            lines[row++] = 'q - Quit';
            lines[row] = '(end)';
            this._drawCharacterMenu(lines, 41, row);
        };

        selection: for (;;) {
            let role = manualInitial.role;
            let race = manualInitial.race;
            let gender = manualInitial.gender;
            let alignment = manualInitial.alignment;
            let nextFacet: CharacterFacet | null = 'role';

            const resetFiltering = async (facet: CharacterFacet): Promise<void> => {
                const result = await editCharacterFilters(filters);
                pendingRandom.delete(facet);
                if (result !== 'cancelled') {
                    pendingRandom.clear();
                    role = null;
                    race = null;
                    gender = null;
                    alignment = null;
                } else {
                    switch (facet) {
                    case 'role': role = null; break;
                    case 'race': race = null; break;
                    case 'gender': gender = null; break;
                    case 'alignment': alignment = null; break;
                    }
                }
                nextFacet = result === 'filtered' ? 'role' : facet;
            };

            // role.c:plsel_startmenu() calls rigid_role_checks() immediately
            // before constructing every facet menu.  A rigid picker still
            // consumes rn2(1) for its sole candidate; facets skipped without
            // constructing a menu do not cross this boundary.
            const applyPreMenuRigidChecks = (): void => {
                if (!role) return;
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
                    if (key === 'q' || key === '\x1b') return null;
                    if (key === '~') {
                        await resetFiltering('role');
                        continue;
                    }
                    if (key === '/') {
                        pendingRandom.delete('race');
                        role = null;
                        race = null;
                        nextFacet = 'race';
                        continue;
                    }
                    if (key === '"') {
                        pendingRandom.delete('gender');
                        role = null;
                        gender = null;
                        nextFacet = 'gender';
                        continue;
                    }
                    if (key === '[') {
                        pendingRandom.delete('alignment');
                        role = null;
                        alignment = null;
                        nextFacet = 'alignment';
                        continue;
                    }
                    const choosingRandom = key === '*' || key === ' ' || key === '\n';
                    const chosen = choosingRandom
                        ? pickCharacterChoice(candidates.map(([, candidate]) => candidate))
                            ?? pickCharacterChoice(nativeRoleChoices())
                        : roleByKey(key);
                    if (!chosen || !choosingRandom && !candidates.some(([, candidate]) => candidate === chosen))
                        continue;
                    role = chosen;
                    nextFacet = 'race';
                    continue;
                }

                if (nextFacet === 'race') {
                    const randomRace = pendingRandom.delete('race');
                    if (race && validCharacterRace(role, race, null)) {
                        nextFacet = role ? 'gender' : 'role';
                        continue;
                    }
                    race = null;
                    const candidates = availableRaces(role, gender, alignment);
                    const permitted = races.filter(candidate => validCharacterRace(role, candidate, null));
                    if (randomRace) {
                        if (!candidates.length) await plineWithContinuation('Incompatible race!');
                        race = pickCharacterChoice(candidates)
                            ?? permitted[Math.trunc(rn2(permitted.length * 100) / 100)];
                        nextFacet = role ? 'gender' : 'role';
                        continue;
                    }
                    const counted = candidates.length ? candidates : permitted;
                    if (counted.length === 1) {
                        race = counted[0];
                        nextFacet = role ? 'gender' : 'role';
                        continue;
                    }
                    applyPreMenuRigidChecks();
                    drawRaceMenu(role, candidates, gender, alignment);
                    const key = String.fromCharCode(await nhgetch());
                    if (key === 'q' || key === '\x1b') return null;
                    if (key === '?') {
                        role = null;
                        race = null;
                        nextFacet = 'role';
                        continue;
                    }
                    if (key === '"') {
                        pendingRandom.delete('gender');
                        gender = null;
                        race = null;
                        nextFacet = 'gender';
                        continue;
                    }
                    if (key === '[') {
                        pendingRandom.delete('alignment');
                        alignment = null;
                        race = null;
                        nextFacet = 'alignment';
                        continue;
                    }
                    if (key === '~') {
                        await resetFiltering('race');
                        continue;
                    }
                    if (key === '*' || key === ' ' || key === '\n') {
                        race = pickCharacterChoice(candidates)
                            ?? permitted[Math.trunc(rn2(permitted.length * 100) / 100)];
                    }
                    else {
                        const entry = CHARACTER_RACE_MENU.find(candidate =>
                            candidate[0] === key.toLowerCase());
                        race = candidates.find(candidate => candidate.name === entry?.[2]);
                    }
                    if (!race) continue;
                    nextFacet = role ? 'gender' : 'role';
                    continue;
                }

                if (nextFacet === 'gender') {
                    const randomGender = pendingRandom.delete('gender');
                    if (gender && validCharacterGender(role, gender)) {
                        nextFacet = role ? (race ? 'alignment' : 'race') : 'role';
                        continue;
                    }
                    gender = null;
                    const candidates = availableGenders(role, race, alignment);
                    const permitted = genders.filter(candidate => validCharacterGender(role, candidate));
                    if (randomGender) {
                        if (!candidates.length) await plineWithContinuation('Incompatible gender!');
                        gender = pickCharacterChoice(candidates) ?? pickCharacterChoice(permitted);
                        nextFacet = role ? (race ? 'alignment' : 'race') : 'role';
                        continue;
                    }
                    const counted = candidates.length ? candidates : permitted;
                    if (counted.length === 1) {
                        gender = counted[0];
                        nextFacet = role ? (race ? 'alignment' : 'race') : 'role';
                        continue;
                    }
                    applyPreMenuRigidChecks();
                    drawGenderMenu(role, race, alignment, candidates);
                    const key = String.fromCharCode(await nhgetch()).toLowerCase();
                    if (key === 'q' || key === '\x1b') return null;
                    if (key === '~') {
                        await resetFiltering('gender');
                        continue;
                    }
                    if (key === '?') {
                        role = null;
                        gender = null;
                        nextFacet = 'role';
                        continue;
                    }
                    if (key === '/') {
                        pendingRandom.delete('race');
                        race = null;
                        gender = null;
                        nextFacet = 'race';
                        continue;
                    }
                    if (key === '[') {
                        pendingRandom.delete('alignment');
                        alignment = null;
                        gender = null;
                        nextFacet = 'alignment';
                        continue;
                    }
                    if (key === '*' || key === ' ' || key === '\n')
                        gender = pickCharacterChoice(candidates) ?? pickCharacterChoice(permitted);
                    else gender = candidates.find(candidate => candidate.name[0] === key);
                    if (!gender) continue;
                    nextFacet = role ? (race ? 'alignment' : 'race') : 'role';
                    continue;
                }

                const randomAlignment = pendingRandom.delete('alignment');
                if (alignment && validCharacterAlignment(role, race, alignment)) {
                    nextFacet = role ? (race ? (gender ? null : 'gender') : 'race') : 'role';
                    if (!nextFacet) break facetSelection;
                    continue;
                }
                alignment = null;
                const candidates = availableAlignments(role, race, gender);
                const permitted = aligns.filter(candidate => validCharacterAlignment(role, race, candidate));
                if (randomAlignment) {
                    if (!candidates.length) await plineWithContinuation('Incompatible alignment!');
                    alignment = pickCharacterChoice(candidates) ?? pickCharacterChoice(permitted);
                    nextFacet = role ? (race ? (gender ? null : 'gender') : 'race') : 'role';
                    if (!nextFacet) break facetSelection;
                    continue;
                }
                const counted = candidates.length ? candidates : permitted;
                if (counted.length === 1) {
                    alignment = counted[0];
                    nextFacet = role ? (race ? (gender ? null : 'gender') : 'race') : 'role';
                    if (!nextFacet) break facetSelection;
                    continue;
                }
                applyPreMenuRigidChecks();
                drawAlignmentMenu(role, race, gender, candidates);
                const key = String.fromCharCode(await nhgetch()).toLowerCase();
                if (key === 'q' || key === '\x1b') return null;
                if (key === '~') {
                    await resetFiltering('alignment');
                    continue;
                }
                if (key === '?') {
                    role = null;
                    alignment = null;
                    nextFacet = 'role';
                    continue;
                }
                if (key === '/') {
                    pendingRandom.delete('race');
                    race = null;
                    alignment = null;
                    nextFacet = 'race';
                    continue;
                }
                if (key === '"') {
                    pendingRandom.delete('gender');
                    gender = null;
                    alignment = null;
                    nextFacet = 'gender';
                    continue;
                }
                if (key === '*' || key === ' ' || key === '\n')
                    alignment = pickCharacterChoice(candidates) ?? pickCharacterChoice(permitted);
                else alignment = candidates.find(candidate => candidate.name[0] === key);
                if (!alignment) continue;
                nextFacet = role ? (race ? (gender ? null : 'gender') : 'race') : 'role';
                if (!nextFacet) break facetSelection;
            }

            if (!role || !race || !gender || !alignment)
                throw new Error('Character selection did not resolve all choices');
            if (!needsConfirmation)
                return { role, race, gender, alignment, name: selectedName };
            let preserveConfirmationBackground = false;
            for (;;) {
                const roleName = gender.value === 1 && role.name.f
                    ? role.name.f : role.name.m;
                const identity = `${selectedName} the ${alignment.name} ${gender.name} ${race.adj} ${roleName}`;
                const lines = Array<CharacterMenuLine>(9).fill('');
                lines[0] = { text: 'Is this ok? [ynaq]', attr: 1 };
                lines[2] = identity;
                lines[4] = 'y * Yes; start game';
                lines[5] = 'n - No; choose role again';
                lines[6] = 'a - Not yet; choose another name';
                lines[7] = 'q - Quit';
                lines[8] = '(end)';
                const left = 80 - Math.max(39, identity.length + 2);
                this._drawCharacterMenu(
                    lines, left, 8, 6, preserveConfirmationBackground,
                );
                const code = await nhgetch();
                const key = String.fromCharCode(code).toLowerCase();
                if (key === 'q' || code === 27) return null;
                if (key === 'a') {
                    do {
                        selectedName = (await this._readPlayerName(10, false)).name;
                    } while (!selectedName);
                    game.plname = selectedName;
                    preserveConfirmationBackground = true;
                    continue;
                }
                if (key === 'n') {
                    pendingRandom.clear();
                    manualInitial = { role: null, race: null, gender: null, alignment: null };
                    continue selection;
                }
                if (key === 'y' || code === 10 || code === 13 || code === 32)
                    return { role, race, gender, alignment, name: selectedName };
            }
        }
    }

    async _readPlayerName(row = 12, showCopyright = true): Promise<ParsedCharacterName> {
        const display = this.requireDisplay();
        display.clearScreen();
        if (showCopyright) {
            display.putstr(0, 4, 'NetHack, Copyright 1985-2026', NO_COLOR);
            display.putstr(9, 5,
                'By Stichting Mathematisch Centrum and M. Stephenson.', NO_COLOR);
            display.putstr(9, 6,
                'Version 5.0.0 MacOS, built May  2 2026 12:00:00.', NO_COLOR);
            display.putstr(9, 7, 'See license for details.', NO_COLOR);
        }
        const prompt = 'Who are you? ';
        display.putstr(0, row, prompt, NO_COLOR);

        let name = '';
        for (;;) {
            display.setCursor(prompt.length + name.length, row);
            const key = await nhgetch();
            if (key === 10 || key === 13) break;
            if (key === 8 || key === 127) {
                if (name) {
                    name = name.slice(0, -1);
                    display.putstr(prompt.length + name.length, row, ' ', NO_COLOR);
                }
            } else if (key >= 32 && key <= 126 && name.length < 31) {
                name += String.fromCharCode(key);
                display.putstr(prompt.length + name.length - 1, row,
                    String.fromCharCode(key), NO_COLOR);
            }
        }
        return parseCharacterName(name || 'player');
    }

    run(): Promise<void> {
        if (!this.runningTask) this.runningTask = this.runGame();
        return this.runningTask;
    }

    async runGame(): Promise<void> {
        let started = false;
        try {
            started = await this.start();
            if (!started) return;
            while (!this.state.program_state?.gameover) await moveloop_core();
        } catch (error) {
            if (error instanceof PanicTermination)
                this.lastRunResult = { kind: 'panicked', reason: error.message, stack: error.stack };
            throw error;
        } finally {
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

    async runUntilInputNeeded(): Promise<EngineRunResult> {
        const stopped = this.run().then((): EngineRunResult => ({ kind: 'stopped' }));
        const inputNeeded = this.inputGate.waitUntilBlocked()
            .then((): EngineRunResult => ({ kind: 'input-needed' }));
        this.lastRunResult = await Promise.race([stopped, inputNeeded]);
        return this.lastRunResult;
    }

    getScreens(): string[] { return this.capture.screens; }
    getCursors(): CaptureCursor[] { return this.capture.cursors; }
    getRngLog(): string[] { return this.rngLog; }
    // Per-step PRNG slices, parallel to getScreens(). Each entry is the
    // log of PRNG calls that fired since the previous capture (i.e.
    // since the previous nhgetch). Useful for tooling like the PS
    // visualizer that wants to attribute calls to individual keystrokes;
    // the judge ignores this and uses getRngLog() flat.
    getRngSlices(): string[][] { return this.capture.rngSlices; }
    // Per-step animation frames, parallel to getScreens().  Each entry
    // is the array of frames captured (via animationFrame()) between
    // the previous input boundary and this one — i.e. the intermediate
    // display states for that step's animation.  Empty inner arrays
    // for steps that didn't animate.  SUPPLEMENTAL metric — not part
    // of the official ranking; see API.md.
    getAnimationFramesByStep(): AnimationFrame[][] {
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
export async function runSegment(input: SegmentInput): Promise<Engine> {
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
