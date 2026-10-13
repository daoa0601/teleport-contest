import assert from 'node:assert/strict';
import test from 'node:test';
import { CORR, DOOR, DUST, D_LOCKED, FILL_NORMAL, ROOMOFFSET, SHOPBASE } from '../js/const.js';
import { map_location } from '../js/display.js';
import { engravingAt } from '../js/engrave.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { fillSpecialRoom } from '../js/mklev.js';
import { ATR_INVERSE, CLR_BRIGHT_BLUE } from '../js/terminal.js';
import { freshObjectRoom } from './support/object-room.js';
void test('stocking a locked shop writes its inventory notice on the floor outside the entrance', async () => {
    const level = freshObjectRoom({ left: 12, right: 15, top: 8, bottom: 12, heroX: 10, heroY: 7 });
    requirePlayingGame(game);
    const shop = {
        lx: 12, hx: 15, ly: 8, hy: 12, rtype: SHOPBASE, rlit: 1,
        doorct: 1, fdoor: 0, irregular: false, needjoining: false,
        nsubrooms: 0, sbrooms: [], needfill: FILL_NORMAL, roomnoidx: 0,
    };
    level.rooms.push(shop);
    level.nroom = 1;
    level.doors.push({ x: 11, y: 10 });
    for (let x = shop.lx; x <= shop.hx; x++)
        for (let y = shop.ly; y <= shop.hy; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET;
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_LOCKED;
    await fillSpecialRoom(shop);
    const notice = engravingAt(10, 10);
    assert.ok(notice, 'The locked entrance needs a notice on its outside square');
    assert.equal(notice.text, 'Closed for inventory');
    assert.equal(notice.engr_type, DUST);
    assert.equal(level.requireAt(10, 10).typ, CORR);
    notice.erevealed = true;
    map_location(10, 10);
    assert.equal(level.requireAt(10, 10).disp_color, CLR_BRIGHT_BLUE);
    assert.equal(level.requireAt(10, 10).disp_attr, ATR_INVERSE);
});
//# sourceMappingURL=locked_shop_engraving.test.js.map