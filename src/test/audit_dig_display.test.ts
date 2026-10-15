import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { PIT, TT_PIT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { maketrap } from '../js/mklev.js';
import { WAN_DIGGING } from '../js/object_data.js';
import { connectPits } from '../js/pit_connections.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('a blind hero remembers a new pit beyond a conjoined pit after a digging zap', async () => {
    const level = freshObjectRoom({ hero: { blindTurns: 10 } });
    const ownPit = await maketrap(10, 10, PIT);
    const adjacent = await maketrap(11, 10, PIT);
    assert.ok(ownPit && adjacent);
    connectPits(ownPit, adjacent);
    game.u.utrap = 5;
    game.u.utraptype = TT_PIT;
    const wand = await addInventoryObject(WAN_DIGGING, { spe: 2 });
    const input = resetInputState();
    installPagerInput(input, { expected: /dig|pit/, limit: 10 });
    input.feed(`${wand.invlet}l`);

    await rhack('z'.charCodeAt(0));

    assert.ok(level.traps.find(trap => trap.tx === 12 && trap.ty === 10)?.tseen);
    assert.equal(level.requireAt(12, 10).disp_ch, '^');
});

