// C timeout.c:burn_object() warning branches that earlier coverage left
// unpinned: the candelabrum's own burnout prose in singular and plural, the
// lamp threshold ladder (150/100/50/25/0) with seen floor and monster-carried
// variants, and the by-touch notices a blind hero still receives.
import test from 'node:test';
import assert from 'node:assert/strict';
import { beginObjectBurn } from '../js/light.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { flush_screen } from '../js/display.js';
import { runDueTimers } from '../js/timer_effects.js';
import { NO_MINVENT } from '../js/const.js';
import { BRASS_LANTERN, CANDELABRUM_OF_INVOCATION, OIL_LAMP } from '../js/object_data.js';
import { cansee, vision_recalc, vision_reset } from '../js/vision.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { resetInputState } from '../js/input.js';
import { installPagerInput } from './support/pager-input.js';
import { createMonsterAt } from './support/monsters.js';
function screen() {
    assert.ok(game.nhDisplay);
    return game.nhDisplay.grid.map((row) => row.map((cell) => cell.ch).join('')).join('\n');
}
function freshDark() {
    const level = freshObjectRoom({ left: 2, right: 30 });
    requirePlayingGame(game);
    for (let x = 2; x <= 30; x++)
        for (let y = 6; y <= 14; y++) {
            level.requireAt(x, y).lit = false;
            level.requireAt(x, y).waslit = false;
        }
    vision_reset();
    vision_recalc(0);
    const input = resetInputState();
    installPagerInput(input, {
        expected: /candle|Candle|lamp|Lamp|lantern|Lantern|candelabrum|Candelabrum|flame|Flame|dim|power|shriek|Batteries/,
        limit: 24,
    });
    return input;
}
async function announce() {
    await runDueTimers();
    await flush_screen(1);
    return screen();
}
void test('a carried candelabrum announces each burnout stage in its own words', async () => {
    freshDark();
    const holder = await addInventoryObject(CANDELABRUM_OF_INVOCATION, { spe: 3, age: 76 });
    beginObjectBurn(holder);
    game.moves++;
    await announce();
    assert.match(screen(), /Your candelabrum's candles are getting short\./);
    game.moves += 60;
    await announce();
    assert.match(screen(), /Your candelabrum's candles' flames flicker low!/);
    game.moves += 15;
    await announce();
    assert.match(screen(), /Your candelabrum's flames die\./);
    assert.equal(holder.spe, 0);
    assert.equal(holder.lamplit, false);
});
void test('a floor candelabrum the hero can see uses the seen forms', async () => {
    freshDark();
    const torch = await addInventoryObject(OIL_LAMP, { age: 1500 });
    beginObjectBurn(torch);
    const holder = await floorObject(CANDELABRUM_OF_INVOCATION, 20, 10, { spe: 1, age: 76 });
    beginObjectBurn(holder);
    vision_recalc(0);
    assert.equal(cansee(20, 10), true);
    game.moves++;
    await announce();
    assert.match(screen(), /You see a candelabrum's candle getting short\./);
    game.moves += 60;
    await announce();
    assert.match(screen(), /You see a candelabrum's candle's flame flicker low!/);
    game.moves += 15;
    await announce();
    assert.match(screen(), /You see a candelabrum's flame die\./);
});
void test('a carried oil lamp walks the whole warning ladder down to going out', async () => {
    freshDark();
    const lamp = await addInventoryObject(OIL_LAMP, { age: 151 });
    beginObjectBurn(lamp);
    game.moves++;
    await announce();
    game.moves += 50;
    await announce();
    assert.match(game._pending_message ?? '', /Your oil lamp flickers\.\s+Your oil lamp flickers\./);
    game.moves += 50;
    await announce();
    assert.match(game._pending_message ?? '', /Your oil lamp flickers considerably\./);
    game.moves += 25;
    await announce();
    assert.match(game._pending_message ?? '', /Your oil lamp seems about to go out\./);
    game.moves += 25;
    await announce();
    assert.match(game._pending_message ?? '', /Your oil lamp has gone out\./);
    assert.equal(lamp.lamplit, false);
});
void test('a hallucinating hero is reminded about lantern batteries', async () => {
    freshDark();
    game.u.hallucinationTurns = 100;
    const lantern = await addInventoryObject(BRASS_LANTERN, { age: 151 });
    beginObjectBurn(lantern);
    game.moves++;
    await announce();
    assert.match(game._pending_message ?? '', /Your lantern is getting dim\.\s+Batteries have not been invented yet\./);
});
void test('a monster-carried lamp reports through its carrier at both warnings', async () => {
    freshDark();
    const torch = await addInventoryObject(OIL_LAMP, { age: 1500 });
    beginObjectBurn(torch);
    const soldier = await createMonsterAt('soldier', 20, 10, NO_MINVENT);
    const lamp = await addObjectToMonsterInventory(soldier, await knownObject(OIL_LAMP, { age: 26 }));
    assert.ok(lamp);
    beginObjectBurn(lamp);
    vision_recalc(0);
    game.moves++;
    await announce();
    assert.match(screen(), /The soldier's lamp seems about to go out\./);
    game.moves += 25;
    await announce();
    assert.match(screen(), /The soldier's lamp has gone out\./);
});
// timeout.c computes bytouch for carried lights but excludes brass
// lanterns: a blind hero feels the lamp go out yet learns nothing from the
// lantern.
void test('a blind hero feels a carried lamp expire by its heat', async () => {
    freshDark();
    game.u.blindTurns = 10;
    const lamp = await addInventoryObject(OIL_LAMP, { age: 1 });
    beginObjectBurn(lamp);
    game.moves++;
    await announce();
    assert.match(screen(), /Your oil lamp has gone out\./);
    assert.equal(lamp.lamplit, false);
});
void test('a blind hero gets no lantern expiry notice', async () => {
    freshDark();
    game.u.blindTurns = 10;
    const lantern = await addInventoryObject(BRASS_LANTERN, { age: 1 });
    beginObjectBurn(lantern);
    game.moves++;
    await announce();
    assert.doesNotMatch(screen(), /lantern|power|gone out/);
    assert.equal(lantern.lamplit, false);
});
//# sourceMappingURL=light_burn_messages.test.js.map