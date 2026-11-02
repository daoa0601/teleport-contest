import test from 'node:test';
import assert from 'node:assert/strict';
import { W_TOOL } from '../js/const.js';
import { useCreamPie } from '../js/apply.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { BLINDFOLD, CREAM_PIE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { syncBlindness } from '../js/senses.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('applying a named cream pie includes its name before the blindness message', async () => {
    freshPlayableRoom();
    const pie = await addInventoryObject(CREAM_PIE, { invlet: 'a', oname: 'Dessert' });
    await applyInventoryObject(pie, ' ');
    assert.ok(game._messageHistory.includes('You immerse your face in the cream pie named Dessert.'), `Expected the named pie in the application message; saw ${game._messageHistory.join(' | ')}`);
    assert.equal(game._pending_message, "You can't see through all the sticky goop on your face.");
    assert.equal(pie.where, 'gone');
});
void test('applying a named stack describes one of the pies and consumes only one', async () => {
    freshPlayableRoom();
    const pies = await addInventoryObject(CREAM_PIE, { invlet: 'a', quan: 3, oname: 'Dessert' });
    await applyInventoryObject(pies, ' ');
    assert.ok(game._messageHistory.includes('You immerse your face in one of the cream pies named Dessert.'), `Expected one of the named pies in the application message; saw ${game._messageHistory.join(' | ')}`);
    assert.equal(pies.quan, 2);
    assert.equal(pies.where, 'inventory');
});
void test('a polymorphed hero puts cream on its own face and gets the matching blindness message', async () => {
    freshPlayableRoom({
        hero: { umonnum: MONSTER_NAME.indexOf('floating eye'), mtimedone: 100 },
    });
    const pie = await addInventoryObject(CREAM_PIE, { invlet: 'a' });
    pushKeys(' ');
    await useCreamPie(pie);
    assert.ok(game._messageHistory.includes('You immerse your body in the cream pie.'), `Expected the current form's face; saw ${game._messageHistory.join(' | ')}`);
    assert.equal(game._pending_message, "You can't see through all the sticky goop on your body.");
});
void test('an already blind polymorphed hero feels cream on its own face', async () => {
    freshPlayableRoom({
        hero: { umonnum: MONSTER_NAME.indexOf('floating eye'), mtimedone: 100, blindTurns: 5 },
    });
    const pie = await addInventoryObject(CREAM_PIE);
    pushKeys(' ');
    await useCreamPie(pie);
    assert.equal(game._pending_message, "There's sticky goop all over your body.");
    assert.ok((game.u.blindTurns ?? 0) > 5);
});
void test('a hero without eyes consumes the pie without a blindness or goop message', async () => {
    freshPlayableRoom({
        hero: { umonnum: MONSTER_NAME.indexOf('yellow light'), mtimedone: 100 },
    });
    const pie = await addInventoryObject(CREAM_PIE);
    await useCreamPie(pie);
    assert.equal(game._pending_message, 'You immerse your beam in the cream pie.');
    assert.equal(game.u.blindTurns ?? 0, 0);
    assert.equal(game.u.ucreamed ?? 0, 0);
    assert.equal(pie.where, 'gone');
});
void test('hallucinating while applying a named stack gives a facial and still consumes one pie', async () => {
    freshPlayableRoom({ hero: { hallucinationTurns: 20 } });
    const pies = await addInventoryObject(CREAM_PIE, { invlet: 'a', quan: 2, oname: 'Dessert' });
    await applyInventoryObject(pies, ' ');
    assert.ok(game._messageHistory.includes('You give yourself a facial.'), `Expected a hallucinated facial; saw ${game._messageHistory.join(' | ')}`);
    assert.equal(pies.quan, 1);
    assert.equal(game._pending_message, "You can't see through all the sticky goop on your face.");
});
void test('applying one pie from a stack blinds the hero without taking a turn', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const pies = await addInventoryObject(CREAM_PIE, {
        invlet: 'a',
        quan: 2,
        quantity: 2,
        owt: 20,
    });
    initRng(4301n);
    await applyInventoryObject(pies, ' ');
    assert.equal(pies.quan, 1);
    assert.equal(pies.quantity, 1);
    assert.equal(pies.where, 'inventory');
    assert.ok((game.u.blindTurns ?? 0) > 0);
    assert.equal(game.u.ucreamed, game.u.blindTurns);
    assert.equal(game.blind, true);
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /sticky goop/);
});
void test("a blindfold keeps an applied cream pie out of the hero's eyes", async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const blindfold = await addInventoryObject(BLINDFOLD, {
        invlet: 'b',
        worn: true,
        wornSlot: 'ublindf',
        owornmask: W_TOOL,
    });
    const pie = await addInventoryObject(CREAM_PIE, { invlet: 'a' });
    game.ublindf = game.u.ublindf = blindfold;
    syncBlindness(game);
    initRng(4302n);
    await applyInventoryObject(pie);
    assert.equal(pie.where, 'gone');
    assert.equal(game.inventory.includes(pie), false);
    assert.equal(game.u.blindTurns ?? 0, 0);
    assert.equal(game.u.ucreamed ?? 0, 0);
    assert.equal(game.context.move, 0);
});
void test('another cream pie adds more goop while the hero is already blind', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const pie = await addInventoryObject(CREAM_PIE, { invlet: 'a' });
    game.u.blindTurns = 5;
    game.u.ucreamed = 2;
    syncBlindness(game);
    initRng(4303n);
    await applyInventoryObject(pie, ' ');
    assert.ok((game.u.blindTurns ?? 0) > 5);
    assert.ok(game.u.ucreamed > 2);
    assert.equal(game._pending_message, "There's more sticky goop all over your face.");
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=cream_pie_apply.test.js.map