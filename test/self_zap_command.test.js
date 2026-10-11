import { installPagerInput } from './support/pager-input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { requireScreenRow } from './support/screen.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { rhack } from '../js/cmd.js';
import { flushPendingTopline, flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { playInstrument } from '../js/music.js';
import { AMULET_OF_LIFE_SAVING, BOULDER, FIRE_HORN, WAN_DEATH, WAN_FIRE, WAN_LIGHT, WAN_MAGIC_MISSILE, WAN_SLEEP, } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
function acknowledgeMessages(expected = /fire|magic|wand|horn|medallion|die|But wait/i) {
    const input = resetInputState();
    installPagerInput(input, { expected, limit: 100 });
}
void test('a self-directed wand damages the current monster body', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    installPolymorphedHero('ettin', { hitPoints: 200 });
    const wand = await addInventoryObject(WAN_FIRE, { spe: 2 });
    acknowledgeMessages();
    pushKeys(`${wand.invlet}.`);
    await rhack('z'.charCodeAt(0));
    assert.equal(game.u.uhp, 40);
    assert.ok(game.u.mh < 200);
    assert.ok(game.u.mh >= 128);
    assert.equal(wand.spe, 1);
    assert.equal(game.context.move, 1);
});
void test('the zap command honors a rebound self-direction key', async () => {
    freshObjectRoom({ hero: { sleepResistance: true } });
    requirePlayingGame(game);
    game.commandBindings.bindSpecialKey('~'.charCodeAt(0), 'getdir.self');
    const wand = await addInventoryObject(WAN_SLEEP, { spe: 2 });
    pushKeys(`${wand.invlet}~`);
    await rhack('z'.charCodeAt(0));
    assert.equal(game._pending_message, "You don't feel sleepy!");
    assert.equal(wand.spe, 1);
    assert.equal(game._helplessTurns, undefined);
});
void test('life saving permits a death-wand self-zap to complete its turn', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const wand = await addInventoryObject(WAN_DEATH, { spe: 2 });
    const input = resetInputState();
    input.feed(`${wand.invlet}.`);
    await answerPrompts(rhack('z'.charCodeAt(0)), input, [
        { prompt: /You irradiate yourself with pure energy!--More--/, keys: ' ' },
        { prompt: /You die\.  But wait\.\.\.  Your medallion begins to glow!--More--/, keys: ' ' },
    ]);
    assert.ok(!game.program_state.gameover);
    assert.ok(game.u.uhp > 0);
    assert.equal(amulet.where, 'gone');
    assert.equal(wand.spe, 1);
    assert.equal(game.context.move, 1);
});
void test('cancelling a horn direction spends a charge without discovering its type', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const horn = await addInventoryObject(FIRE_HORN, { spe: 2, typeKnown: false });
    acknowledgeMessages();
    pushKeys('y\x1b');
    await playInstrument(horn);
    assert.equal(horn.spe, 1);
    assert.ok(!game._knownObjectTypes?.has(FIRE_HORN));
    assert.equal(game.context.move, 1);
});
void test('cancelling a direction spends a charge without describing an unseen glow', async () => {
    freshObjectRoom({ hero: { blindTurns: 20 } });
    requirePlayingGame(game);
    const wand = await addInventoryObject(WAN_SLEEP, { spe: 2 });
    pushKeys(`${wand.invlet}\x1b`);
    await rhack('z'.charCodeAt(0));
    await flush_screen();
    assert.equal(wand.spe, 1);
    assert.equal(game.context.move, 1);
    assert.ok(!requireScreenRow(0).map(cell => cell.ch).join('').includes('glows'));
});
void test('a heavy load rejects zapping before selection or charge consumption', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const wand = await addInventoryObject(WAN_SLEEP, { spe: 2 });
    await addInventoryObject(BOULDER, { quan: 10 });
    await rhack('z'.charCodeAt(0));
    assert.equal(wand.spe, 2);
    assert.equal(game.context.move, 0);
    assert.equal(game._pending_message, "You can't do that while carrying so much stuff.");
});
void test('a charged shop wand accrues usage debt even when its direction is cancelled', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    const wand = await addInventoryObject(WAN_SLEEP, { spe: 2, unpaid: true });
    acknowledgeMessages();
    pushKeys(`${wand.invlet}\x1b`);
    await rhack('z'.charCodeAt(0));
    assert.ok(shopkeeper.eshk.debit > 0);
    assert.equal(wand.spe, 1);
    assert.equal(wand.unpaid, true);
});
void test('discovering a directionless wand awards score once and ends beginner status at the threshold', async () => {
    freshObjectRoom({ hero: { urexp: 1995 }, flags: { beginner: true } });
    requirePlayingGame(game);
    const wand = await addInventoryObject(WAN_LIGHT, { spe: 3, typeKnown: false });
    acknowledgeMessages(/A lit field surrounds you!/);
    assert.ok(wand.invlet);
    pushKeys(wand.invlet);
    await rhack('z'.charCodeAt(0));
    assert.equal(game.u.urexp, 2005);
    assert.equal(game.flags.beginner, false);
    assert.ok(game._knownObjectTypes !== undefined && game._knownObjectTypes !== null, 'Expected game._knownObjectTypes to be initialized');
    assert.ok(game._knownObjectTypes?.has(WAN_LIGHT));
    await flushPendingTopline();
    assert.ok(wand.invlet);
    pushKeys(wand.invlet);
    await rhack('z'.charCodeAt(0));
    assert.equal(game.u.urexp, 2005);
});
void test('physical protection halves self-wand damage but leaves magical horn damage intact', async () => {
    async function damageFrom(type, protectedHero) {
        freshObjectRoom({ hero: { uhp: 200, uhpmax: 200, halfPhysicalDamage: protectedHero } });
        requirePlayingGame(game);
        const object = await addInventoryObject(type, { spe: 2 });
        acknowledgeMessages();
        initRng(8345n);
        if (type === FIRE_HORN) {
            pushKeys('y.');
            await playInstrument(object);
        }
        else {
            pushKeys(`${object.invlet}.`);
            await rhack('z'.charCodeAt(0));
        }
        return 200 - game.u.uhp;
    }
    const wandDamage = await damageFrom(WAN_MAGIC_MISSILE, false);
    requirePlayingGame(game);
    assert.ok(wandDamage > 0);
    assert.equal(await damageFrom(WAN_MAGIC_MISSILE, true), Math.ceil(wandDamage / 2));
    requirePlayingGame(game);
    const hornDamage = await damageFrom(FIRE_HORN, false);
    requirePlayingGame(game);
    assert.ok(hornDamage > 0);
    assert.equal(await damageFrom(FIRE_HORN, true), hornDamage);
    requirePlayingGame(game);
});
//# sourceMappingURL=self_zap_command.test.js.map