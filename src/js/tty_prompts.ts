// Top-line key prompts used by commands which can pause for input.
// C refs: win/tty/topl.c more() and win/tty/wintty.c tty_nhgetch().

import { bot, clearMessageWindow, docrt, flushPendingTopline, flush_screen, pline, renderKeyPrompt, setTopline } from './display.js';
import { CLICK_1, CLICK_2, DIRECTION_KEYS, LOOK_ONCE, LOOK_QUICK, N_DIRS, xdir, ydir, zdir } from './const.js';
import { game } from './gstate.js';
import { selectMapPosition } from './getpos.js';
import { clearCommandKeys, readchar, takeCommandKey, takeCommandResponse } from './input.js';
import type { CommandDirection } from './input.js';
import { promptedDirectionKey, visibleCommandKey } from './command_keys.js';
import { MONSTER_NAME } from './monster_data.js';
import { rn2 } from './rng.js';
import { showTextPages } from './windows.js';
import type { TextPage } from './windows.js';
import type { Hero } from './hero_types.js';
import { rememberCommandKey, takeRepeatCommand } from './command_repeat.js';
import { keyText } from './prevmsg.js';
import { controlKeyHintLines } from './command_help.js';

export interface DirectionSelection {
    key: string;
    dx: number;
    dy: number;
    dz: number;
}
export type DirectionKeyReader = (message: string) => string | number | Promise<string | number>;

const GRID_BUG = MONSTER_NAME.indexOf('grid bug');
const impairedDirections = [
    [-1, 0], [0, -1], [1, 0], [0, 1],
    [-1, -1], [1, -1], [1, 1], [-1, 1],
] as const;

async function paintKeyPrompt(message: string, cursorOffset = 0): Promise<number> {
    await setTopline(message);
    await flush_screen(1);
    return renderKeyPrompt(message, cursorOffset);
}

export async function promptKey(message: string, cursorOffset = 0): Promise<number> {
    // C cmd.c:yn_function() answers from the command queue without ever
    // reaching tty_yn_function(); gt.toplines is untouched then.
    const queuedKey = takeCommandKey();
    if (queuedKey !== undefined) return queuedKey;
    // tty_yn_function() with a null response list goes straight from its
    // custompline(SUPPRESS_HISTORY) prompt to readchar() and clean_up:
    // ^P has no special meaning and comes back as the answer.
    game._suppressMessagesUntilInput = false;
    const coveredRows = await paintKeyPrompt(message, cursorOffset);
    // tty_yn_function() uses readchar(), including its EOF and fuzzer rules.
    const key = await readchar();
    // Fuzzer input bypasses nhgetch(); tty_yn_function's cleanup still marks
    // its question as read.
    if (game._pending_message) {
        game._retained_message = game._pending_message;
        game._pending_message = '';
    }
    // clean_up rewrites gt.toplines with the prompt and its recorded answer.
    game._toplines = `${message}${keyText(key)}`;
    // C tty_yn_function() retains a one-line query, but clears wrapped ones.
    if (coveredRows > 1) clearMessageWindow(coveredRows);
    return key;
}

// C cmd.c:getdir() removes its query immediately after receiving a key,
// before interpreting that key as a direction, cancellation, or help.
export async function readDirectionKey(message = 'In what direction? ') {
    // C cmdq_pop() selects CQ_REPEAT during do-again, otherwise CQ_CANNED.
    if (game._inDoAgain) {
        const queued = takeRepeatCommand();
        if (queued) return queued.kind === 'key' ? queued.key : 27;
    } else {
        const queued = takeCommandResponse();
        if (typeof queued === 'number') return queued;
        if (typeof queued === 'object') return queuedDirectionKey(queued);
        if (queued !== undefined) {
            clearCommandKeys();
            return 0;
        }
    }
    // tty_yn_function() skips an unread topline stopped by Escape, then
    // clears WIN_STOP before painting its question.
    if (game._suppressMessagesUntilInput) clearMessageWindow();
    else await flushPendingTopline();
    game._suppressMessagesUntilInput = false;
    await paintKeyPrompt(message);
    const key = (await readchar('direction')) & 255;
    if (game.commandBindings.lookup(key)?.command?.handler !== 'doredraw')
        rememberCommandKey(key);
    // getdir() asks through yn_function(), whose clean_up rewrites
    // gt.toplines with the prompt and its recorded answer.
    game._toplines = `${message}${keyText(key)}`;
    clearMessageWindow();
    return key;
}

// C getdir() converts CMDQ_DIR through xytodir() and Cmd.dirchars only
// when it needs the direction; other prompts must keep its entry type.
function queuedDirectionKey({ dx, dy, dz }: CommandDirection): number {
    const direction = dz ? zdir.findIndex(z => z === Math.sign(dz))
        : xdir.findIndex((x, index) => index < N_DIRS && x === dx && ydir[index] === dy);
    // A distant vector yields DIR_ERR. The pinned recorder reads NUL at
    // dirchars[-1] and cancels silently; avoid that out-of-bounds read.
    return direction < 0 ? 0 : game.commandBindings.directionKeys.charCodeAt(direction);
}

export interface DirectionPromptOptions {
    // C getdir callers pass a prompt starting with '^' (doidtrap) so that
    // help_dir() explains control-key forms of mistyped letters.
    ctrlCommandHint?: boolean;
}

