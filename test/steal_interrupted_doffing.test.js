import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core, performMonsterHeroAttack } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState, pushKey } from '../js/input.js';
import { LEATHER_ARMOR, OBJECT_NAMES } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenRow } from './support/screen.js';
const LOW_BOOTS = OBJECT_NAMES.indexOf('low boots');
// C do_wear.c:stop_donning() calls cancel_don(), which zeroes multi before
// -multi is captured, so steal.c:steal() always sees olddelay 0: an animal
// thief still runs out of patience with armor the hero is already doffing.
void test('a monkey can give up on boots the hero is already taking off', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const boots = await addInventoryObject(LOW_BOOTS);
    wearHeroArmor(boots);
    pushKey(boots.invlet);
    await rhack('T'.charCodeAt(0));
    const thief = await createMonsterAt('monkey', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    thief.mux = game.u.ux;
    thief.muy = game.u.uy;
    const input = resetInputState();
    installPagerInput(input, { expected: /monkey|boots/, limit: 12 });
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    await performMonsterHeroAttack(thief, game, { random: limit => limit - 1, rollOne: () => 1 });
    await flushPendingTopline();
    assert.ok(!thief.minvent.includes(boots), 'the impatient monkey leaves the boots');
    assert.ok(game.inventory.includes(boots), 'the hero keeps the boots');
});
// With olddelay always 0, steal.c:steal() restarts the suit's full oc_delay
// instead of the turns still owed on the interrupted doffing.
void test('a seduced hero restarts the full delay of a started suit removal', async () => {
    await freshObjectRoom({ flags: { female: true }, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const suit = await addInventoryObject(LEATHER_ARMOR);
    wearHeroArmor(suit);
    pushKey(suit.invlet);
    await rhack('T'.charCodeAt(0));
    game._moveloopStarted = true;
    game.u.umovement = 12;
    const started = game.moves;
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.moves - started, 1, 'One turn of the suit removal has elapsed');
    const thief = await createMonsterAt('water nymph', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    thief.mux = game.u.ux;
    thief.muy = game.u.uy;
    thief.movement = -100;
    const input = resetInputState();
    installPagerInput(input, { expected: /nymph|suit/, limit: 12 });
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    await performMonsterHeroAttack(thief, game, { random: () => 0, rollOne: () => 1 });
    assert.match(game._pending_message + messages.join('\n'), /You gladly continue removing your suit\./);
    assert.equal(game.uarm, null);
    assert.ok(game.inventory.includes(suit), 'the charmed suit waits for its theft delay');
    let reads = 0;
    input.display = { async readKey() {
            assert.ok(++reads <= 24, `Suit theft did not finish: ${game._pending_message}`);
            messages.push(game._pending_message);
            const row = requireScreenRow(0).map(cell => cell.ch).join('');
            return row.includes('--More--') ? 32 : 46;
        } };
    while (game.multi < 0)
        await moveloop_core();
    await flushPendingTopline();
    assert.equal(game.moves - started, 4, 'the theft restarts the three-turn suit delay');
    assert.ok(thief.minvent.includes(suit));
});
// C allmain.c counts negative multi down after movemon(); a nymph acting in
// that monster phase still restarts the whole suit delay.
void test('a nymph acting during suit removal restarts the full delay', async () => {
    await freshObjectRoom({ flags: { female: true }, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const suit = await addInventoryObject(LEATHER_ARMOR);
    wearHeroArmor(suit);
    pushKey(suit.invlet);
    await rhack('T'.charCodeAt(0));
    game._moveloopStarted = true;
    game.u.umovement = 12;
    const started = game.moves;
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.moves - started, 1, 'One turn of the suit removal has elapsed');
    const thief = await createMonsterAt('water nymph', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    thief.mux = game.u.ux;
    thief.muy = game.u.uy;
    thief.msleeping = 0;
    thief.movement = 12;
    const input = resetInputState();
    installPagerInput(input, { expected: /nymph|suit/, limit: 12 });
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    await moveloop_core();
    assert.match(game._pending_message + messages.join('\n'), /You gladly continue removing your suit\./);
    assert.equal(game.uarm, null);
    assert.ok(game.inventory.includes(suit), 'the charmed suit waits for its theft delay');
    let reads = 0;
    input.display = { async readKey() {
            assert.ok(++reads <= 24, `Suit theft did not finish: ${game._pending_message}`);
            messages.push(game._pending_message);
            const row = requireScreenRow(0).map(cell => cell.ch).join('');
            return row.includes('--More--') ? 32 : 46;
        } };
    while (game.multi < 0)
        await moveloop_core();
    await flushPendingTopline();
    assert.equal(game.moves - started, 4, 'the theft restarts the three-turn suit delay');
    assert.ok(thief.minvent.includes(suit));
});
//# sourceMappingURL=steal_interrupted_doffing.test.js.map