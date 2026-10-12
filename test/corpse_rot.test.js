import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { W_WEP } from '../js/const.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { SACK } from '../js/object_data.js';
import { addObjectToContainer } from '../js/object_container.js';
import { OBJECT_TIMER_KIND, scheduleObjectTimer, stopAllObjectTimers } from '../js/object_timers.js';
import { runDueTimers } from '../js/timer_effects.js';
import { nearCapacity } from '../js/weight.js';
import { addInventoryObject, corpseObject } from './support/game-objects.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
for (const [species, quantity, wielded, expected] of [
    ['kobold', 1, false, 'Your kobold corpse rots away.'],
    ['goblin', 2, false, 'Your goblin corpses rot away.'],
    ['newt', 1, true, 'Your wielded newt corpse rots away!'],
    ['Oracle', 1, false, "Your Oracle's corpse rots away."],
]) {
    void test(`rotting ${wielded ? 'wielded ' : ''}${species} flesh names the corpse and its quantity`, async () => {
        freshObjectRoom({ flags: { verbose: true } });
        requirePlayingGame(game);
        const corpse = await corpseObject(MONSTER_NAME.indexOf(species), { quan: quantity, where: 'inventory' });
        game.inventory.push(corpse);
        if (wielded) {
            game.uwep = corpse;
            corpse.owornmask = W_WEP;
        }
        stopAllObjectTimers(corpse);
        scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.ROT_CORPSE, game.moves);
        await runDueTimers();
        assert.equal(game._pending_message, expected);
        assert.equal(game.inventory.includes(corpse), false);
        assert.equal(corpse.where, 'gone');
        if (wielded)
            assert.equal(game.uwep, null);
    });
}
void test('a visible floor corpse rots silently', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const corpse = placeCreatedObject(await corpseObject(MONSTER_NAME.indexOf('newt')), 11, 10);
    stopAllObjectTimers(corpse);
    scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.ROT_CORPSE, game.moves);
    await runDueTimers();
    assert.equal(corpse.where, 'gone');
    assert.equal(game._pending_message, '');
});
for (const stoneResistant of [false, true]) {
    void test(`rotting safe cover ${stoneResistant ? 'keeps a stone-resistant hero hidden' : 'exposes a hero'} above petrifying corpses`, async () => {
        freshRoomWithPolymorphedHero('garter snake');
        requirePlayingGame(game);
        const safeCorpse = placeCreatedObject(await corpseObject(MONSTER_NAME.indexOf('newt')), game.u.ux, game.u.uy);
        const petrifyingCorpse = placeCreatedObject(await corpseObject(MONSTER_NAME.indexOf('cockatrice')), game.u.ux, game.u.uy);
        stopAllObjectTimers(petrifyingCorpse);
        stopAllObjectTimers(safeCorpse);
        scheduleObjectTimer(safeCorpse, OBJECT_TIMER_KIND.ROT_CORPSE, game.moves);
        game.u.stoneResistance = stoneResistant;
        game.u.uundetected = 1;
        await runDueTimers();
        assert.equal(safeCorpse.where, 'gone');
        assert.equal(petrifyingCorpse.where, 'floor');
        assert.equal(game.u.uundetected, stoneResistant ? 1 : 0);
        assert.equal(game._pending_message, '');
    });
}
void test('turn maintenance reports relief immediately after a heavy corpse rots', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const corpse = await corpseObject(MONSTER_NAME.indexOf('red dragon'), { where: 'inventory' });
    game.inventory.push(corpse);
    stopAllObjectTimers(corpse);
    scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.ROT_CORPSE, game.moves + 1);
    game._encumbranceLevel = nearCapacity(game);
    assert.ok(game._encumbranceLevel > 0);
    game._capacityDirty = false;
    game._moveloopStarted = true;
    game._heroTimePending = true;
    game.u.umovement = 0;
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /corpse|unencumbered/, limit: 4 });
    await finishAtCommandInput(input, moveloop_core, /corpse|unencumbered/);
    assert.match(messages.join('\n'), /Your red dragon corpse rots away\./);
    assert.match(messages.join('\n'), /Your movements are now unencumbered\./);
    assert.equal(game._encumbranceLevel, 0);
});
void test('turn maintenance reports relief when a corpse rots inside a carried sack', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const sack = await addInventoryObject(SACK);
    const corpse = await corpseObject(MONSTER_NAME.indexOf('red dragon'));
    await addObjectToContainer(sack, corpse);
    stopAllObjectTimers(corpse);
    scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.ROT_CORPSE, game.moves + 1);
    game._encumbranceLevel = nearCapacity(game);
    assert.ok(game._encumbranceLevel > 0);
    game._capacityDirty = false;
    game._moveloopStarted = true;
    game._heroTimePending = true;
    game.u.umovement = 0;
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /unencumbered/, limit: 4 });
    await finishAtCommandInput(input, moveloop_core, /unencumbered/);
    assert.equal(corpse.where, 'gone');
    assert.equal(sack.contents?.length, 0);
    assert.match(messages.join('\n'), /Your movements are now unencumbered\./);
    assert.equal(game._encumbranceLevel, 0);
    assert.equal(game.u._encumbrance, '');
});
//# sourceMappingURL=corpse_rot.test.js.map