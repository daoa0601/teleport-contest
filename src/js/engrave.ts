// engrave.js — Shared engraving storage, wear, and reading.
// C refs: engrave.c make_engr_at(), wipe_engr_at(), read_engr_at();
//         hack.c maybe_smudge_engr().

import { formatSeenMessage } from './hero_speech.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameMap } from './game.js';
import type { Engraving } from './map_types.js';
import type { MessagePublisher } from './display.js';
import { exerciseWisdom } from './attrib.js';
import { heroCanReachFloor } from './floor_reach.js';
import { rn2, rnd } from './rng.js';
import { BUFSZ, DUST, ENGRAVE, BURN, MARK, ENGR_BLOOD, HEADSTONE, N_ENGRAVE } from './const.js';
import { surfaceName } from './terrain_name.js';
import { isIceAt } from './terrain_properties.js';

type EngravingStore = Pick<GameMap, 'engravings'>;

const RUBOUTS = new Map([
    ['A', '^'],
    ['B', 'Pb['],
    ['C', '('],
    ['D', '|)['],
    ['E', '|FL[_'],
    ['F', '|-'],
    ['G', 'C('],
    ['H', '|-'],
    ['I', '|'],
    ['K', '|<'],
    ['L', '|_'],
    ['M', '|'],
    ['N', '|\\'],
    ['O', 'C('],
    ['P', 'F'],
    ['Q', 'C('],
    ['R', 'PF'],
    ['T', '|'],
    ['U', 'J'],
    ['V', '/\\'],
    ['W', 'V/\\'],
    ['Z', '/'],
    ['b', '|'],
    ['d', 'c|'],
    ['e', 'c'],
    ['g', 'c'],
    ['h', 'n'],
    ['j', 'i'],
    ['k', '|'],
    ['l', '|'],
    ['m', 'nr'],
    ['n', 'r'],
    ['o', 'c'],
    ['q', 'c'],
    ['w', 'v'],
    ['y', 'v'],
    [':', '.'],
    [';', ',:'],
    [',', '.'],
    ['=', '-'],
    ['+', '-|'],
    ['*', '+'],
    ['@', '0'],
    ['0', 'C('],
    ['1', '|'],
    ['6', 'o'],
    ['7', '/'],
    ['8', '3o'],
]);

export function engravingAt(
    x: number,
    y: number,
    level: EngravingStore | null = game.level,
): Engraving | null {
    return level?.engravings?.find((engraving) => engraving.x === x && engraving.y === y) || null;
}

export function hasCompletedEngraving(
    text: string,
    x: number,
    y: number,
    state: Pick<GameState, 'level' | 'moves'> = game,
): boolean {
    const engraving = engravingAt(x, y, state.level);
    return (
        !!engraving &&
        engraving.engr_type !== HEADSTONE &&
        (engraving.epoch ?? 0) <= (state.moves ?? 0) &&
        engraving.text.toLowerCase() === text.toLowerCase()
    );
}

export function deleteEngravingAt(
    x: number,
    y: number,
    level: EngravingStore | null = game.level,
): boolean {
    if (!level?.engravings) return false;
    const engraving = engravingAt(x, y, level);
    if (!engraving) return false;
    level.engravings = level.engravings.filter((candidate) => candidate !== engraving);
    return true;
}

// C engrave.c del_engr(): unlink one known engraving unconditionally.
export function deleteEngraving(
    engraving: Engraving,
    level: EngravingStore | null = game.level,
): boolean {
    if (!level?.engravings?.includes(engraving)) return false;
    level.engravings = level.engravings.filter((candidate) => candidate !== engraving);
    return true;
}

