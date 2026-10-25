// jsmain.js — Per-game engine and contest adapter.
// C ref: unixmain.c — nethack_main() initialization and game setup.
import { game, resetGame } from './gstate.js';
import { createGameState } from './game_state.js';
import { createHeroState } from './hero_types.js';
import { initRng, enableRngLog, getRngLog } from './rng.js';
import { bindInputGate, InputGate, nhgetch } from './input.js';
import { bindLuaLifecycle, LuaLifecycle } from './lua/lifecycle.js';
import { bindPlayStep, newgame, restoregamePreamble, runMoveloopCore } from './allmain.js';
import { parseNethackOptions, parseNethackrc } from './options.js';
import { displayConfigurationErrors } from './config_errors.js';
import { parseCharacterName } from './character_name.js';
import { GameDisplay } from './game_display.js';
import { DEC_TO_UNICODE, KEY_BINDINGS, NO_COLOR } from './terminal.js';
import { askAboutPanicSave, dismissUnhealthyRestore, hasErrorSave, restoreGame, restoreRefusedAsUnhealthy } from './save.js';
import { PanicTermination } from './panic_termination.js';
import { discardTutorialState } from './tutorial_state.js';
import { initializeFruitRegistry } from './fruit.js';
import { selectCharacter } from './character_selection.js';
const UNICODE_TO_DEC = new Map(Object.entries(DEC_TO_UNICODE).map(([dec, unicode]) => [unicode, dec]));
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
        // C seeds both RNG streams inside initoptions_init() before
        // initoptions_finish() runs rcfile(); a CHOOSE= statement consumes
        // the first core draws during config parsing.
        initRng(this._seed);
        this.coreRng = g.coreCtx;
        this.displayRng = g.displayCtx;
        enableRngLog();
        // Parse nethackrc
        const opts = parseNethackrc(this._nethackrc, {
            fileName: this._nethackrcFileName,
        });
        // Install the terminal before character creation because an unset
        // OPTIONS=name opens the editable "Who are you?" prompt.
        g.nhDisplay = this.display;
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
        // The `-D`/playmode:debug startup path uses the traditional fixed
        // player name "wizard", regardless of OPTIONS=name.
        let configuredName = parseCharacterName(opts.flags.debug ? 'wizard' : opts.name);
        for (;;) {
            if (configuredName.role)
                opts.role = configuredName.role;
            if (configuredName.race)
                opts.race = configuredName.race;
            if (configuredName.gender)
                opts.gender = configuredName.gender;
            if (configuredName.align)
                opts.align = configuredName.align;
            if (configuredName.name)
                break;
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
        const restored = restoreGame(playerName, this.storage);
        // C dorecover() shows the refusal message and waits for its
        // dismissal key before the game falls through to a new character.
        if (restoreRefusedAsUnhealthy())
            await dismissUnhealthyRestore(playerName, this.storage);
        if (restored) {
            await restoregamePreamble();
            return true;
        }
        const selected = await selectCharacter(opts, () => this._readPlayerName(10, false));
        if (!selected)
            return false;
        const { role, race, gender, alignment } = selected;
        playerName = selected.name;
        g.plname = playerName;
        g.displayName = playerName.charAt(0).toUpperCase() + playerName.slice(1);
        g.urole = role;
        if (g.urole?.key === 'samurai'
            && !Object.prototype.hasOwnProperty.call(opts.flags, 'pickup')) {
            g.flags.pickup = false;
        }
        g.urace = race;
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
        g.rogueSymset = opts.rogueSymset || null;
        if (opts.boulderSym !== undefined)
            g.boulderSym = opts.boulderSym;
        if (opts.rogueBoulderSym !== undefined)
            g.rogueBoulderSym = opts.rogueBoulderSym;
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
                const typed = String.fromCharCode(key);
                // Unix tty_askname() normalizes before echoing or parsing
                // suffixes; a leading digit would make save names ambiguous.
                const allowed = /^[A-Za-z@-]$/.test(typed)
                    || name.length > 0 && /^[0-9]$/.test(typed);
                const character = allowed ? typed : '_';
                name += character;
                display.putstr(prompt.length + name.length - 1, row, character, NO_COLOR);
            }
        }
        return parseCharacterName(name || 'player');
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
                await runMoveloopCore();
        }
        catch (error) {
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
export class NethackGame {
    _pendingDisplay = null;
    _pendingStorage = null;
    _storage;
    engine = null;
    options;
    constructor(options = {}) {
        this.options = options;
        this._storage = options.storage ?? null;
    }
    // Runs the game up to its first key request. Each later moveloop_core()
    // call reads one key from the display and runs to the next request.
    async start() {
        const display = this._pendingDisplay ?? game.nhDisplay ?? new GameDisplay(null);
        const engine = new Engine({
            seed: this.options.seed ?? 0,
            datetime: this.options.datetime ?? null,
            nethackrc: this.options.nethackrc ?? '',
            storage: this._pendingStorage ?? this._storage,
            display,
        });
        this.engine = engine;
        const advance = async () => {
            // A refused character or panic save stops without a gameover.
            if ((await engine.runUntilInputNeeded()).kind !== 'input-needed')
                engine.state.program_state.gameover = true;
        };
        await advance();
        bindPlayStep({
            state: engine.state,
            step: async () => {
                if (engine.state.program_state.gameover)
                    return;
                engine.inputGate.feedOne(await display.readKey({ bindings: KEY_BINDINGS.VI_KEYS }));
                await advance();
            },
        });
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