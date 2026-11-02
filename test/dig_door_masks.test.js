import assert from 'node:assert/strict';
import test from 'node:test';
import { D_BROKEN, D_ISOPEN, D_LOCKED, DOOR, W_WEP, } from '../js/const.js';
import { AXE } from '../js/object_data.js';
import { continueHeroDigging, startHeroDigging } from '../js/dig.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { resetInputState } from '../js/input.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { requireFixtureGame } from './support/game-state.js';
import { installPagerInput } from './support/pager-input.js';
const DIGGING_PROSE = /You start (?:digging|chipping|hitting|chopping)|You hit the .* with all your might/;
async function wieldAxe() {
    const axe = await addInventoryObject(AXE, {
        invlet: 'a', spe: 0, blessed: false, cursed: false,
        wielded: true, owornmask: W_WEP,
    });
    game.uwep = game.u.uwep = axe;
    return axe;
}
async function chopUntilDone(axe, x, y) {
    installPagerInput(resetInputState(), { expected: DIGGING_PROSE, limit: 2 });
    initRng(5n);
    await startHeroDigging(axe, x, y, { state: game });
    let continuing = true;
    let ticks = 0;
    while (continuing && ticks < 400) {
        continuing = await continueHeroDigging(game);
        ticks += 1;
    }
}
// C dig.c reaches the door case through monmove.c:closed_door(), which
// admits D_LOCKED exactly like D_CLOSED.  A locked door is a chopping
// target, and breaking an untrapped one leaves D_BROKEN, not an open
// doorway.
void test('a locked door breaks open with the wielded axe', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const axe = await wieldAxe();
    const door = requireGameLevel(game).requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_LOCKED;
    await chopUntilDone(axe, 11, 10);
    const cell = game.level.requireAt(11, 10);
    assert.equal(cell.doormask, D_BROKEN, 'a dug locked door ends broken like a closed one');
    assert.match(game._pending_message, /You break through the door with your axe\.$/);
});
// C dig.c:dig_typ() asks closed_door() for the door target; an open door
// (D_ISOPEN) is not one, so chopping it with an axe never breaks the
// doorway.
void test('an open doorway is not a chopping target', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const axe = await wieldAxe();
    const door = requireGameLevel(game).requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_ISOPEN;
    await chopUntilDone(axe, 11, 10);
    const cell = game.level.requireAt(11, 10);
    assert.equal(cell.doormask, D_ISOPEN, 'an open door must stay open');
    assert.doesNotMatch(game._pending_message ?? '', /break through the door/);
});
//# sourceMappingURL=dig_door_masks.test.js.map