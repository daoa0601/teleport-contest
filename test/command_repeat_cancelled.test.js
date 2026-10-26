import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { W_ARMF, W_RINGL, W_RINGR } from '../js/const.js';
import { game } from '../js/gstate.js';
import { OBJECT_NAMES, OIL_LAMP, RIN_PROTECTION, RIN_PROTECTION_FROM_SHAPE_CHANGERS, WAN_STRIKING } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
// C cmd.c:rhack() clears CQ_REPEAT whenever a command reports ECMD_CANCEL
// or ECMD_FAIL.  do_wear.c:dowear()/doputon()/dotakeoff()/doremring(),
// zap.c:dozap(), apply.c:dorub(), and pager.c:doidtrap() all return
// ECMD_CANCEL when their getobj()/getdir() is declined or empty, so a
// following ^A has nothing to repeat (cmd.c:do_repeat()).
const LOW_BOOTS = OBJECT_NAMES.indexOf('low boots');
const RING = RIN_PROTECTION;
const CLEARING_CASES = [
    { name: 'declining the wear prompt', keys: 'W\x1b', setup: { wear: LOW_BOOTS } },
    { name: 'having nothing to wear', keys: 'W', setup: {} },
    { name: 'declining the put on prompt', keys: 'P\x1b', setup: { wear: RING } },
    { name: 'declining the remove prompt', keys: 'R\x1b', setup: { wornBoots: true, wornRing: true } },
    { name: 'declining the zap prompt', keys: 'z\x1b', setup: { wand: true } },
    { name: 'having nothing to zap', keys: 'z', setup: {} },
    { name: 'declining the rub prompt', keys: '#rub\n\x1b', setup: { lamp: true } },
    { name: 'declining the showtrap direction', keys: '^\x1b', setup: {} },
];
for (const { name, keys, setup } of CLEARING_CASES) {
    void test(`${name} leaves no command available to repeat`, async () => {
        const input = freshTurnRoom();
        if (setup.wear !== undefined)
            await addInventoryObject(setup.wear);
        if (setup.wornBoots) {
            const boots = await addInventoryObject(LOW_BOOTS, { owornmask: W_ARMF });
            boots.worn = true;
            game.uarmf = boots;
        }
        if (setup.wornRing) {
            const left = await addInventoryObject(RIN_PROTECTION, { owornmask: W_RINGL });
            left.worn = true;
            game.uleft = left;
            const right = await addInventoryObject(RIN_PROTECTION_FROM_SHAPE_CHANGERS, { owornmask: W_RINGR });
            right.worn = true;
            game.uright = right;
        }
        if (setup.wand)
            await addInventoryObject(WAN_STRIKING);
        if (setup.lamp)
            await addInventoryObject(OIL_LAMP);
        input.feed(keys);
        await rhack(0);
        assert.equal(game.context.move, 0);
        input.feed('\x01');
        await rhack(0);
        assert.equal(game._pending_message, 'There is no command available to repeat.');
        assert.equal(game.context.move, 0);
    });
}
// do_wear.c:dowear() keeps its repeat entry when getobj() selects a real
// target: cmd.c re-queues the command plus the letter getobj() read.
void test('a selected wear target stays repeatable', async () => {
    const input = freshTurnRoom();
    const boots = await addInventoryObject(LOW_BOOTS);
    input.feed(`W${boots.invlet}`);
    await rhack(0);
    assert.equal(game.uarmf ?? game.uarm, boots);
    input.feed('\x01');
    await rhack(0);
    assert.notEqual(game._pending_message, 'There is no command available to repeat.');
});
//# sourceMappingURL=command_repeat_cancelled.test.js.map