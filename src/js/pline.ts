// Message admission and publishing: C pline.c pline(), pline_dir(),
// pline_xy(), pline_mon(), set_msg_dir(), set_msg_xy(), vpline(), You_feel(),
// You_hear(), You_see(), verbalize(), gamelog_add(), and raw_printf().
import { game } from './gstate.js';
import { flush_screen } from './display.js';
import { vision_recalc } from './vision.js';
import { coordinateDescription } from './pager.js';
import { messageTypeFor } from './message_types.js';
import { heroIsBlind, heroIsDeaf, heroIsUnaware } from './senses.js';
import {
    displayMessageWindow, rememberToplines, replaceTopline, updateTopline,
} from './topl.js';
import { nhgetch, rawPrint, writeRawText } from './input.js';
import { BUFSZ, LL_NONE, MSGTYP_NORMAL, MSGTYP_NOREP, MSGTYP_NOSHOW, MSGTYP_STOP, PLNMSG_UNKNOWN, xdir, ydir } from './const.js';
import { isok } from './cmd.js';
import { NO_COLOR } from './terminal.js';
import type { Position } from './map_types.js';
import type { Hero } from './hero_types.js';
import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';

/** Message callers await publication but do not consume the producer's result. */
export type MessagePublisher = (message: string, options?: ToplineOptions) => unknown;

export interface ToplineOptions {
    noRepeat?: boolean;
    urgent?: boolean;
    overrideMessageType?: boolean;
    position?: Position;
}

// C pline.c:set_msg_dir(). The next vpline consumes the location, even when hidden.
export function set_msg_dir(direction: number): void {
    const previous = game.iflags.messageLocation ?? { x: 0, y: 0 };
    const dx = xdir[direction], dy = ydir[direction];
    game.iflags.messageLocation = {
        x: game.u.ux + (dx ?? previous.x), y: game.u.uy + (dy ?? previous.y),
    };
}

// C pline.c:set_msg_xy().
export function set_msg_xy(x: number, y: number): void {
    game.iflags.messageLocation = { x, y };
}

// C pline.c:pline() delegates message admission and publication to vpline().
export async function pline(msg: string): Promise<void> {
    await plineWithContinuation(msg);
}

// C pline.c:pline_dir().
export async function pline_dir(direction: number, message: string): Promise<void> {
    set_msg_dir(direction);
    await pline(message);
}

// C pline.c:pline_xy().
export async function pline_xy(x: number, y: number, message: string): Promise<void> {
    set_msg_xy(x, y);
    await pline(message);
}

// C pline.c:Norep(): pline() with PLINE_NOREPEAT — the message is
// suppressed when it repeats the previous individual message.
export async function norep(message: string): Promise<void> {
    if (game._lastPlineMessage !== message) await pline(message);
}

// C pline.c:pline_mon().
export async function pline_mon(monster: Monster | Hero, message: string): Promise<void> {
    if ('mx' in monster) set_msg_xy(monster.mx, monster.my);
    else set_msg_xy(0, 0);
    await pline(message);
}

// Part of C pline.c:vpline(): the BUFSZ-1 truncation shared by raw startup diagnostics.
// vpline()'s BUFSZ-1 byte truncate, shared with cfgfiles.c's raw startup
// diagnostics: shorten prose while retaining its last three bytes.
export function truncatePlineMessage(message: string): string {
    const text = message.split('\0', 1)[0] ?? '';
    const bytes = new TextEncoder().encode(text);
    if (bytes.length <= BUFSZ - 1) return text;
    const decoder = new TextDecoder();
    return `${decoder.decode(bytes.subarray(0, BUFSZ - 7))}...${decoder.decode(bytes.subarray(-3))}`;
}

