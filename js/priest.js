// priest.js — Runtime temple ownership and entry feedback.
// C refs: priest.c intemple()/findpriest()/has_shrine().  Level construction
// owns the room, altar, and resident; this module owns their live relationship
// with the hero after movement or a level transition.
import { formatFeltMessage } from './hero_speech.js';
import { game, requireGameLevel, requireInitializedGame, requireLiveGame } from './gstate.js';
import { deityName } from './alignment.js';
import { angerMonster, wakeMonster } from './monster_anger.js';
import { canSeeMonster, plineWithContinuation } from './display.js';
import { exerciseAttribute } from './attrib.js';
import { castMonsterSpellRay } from './breath_ray.js';
import { AT_MAGC, AD_ELEC } from './monster_attack_types.js';
import { cansee, couldsee } from './vision.js';
import { d, rn2 } from './rng.js';
import { A_NONE, A_WIS, AM_SHRINE, Amask2align, BOLT_LIM, D_CLOSED, D_LOCKED, IS_ALTAR, IS_DOOR, IS_OBSTRUCTED, LAVAWALL, TEMPLE, WATER, } from './const.js';
import { roomForRoomno, roomsAt } from './room.js';
import { MONSTER_FLAGS2 } from './monster_data.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { monsterName } from './monster_name.js';
const M2_MINION = 0x00001000;
const PM_DEATH = 311, PM_PESTILENCE = 312, PM_FAMINE = 313;
function sameLevel(left, right) {
    return (left?.dnum ?? 0) === (right?.dnum ?? 0)
        && (left?.dlevel ?? 1) === (right?.dlevel ?? 1);
}
function priestData(priest) {
    return priest?.epri || priest?.mextra?.epri || null;
}
function minionData(priest) {
    return priest?.emin || priest?.mextra?.emin || null;
}
function priestInOwnTemple(priest, roomno, state = game) {
    const epri = priestData(priest);
    if (!priest?.ispriest || !epri || epri.shroom !== roomno
        || !sameLevel(epri.shrlevel, state.u?.uz))
        return false;
    return roomsAt(state.level, priest.mx, priest.my, TEMPLE)[0] === roomno;
}
export function priestIsInOwnTemple(priest, state = game) {
    const roomno = roomsAt(state.level, priest?.mx, priest?.my, TEMPLE)[0];
    return roomno != null && priestInOwnTemple(priest, roomno, state);
}
function findPriest(roomno, state = game) {
    // makemon prepends to Native fmon; JS appends to the level array.
    const monsters = state.level?.monsters || [];
    for (let index = monsters.length - 1; index >= 0; index--) {
        const priest = monsters[index];
        if (priest && !priest.dead && priest.mhp > 0
            && priestInOwnTemple(priest, roomno, state))
            return priest;
    }
    return null;
}
// C priest.c:angry_priest(). A converted or destroyed altar frees its
// priest to roam instead of guarding a shrine which is no longer theirs.
export async function angerTemplePriest(state = game, onlyIfDifferent = false) {
    const temple = templeRoomAt(state, state.u.ux, state.u.uy);
    const priest = temple && findPriest(temple.roomno, state);
    if (!priest || onlyIfDifferent && priestIsCoaligned(priest, state))
        return;
    await wakeMonster(priest);
    await angerMonster(priest);
    const shrine = priestData(priest);
    if (!shrine)
        throw new Error('A temple resident requires its shrine record.');
    const altar = requireGameLevel(state).at(shrine.shrpos.x, shrine.shrpos.y);
    if (!altar)
        throw new Error('The priest shrine square is outside the current level.');
    if (!IS_ALTAR(altar.typ) || Amask2align(altar.flags) !== shrine.shralign) {
        priest.ispriest = 0;
        priest.isminion = 1;
        priest.emin = { min_align: shrine.shralign, renegade: 0 };
        priest.mextra = { ...priest.mextra, emin: priest.emin };
        delete priest.epri;
        delete priest.mextra.epri;
    }
}
// C priest.c:clearpriests(). Bones must not retain a priest tied to another level.
export async function clearNonlocalPriestsOnExit() {
    const state = requireInitializedGame();
    // Monster births append here; the native fmon chain visits newest first.
    for (const priest of [...state.level.monsters].reverse()) {
        if (priest.mhp <= 0 || !priest.ispriest)
            continue;
        const shrine = priestData(priest);
        if (!shrine)
            throw new Error(`Priest ${priest.m_id} has no shrine record.`);
        if (!sameLevel(shrine.shrlevel, state.u.uz))
            await removeMonsterFromGame(priest);
    }
}
function hasShrine(priest, state = game) {
    const epri = priestData(priest);
    if (!priest.ispriest || !epri)
        return false;
    const altar = state.level?.at(epri.shrpos.x, epri.shrpos.y);
    return !!altar && IS_ALTAR(altar.typ) && !!(altar.flags & AM_SHRINE)
        && epri.shralign === Amask2align(altar.flags & ~AM_SHRINE);
}
// C priest.c:in_your_sanctuary(). A resident protects only a faithful hero
// sharing the temple of their intact, coaligned shrine.
export function inHeroSanctuary(monster, x, y, state = game) {
    if (monster) {
        if (((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_MINION)
            || [PM_DEATH, PM_PESTILENCE, PM_FAMINE].includes(monster.mnum))
            return false;
        x = monster.mx;
        y = monster.my;
    }
    if ((state.u.ualign?.record ?? 0) <= -4)
        return false;
    const rooms = state.u.urooms;
    if (!rooms)
        throw new Error('Sanctuary checks require hero room membership.');
    const roomno = rooms.find(number => roomForRoomno(state.level, number)?.rtype === TEMPLE);
    if (roomno == null || roomsAt(state.level, x, y, TEMPLE)[0] !== roomno)
        return false;
    const priest = findPriest(roomno, state);
    return !!priest && hasShrine(priest, state)
        && priestIsCoaligned(priest, state) && !!priest.mpeaceful;
}
// C priest.c:ghod_hitsu(). The original shrine supplies the deity, while
// the hero's current temple supplies the fallback launch edges.
export async function ghodHitsu(priest, { state = game, publish = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    const { u, level } = requireInitializedGame(state);
    const roomno = u.urooms.find(number => roomForRoomno(level, number)?.rtype === TEMPLE);
    if (!roomno || !hasShrine(priest, state))
        return { heroDied: false };
    const shrine = priestData(priest);
    const room = roomForRoomno(level, roomno);
    if (!shrine || !room)
        throw new Error('Shrine retaliation requires its priest and temple records.');
    const { x: ax, y: ay } = shrine.shrpos;
    let x = ax, y = ay;
    if (!shrineRayIsLinedUp(x, y, state)) {
        if (IS_DOOR(level.at(u.ux, u.uy)?.typ ?? 0)) {
            if (u.ux === room.lx - 1) {
                x = room.hx;
                y = u.uy;
            }
            else if (u.ux === room.hx + 1) {
                x = room.lx;
                y = u.uy;
            }
            else if (u.uy === room.ly - 1) {
                x = u.ux;
                y = room.hy;
            }
            else if (u.uy === room.hy + 1) {
                x = u.ux;
                y = room.ly;
            }
        }
        else {
            switch (rn2(4)) {
                case 0:
                    x = u.ux;
                    y = room.ly;
                    break;
                case 1:
                    x = u.ux;
                    y = room.hy;
                    break;
                case 2:
                    x = room.lx;
                    y = u.uy;
                    break;
                default:
                    x = room.hx;
                    y = u.uy;
                    break;
            }
        }
        if (!shrineRayIsLinedUp(x, y, state))
            return { heroDied: false };
    }
    const threat = rn2(3);
    const altar = level.at(ax, ay);
    if (!altar)
        throw new Error('The retaliation shrine square is outside the level.');
    const deity = deityName(Amask2align(altar.flags), state);
    if (threat === 0)
        await publish(`${deity} roars in anger:  "Thou shalt suffer!"`);
    else if (threat === 1)
        await publish(`${deity}${deity.endsWith('s') ? "'" : "'s"} voice booms:  "How darest thou harm my servant!"`);
    else
        await publish(`${deity} roars:  "Thou dost profane my shrine!"`);
    const dx = Math.sign(u.ux - x), dy = Math.sign(u.uy - y);
    const directions = [['y', 'k', 'u'], ['h', null, 'l'], ['b', 'j', 'n']];
    const direction = directions[dy + 1]?.[dx + 1];
    if (!direction)
        throw new Error('A shrine ray requires a nonzero direction toward the hero.');
    const previousWand = state._currentWand;
    state._currentWand = null;
    try {
        const result = await castMonsterSpellRay(direction, x, y, [AT_MAGC, AD_ELEC, 6, 6], {
            state, publish, sourceMonster: null,
        });
        if (result.heroDied)
            return { heroDied: true };
    }
    finally {
        if (previousWand === undefined)
            delete state._currentWand;
        else
            state._currentWand = previousWand;
    }
    await exerciseAttribute(A_WIS, false, state);
    return { heroDied: false };
}
function shrineRayIsLinedUp(x, y, state) {
    const level = requireGameLevel(state);
    const dx = state.u.ux - x, dy = state.u.uy - y;
    if ((!dx && !dy) || (dx && dy && Math.abs(dx) !== Math.abs(dy))
        || Math.max(Math.abs(dx), Math.abs(dy)) >= BOLT_LIM)
        return false;
    if (couldsee(x, y))
        return true;
    do {
        x += Math.sign(dx);
        y += Math.sign(dy);
        const loc = level.at(x, y);
        if (!loc || IS_OBSTRUCTED(loc.typ)
            || (IS_DOOR(loc.typ) && (loc.doormask & (D_CLOSED | D_LOCKED)))
            || loc.typ === WATER || loc.typ === LAVAWALL)
            return false;
    } while (x !== state.u.ux || y !== state.u.uy);
    return true;
}
export function priestAlignment(priest) {
    const alignment = priestData(priest)?.shralign
        ?? minionData(priest)?.min_align ?? A_NONE;
    if (alignment === A_NONE)
        return A_NONE;
    return Math.sign(alignment);
}
export function priestIsCoaligned(priest, state = game) {
    return (state.u?.ualign?.type ?? A_NONE) === priestAlignment(priest);
}
export function visiblePriestName(priest, state = game) {
    if (!canSeeMonster(priest))
        return 'A nearby voice';
    return monsterName(priest, { state, capitalized: true });
}
function priestCanSpeak(priest, state = game) {
    return !state.u?.deaf && !priest.msleeping
        && priest.mcanmove !== 0 && !((priest.mfrozen ?? 0) > 0);
}
// C intemple() keeps TEMPLE repeatable and rate-limits each class of entry
// message on the resident's epri record.  plineWithContinuation is important:
// an intone can fit beside a short Quest arrival line, while the following
// spoken greeting forces the tty More boundary before its own cooldown roll.
export async function intemple(roomno, state = game) {
    const previousRooms = state.u.urooms0;
    if (!previousRooms)
        throw new Error('Temple entry requires previous hero room membership.');
    if (previousRooms.some(previous => roomForRoomno(state.level, previous)?.rtype === TEMPLE))
        return null;
    const priest = findPriest(roomno, state);
    if (!priest) {
        const eerie = rn2(4);
        if (eerie === 0)
            await plineWithContinuation('You have an eerie feeling...');
        else if (eerie === 1)
            await plineWithContinuation(formatFeltMessage('like you are being watched.', state));
        else if (eerie === 2)
            await plineWithContinuation('A shiver runs down your spine.');
        // Ghost creation remains with the monster-construction owner.  Keep
        // the source gate in stream even when it does not fire.
        rn2(5);
        return null;
    }
    const epri = priestData(priest);
    if (!epri)
        throw new Error('Temple entry requires the resident shrine record.');
    epri.intone_time ??= 0;
    epri.enter_time ??= 0;
    epri.peaceful_time ??= 0;
    epri.hostile_time ??= 0;
    const moves = state.moves ?? 0;
    const canSpeak = priestCanSpeak(priest, state);
    const shrined = hasShrine(priest, state);
    if (canSpeak && moves >= epri.intone_time) {
        await plineWithContinuation(`${visiblePriestName(priest, state)} intones:`);
        epri.intone_time = moves + d(10, 500);
        epri.enter_time = 0;
    }
    if (moves >= epri.enter_time && canSpeak) {
        await plineWithContinuation(`"Pilgrim, you enter a ${shrined ? 'sacred' : 'desecrated'} place!"`);
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
            await plineWithContinuation(`You have a${strange} forbidding feeling...`);
        }
        else {
            const article = (state.u?.ualign?.record ?? 0) >= 14
                ? 'a' : 'an unusual';
            await plineWithContinuation(`You experience ${article} sense of peace.`);
        }
        epri[thisKey] = moves + d(10, 20);
        if (epri[thisKey] <= epri[otherKey])
            epri[otherKey] = epri[thisKey] - 1;
    }
    return priest;
}
export function templeRoomAt(state, x, y) {
    const roomno = roomsAt(state.level, x, y, TEMPLE)[0];
    return roomno ? { room: roomForRoomno(state.level, roomno), roomno } : null;
}
//# sourceMappingURL=priest.js.map