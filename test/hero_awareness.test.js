import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { clearMessageWindow } from '../js/display.js';
import { game } from '../js/gstate.js';
import { getHungry } from '../js/hunger.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { POT_BLINDNESS, POT_BOOZE, POT_PARALYSIS } from '../js/object_data.js';
import { applySupportedPotionVapor } from '../js/potion_hit.js';
import { heroCanControlPolymorph, polymonHero } from '../js/polyself.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { pushKey, resetInputState } from '../js/input.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { wearPolymorphControlRing } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a sleeping hero does not notice blindness from potion vapor', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    await putHeroToSleep(20);
    await applySupportedPotionVapor({ potion: await knownObject(POT_BLINDNESS) });
    assert.ok((game.u.blindTurns ?? 0) > 0);
    assert.doesNotMatch(game._pending_message || '', /It suddenly gets dark/u);
});
void test('paralysis does not prevent the hero from noticing blindness', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    await applySupportedPotionVapor({ potion: await knownObject(POT_PARALYSIS) });
    clearMessageWindow();
    await applySupportedPotionVapor({ potion: await knownObject(POT_BLINDNESS) });
    assert.ok((game.u.blindTurns ?? 0) > 0);
    assert.match(game._pending_message, /It suddenly gets dark/u);
});
void test('a sleeping hero cannot choose a polymorph despite a control ring', async () => {
    freshObjectRoom();
    await wearPolymorphControlRing();
    assert.equal(heroCanControlPolymorph(), true);
    await putHeroToSleep(20);
    assert.equal(heroCanControlPolymorph(), false);
});
void test('sleep slows ordinary metabolism but being awake does not', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const awakeHunger = game.u.uhunger;
    for (let turn = 0; turn < 20; turn++)
        await getHungry();
    assert.equal(awakeHunger - game.u.uhunger, 20);
    await putHeroToSleep(40);
    const asleepHunger = game.u.uhunger;
    for (let turn = 0; turn < 20; turn++)
        await getHungry();
    assert.ok(game.u.uhunger > asleepHunger - 20);
});
for (const [species, foodCost] of [['rock mole', 1], ['yellow mold', 0]]) {
    void test(`ordinary metabolism respects a ${species}'s diet`, async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        const input = resetInputState();
        input.beforeRead = () => input.feed(' ');
        await polymonHero(MONSTER_NAME.indexOf(species));
        const nutrition = game.u.uhunger;
        await getHungry();
        assert.equal(nutrition - game.u.uhunger, foodCost);
    });
}
void test('passing out from cursed booze prevents controlled polymorph', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    await wearPolymorphControlRing();
    const booze = await addInventoryObject(POT_BOOZE, {
        cursed: true, typeKnown: true,
    });
    assert.ok(booze.invlet);
    pushKey(booze.invlet);
    await rhack('q'.charCodeAt(0));
    assert.ok((game._helplessTurns ?? 0) > 0);
    assert.equal(heroCanControlPolymorph(), false);
});
//# sourceMappingURL=hero_awareness.test.js.map