// C pline.c:vpline(). Await the window port before recording the last
// message.  The empty-line guard `if (!line || !*line) return;` tests the
// caller's format: the port receives already-formatted text, so a direct
// empty message is dropped, while the `unpackedArgument` path below keeps
// vpline()'s substituted "%s" argument, which is never format-filtered.
export async function plineWithContinuation(msg: string, {
    noRepeat = false, urgent = false, overrideMessageType = false, position,
}: ToplineOptions = {}, unpackedArgument = false,
): Promise<number | null | undefined> {
    const location = position ?? game.iflags.messageLocation;
    delete game.iflags.messageLocation;
    msg = msg.split('\0', 1)[0] ?? '';
    if (!msg && !unpackedArgument) return;
    if (game.program_state.wizkit_wishing) return;
    if (game.flags.accessiblemsg && location && isok(location.x, location.y)) {
        const mode = game.iflags.getpos_coords;
        const coordinates = coordinateDescription(location.x, location.y,
            !mode || mode === 'n' ? 'f' : mode);
        msg = `${coordinates}: ${msg}`;
    }
    const length = new TextEncoder().encode(msg).length;
    if (length > 5 * BUFSZ - 1) {
        // diagnostics.js statically imports this module; a static import
        // back would be a load cycle, so panic() is fetched lazily.
        const { panic } = await import('./diagnostics.js');
        await panic(`pline attempting to print ${length} characters!`);
    }
    msg = truncatePlineMessage(msg);
    if (game.program_state?.windows_exited) {
        rawPrint(msg);
        game._lastPlineKind = PLNMSG_UNKNOWN;
        return;
    }
    const messageType = overrideMessageType ? MSGTYP_NORMAL
        : messageTypeFor(msg, noRepeat, game.iflags.messageTypes);
    if (!urgent && (messageType === MSGTYP_NOSHOW
        || (messageType === MSGTYP_NOREP && msg === game._lastPlineMessage))) return;
    if (urgent && game._suppressMessagesUntilInput) {
        game._suppressMessagesUntilInput = false;
        game._pending_message = '';
        game._retained_message = '';
    }
    // vpline() flushes the map before tty decides whether older prose needs
    // acknowledgment. Direct message-window display does not do this.
    if (game.vision_full_recalc) await vision_recalc(0);
    if (game.u.ux) await flush_screen(1);
    const dismissal = await updateTopline(msg, { urgent });
    // C pline.c tracks the last individual message, not the joined tty line.
    game._lastPlineMessage = msg;
    game._lastPlineKind = PLNMSG_UNKNOWN;
    return messageType === MSGTYP_STOP ? await displayMessageWindow() : dismissal;
}

// C hack.h:pline1(): the "%s" format wrapper macro.
// include/hack.h:1026 `#define pline1(cstr) pline("%s", cstr)`.  vpline()'s
// empty-line filter tests the "%s" format, never the substituted argument,
// so pline1("") still reaches putmesg("") and update_topl()'s append, which
// widens the topline by two blank columns without glyphs or a pager
// (eat.c:done_eating() relies on this while hurtle() has set nomovemsg="").
export async function pline1(msg: string, options: ToplineOptions = {},
): Promise<number | null | undefined> {
    return plineWithContinuation(msg, options, true);
}

// C pline.c:You_feel(). Sensations reach an unaware hero as dreams.
export function formatFeltMessage(text: string, state = game): string {
    return `${heroIsUnaware(state) ? 'You dream that you feel' : 'You feel'} ${text}`;
}

// Part of C pline.c:You_hear(): the pure formatter half (pline.c:436-452).
// Returns the exact line to publish, or null when the sound is
// suppressed: an awake deaf hero or disabled acoustics hears nothing; an
// unaware (sleeping, fainted, unconscious) hero only dreams the sound;
// being underwater muffles it.
export function formatHeardMessage(text: string, state = game) {
    const deaf = heroIsDeaf(state);
    const unaware = heroIsUnaware(state);
    if ((deaf && !unaware) || state.flags?.acoustics === false)
        return null;
    if (state.underwater || state.u?.uinwater)
        return `You barely hear ${text}`;
    if (unaware)
        return `You dream that you hear ${text}`;
    return `You hear ${text}`;
}

// C pline.c:You_hear(): format the sound line and publish it
// unless suppressed.
// Publishes through You_hear()'s own suppression. Callers must retain their
// C guards: an unconditional You_hear reaches a deaf unaware hero, but
// `if (!Deaf)` does not.
export async function publishHeardMessage(
    text: string, publish: MessagePublisher, state = game,
): Promise<void> {
    const message = formatHeardMessage(text, state);
    if (message) await publish(message);
}

