// extralev.js — the Rogue level.
// C ref: extralev.c — makeroguerooms(), roguecorr(), roguejoin(), miniwalk()
// (a modified mkmaze.c walkfrom), corr() and makerogueghost(). Regular room
// and corridor generation lives in mklev.ts (mklev.c).
import { game, requireGameLevel } from './gstate.js';
import { rn2, rn1, rnd } from './rng.js';
import { CORR, D_NODOOR, OROOM, SCORR, XL_DOWN, XL_LEFT, XL_RIGHT, XL_UP, } from './const.js';
import { ARROW, BOW, FAKE_AMULET_OF_YENDOR, FOOD_RATION, MACE, OBJECT_WEIGHT, RING_MAIL, TWO_HANDED_SWORD, } from './object_data.js';
import { curseObjectState } from './object_state.js';
import { roguePlayerName, setMonsterGivenName } from './monster_given_name.js';
import { makemon } from './makemon.js';
import { mksobj_at } from './mkobj.js';
import { somex, somey } from './mkroom.js';
import { add_room, dodoor } from './mklev.js';
import { isRoom } from './map_types.js';
// Object/class constant (normally from objects.js, not in contest template)
const PLATE_MAIL = 121;
function rogueGridCell(grid, x, y) {
    const cell = grid[x]?.[y];
    if (!cell)
        throw new RangeError(`Missing Rogue grid cell ${x},${y}`);
    return cell;
}
function rogueGridRoom(cell) {
    const room = cell.nroom === undefined ? undefined : requireGameLevel().rooms[cell.nroom];
    if (!isRoom(room))
        throw new Error('Rogue room cell has no generated room.');
    return room;
}
function rogueCorrCell(x, y) {
    const loc = game.level?.at(x, y);
    if (loc)
        loc.typ = rn2(50) ? CORR : SCORR;
}
function roguejoin(x1, y1, x2, y2, horiz) {
    if (horiz) {
        const middle = x1 + rn2(x2 - x1 + 1);
        for (let x = Math.min(x1, middle); x <= Math.max(x1, middle); x++)
            rogueCorrCell(x, y1);
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
            rogueCorrCell(middle, y);
        for (let x = Math.min(middle, x2); x <= Math.max(middle, x2); x++)
            rogueCorrCell(x, y2);
    }
    else {
        const middle = y1 + rn2(y2 - y1 + 1);
        for (let y = Math.min(y1, middle); y <= Math.max(y1, middle); y++)
            rogueCorrCell(x1, y);
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
            rogueCorrCell(x, middle);
        for (let y = Math.min(middle, y2); y <= Math.max(middle, y2); y++)
            rogueCorrCell(x2, y);
    }
}
async function roguecorr(grid, x, y, dir) {
    const level = requireGameLevel();
    let fromx, fromy, tox, toy;
    const source = rogueGridCell(grid, x, y);
    if (dir === XL_DOWN) {
        source.doortable &= ~XL_DOWN;
        if (!source.real) {
            fromx = source.rlx + 1 + 26 * x;
            fromy = source.rly + 7 * y;
        }
        else {
            fromx = source.rlx + rn2(source.dx) + 1 + 26 * x;
            fromy = source.rly + source.dy + 7 * y;
            await dodoor(fromx, fromy, rogueGridRoom(source));
            level.requireAt(fromx, fromy).doormask = D_NODOOR;
            fromy++;
        }
        if (y >= 2)
            return;
        const dest = rogueGridCell(grid, x, ++y);
        dest.doortable &= ~XL_UP;
        if (!dest.real) {
            tox = dest.rlx + 1 + 26 * x;
            toy = dest.rly + 7 * y;
        }
        else {
            tox = dest.rlx + rn2(dest.dx) + 1 + 26 * x;
            toy = dest.rly - 1 + 7 * y;
            await dodoor(tox, toy, rogueGridRoom(dest));
            level.requireAt(tox, toy).doormask = D_NODOOR;
            toy--;
        }
        roguejoin(fromx, fromy, tox, toy, false);
        return;
    }
    if (dir === XL_RIGHT) {
        source.doortable &= ~XL_RIGHT;
        if (!source.real) {
            fromx = source.rlx + 1 + 26 * x;
            fromy = source.rly + 7 * y;
        }
        else {
            fromx = source.rlx + source.dx + 1 + 26 * x;
            fromy = source.rly + rn2(source.dy) + 7 * y;
            await dodoor(fromx, fromy, rogueGridRoom(source));
            level.requireAt(fromx, fromy).doormask = D_NODOOR;
            fromx++;
        }
        if (x >= 2)
            return;
        const dest = rogueGridCell(grid, ++x, y);
        dest.doortable &= ~XL_LEFT;
        if (!dest.real) {
            tox = dest.rlx + 1 + 26 * x;
            toy = dest.rly + 7 * y;
        }
        else {
            tox = dest.rlx - 1 + 1 + 26 * x;
            toy = dest.rly + rn2(dest.dy) + 7 * y;
            await dodoor(tox, toy, rogueGridRoom(dest));
            level.requireAt(tox, toy).doormask = D_NODOOR;
            tox--;
        }
        roguejoin(fromx, fromy, tox, toy, true);
    }
}
// Modified walkfrom() from mkmaze.c.  Preserve the recursive walk and its
// left/right/up/down candidate order: revisiting a cell can add the intended
// one-in-ten extra connection and therefore owns observable RNG calls.
function rogueMiniwalk(grid, x, y) {
    while (true) {
        const dirs = [];
        const here = rogueGridCell(grid, x, y);
        if (x > 0 && !(here.doortable & XL_LEFT)
            && (!rogueGridCell(grid, x - 1, y).doortable || !rn2(10)))
            dirs.push(XL_LEFT);
        if (x < 2 && !(here.doortable & XL_RIGHT)
            && (!rogueGridCell(grid, x + 1, y).doortable || !rn2(10)))
            dirs.push(XL_RIGHT);
        if (y > 0 && !(here.doortable & XL_UP)
            && (!rogueGridCell(grid, x, y - 1).doortable || !rn2(10)))
            dirs.push(XL_UP);
        if (y < 2 && !(here.doortable & XL_DOWN)
            && (!rogueGridCell(grid, x, y + 1).doortable || !rn2(10)))
            dirs.push(XL_DOWN);
        if (!dirs.length)
            return;
        const dir = dirs[rn2(dirs.length)];
        if (dir === undefined)
            throw new RangeError('Rogue walk direction is out of range.');
        if (dir === XL_LEFT) {
            here.doortable |= XL_LEFT;
            rogueGridCell(grid, --x, y).doortable |= XL_RIGHT;
        }
        else if (dir === XL_RIGHT) {
            here.doortable |= XL_RIGHT;
            rogueGridCell(grid, ++x, y).doortable |= XL_LEFT;
        }
        else if (dir === XL_UP) {
            here.doortable |= XL_UP;
            rogueGridCell(grid, x, --y).doortable |= XL_DOWN;
        }
        else {
            here.doortable |= XL_DOWN;
            rogueGridCell(grid, x, ++y).doortable |= XL_UP;
        }
        rogueMiniwalk(grid, x, y);
    }
}
export async function makeroguerooms() {
    const g = game;
    const level = requireGameLevel();
    const roomEquivalence = g.smeq;
    if (!roomEquivalence)
        throw new Error('Rogue generation requires initialized room equivalence.');
    const grid = [[], [], []];
    let realRooms = 0;
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            const column = grid[x];
            if (!column)
                throw new RangeError(`Missing Rogue grid column ${x}`);
            if (!rn2(5) && (realRooms || (x < 2 && y < 2))) {
                column[y] = {
                    doortable: 0, real: false,
                    rlx: rn1(22, 2), rly: rn1(y === 2 ? 4 : 3, 2),
                };
            }
            else {
                const dx = rn1(22, 2), dy = rn1(y === 2 ? 4 : 3, 2);
                column[y] = {
                    doortable: 0, real: true, dx, dy,
                    rlx: rnd(23 - dx + 1), rly: rnd((y === 2 ? 5 : 4) - dy + 1),
                };
                realRooms++;
            }
        }
    }
    rogueMiniwalk(grid, rn2(3), rn2(3));
    level.nroom = 0;
    level.rooms = [];
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            const room = rogueGridCell(grid, x, y);
            if (!room.real)
                continue;
            room.nroom = level.nroom;
            roomEquivalence[level.nroom] = level.nroom;
            const lowx = 1 + 26 * x + room.rlx;
            const lowy = 7 * y + room.rly;
            add_room(lowx, lowy, lowx + room.dx - 1, lowy + room.dy - 1, !rn2(7), OROOM, false);
        }
    }
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            const room = rogueGridCell(grid, x, y);
            if (room.doortable & XL_DOWN)
                await roguecorr(grid, x, y, XL_DOWN);
            if (room.doortable & XL_RIGHT)
                await roguecorr(grid, x, y, XL_RIGHT);
        }
    }
}
export async function makerogueghost() {
    const level = requireGameLevel();
    if (!level.nroom)
        return;
    const croom = level.rooms[rn2(level.nroom)];
    if (!isRoom(croom))
        throw new Error('Rogue ghost placement selected a missing room.');
    const x = somex(croom), y = somey(croom);
    const ghost = await makemon(287, x, y, 0); // PM_GHOST
    if (!ghost)
        return;
    ghost.msleeping = 1;
    setMonsterGivenName(ghost, roguePlayerName());
    let ghostobj;
    if (rn2(4)) {
        ghostobj = await mksobj_at(FOOD_RATION, x, y, false, false);
        ghostobj.quan = rnd(7);
        ghostobj.quantity = ghostobj.quan;
        ghostobj.owt = (OBJECT_WEIGHT[FOOD_RATION] ?? 1) * ghostobj.quan;
    }
    if (rn2(2)) {
        ghostobj = await mksobj_at(MACE, x, y, false, false);
        ghostobj.spe = rnd(3);
        if (rn2(4))
            curseObjectState(ghostobj);
    }
    else {
        ghostobj = await mksobj_at(TWO_HANDED_SWORD, x, y, false, false);
        ghostobj.spe = rnd(5) - 2;
        if (rn2(4))
            curseObjectState(ghostobj);
    }
    ghostobj = await mksobj_at(BOW, x, y, false, false);
    ghostobj.spe = 1;
    if (rn2(4))
        curseObjectState(ghostobj);
    ghostobj = await mksobj_at(ARROW, x, y, false, false);
    ghostobj.spe = 0;
    ghostobj.quan = rn1(10, 25);
    ghostobj.quantity = ghostobj.quan;
    ghostobj.owt = (OBJECT_WEIGHT[ARROW] ?? 1) * ghostobj.quan;
    if (rn2(4))
        curseObjectState(ghostobj);
    if (rn2(2)) {
        ghostobj = await mksobj_at(RING_MAIL, x, y, false, false);
        ghostobj.spe = rn2(3);
        if (!rn2(3))
            ghostobj.oerodeproof = true;
        if (rn2(4))
            curseObjectState(ghostobj);
    }
    else {
        ghostobj = await mksobj_at(PLATE_MAIL, x, y, false, false);
        ghostobj.spe = rnd(5) - 2;
        if (!rn2(3))
            ghostobj.oerodeproof = true;
        if (rn2(4))
            curseObjectState(ghostobj);
    }
    if (rn2(2)) {
        ghostobj = await mksobj_at(FAKE_AMULET_OF_YENDOR, x, y, true, false);
        ghostobj.known = true;
    }
}
//# sourceMappingURL=extralev.js.map