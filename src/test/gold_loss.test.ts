import { nearCapacity } from '../js/weight.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { moveloop_core } from '../js/allmain.js';
import { freshTurnRoom } from './support/playable-room.js';
import { THRONE } from '../js/const.js';
import { requireGameDisplay, game } from '../js/gstate.js';
import { heroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { GOLD_PIECE, SACK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { throneSitEffect } from '../js/throne.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a throne takes readied gold but leaves gold inside a carried bag', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requireFixtureGame(game);
    game.level.requireAt(10, 10).typ = THRONE;
    const purse = await addInventoryObject(GOLD_PIECE, { quan: 23 });
    const bag = await addInventoryObject(SACK);
    const hidden = await addCreatedObjectToContainer(bag,
        await knownObject(GOLD_PIECE, { quan: 17 }));
    const input = resetInputState();
    input.feed('$');
    await rhack('Q'.charCodeAt(0));
    assert.equal(game.uquiver, purse);
    initRng(25n);
    const answers = [...'5\n'];
    const messages: string[] = [];
    input.beforeRead = () => {
        const message = game._pending_message || '';
        messages.push(message);
        const row = requireGameDisplay(game).grid[0];
        assert.ok(row);
        const top = row.map(cell => cell.ch).join('');
        input.feed(top.includes('--More--') ? ' '
            : message.includes('Analyze throne?') ? 'n'
                : answers.shift() || ' ');
    };

    await throneSitEffect();

    assert.equal(heroGoldAmount(game), 0);
    assert.equal(purse.where, 'gone');
    assert.equal(game.uquiver, null);
    assert.equal(game.u.uquiver, null);
    assert.ok(bag.contents !== null && bag.contents !== undefined);
    assert.ok(hidden);
    assert.equal(bag.contents.includes(hidden), true);
    assert.ok(hidden !== null && hidden !== undefined);
    assert.equal(hidden.quan, 17);
    messages.push(game._pending_message || '');
    assert.match(messages.join('\n'), /You notice you have no gold!/u);
});


void test('losing a heavy purse removes its encumbrance on the next command boundary', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    game.flags.debug = true;
    game.level.requireAt(10, 10).typ = THRONE;
    await addInventoryObject(GOLD_PIECE, { quan: 100100 });
    const messages: string[] = [];
    let keys = ['.'];
    const finishCommand = () => {
        const row = requireGameDisplay(game).grid[0];
        assert.ok(row);
        const top = row.map(cell => cell.ch).join('');
        messages.push(game._pending_message || '');
        input.feed(top.includes('--More--') ? ' ' : keys.shift() ?? 27);
    };
    input.beforeRead = finishCommand;
    await moveloop_core();
    await moveloop_core();
    assert.ok(nearCapacity(game) > 0);
    initRng(25n);
    keys = [...'#sit\n5\n'];
    let reads = 0;
    input.beforeRead = () => {
        messages.push(game._pending_message || '');
        const row = requireGameDisplay(game).grid[0];
        assert.ok(row);
        const top = row.map(cell => cell.ch).join('');
        assert.ok(++reads < 40, `Unexpected input loop: ${top}`);
        input.feed(top.includes('--More--') ? ' ' : keys.shift() || 'n');
    };

    await moveloop_core();
    assert.equal(heroGoldAmount(game), 0);
    input.beforeRead = finishCommand;
    await moveloop_core();

    assert.equal(nearCapacity(game), 0);
    assert.match(messages.join('\n'), /Your movements are now unencumbered/u);
});
