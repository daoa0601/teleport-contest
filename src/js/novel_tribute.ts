// C do_name.c:noveltitle() and files.c:set_bonesfile_name()/delete_bonesfile()/
// paniclog()/choose_passage()/read_tribute().
import { game } from './gstate.js';
import { plineWithContinuation } from './pline.js';
import { putMessageHistory } from './topl.js';
import { rn2 } from './rng.js';
import { NOVEL_PASSAGES } from './tribute_data.js';
import { showTextMenuOverlay } from './windows.js';
import type { GameState } from './game_state.js';
import { PANICLOG, PATCHLEVEL, VERSION_MAJOR, VERSION_MINOR } from './const.js';
import { specialLevelAt, In_quest } from './dungeon.js';
import { PanicTermination } from './panic_termination.js';
import type { DungeonLocation } from './dungeon_types.js';
import type { GameObject } from './object_types.js';

// C files.c:set_bonesfile_name(): special levels keep their identity when
// dungeon generation changes their depth; quest bones also belong to a role.
export function bonesLevelId(location: DungeonLocation | undefined = game.u.uz): string {
    if (!location) throw new Error('Bones require an initialized dungeon location');
    const tag = game.dungeons[location.dnum]?.bonetag;
    if (!tag) return '';
    const role = In_quest(location) ? game.urole?.filecode : '0';
    if (role === undefined) throw new Error('Quest bones require an initialized role');
    const special = specialLevelAt(location);
    return `${tag}${role}.${special ? special.bonetag ?? '' : location.dlevel}`;
}


// Port only: browser-storage key for a bones level (C names a bones file).
export function bonesStorageKey(level: DungeonLocation | undefined = game.u.uz): string {
    return `teleport-bones:${bonesLevelId(level)}`;
}

// C files.c:open_bonesfile(): open the level's bones record. C builds the
// bones file name, uncompresses the file (no effect when absent), and hands
// back an NHFILE whose nullness the caller tests; the port reads the storage
// record built from the same name and returns the encoded payload, null
// when the level has no bones.
export function openBonesFile(level: DungeonLocation | undefined = game.u.uz): string | null {
    return game.storage?.getItem(bonesStorageKey(level)) ?? null;
}
// C files.c:delete_bonesfile()
export function deleteBonesLevel(): boolean {
    const storage = game.storage;
    if (!storage) return false;
    try {
        const key = bonesStorageKey();
        // Native unlink fails if another game has already consumed these bones.
        if (storage.getItem(key) === null) return false;
        storage.removeItem(key);
        return storage.getItem(key) === null;
    } catch (_error) {
        return false;
    }
}

// Part of C files.c:paniclog(): yyyymmdd+hhmmss timestamp (calendar.c) of the record.
function diagnosticDateTime(state: GameState): string {
    if (state.datetime) return state.datetime;
    const now = new Date();
    return [now.getFullYear(), now.getMonth() + 1, now.getDate(),
        now.getHours(), now.getMinutes(), now.getSeconds()]
        .map((value, index) => String(value).padStart(index ? 2 : 4, '0')).join('');
}

// C files.c:paniclog(): Web Storage record in place of the paniclog append.
// Web Storage retains semantic records. Native's Unix uid and paniclog header
// are not available in a browser; do not fabricate a native header.
export function paniclog(type: 'panic' | 'impossible' | 'yn debug', reason: string, state: GameState = game): void {
    if (state.program_state.in_paniclog) return;
    state.program_state.in_paniclog = true;
    try {
        const storage = state.storage;
        if (storage?.getItem && storage?.setItem) {
            const record = {
                type, reason, datetime: diagnosticDateTime(state),
                version: `${VERSION_MAJOR}.${VERSION_MINOR}.${PATCHLEVEL}`,
                player: state.plname || null,
                playmode: state.flags?.debug ? 'D' : state.flags?.explore ? 'X' : '-',
            };
            storage.setItem(PANICLOG, (storage.getItem(PANICLOG) || '')
                + JSON.stringify(record) + '\n');
        }
    } catch (error) {
        if (error instanceof PanicTermination) throw error;
        // Like a failed native log-file open, storage failure is nonfatal.
    }
    state.program_state.in_paniclog = false;
}

// C files.c:choose_passage(): pick an unread passage of a novel.
export function selectTributePassage(count: number, bookId: number, state: GameState): number {
    const tracking = state.context.novel ||= { id: 0, count: 0, pasg: [] };
    if (tracking.id !== bookId || !tracking.count) {
        tracking.id = bookId;
        tracking.pasg = [];
        let remaining = count;
        let slots = 20;
        for (let index = 1; index <= count; index++, remaining--) {
            if (count <= 20 || rn2(remaining) < slots) {
                tracking.pasg.push(index);
                slots--;
            }
        }
        tracking.count = tracking.pasg.length;
    }
    const index = rn2(tracking.count);
    const passage = tracking.pasg[index];
    const lastPassage = tracking.pasg[--tracking.count];
    if (passage === undefined || lastPassage === undefined)
        throw new Error('Novel passage selection is outside the unread passage list');
    tracking.pasg[index] = lastPassage;
    return passage;
}

// C files.c:read_tribute(): show a novel passage and file its attribution.
export async function readNovelTribute(book: GameObject, title: string, state: GameState = game) {
    const passages = NOVEL_PASSAGES[title];
    if (!passages?.length) {
        await plineWithContinuation(`It seems to be an incomprehensible foreign translation of "${title}"!`);
        return false;
    }
    const passage = selectTributePassage(passages.length, book.o_id, state);
    const lines = passages[passage - 1];
    if (!lines) throw new Error(`Novel ${title} has no passage ${passage}`);
    // C files.c:3601 outputs the passage with putstr().
    await showTextMenuOverlay(lines, { viaPutstr: true });
    let attribution = '';
    for (let index = lines.length - 1; index >= 0; index--) {
        const line = lines[index];
        if (line?.trim()) { attribution = line; break; }
    }
    attribution = attribution.includes('[') ? attribution.trim().replace(/\s+/gu, ' ')
        : `[${title}, by Terry Pratchett]`;
    attribution = attribution.replace(/\][^\]]*$/u, `; passage #${passage}]`);
    // C files.c: putmsghistory(lastline, FALSE) files the attribution for
    // ^P recall without displaying it.
    putMessageHistory(attribution);
    return true;
}
