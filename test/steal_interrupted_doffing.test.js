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
// C steal.c:stop_donning() reports the remaining turns only for the armor
// whose doffing it silently stops; steal.c:steal() then skips the animal
// patience refusal and its rn2(10) roll for that armor.
void test('a monkey takes boots the hero is already taking off', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
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
    const calls = [];
    await performMonsterHeroAttack(thief, game, {
        random: limit => limit - 1, rollOne: () => 1, calls,
    });
    await flushPendingTopline();
    assert.ok(thief.minvent.includes(boots), 'the monkey leaves with the boots');
    assert.match(messages.join('\n'), /The monkey takes off your .*pair of low boots\./);
    assert.match(messages.join('\n'), /The monkey stole an? .*pair of low boots\./);
    assert.equal(calls.filter(call => call === 'rn2(10)').length, 0, 'an interrupted doffing disarms the patience refusal and its roll');
    assert.match(messages.join('\n'), /tries to run away with your/);
});
// C steal.c:steal() shortens the seduction delay to the turns still owed on
// the interrupted doffing instead of restarting the full armor delay.
void test('a seduced hero finishes only the remaining turns of a started suit removal', async () => {
    freshObjectRoom({ flags: { female: true }, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
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
    assert.equal(game.moves - started, 3, 'the theft takes the two remaining turns, not three new turns');
    assert.ok(thief.minvent.includes(suit));
});
//# sourceMappingURL=steal_interrupted_doffing.test.js.map