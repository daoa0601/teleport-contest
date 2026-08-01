// priest.js — Runtime temple ownership and entry feedback.
// C refs: priest.c intemple()/findpriest()/has_shrine().  Level construction
// owns the room, altar, and resident; this module owns their live relationship
// with the hero after movement or a level transition.

import { game } from './gstate.js';
import { plineWithContinuation } from './display.js';
import { cansee } from './vision.js';
import { d, rn2 } from './rng.js';
import {
    A_NONE, AM_SHRINE, Amask2align, IS_ALTAR, ROOMOFFSET, TEMPLE,
} from './const.js';
import { roomForRoomno } from './room.js';

function sameLevel(left, right) {
    return (left?.dnum ?? 0) === (right?.dnum ?? 0)
        && (left?.dlevel ?? 1) === (right?.dlevel ?? 1);
}

function priestData(priest) {
    return priest?.epri || priest?.mextra?.epri || null;
}

function priestInOwnTemple(priest, roomno, state = game) {
    const epri = priestData(priest);
    if (!priest?.ispriest || !epri || epri.shroom !== roomno
        || !sameLevel(epri.shrlevel, state.u?.uz)) return false;
    return state.level?.at?.(priest.mx, priest.my)?.roomno === roomno;
}

function findPriest(roomno, state = game) {
    return state.level?.monsters?.find(priest => !priest.dead
        && priestInOwnTemple(priest, roomno, state)) || null;
}

function hasShrine(priest, state = game) {
    const epri = priestData(priest);
    const altar = epri && state.level?.at?.(epri.shrpos?.x, epri.shrpos?.y);
    return !!altar && IS_ALTAR(altar.typ) && !!(altar.flags & AM_SHRINE)
        && epri.shralign === Amask2align(altar.flags & ~AM_SHRINE);
}

export function priestAlignment(priest) {
    const alignment = priestData(priest)?.shralign ?? A_NONE;
    if (alignment === A_NONE) return A_NONE;
    return Math.sign(alignment);
}

function priestDeityName(priest, state = game) {
    const alignment = priestAlignment(priest);
    if (alignment === A_NONE) return 'Moloch';
    const key = alignment > 0
        ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
    return state.urole?.gods?.[key] || 'the gods';
}

export function priestIsCoaligned(priest, state = game) {
    return (state.u?.ualign?.type ?? A_NONE) === priestAlignment(priest);
}

export function visiblePriestName(priest, state = game) {
    if (!cansee(priest.mx, priest.my) || priest.minvis || priest.mundetected)
        return 'A nearby voice';
    const title = `${priest.mnum === 276 ? 'high ' : ''}${
        priest.female ? 'priestess' : 'priest'
    }`;
    return `The ${title} of ${priestDeityName(priest, state)}`;
}

function priestCanSpeak(priest, state = game) {
    return !state.u?.deaf && !state.u?.Deaf && !priest.msleeping
        && priest.mcanmove !== 0 && !(priest.mfrozen > 0);
}

// C intemple() keeps TEMPLE repeatable and rate-limits each class of entry
// message on the resident's epri record.  plineWithContinuation is important:
// an intone can fit beside a short Quest arrival line, while the following
// spoken greeting forces the tty More boundary before its own cooldown roll.
export async function intemple(roomno, state = game) {
    const priest = findPriest(roomno, state);
    if (!priest) {
        const eerie = rn2(4);
        if (eerie === 0)
            await plineWithContinuation('You have an eerie feeling...');
        else if (eerie === 1)
            await plineWithContinuation('You feel like you are being watched.');
        else if (eerie === 2)
            await plineWithContinuation('A shiver runs down your spine.');
        // Ghost creation remains with the monster-construction owner.  Keep
        // the source gate in stream even when it does not fire.
        rn2(5);
        return null;
    }

    const epri = priestData(priest);
    epri.intone_time ??= 0;
    epri.enter_time ??= 0;
    epri.peaceful_time ??= 0;
    epri.hostile_time ??= 0;
    const moves = state.moves ?? 0;
    const canSpeak = priestCanSpeak(priest, state);
    const shrined = hasShrine(priest, state);

    if (canSpeak && moves >= epri.intone_time) {
        await plineWithContinuation(
            `${visiblePriestName(priest, state)} intones:`,
        );
        epri.intone_time = moves + d(10, 500);
        epri.enter_time = 0;
    }

    if (moves >= epri.enter_time && canSpeak) {
        await plineWithContinuation(
            `"Pilgrim, you enter a ${shrined ? 'sacred' : 'desecrated'} place!"`,
        );
        epri.enter_time = moves + d(10, 100);
    }

    const coaligned = priestIsCoaligned(priest, state);
    const forbidding = !shrined || !coaligned
        || (state.u?.ualign?.record ?? 0) <= -4;
    const thisKey = forbidding ? 'hostile_time' : 'peaceful_time';
    const otherKey = forbidding ? 'peaceful_time' : 'hostile_time';
    if (moves >= epri[thisKey] || epri[otherKey] >= epri[thisKey]) {
        if (forbidding) {
            const strange = shrined && coaligned ? ' strange' : '';
            await plineWithContinuation(
                `You have a${strange} forbidding feeling...`,
            );
        } else {
            const article = (state.u?.ualign?.record ?? 0) >= 14
                ? 'a' : 'an unusual';
            await plineWithContinuation(
                `You experience ${article} sense of peace.`,
            );
        }
        epri[thisKey] = moves + d(10, 20);
        if (epri[thisKey] <= epri[otherKey])
            epri[otherKey] = epri[thisKey] - 1;
    }
    return priest;
}

export function templeRoomAt(state, x, y) {
    const roomno = state?.level?.at?.(x, y)?.roomno ?? 0;
    if (roomno >= ROOMOFFSET) {
        const room = roomForRoomno(state?.level, roomno);
        if (room?.rtype === TEMPLE) return { room, roomno };
    }

    // C's in_rooms() derives membership from the live room rectangles; it
    // does not require a precomputed levl[][] room number.  Static Lua maps
    // such as Pri-strt can retain roomno=0 on an interior temple cell, so use
    // the room geometry as the canonical fallback.
    const rooms = state?.level?.rooms || [];
    const index = rooms.findIndex(room => room?.rtype === TEMPLE
        && x >= room.lx && x <= room.hx
        && y >= room.ly && y <= room.hy);
    return index >= 0
        ? { room: rooms[index], roomno: index + ROOMOFFSET }
        : null;
}
