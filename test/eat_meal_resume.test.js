import assert from 'node:assert/strict';
import test from 'node:test';
import { NOT_HUNGRY, SATIATED } from '../js/const.js';
import { continueCountedCommand } from '../js/cmd.js';
import { doeat } from '../js/eat.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { flushPendingTopline } from '../js/topl.js';
import { FOOD_RATION } from '../js/object_data.js';
import { stopHeroOccupation } from '../js/occupation.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('resuming an interrupted ration finishes the same meal without recounting food', async () => {
    await freshObjectRoom({ hero: { uhunger: 1100, uhs: SATIATED } });
    requirePlayingGame(game);
    const input = resetInputState();
    installPagerInput(input, { expected: /ration|meal/, limit: 8 });
    const ration = await addInventoryObject(FOOD_RATION);
    assert.ok(ration.invlet);
    await flushPendingTopline();
    pushKeys(ration.invlet);
    await doeat();
    await stopHeroOccupation();
    game.u.uhunger = 500;
    game.u.uhs = NOT_HUNGRY;
    await flushPendingTopline();
    pushKeys(ration.invlet);
    await doeat();
    assert.match(game._lastPlineMessage, /You resume your meal\./);
    for (let turn = 0; ration.where !== 'gone' && turn < 8; turn++) {
        await continueCountedCommand(game);
    }
    assert.equal(ration.where, 'gone');
    assert.ok(game.u.uhunger > 500);
    assert.equal(game.u.uconduct.food, 1);
    assert.match(game._lastPlineMessage, /You finish eating the food ration\./);
});
//# sourceMappingURL=eat_meal_resume.test.js.map