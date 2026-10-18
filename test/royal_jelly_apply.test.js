import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { DAGGER, EGG, LUMP_OF_ROYAL_JELLY, } from '../js/object_data.js';
import { OBJECT_TIMER_KIND, objectTimers, scheduleObjectTimer, stopAllObjectTimers, } from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { useRoyalJelly } from '../js/royal_jelly.js';
import { applyInventoryObject, runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshPlayableRoom } from './support/playable-room.js';
const PM_KILLER_BEE = MONSTER_NAME.indexOf('killer bee');
const PM_QUEEN_BEE = MONSTER_NAME.indexOf('queen bee');
const PM_CAVE_SPIDER = MONSTER_NAME.indexOf('cave spider');
void test('blessed royal jelly turns a killer bee egg into a queen bee egg', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const jelly = await addInventoryObject(LUMP_OF_ROYAL_JELLY, {
        invlet: 'a',
        blessed: true,
        quan: 2,
        quantity: 2,
    });
    const egg = await addInventoryObject(EGG, {
        invlet: 'b',
        corpsenm: PM_KILLER_BEE,
        spe: 0,
    });
    initRng(4401n);
    await applyInventoryObject(jelly, 'b ');
    assert.equal(jelly.quan, 1);
    assert.equal(egg.corpsenm, PM_QUEEN_BEE);
    assert.equal(egg.spe, 2);
    assert.equal(objectTimers(egg)[0]?.kind, OBJECT_TIMER_KIND.HATCH_EGG);
    assert.equal(game.context.move, 1);
});
void test('rubbing cursed royal jelly on an egg stops it from hatching', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const jelly = await addInventoryObject(LUMP_OF_ROYAL_JELLY, {
        invlet: 'a',
        cursed: true,
    });
    const egg = await addInventoryObject(EGG, {
        invlet: 'b', corpsenm: PM_CAVE_SPIDER,
    });
    scheduleObjectTimer(egg, OBJECT_TIMER_KIND.HATCH_EGG, 200, game);
    initRng(4402n);
    pushKeys('rub\nab ');
    await rhack('#'.charCodeAt(0));
    assert.equal(jelly.where, 'gone');
    assert.equal(game.inventory.includes(jelly), false);
    assert.equal(objectTimers(egg).length, 0);
    assert.match(game._pending_message, /quivers feebly/);
    assert.equal(game.context.move, 1);
});
// C use_royal_jelly() frees the split-off lump before prompting, and
// unsplitobj() never rejoins a free object, so the lump is lost.
void test('cancelling royal jelly from a stack loses the split-off lump', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const jelly = await addInventoryObject(LUMP_OF_ROYAL_JELLY, {
        invlet: 'a',
        quan: 2,
        quantity: 2,
    });
    initRng(4403n);
    await applyInventoryObject(jelly, '\x1b');
    assert.deepEqual(game.inventory, [jelly]);
    assert.equal(jelly.quan, 1);
    assert.equal(jelly.quantity, 1);
    assert.equal(game.context.move, 0);
    assert.equal(game._pending_message, 'Never mind.');
});
for (const command of ['apply', 'rub']) {
    void test(`${command} uses one lump on the whole egg stack without announcing a count`, async () => {
        freshPlayableRoom();
        const jelly = await addInventoryObject(LUMP_OF_ROYAL_JELLY, { cursed: true, quan: 2 });
        const eggs = await addInventoryObject(EGG, { corpsenm: PM_KILLER_BEE, quan: 2 });
        const input = resetInputState();
        await answerPrompts(runExtendedCommand(command), input, [
            { prompt: /What do you want to (?:use or apply|rub)\?/, keys: jelly.invlet },
            { prompt: /What do you want to rub the royal jelly on\?/, keys: eggs.invlet },
        ]);
        assert.equal(game._pending_message, 'You smear royal jelly all over your eggs.  The eggs quiver feebly.');
        assert.equal(eggs.quan, 2);
        assert.equal(eggs.corpsenm, PM_QUEEN_BEE);
        assert.equal(objectTimers(eggs).length, 0);
        assert.equal(jelly.quan, 1);
        assert.equal(game.context.move, 1);
    });
}
void test('blessed jelly cannot make a sterile egg hatch or treat the hero as its parent', async () => {
    freshPlayableRoom();
    const jelly = await addInventoryObject(LUMP_OF_ROYAL_JELLY, { blessed: true });
    const egg = await addInventoryObject(EGG, { corpsenm: -1, spe: 0 });
    stopAllObjectTimers(egg);
    await applyInventoryObject(jelly, egg.invlet);
    assert.equal(egg.spe, 0);
    assert.equal(objectTimers(egg).length, 0);
    assert.match(game._pending_message, /Nothing seems to happen\./);
    assert.equal(jelly.where, 'gone');
    assert.equal(game.context.move, 1);
});
void test('uncursed jelly restarts hatching for a viable dead egg', async () => {
    freshPlayableRoom();
    const jelly = await addInventoryObject(LUMP_OF_ROYAL_JELLY);
    const egg = await addInventoryObject(EGG, { corpsenm: PM_CAVE_SPIDER, spe: 0 });
    stopAllObjectTimers(egg);
    await applyInventoryObject(jelly, egg.invlet);
    const hatch = objectTimers(egg)[0];
    assert.equal(hatch?.kind, OBJECT_TIMER_KIND.HATCH_EGG);
    assert.ok(hatch && hatch.deadline >= game.moves + 151 && hatch.deadline <= game.moves + 200);
    assert.equal(egg.spe, 0);
    assert.match(game._pending_message, /The egg quivers briefly\./);
    assert.equal(game.context.move, 1);
});
void test('blessed jelly preserves a laid egg and its scheduled hatch time', async () => {
    freshPlayableRoom();
    const jelly = await addInventoryObject(LUMP_OF_ROYAL_JELLY, { blessed: true });
    const egg = await addInventoryObject(EGG, { corpsenm: PM_CAVE_SPIDER, spe: 1 });
    stopAllObjectTimers(egg);
    scheduleObjectTimer(egg, OBJECT_TIMER_KIND.HATCH_EGG, game.moves + 25, game);
    await applyInventoryObject(jelly, egg.invlet);
    assert.equal(egg.spe, 1);
    assert.equal(objectTimers(egg)[0]?.deadline, game.moves + 25);
    assert.match(game._pending_message, /Nothing seems to happen\./);
});
void test('royal jelly still asks for a target without any eggs and returns a cancelled single lump', async () => {
    freshPlayableRoom();
    const jelly = await addInventoryObject(LUMP_OF_ROYAL_JELLY);
    const input = resetInputState();
    await answerPrompts(runExtendedCommand('rub'), input, [
        { prompt: /What do you want to rub\?/, keys: jelly.invlet },
        { prompt: /What do you want to rub the royal jelly on\? \[\*\]/, keys: '\x1b' },
    ]);
    assert.ok(game.inventory.includes(jelly));
    assert.equal(jelly.where, 'inventory');
    assert.equal(game.context.move, 0);
});
void test('royal jelly smeared on another object is consumed without changing that object', async () => {
    freshPlayableRoom();
    const jelly = await addInventoryObject(LUMP_OF_ROYAL_JELLY, { blessed: true });
    const dagger = await addInventoryObject(DAGGER, { spe: 0 });
    const used = await useRoyalJelly(jelly, () => dagger);
    assert.equal(used, true);
    assert.equal(jelly.where, 'gone');
    assert.equal(dagger.spe, 0);
    assert.equal(objectTimers(dagger).length, 0);
    assert.match(game._pending_message, /You smear royal jelly all over your dagger\.  Nothing happens\./);
});
//# sourceMappingURL=royal_jelly_apply.test.js.map