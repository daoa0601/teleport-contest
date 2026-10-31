import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { flushPendingTopline } from '../js/tty_topline.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { advanceHeroStrangulation } from '../js/hero_strangulation.js';
import { AMULET_OF_STRANGULATION } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireFixtureGame } from './support/game-state.js';
async function wearSetupAmulet(amulet) {
    resetInputState().feed(' ');
    await wearHeroAccessory(amulet, 'uamul');
    resetInputState().feed(' ');
    await flushPendingTopline();
}
// C timeout.c's STRANGLED expiry calls done() through done_timeout():
// unlike HP-loss deaths there is no "You die..." line from losehp(), so
// the disclosure questions start directly and the status line commits
// HP to zero before the first one.
void test('strangulation death starts the disclosure without a You die line', async () => {
    await freshObjectRoom({ flags: { bones: false } });
    requireFixtureGame(game);
    const amulet = await addInventoryObject(AMULET_OF_STRANGULATION);
    await wearSetupAmulet(amulet);
    for (let turn = 0; turn < 5; turn++) {
        const input = resetInputState();
        input.feed(' ');
        await advanceHeroStrangulation();
    }
    assert.equal(game.u.strangledTurns, 1);
    const input = resetInputState();
    const pages = [];
    installPagerInput(input, { expected: /[\s\S]/, limit: 40, pages });
    await advanceHeroStrangulation();
    assert.ok(game.program_state.gameover, 'the hero must die of strangulation');
    assert.equal(game.u.uhp, 0, 'done() commits the fatal HP before disclosure');
    const firstQuestion = pages.find(page => /possessions identified\?/.test(page));
    assert.ok(firstQuestion, 'the disclosure must ask about possessions');
    assert.match(firstQuestion, /HP:0\(/);
    assert.ok(!pages.some(page => /You die\.\.\./.test(page)), 'a timeout death must not print a "You die..." line');
});
//# sourceMappingURL=strangulation_disclosure.test.js.map