export async function promptDirection(
    readKey: DirectionKeyReader = readDirectionKey,
    { ctrlCommandHint = false }: DirectionPromptOptions = {},
): Promise<DirectionSelection | null> {
    for (;;) {
        const key = await readKey('In what direction? ');
        const code = (typeof key === 'number' ? key : String(key).charCodeAt(0)) & 255;
        if (game.commandBindings.lookup(code)?.command?.handler === 'doredraw') {
            await restoreCommandMap();
            continue;
        }
        const direction = promptedDirectionKey(code, game.commandBindings);
        const hero = game.u;
        if (direction !== '.' && code === game.commandBindings.specialKey('getdir.mouse'))
            return promptClickDirection();
        hero.dz = 0;
        const vector = DIRECTION_KEYS[direction];
        if (vector) {
            [hero.dx, hero.dy] = vector;
            if (hero.umonnum === GRID_BUG && hero.dx && hero.dy) {
                hero.dx = hero.dy = 0;
                await pline("You can't orient yourself that direction.");
                return null;
            }
        } else if (direction === '.') hero.dx = hero.dy = 0;
        else if (direction === '<' || direction === '>') {
            hero.dx = hero.dy = 0;
            hero.dz = direction === '<' ? -1 : 1;
        } else {
            // C getdir() skips invalid-direction help for all quitchars, including NUL.
            if ([0, 27, 32, 10, 13].includes(code)) return null;
            const helpRequested = code === game.commandBindings.specialKey('getdir.help');
            if (helpRequested || game.flags?.cmdassist !== false) {
                // cmd.c:4101 passes the typed key to help_dir() whenever the
                // caller prompt starts with '^', explicit help included.
                const assistPage = directionAssistPage(!helpRequested,
                    ctrlCommandHint ? code : null);
                await showTextPages([assistPage], {
                    validKeys: [27, 32, 10, 13],
                });
                await restoreCommandMap();
            } else await pline('What a strange direction!');
            if (helpRequested) continue;
            return null;
        }
        if (!hero.dz) confusePromptDirection(hero);
        return { key: direction, dx: hero.dx, dy: hero.dy, dz: hero.dz };
    }
}

// C getdir's simulated click returns directly from getpos: it bypasses
// both the grid-bug movement restriction and confusion redirection.
async function promptClickDirection(): Promise<DirectionSelection | null> {
    const bindings = game.commandBindings;
    const goal = `desired location, then type '${visibleCommandKey(
        bindings.specialKey('getpos.pick.quick') ?? 0,
    )}' for left click, '${visibleCommandKey(
        bindings.specialKey('getpos.pick') ?? 0,
    )}' for right`;
    const selected = await selectMapPosition({
        start: { x: game.u.ux, y: game.u.uy },
        prompt: `Move cursor to ${goal}:`, goal,
    });
    const hero = game.u;
    if (!selected) {
        hero.dx = hero.dy = hero.dz = 0;
        if (game.iflags.getdir_click) game.iflags.getdir_click = 0;
        return null;
    }
    hero.dx = selected.x - hero.ux;
    hero.dy = selected.y - hero.uy;
    hero.dz = 0;
    if (game.iflags.getdir_click) {
        game.iflags.getdir_click = selected.pickType === LOOK_QUICK
            || selected.pickType === LOOK_ONCE ? CLICK_1 : CLICK_2;
    } else {
        hero.dx = Math.sign(hero.dx);
        hero.dy = Math.sign(hero.dy);
    }
    return { key: '_', dx: hero.dx, dy: hero.dy, dz: hero.dz };
}

// C getdir() calls confdir(FALSE) even for self, but never for up/down.
export function confusePromptDirection(hero: Hero, forceImpairment = false): void {
    const stunned = hero.stunned || (hero.stunnedTurns ?? 0) > 0;
    const confused = hero.confused || (hero.confusionTurns ?? 0) > 0;
    if (!forceImpairment && !stunned && !(confused && !rn2(5))) return;
    const count = hero.umonnum === GRID_BUG ? 4 : 8;
    const vector = impairedDirections[rn2(count)];
    if (!vector) throw new Error('The confused direction is outside the movement table');
    [hero.dx, hero.dy] = vector;
}

export async function restoreCommandMap() {
    await docrt();
    await bot();
    await flush_screen(1);
}

// C help_dir(): use the current movement bindings and hide diagonals when
// the hero's body cannot use them. Explicit help omits the error heading.
export function directionAssistPage(invalidDirection = true, ctrlHintKey: number | null = null): TextPage {
    const bindings = game.commandBindings;
    const key = (direction: number) => visibleCommandKey(bindings.keyForDirection(direction) ?? 0);
    const lines = invalidDirection ? ['cmdassist: Invalid direction key!', ''] : [];
    if (ctrlHintKey !== null) lines.push(...controlKeyHintLines(ctrlHintKey));
    lines.push(`Valid direction keys${game.u.umonnum === GRID_BUG ? ' in your current form' : ''} are:`);
    if (game.u.umonnum === GRID_BUG) {
        lines.push(`             ${key(2)}   `, '             |   ',
            `          ${key(0)}- . -${key(4)}`, '             |   ',
            `             ${key(6)}   `);
    } else {
        lines.push(`          ${key(1)}  ${key(2)}  ${key(3)}`,
            '           \\ | / ', `          ${key(0)}- . -${key(4)}`,
            '           / | \\ ', `          ${key(7)}  ${key(6)}  ${key(5)}`);
    }
    const self = visibleCommandKey(bindings.specialKey(
        bindings.numberPad ? 'getdir.self2' : 'getdir.self',
    ) ?? 0);
    lines.push('', '          <  up', '          >  down',
        `       ${self.padStart(4)}  direct at yourself`);
    if (invalidDirection)
        lines.push('', '(Suppress this message with !cmdassist in config file.)');
    while (lines.length < 23) lines.push('');
    lines.push('--More--');
    return { lines, cursor: [8, 23] };
}
