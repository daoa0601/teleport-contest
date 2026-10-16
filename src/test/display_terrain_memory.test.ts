import assert from 'node:assert/strict';
import test from 'node:test';
import { CORR, CROSSWALL, DOOR, D_BROKEN, D_ISOPEN, TDWALL } from '../js/const.js';
import { flush_screen, map_background, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { NO_COLOR } from '../js/terminal.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

void test('direct background mapping uses remembered corridor lighting until sight updates it', async () => {
    const level = freshObjectRoom({ flags: { lit_corridor: false } });
    const corridor = level.requireAt(11, 10);
    corridor.typ = CORR;
    corridor.lit = true;
    corridor.waslit = false;

    map_background(11, 10);
    await flush_screen(1);

    assert.equal(requireScreenCell(10, 11).color, NO_COLOR);
    newsym(11, 10);
    assert.equal(corridor.waslit, true);
});

for (const horizontal of [false, true]) {
    void test(`an open ${horizontal ? 'horizontal' : 'vertical'} doorway uses its own door orientation`, async () => {
        const level = freshObjectRoom();
        game.symset = 'ASCII';
        const door = level.requireAt(11, 10);
        door.typ = DOOR;
        door.horizontal = horizontal;
        door.doormask = D_ISOPEN;

        newsym(11, 10);
        await flush_screen(1);

        assert.equal(requireScreenCell(10, 11).ch, horizontal ? '|' : '-');
    });
}

void test('a broken door displays a doorway even if its old open bit remains set', async () => {
    const level = freshObjectRoom();
    game.symset = 'ASCII';
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_BROKEN | D_ISOPEN;

    newsym(11, 10);
    await flush_screen(1);

    assert.equal(requireScreenCell(10, 11).ch, '.');
});

for (const typ of [CROSSWALL, TDWALL]) {
    void test(`mapping an unseen wall junction ${typ} leaves it as stone`, async () => {
        const level = freshObjectRoom();
        const wall = level.requireAt(11, 10);
        wall.typ = typ;
        wall.seenv = 0;

        map_background(11, 10);
        await flush_screen(1);

        assert.equal(requireScreenCell(10, 11).ch, ' ');
    });
}