export function makeEngravingAt(
    x: number,
    y: number,
    text: string,
    pristine: string | null = null,
    epoch = 0,
    engrType = ENGRAVE,
    { nowipeout = false, guardobjects = false } = {},
): Engraving | null {
    if (!game.level) return null;
    if (!game.level.engravings) game.level.engravings = [];
    game.level.engravings = game.level.engravings.filter(
        (engraving) => engraving.x !== x || engraving.y !== y,
    );
    if (text === 'Elbereth') {
        if (game.in_mklev) guardobjects = true;
        else exerciseWisdom(true, game);
    }
    const engraving: Engraving = {
        x,
        y,
        text,
        pristine: pristine ?? text,
        rememberedText: text,
        epoch,
        engr_type: engrType > 0 ? engrType : rnd(N_ENGRAVE - 1),
        nowipeout,
        guardobjects,
        eread: false,
        erevealed: false,
    };
    game.level.engravings.unshift(engraving);
    return engraving;
}

// C ref: engrave.c wipeout_text().
export function wipeoutText(text: string, count: number, seed = 0): string {
    seed >>>= 0;
    const chars = [...text];
    const length = chars.length;
    while (length && count-- > 0) {
        let next, useRubout;
        if (seed) {
            next = seed % length;
            seed = (Math.imul(seed, 31) >>> 0) % 255;
            useRubout = seed & 3;
        } else {
            next = rn2(length);
            useRubout = rn2(4);
        }
        const ch = chars[next];
        if (ch === undefined)
            throw new RangeError(`Wipeout selected character ${next} outside the text`);
        if (ch === ' ') continue;
        if ("?.,'`-|_".includes(ch)) {
            chars[next] = ' ';
            continue;
        }
        const replacements = useRubout ? RUBOUTS.get(ch) : null;
        if (replacements) {
            if (seed) {
                seed = (Math.imul(seed, 31) >>> 0) % 255;
                chars[next] = replacements.charAt(seed % replacements.length);
            } else {
                chars[next] = replacements.charAt(rn2(replacements.length));
            }
        } else {
            chars[next] = '?';
        }
    }
    return chars.join('').replace(/ +$/, '');
}

export function wipeEngravingAt(
    x: number,
    y: number,
    count: number,
    magical = false,
    level: GameMap | null = game.level,
): boolean {
    if (!level?.engravings) return false;
    const engraving = engravingAt(x, y, level);
    if (!engraving || engraving.engr_type === HEADSTONE || engraving.nowipeout) return false;

    const onIce = isIceAt(x, y, { level });
    if (engraving.engr_type === BURN && !onIce && !(magical && rn2(2) === 0)) return false;

    if (engraving.engr_type !== DUST && engraving.engr_type !== ENGR_BLOOD) {
        const range = 1 + Math.trunc(50 / (count + 1));
        count = rn2(range) ? 0 : 1;
    }
    const wornText = wipeoutText(engraving.text || '', count);
    const leadingSpaces = wornText.length - wornText.replace(/^ +/, '').length;
    engraving.text = wornText.slice(leadingSpaces);
    // Only the actual-text pointer advances; pristine text stays at its
    // buffer start. Saving later rewinds the live actual-text pointer.
    engraving.erasedPrefix = (engraving.erasedPrefix ?? '') + wornText.slice(0, leadingSpaces);
    if (!engraving.text) {
        level.engravings = level.engravings.filter((candidate) => candidate !== engraving);
    }
    return true;
}

// C engrave.c:save_engravings(). Writing resets the live pointer, including
// checkpoint writes which leave the hero on the same level. Both actual
// and remembered text return to their separate buffer starts.
export function rewindEngravingsForSave(level: EngravingStore | null): void {
    for (const engraving of level?.engravings ?? []) {
        engraving.text = (engraving.erasedPrefix ?? '') + engraving.text;
        delete engraving.erasedPrefix;
        engraving.rememberedText = (engraving.rememberedPrefix ?? '') + engraving.rememberedText;
        delete engraving.rememberedPrefix;
    }
}

