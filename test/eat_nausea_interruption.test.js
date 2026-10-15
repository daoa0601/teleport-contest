import { advanceHeroVomiting } from './support/condition-turn.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { continueCountedCommand } from '../js/cmd.js';
import { NOT_HUNGRY } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { doeat } from '../js/eat.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { startHeroVomiting } from '../js/hero_illness.js';
import { makeConfused } from '../js/hero_mental_status.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, FOOD_RATION } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
function eatingRoom() {
    freshObjectRoom({ gameplaySeed: 71n, hero: { uhunger: 200, uhs: NOT_HUNGRY } });
    requirePlayingGame(game);
    const input = resetInputState();
    installPagerInput(input, {
        expected: /food|ration|lizard|corpse|eating|petrif|vomit/i, limit: 10,
    });
    return input;
}
void test('nausea stops an unfinished meal with feedback and leaves it available to resume', async () => {
    const input = eatingRoom();
    requirePlayingGame(game);
    const ration = await addInventoryObject(FOOD_RATION, { age: game.moves });
    input.feed(ration.invlet);
    await doeat();
    const nutrition = game.u.uhunger;
    startHeroVomiting({ turns: 7 });
    await advanceHeroVomiting();
    assert.match(game._lastPlineMessage, /You stop eating the food ration\./);
    assert.equal(game._occupation, null);
    assert.equal(ration.where, 'inventory');
    assert.equal(game.u.uhunger, nutrition);
    await flushPendingTopline();
    input.feed(ration.invlet);
    await doeat();
    assert.ok(game.u.uhunger > nutrition);
    assert.equal(game.u.uconduct.food, 1);
});
for (const turns of [7, 1]) {
    void test(`nausea with ${turns} turn${turns === 1 ? '' : 's'} remaining finishes a swallowed last bite before stopping`, async () => {
        const input = eatingRoom();
        requirePlayingGame(game);
        const lizard = await addInventoryObject(CORPSE, {
            corpsenm: MONSTER_NAME.indexOf('lizard'), age: game.moves,
        });
        input.feed(lizard.invlet);
        await doeat();
        for (let bite = 0; (lizard.oeaten ?? 0) > 1 && bite < 10; bite++)
            await continueCountedCommand(game);
        assert.equal(lizard.oeaten, 1);
        assert.ok(game._occupation, 'the final completion turn is still pending');
        startHeroVomiting({ turns });
        await advanceHeroVomiting();
        assert.equal(lizard.where, 'gone', 'the swallowed last bite is consumed when nausea interrupts eating');
        assert.equal(game.context.victual, null);
        assert.equal(game._occupation, null);
        if (turns === 7) {
            assert.equal(game.u.stunnedTurns, 2, 'lizard digestion limits the stun before nausea adds confusion');
            assert.ok((game.u.confusionTurns ?? 0) >= 2 && (game.u.confusionTurns ?? 0) <= 8);
        }
    });
}
void test('early nausea cancels repeated turns while allowing the meal to continue', async () => {
    const input = eatingRoom();
    requirePlayingGame(game);
    const ration = await addInventoryObject(FOOD_RATION, { age: game.moves });
    input.feed(ration.invlet);
    await doeat();
    game.multi = 3;
    startHeroVomiting({ turns: 10 });
    await advanceHeroVomiting();
    assert.equal(game.multi, 0);
    assert.equal(game._occupation?.key, 'eat-food');
    assert.equal(ration.where, 'inventory');
    assert.ok((game.u.confusionTurns ?? 0) >= 2);
});
void test('nausea describes existing confusion as slightly more confused', async () => {
    const input = eatingRoom();
    requirePlayingGame(game);
    const ration = await addInventoryObject(FOOD_RATION, { age: game.moves });
    input.feed(ration.invlet);
    await doeat();
    await makeConfused(20, { talk: false });
    startHeroVomiting({ turns: 12 });
    await advanceHeroVomiting();
    assert.equal(game._lastPlineMessage, 'You feel slightly more confused.');
    assert.equal(game._occupation?.key, 'eat-food');
});
//# sourceMappingURL=eat_nausea_interruption.test.js.map