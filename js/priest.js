// priest.js — Runtime temple ownership, priest and shopkeeper movement.
// C refs: priest.c intemple()/findpriest()/has_shrine()/pri_move()/
// move_special().  Level construction owns the room, altar, and resident;
// this module owns their live relationship with the hero after movement or
// a level transition, and the special mover both temple priests and
// shopkeepers use to reach a goal square.
import { formatFeltMessage } from './hero_speech.js';
import { game, requireGameLevel, requireInitializedGame, requireLiveGame } from './gstate.js';
import { recordTempleOverview } from './dungeon.js';
import { deityName } from './alignment.js';
import { heroSpineName } from './body_parts.js';
import { nomul } from './command_state.js';
import { recordAchievement } from './achievements.js';
import { setMonsterMalign } from './monster_alignment.js';
import { angerMonster, wakeMonster } from './monster_anger.js';
import { canSeeMonster, canSpotMonster, newsym } from './display.js';
import { plineWithContinuation } from './pline.js';
import { exerciseAttribute } from './attrib.js';
import { castMonsterSpellRay } from './breath_ray.js';
import { AT_MAGC, AD_ELEC } from './monster_attack_types.js';
import { cansee, couldSeeFromHero, couldsee } from './vision.js';
import { d, rn2 } from './rng.js';
import { recordRandom } from './monster_action_types.js';
import { A_NONE, A_WIS, ALLOW_M, ALLOW_ROCK, AM_SHRINE, MM_EPRI, MMOVE_DIED, MMOVE_MOVED, MMOVE_NOTHING, NOTONL, ROOMOFFSET, SPACE_POS, Amask2align, BOLT_LIM, D_CLOSED, D_LOCKED, IS_ROOM, RLOC_NOMSG, STONE, ACH_TMPL, In_endgame, IS_ALTAR, IS_DOOR, IS_OBSTRUCTED, LAVAWALL, MM_NOMSG, TEMPLE, WATER, } from './const.js';
import { roomForRoomno, roomsAt } from './room.js';
import { dist2, pointsOnline } from './hacklib.js';
import { mfndpos, monAllowFlags, resistConflict } from './mon.js';
import { breakMonsterBoulder } from './monster_boulder.js';
import { beginMonsterHeroAttack, moveMonsterAggress } from './monmove.js';
import { monsterAtPosition, placeMonsterOnMap, removeMonsterFromMapAt } from './monster_location.js';
import { checkSpecialRoom, shopkeeperInOwnShop } from './shk.js';
import { heroHasConflict } from './hero_conflict.js';
import { heroIsDisplaced } from './armor.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_NAME } from './monster_data.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { monsterName } from './monster_name.js';
import { heroIsHallucinating } from './senses.js';
import { makemon, makemonAt } from './makemon.js';
import { mksobj, mkobj } from './mkobj.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { randomMonsterRelocation } from './teleport.js';
import { AMULET_OF_YENDOR, BOULDER, CLOAK_OF_MAGIC_RESISTANCE, CLOAK_OF_PROTECTION, ROBE, } from './object_data.js';
import { SPBOOK_no_NOVEL, xdir, ydir } from './mklev.js';
const M2_MINION = 0x00001000;
const PM_DEATH = 311, PM_PESTILENCE = 312, PM_FAMINE = 313;
const PM_ALIGNED_CLERIC = 275, PM_HIGH_CLERIC = 276;
const M1_SEE_INVIS = 0x01000000;
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
export function priestInOwnTemple(priest, roomno, state = game) {
    const epri = priestData(priest);
    if (!priest?.ispriest || !epri || epri.shroom !== roomno
        || !sameLevel(epri.shrlevel, state.u?.uz))
        return false;
    return roomsAt(state.level, priest.mx, priest.my, TEMPLE)[0] === roomno;
}
// C priest.c:inhistemple().
export function priestIsInOwnTemple(priest, state = game) {
    const roomno = roomsAt(state.level, priest?.mx, priest?.my, TEMPLE)[0];
    return roomno != null && priestInOwnTemple(priest, roomno, state)
        && priestHasShrine(priest, state);
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
// C priest.c:has_shrine().
export function priestHasShrine(priest, state = game) {
    const epri = priestData(priest);
    if (!priest.ispriest || !epri)
        return false;
    const altar = state.level?.at(epri.shrpos.x, epri.shrpos.y);
    return !!altar && IS_ALTAR(altar.typ) && !!(altar.flags & AM_SHRINE)
        && epri.shralign === Amask2align(altar.flags & ~AM_SHRINE);
}
// C forget_temple_entry(): saving a monster starts its entry feedback anew.
export function forgetTempleEntry(priest) {
    const shrine = priestData(priest);
    if (!priest.ispriest || !shrine)
        throw new Error('Temple entry memory requires a priest with shrine data.');
    shrine.intone_time = shrine.enter_time = shrine.peaceful_time = shrine.hostile_time = 0;
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
    return !!priest && priestHasShrine(priest, state)
        && priestIsCoaligned(priest, state) && !!priest.mpeaceful;
}
// C priest.c:ghod_hitsu(). The original shrine supplies the deity, while
// the hero's current temple supplies the fallback launch edges.
export async function ghodHitsu(priest, { state = game, publish = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    const { u, level } = requireInitializedGame(state);
    const roomno = u.urooms.find(number => roomForRoomno(level, number)?.rtype === TEMPLE);
    if (!roomno || !priestHasShrine(priest, state))
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
// C can_speak uses !helpless(priest); monst.h helpless() is only
// msleeping || !mcanmove, so a monster frozen mid-action still speaks.
function priestCanSpeak(priest, state = game) {
    return !state.u?.deaf && !priest.msleeping && priest.mcanmove !== 0;
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
            await plineWithContinuation(`A shiver runs down your ${heroSpineName(state)}.`);
        if (!rn2(5)) {
            const ghost = await makemonAt(287, state.u.ux, state.u.uy, MM_NOMSG);
            if (ghost) {
                const born = state.mvitals?.[287]?.born ?? 0;
                await plineWithContinuation(canSpotMonster(ghost)
                    ? `A${born < 5 ? 'n enormous' : ''} ghost appears next to you${born < 10 ? '!' : '.'}`
                    : 'You sense a presence close by!');
                ghost.mpeaceful = 0;
                setMonsterMalign(ghost, state);
                if (state.flags.verbose)
                    await plineWithContinuation('You are frightened to death, and unable to move.');
                nomul(-3, state);
                state._helplessReason = 'being terrified of a ghost';
                state._helplessDoneMessage = 'You regain your composure.';
            }
        }
        return null;
    }
    recordAchievement(state, ACH_TMPL);
    const epri = priestData(priest);
    if (!epri)
        throw new Error('Temple entry requires the resident shrine record.');
    epri.intone_time ??= 0;
    epri.enter_time ??= 0;
    epri.peaceful_time ??= 0;
    epri.hostile_time ??= 0;
    const moves = state.moves ?? 0;
    const canSpeak = priestCanSpeak(priest, state);
    const shrined = priestHasShrine(priest, state);
    const inSanctum = !!state.sanctum_level && sameLevel(state.sanctum_level, state.u.uz);
    const sanctum = priest.mnum === 276 && (inSanctum || In_endgame(state.u.uz));
    if (canSpeak && moves >= epri.intone_time) {
        const wasPriest = priest.ispriest;
        try {
            if (sanctum && !heroIsHallucinating(state))
                priest.ispriest = 0;
            await plineWithContinuation(`${visiblePriestName(priest, state)} intones:`);
        }
        finally {
            if (wasPriest === undefined)
                delete priest.ispriest;
            else
                priest.ispriest = wasPriest;
        }
        epri.intone_time = moves + d(10, 500);
        epri.enter_time = 0;
    }
    let greeting = null;
    let followup = null;
    if (sanctum && inSanctum) {
        if (priest.mpeaceful) {
            greeting = "Infidel, you have entered Moloch's Sanctum!";
            followup = 'Be gone!';
            priest.mpeaceful = 0;
            setMonsterMalign(priest, state);
        }
        else
            greeting = 'You desecrate this place by your presence!';
    }
    else if (moves >= epri.enter_time) {
        greeting = `Pilgrim, you enter a ${shrined ? 'sacred' : 'desecrated'} place!`;
    }
    if (greeting && canSpeak) {
        await plineWithContinuation(`"${greeting}"`);
        if (followup)
            await plineWithContinuation(`"${followup}"`);
        epri.enter_time = moves + d(10, 100);
    }
    if (sanctum) {
        recordTempleOverview(state);
        return priest;
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
    recordTempleOverview(state);
    return priest;
}
export function templeRoomAt(state, x, y) {
    const roomno = roomsAt(state.level, x, y, TEMPLE)[0];
    return roomno ? { room: roomForRoomno(state.level, roomno), roomno } : null;
}
export async function specialShrinePriest(temple, altarX, altarY, altarAlignment, { sanctum = false } = {}) {
    const level = requireGameLevel();
    const shrineLevel = game.u.uz;
    if (!shrineLevel)
        throw new Error('Shrine priest creation requires the dungeon location.');
    const startDirection = rn2(8);
    let priestX = altarX, priestY = altarY;
    for (let offset = 0; offset < 8; offset++) {
        const direction = (startDirection + offset) % 8;
        const dx = xdir[direction], dy = ydir[direction];
        if (dx === undefined || dy === undefined)
            throw new RangeError(`Invalid priest placement direction ${direction}`);
        const x = altarX + dx;
        const y = altarY + dy;
        const loc = level.at(x, y);
        if (loc && SPACE_POS(loc.typ)
            && !(level.objects[x]?.[y] ?? []).some(object => object.otyp === BOULDER)) {
            priestX = x;
            priestY = y;
            break;
        }
    }
    const occupant = monsterAtPosition(level, priestX, priestY);
    if (occupant)
        await randomMonsterRelocation(occupant, { flags: RLOC_NOMSG });
    const priest = await makemon(sanctum ? PM_HIGH_CLERIC : PM_ALIGNED_CLERIC, priestX, priestY, MM_EPRI);
    if (!priest)
        return null;
    priest.ispriest = 1;
    priest.isminion = 0;
    priest.mpeaceful = 1;
    priest.msleeping = 0;
    priest.epri = {
        shroom: (temple?.roomnoidx ?? 0) + ROOMOFFSET,
        shralign: altarAlignment,
        shrpos: { x: altarX, y: altarY },
        shrlevel: { ...shrineLevel },
        parentmid: priest.m_id,
        intone_time: 0,
        enter_time: 0,
        peaceful_time: 0,
        hostile_time: 0,
    };
    priest.mtrapseen = 0x7fffffff;
    // priest.c:priestini() replaces the birth attitude and species alignment.
    setMonsterMalign(priest);
    if (sanctum && altarAlignment === A_NONE) {
        const amulet = await mksobj(AMULET_OF_YENDOR, true, false);
        await addObjectToMonsterInventory(priest, amulet, game, { atFront: true });
    }
    const spellbookCount = 2 + rn2(3);
    for (let count = 0; count < spellbookCount; count++) {
        const spellbook = await mkobj(SPBOOK_no_NOVEL, false);
        await addObjectToMonsterInventory(priest, spellbook, game, { atFront: true });
    }
    // which_armor(W_ARMC) only mutates the generated robe or cloak; the
    // alignment-based curse/uncurse operation itself consumes no RNG.
    if (rn2(2)) {
        const cloak = priest.minvent.find(object => [
            ROBE, CLOAK_OF_PROTECTION, CLOAK_OF_MAGIC_RESISTANCE,
        ].includes(object.otyp));
        if (cloak) {
            const coaligned = altarAlignment !== A_NONE
                && game.u?.ualign?.type === altarAlignment;
            cloak.cursed = !coaligned;
            if (!coaligned)
                cloak.blessed = false;
        }
    }
    return priest;
}
// ---------------------------------------------------------------------------
// C priest.c:move_special() and pri_move().
// ---------------------------------------------------------------------------
// C priest.c:move_special(). Source MOVED also covers breaking a boulder
// or attacking another monster without changing the mover's coordinates.
// Called from pri_move() here and from shk_move() in shk.js.
export async function moveSpecial(monster, state, random, rollDice, rollOne, calls, { inHisShop, approach, heroOnDoor, avoid, goalX, goalY, }) {
    const oldx = monster.mx, oldy = monster.my;
    const movement = {
        oldx,
        oldy,
        x: oldx,
        y: oldy,
        moved: false,
        postMoveStatus: MMOVE_NOTHING,
        movementStage: 'postmov',
    };
    if (oldx === goalX && oldy === goalY)
        return movement;
    if (monster.mconf) {
        avoid = false;
        approach = 0;
    }
    const candidates = await mfndpos(monster, state, monAllowFlags(monster, state, rollOne, calls));
    if (monster.isshk &&
        avoid &&
        heroOnDoor &&
        !candidates.some((candidate) => !(candidate.info & NOTONL)))
        avoid = false;
    const pickMove = (avoidOnline) => {
        let selected = { x: oldx, y: oldy, info: 0 };
        let choiceCount = 0;
        for (const candidate of candidates) {
            if (!(IS_ROOM(state.level.at(candidate.x, candidate.y)?.typ ?? STONE) ||
                (monster.isshk && (!inHisShop || monster.eshk?.following))))
                continue;
            if (avoidOnline && candidate.info & NOTONL && !(candidate.info & ALLOW_M))
                continue;
            const better = !approach
                ? recordRandom(random, calls, ++choiceCount) === 0
                : dist2(candidate.x, candidate.y, goalX, goalY) <
                    dist2(selected.x, selected.y, goalX, goalY);
            if (better || candidate.info & ALLOW_M)
                selected = candidate;
        }
        return selected;
    };
    let selected = pickMove(avoid);
    if (monster.ispriest &&
        avoid &&
        selected.x === oldx &&
        selected.y === oldy &&
        pointsOnline(oldx, oldy, state.u.ux, state.u.uy))
        selected = pickMove(false);
    if (selected.x === oldx && selected.y === oldy)
        return movement;
    if (selected.info & ALLOW_ROCK) {
        await breakMonsterBoulder(monster, selected.x, selected.y, state, { random });
        movement.postMoveStatus = MMOVE_MOVED;
        return movement;
    }
    if (selected.info & ALLOW_M) {
        const combat = await moveMonsterAggress(monster, selected.x, selected.y, state, random, rollDice, rollOne, calls);
        return {
            ...movement,
            ...combat,
            postMoveStatus: combat.postMoveStatus === MMOVE_DIED ? MMOVE_DIED : MMOVE_MOVED,
        };
    }
    if (monsterAtPosition(state.level, selected.x, selected.y) ||
        (selected.x === state.u.ux && selected.y === state.u.uy))
        return movement;
    removeMonsterFromMapAt(oldx, oldy, state);
    await placeMonsterOnMap(monster, selected.x, selected.y, state);
    if (state === game)
        await newsym(selected.x, selected.y);
    if (monster.isshk && !inHisShop && shopkeeperInOwnShop(monster, state))
        await checkSpecialRoom();
    return {
        ...movement,
        x: selected.x,
        y: selected.y,
        moved: true,
        postMoveStatus: MMOVE_MOVED,
    };
}
// C priest.c:pri_move() via m_canseeu(): the special mover sees the hero
// with its own eyes, without displacement, and not from the water.
export function specialMoverSeesHero(monster, state) {
    const seesInvisible = !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS);
    return (monster.mcansee !== 0 &&
        monster.mcansee !== false &&
        (!heroIsInvisible(state) || seesInvisible) &&
        !state.u.uinwater &&
        couldSeeFromHero(state, monster.mx, monster.my));
}
// C priest.c:pri_move(): return 1: moved  0: didn't  -1: let m_move do it.
export async function movePriest(monster, state, random, rollDice, rollOne, calls) {
    const roomno = roomsAt(state.level, monster.mx, monster.my, TEMPLE)[0];
    if (roomno === undefined || !priestInOwnTemple(monster, roomno, state))
        return null;
    const epri = monster.epri || monster.mextra?.epri;
    if (!epri)
        throw new Error('A temple priest must retain its temple state');
    let goalX = epri.shrpos.x + recordRandom(random, calls, 3) - 1;
    let goalY = epri.shrpos.y + recordRandom(random, calls, 3) - 1;
    let avoid = true;
    if (!monster.mpeaceful ||
        (heroHasConflict(state) && !resistConflict(monster, state, rollOne, calls))) {
        const dx = monster.mx - state.u.ux;
        const dy = monster.my - state.u.uy;
        if (dx * dx + dy * dy < 3 &&
            (MONSTER_NAME[monster.mnum] !== 'grid bug' || dx === 0 || dy === 0)) {
            if (heroIsDisplaced(state)) {
                await plineWithContinuation(`Your displaced image doesn't fool ${monsterName(monster, { state })}!`);
            }
            return {
                oldx: monster.mx,
                oldy: monster.my,
                x: monster.mx,
                y: monster.my,
                moved: false,
                priest: true,
                postMoveStatus: MMOVE_NOTHING,
                movementStage: 'postmov',
                deferredAfterSpecialAttack: true,
                ...await beginMonsterHeroAttack(monster, state, random, rollOne, rollDice, calls),
            };
        }
        if (state.u.urooms.includes(epri.shroom)) {
            if (specialMoverSeesHero(monster, state)) {
                goalX = state.u.ux;
                goalY = state.u.uy;
            }
            avoid = false;
        }
    }
    else if (heroIsInvisible(state)) {
        avoid = false;
    }
    const movement = await moveSpecial(monster, state, random, rollDice, rollOne, calls, {
        inHisShop: false,
        approach: 1,
        heroOnDoor: false,
        avoid,
        goalX,
        goalY,
    });
    return { ...movement, priest: true };
}
//# sourceMappingURL=priest.js.map