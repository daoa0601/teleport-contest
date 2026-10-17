import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { mksobj } from '../js/mklev.js';
import { WAN_NOTHING } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
// o_init.c draws the wand of nothing's direction for each game:
// rn2(2) ? NODIR : IMMEDIATE.  mkobj.c and dozap() read that direction.
async function wandChargesFor(direction) {
    freshObjectRoom();
    game.wandNothingDirection = direction;
    initRng(7);
    const charges = [];
    for (let i = 0; i < 30; i++)
        charges.push((await mksobj(WAN_NOTHING, true, false)).spe);
    return charges;
}
void test('a directionless wand of nothing is made with eleven to fifteen charges', async () => {
    const charges = await wandChargesFor(1);
    assert.ok(charges.every(spe => spe >= 11 && spe <= 15), charges.join(','));
});
void test('a wand of nothing that needs a direction is made with four to eight charges', async () => {
    const charges = await wandChargesFor(0);
    assert.ok(charges.every(spe => spe >= 4 && spe <= 8), charges.join(','));
});
void test('zapping a directionless wand of nothing asks for no direction', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.wandNothingDirection = 1;
    const wand = await addInventoryObject(WAN_NOTHING, { spe: 3 });
    const input = resetInputState();
    input.feed(wand.invlet);
    const outcome = await Promise.race([
        rhack('z'.charCodeAt(0)).then(() => 'finished'),
        input.waitUntilBlocked().then(() => 'asked'),
    ]);
    assert.equal(outcome, 'finished');
    assert.equal(wand.spe, 2);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=wand_nothing_direction.test.js.map