// C pline.c:You_see(). Callers decide whether the event can be seen.
export function formatSeenMessage(text: string, state = game): string {
    if (heroIsUnaware(state)) return `You dream that you see ${text}`;
    if (heroIsBlind(state)) return `You sense ${text}`;
    return `You see ${text}`;
}

// C pline.c:verbalize(): the message goes out wrapped in quotes.
// The caller is responsible for checking deafness; gods can speak directly
// to the hero in spite of it.
export async function verbalize(message: string): Promise<void> {
    await pline(`"${message}"`);
}

// C pline.c:gamelog_add()
export function recordGameLogEvent(text: string, {
    state = game, turn = state.moves || 1, flags = LL_NONE,
}: {
    state?: Pick<GameState, 'gamelog' | 'moves'>; turn?: number; flags?: number;
} = {}) {
    if (!text) return null;
    if (!Array.isArray(state.gamelog)) state.gamelog = [];
    const entry = {
        turn: Math.max(1, Math.trunc(turn)),
        text: String(text),
        flags: Math.trunc(flags) || LL_NONE,
    };
    state.gamelog.push(entry);
    return entry;
}

// Port only: expose the saved gamelog chronicle, oldest first.
// The saved chronicle lines, oldest first: insight.c:do_gamelog()/
// show_gamelog()'s input. Entries saved before flags were tracked carry
// none, so they count as ordinary non-spoiler lines.
export function gameLogEvents(state = game) {
    return Array.isArray(state.gamelog) ? state.gamelog : [];
}

// Port only: prompt owners replace the topline without tty's
// update_topl negotiation (tty_putstr with ATR_NOHISTORY shape).
// Replace the message line without tty's update_topl() negotiation. Only the
// tty topline owner, its direct pagers, and prompt owners (whose native
// TOPLINE_SPECIAL_PROMPT text never pages) write the line this way.
export async function setTopline(msg: string) {
    if (game.program_state?.windows_exited) {
        if (msg) {
            rawPrint(msg);
            game._lastPlineKind = PLNMSG_UNKNOWN;
        }
        return;
    }
    // C pline.c:vpline() resolves any pending blocker/light change before it
    // flushes the map or negotiates tty's previous-topline pager.
    if (game.vision_full_recalc) await vision_recalc(0);
    if (game.u.ux) await flush_screen(1);
    // Every caller models a tty_putstr(WIN_MESSAGE, ATR_NOHISTORY) prompt:
    // remember_topl() archives the negotiated line, and the prompt itself
    // is shown without being remembered.
    rememberToplines();
    replaceTopline(msg);
    game._lastPlineMessage = msg;
    game._lastPlineKind = PLNMSG_UNKNOWN;
}

// Part of C pline.c:vraw_printf(): the BUFSZ-1 prefix truncation also used by files.c:paniclog().
// vraw_printf()'s BUFSZ-1 byte truncate, shared with files.c:paniclog()'s
// yn-debug line: keep only the prefix, with no ellipsis.
export function truncateRawMessage(message: string): string {
    const bytes = new TextEncoder().encode(message.split('\0', 1)[0] ?? '');
    return new TextDecoder().decode(bytes.subarray(0, BUFSZ - 1));
}

// C pline.c:raw_printf()/vraw_printf().
export function rawPrintf(message: string): void {
    rawPrint(truncateRawMessage(message));
    // Both raw_printf() and vraw_printf() increment the early-message count.
    if (!game.program_state.beyond_savefile_load) game.earlyRawMessages += 2;
}



// Part of C end.c:panic(): "Oops..." window-exit preamble, with
// win/tty/wintty.c:getret(); the full port is diagnostics.ts:panic().
// The browser has no host tty to restore after exit_nhwindows(). Keep the
// terminal diagnostic separate from map/status output, with Native's getret.
export async function beginPanicOutput() {
    if (!game.nhDisplay) return;
    rawPrint('\r\nOops...');
    writeRawText('\nHit space to continue: ');
    game._suppressMessagesUntilInput = false;
    let key;
    do key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
    game._pending_message = '';
    game._retained_message = '';
    game.nhDisplay.clearScreen();
    game.program_state.windows_exited = true;
}
