import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { heroGoldObject, setHeroGoldAmount } from '../js/hero_gold.js';
import { queueCommandKeys, resetInputState } from '../js/input.js';
import { CLUB, DAGGER, GOLD_PIECE } from '../js/object_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput, withMessagePages } from './support/planned-input.js';
import { requireScreenRow } from './support/screen.js';

void test('a normal gold purse has no inventory letter adjustment action', async () => {
    freshObjectRoom();
    setHeroGoldAmount(game, 37);
    const input = resetInputState();
    let actions = '';
    input.beforeRead = () => {
        actions = Array.from({ length: 15 }, (_, row) =>
            requireScreenRow(row).map(cell => cell.ch).join('')).join('\n');
    };

    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Coins/, keys: '$' },
        { prompt: /Do what with/, keys: '\x1b' },
    ]);

    assert.doesNotMatch(actions, /Adjust inventory by assigning new letter/);
    assert.equal(heroGoldObject(game)?.invlet, '$');
});

void test('#adjust cannot move an inventory containing only a normal gold purse', async t => {
    freshObjectRoom();
    setHeroGoldAmount(game, 37);
    const input = resetInputState();
    input.feed('adjust\r');
    planInput(input, t, []);

    await rhack('#'.charCodeAt(0));

    assert.equal(game._pending_message, "You aren't carrying anything adjustable.");
    assert.equal(heroGoldObject(game)?.invlet, '$');
    assert.equal(game.context.move, 0);
});

void test('#adjust rejects a typed normal purse alongside an adjustable weapon', async t => {
    freshObjectRoom();
    setHeroGoldAmount(game, 37);
    await addInventoryObject(DAGGER);
    const input = resetInputState();
    input.feed('adjust\r');
    planInput(input, t, [{ prompt: /What do you want to adjust\? \[a or \?\*\]/, keys: '$' }]);

    await rhack('#'.charCodeAt(0));

    assert.equal(game._pending_message, 'You cannot adjust gold.');
    assert.equal(heroGoldObject(game)?.invlet, '$');
    assert.equal(game.context.move, 0);
});

void test('#adjust repairs a second gold stack without requesting a destination', async t => {
    freshObjectRoom();
    setHeroGoldAmount(game, 37);
    const misplaced = await knownObject(GOLD_PIECE, { quan: 12 });
    misplaced.where = 'inventory';
    misplaced.invlet = 'z';
    game.inventory.push(misplaced);
    const input = resetInputState();
    input.feed('adjust\r');
    queueCommandKeys('z');
    planInput(input, t, []);

    await withMessagePages(() => rhack('#'.charCodeAt(0)), input,
        /adjust: gold in wrong slot and multiple gold stacks|Program in disorder|Please report/, 4);

    assert.equal(game.inventory.filter(object => object.oclass === 12).length, 1);
    assert.equal(heroGoldObject(game)?.invlet, '$');
    assert.equal(heroGoldObject(game)?.quan, 49);
    assert.match(game._pending_message, /^Merging: \$ - 49 gold pieces\./);
    assert.equal(game.context.move, 0);
});

void test('gold repair keeps lowercase items first when inventory letters later float', async t => {
    freshObjectRoom();
    setHeroGoldAmount(game, 37);
    const dagger = await addInventoryObject(DAGGER, { invlet: 'b' });
    const club = await addInventoryObject(CLUB, { invlet: 'A' });
    const misplaced = await knownObject(GOLD_PIECE, { quan: 12 });
    misplaced.where = 'inventory';
    misplaced.invlet = 'z';
    game.inventory.push(misplaced);
    const input = resetInputState();
    input.feed('adjust\r');
    queueCommandKeys('z');
    planInput(input, t, [{ prompt: /Coins/, keys: '\x1b' }]);

    await withMessagePages(() => rhack('#'.charCodeAt(0)), input,
        /adjust: gold in wrong slot and multiple gold stacks|Program in disorder|Please report/, 4);
    game.flags.fixinv = false;
    await rhack('i'.charCodeAt(0));

    assert.equal(dagger.invlet, 'a');
    assert.equal(club.invlet, 'b');
    assert.equal(heroGoldObject(game)?.invlet, '$');
});

void test('moving a weapon keeps lowercase items first when inventory letters later float', async t => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER, { invlet: 'b' });
    const club = await addInventoryObject(CLUB, { invlet: 'A' });
    const input = resetInputState();
    input.feed('adjust\r');
    queueCommandKeys('b');
    planInput(input, t, [
        { prompt: /Adjust letter to what/, keys: 'c' },
        { prompt: /Weapons/, keys: '\x1b' },
    ]);

    await rhack('#'.charCodeAt(0));
    game.flags.fixinv = false;
    await rhack('i'.charCodeAt(0));

    assert.equal(dagger.invlet, 'a');
    assert.equal(club.invlet, 'b');
});