// C engrave.c:rest_engravings(). The three text buffers are saved separately.
export function restoreEngravingPointers(level: EngravingStore | null): void {
    for (const engraving of level?.engravings ?? []) {
        const text = engraving.text.replace(/^ +/, '');
        engraving.erasedPrefix = (engraving.erasedPrefix ?? '')
            + engraving.text.slice(0, engraving.text.length - text.length);
        engraving.text = text;
        const rememberedText = engraving.rememberedText.replace(/^ +/, '');
        engraving.rememberedPrefix = (engraving.rememberedPrefix ?? '')
            + engraving.rememberedText.slice(0, engraving.rememberedText.length - rememberedText.length);
        engraving.rememberedText = rememberedText;
    }
}

// C engrave.c:u_wipe_engr().
export function wipeHeroEngraving(count: number, state: GameState = game): boolean {
    if (!heroCanReachFloor(state, { checkPit: true })) return false;
    return wipeEngravingAt(state.u.ux, state.u.uy, count, false, state.level);
}

// C's function-call argument is evaluated before wipeEngravingAt() discovers
// nowipeout.  Lua tutorial engravings therefore still own rnd(5) when an
// explicit movement leaves or enters one, despite degrade=false.
export function maybeSmudgeEngravings(x1: number, y1: number, x2: number, y2: number): void {
    if (!heroCanReachFloor(game, { checkPit: true })) return;
    const departure = engravingAt(x1, y1);
    if (departure && departure.engr_type !== HEADSTONE) wipeEngravingAt(x1, y1, rnd(5), false);
    const arrival = engravingAt(x2, y2);
    if ((x2 !== x1 || y2 !== y1) && arrival && arrival.engr_type !== HEADSTONE) {
        wipeEngravingAt(x2, y2, rnd(5), false);
    }
}

function readingMessages(
    engraving: Engraving,
    x: number,
    y: number,
): { first: string; second: string } | null {
    const blind = !!game.blind;
    const canFeel = heroCanReachFloor(game, { checkPit: true });
    const surface = surfaceName(x, y, game);
    let first = null;
    switch (engraving.engr_type) {
        case DUST:
            if (!blind)
                first = `Something is written here in the ${
                    isIceAt(x, y) ? 'frost' : 'dust'
                }.`;
            break;
        case ENGRAVE:
        case HEADSTONE:
            if (!blind || canFeel) first = `Something is engraved here on the ${surface}.`;
            break;
        case BURN:
            if (!blind || canFeel)
                first = `Some text has been ${
                    isIceAt(x, y) ? 'melted' : 'burned'
                } into the ${surface} here.`;
            break;
        case MARK:
            if (!blind) first = `There's some graffiti on the ${surface} here.`;
            break;
        case ENGR_BLOOD:
            if (!blind) first = formatSeenMessage('a message scrawled in blood here.');
            break;
        default:
            first = 'Something is written here in a very strange way.';
            break;
    }
    if (!first) return null;

    const text = engraving.text.slice(0, BUFSZ - 'You feel the words: "".'.length - 1);
    const punctuation =
        text.length >= 2 &&
        /[.!?]$/.test(text) &&
        engraving.pristine[(engraving.erasedPrefix?.length ?? 0) + text.length - 1] === text[text.length - 1]
            ? ''
            : '.';
    const second = blind
        ? `You feel the words: "${text}"${punctuation}`
        : `You read: "${text}"${punctuation}`;
    return { first, second };
}

// Native read_engr_at() sends two separate messages. The terminal decides
// whether each fits beside earlier prose before it asks for acknowledgement.
export async function readEngravingAt(
    x: number,
    y: number,
    publish: MessagePublisher,
): Promise<boolean> {
    const engraving = engravingAt(x, y);
    if (!engraving?.text) return false;
    const messages = readingMessages(engraving, x, y);
    if (!messages) return false;
    await publish(messages.first);
    await publish(messages.second);
    engraving.rememberedText = engraving.text;
    engraving.eread = true;
    engraving.erevealed = true;
    return true;
}
