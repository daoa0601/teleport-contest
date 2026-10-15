import { ensureQuestStatus } from '../js/quest.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroArmor } from '../js/armor.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { gameLogEvents } from '../js/gamelog.js';
import { resetInputState } from '../js/input.js';
import { addInventoryItem } from '../js/u_init.js';
import { ALCHEMY_SMOCK, CANDY_BAR, CAN_OF_GREASE, CORNUTHAUM, CREDIT_CARD, DUNCE_CAP, FORTUNE_COOKIE, HAWAIIAN_SHIRT, MAGIC_MARKER, OBJECT_NAMES, RING_MAIL, SCR_BLANK_PAPER, SPE_FORCE_BOLT, } from '../js/object_data.js';
import { readOrdinaryObject } from '../js/readable_objects.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { objectTypeKnown } from '../js/shk.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
const T_SHIRT = OBJECT_NAMES.indexOf('T-shirt');
const GOLD_PIECE = OBJECT_NAMES.indexOf('gold piece');
function readingRoom(options = {}) {
    freshObjectRoom({ ...options, flags: { verbose: true, ...options.flags } });
    requirePlayingGame(game);
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => {
        if (game._pending_message)
            messages.push(game._pending_message);
        const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        if (text.includes('--More--'))
            input.feed(' ');
        else {
            assert.match(text, /\(end\)|Call /, `unexpected reading prompt: ${text}`);
            input.feed('\x1b');
        }
    };
    return { input, messages };
}
async function readingOutput(messages) {
    await flushPendingTopline();
    return [...messages, game._pending_message || ''].join('\n');
}
void test('reading a fortune cookie consumes one without granting nutrition and records literacy once', async () => {
    const { messages } = readingRoom();
    requirePlayingGame(game);
    const cookie = await addInventoryObject(FORTUNE_COOKIE, { quan: 2 });
    const hunger = game.u.uhunger;
    const result = await readOrdinaryObject(cookie);
    await readOrdinaryObject(cookie);
    assert.equal(result.spentTime, true);
    assert.equal(game.u.uhunger, hunger);
    assert.equal(cookie.where, 'gone');
    assert.equal(game.u.uconduct.literate, 2);
    assert.deepEqual(gameLogEvents().map(event => event.text), ['became literate by reading a fortune cookie']);
    assert.match(await readingOutput(messages), /break up the cookie/);
});
void test('a blind hero breaks a cookie without becoming literate', async () => {
    const { messages } = readingRoom();
    requirePlayingGame(game);
    const cookie = await addInventoryObject(FORTUNE_COOKIE);
    setHeroBlindnessTurns(10);
    const result = await readOrdinaryObject(cookie);
    assert.equal(result.spentTime, true);
    assert.equal(cookie.where, 'gone');
    assert.equal(game.u.uconduct.literate || 0, 0);
    assert.match(await readingOutput(messages), /cannot read it/);
});
for (const type of [T_SHIRT, ALCHEMY_SMOCK]) {
    void test(`reading an eroded garment of type ${type} retains the garment and counts literacy`, async () => {
        const { messages } = readingRoom();
        requirePlayingGame(game);
        game.ubirthday = 12345;
        const garment = await addInventoryObject(type, { oeroded: 3 });
        const result = await readOrdinaryObject(garment);
        assert.equal(result.spentTime, true);
        assert.equal(game.inventory.includes(garment), true);
        assert.equal(garment.oeroded, 3);
        assert.equal(game.u.uconduct.literate, 1);
        const output = await readingOutput(messages);
        assert.match(output, /It reads:/);
        assert.match(output, /\?/);
    });
}
void test('a suit covers a worn T-shirt but not a shirt held in the pack', async () => {
    const { messages } = readingRoom();
    requirePlayingGame(game);
    const worn = await addInventoryObject(T_SHIRT);
    await wearHeroArmor(worn);
    await wearHeroArmor(await addInventoryObject(RING_MAIL));
    const blocked = await readOrdinaryObject(worn);
    assert.equal(blocked.spentTime, false);
    assert.equal(game.u.uconduct.literate || 0, 0);
    assert.match(await readingOutput(messages), /shirt is obscured by your mail/);
    const carried = await addInventoryObject(T_SHIRT);
    const result = await readOrdinaryObject(carried);
    assert.equal(result.spentTime, true);
    assert.equal(game.u.uconduct.literate, 1);
});
void test('examining a Hawaiian shirt describes its design without breaking illiteracy', async () => {
    const { messages } = readingRoom();
    requirePlayingGame(game);
    const shirt = await addInventoryObject(HAWAIIAN_SHIRT);
    game.ubirthday = 12345;
    const result = await readOrdinaryObject(shirt);
    assert.equal(result.spentTime, true);
    assert.equal(game.u.uconduct.literate || 0, 0);
    assert.match(await readingOutput(messages), /The design features .+ on an? .+ background\./);
});
void test('blindness blocks ordinary cloth writing without using a turn', async () => {
    const { messages } = readingRoom();
    requirePlayingGame(game);
    const shirt = await addInventoryObject(T_SHIRT);
    setHeroBlindnessTurns(10);
    const result = await readOrdinaryObject(shirt);
    assert.equal(result.spentTime, false);
    assert.equal(game.u.uconduct.literate || 0, 0);
    assert.match(await readingOutput(messages), /can't feel any Braille writing/);
});
void test('a tourist can feel a conical hat inscription without formally identifying its type', async () => {
    const { input, messages } = readingRoom({ role: 'tourist' });
    requirePlayingGame(game);
    let hat;
    do {
        hat = await addInventoryObject(CORNUTHAUM, { known: false, typeKnown: false, dknown: true });
    } while (hat.o_id % 3);
    setHeroBlindnessTurns(10);
    input.beforeRead = () => {
        if (game._pending_message)
            messages.push(game._pending_message);
        const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        if (text.includes('--More--'))
            input.feed(' ');
        else {
            assert.match(text, /Call /, `unexpected hat prompt: ${text}`);
            input.feed('star hat\n');
        }
    };
    const result = await readOrdinaryObject(hat);
    assert.equal(result.spentTime, true);
    assert.equal(objectTypeKnown(hat), false);
    assert.ok(game._objectCallNames != null);
    assert.equal(game._objectCallNames[CORNUTHAUM], 'star hat');
    assert.equal(game.u.uconduct.literate, 1);
    assert.match(await readingOutput(messages), /feel lettering.+WIZZARD/);
});
void test('an unmarked tourist hat has nothing to read', async () => {
    const { messages } = readingRoom({ role: 'tourist' });
    requirePlayingGame(game);
    let hat;
    do {
        hat = await addInventoryObject(DUNCE_CAP);
    } while (!(hat.o_id % 3));
    const result = await readOrdinaryObject(hat);
    assert.equal(result.spentTime, false);
    assert.equal(game.u.uconduct.literate || 0, 0);
    assert.match(await readingOutput(messages), /can't find anything to read on this/);
});
void test('other roles cannot read tourist-only conical-hat inscriptions', async () => {
    const { messages } = readingRoom({ role: 'wizard' });
    requirePlayingGame(game);
    const hat = await addInventoryObject(CORNUTHAUM);
    const result = await readOrdinaryObject(hat);
    assert.equal(result.spentTime, false);
    assert.equal(game.u.uconduct.literate || 0, 0);
    assert.match(await readingOutput(messages), /silly thing to read/);
});
void test('blind credit-card reading exposes its embossed number and counts literacy', async () => {
    const { messages } = readingRoom();
    requirePlayingGame(game);
    const card = await addInventoryObject(CREDIT_CARD);
    setHeroBlindnessTurns(10);
    const result = await readOrdinaryObject(card);
    assert.equal(result.spentTime, true);
    assert.equal(game.u.uconduct.literate, 1);
    const output = await readingOutput(messages);
    assert.match(output, /feel the embossed numbers/);
    assert.match(output, /"\d{4} \d{8} \d{4}"\./);
    assert.doesNotMatch(output, /Card|Bank/);
});
void test('an artifact credit card bears the platinum label', async () => {
    const { messages } = readingRoom();
    requirePlayingGame(game);
    ensureQuestStatus().touched_artifact = true;
    const card = await addInventoryItem(await artifactObject('The Platinum Yendorian Express Card'));
    await readOrdinaryObject(card);
    assert.match(await readingOutput(messages), /Yendorian Express - Platinum Card/);
});
for (const blind of [false, true]) {
    void test(`reading a coin ${blind ? 'by touch' : 'by sight'} counts literacy without spending it`, async () => {
        const { messages } = readingRoom();
        requirePlayingGame(game);
        const coins = await addInventoryObject(GOLD_PIECE, { quan: 12 });
        if (blind)
            setHeroBlindnessTurns(10);
        const result = await readOrdinaryObject(coins);
        assert.equal(result.spentTime, true);
        assert.equal(coins.quan, 12);
        assert.equal(game.u.uconduct.literate, 1);
        assert.match(await readingOutput(messages), /In Frobs We Trust/);
    });
}
void test('the Orb of Fate signature can be read by touch', async () => {
    const { messages } = readingRoom({ role: 'valkyrie' });
    requirePlayingGame(game);
    ensureQuestStatus().touched_artifact = true;
    const orb = await addInventoryItem(await artifactObject('The Orb of Fate'));
    setHeroBlindnessTurns(10);
    await readOrdinaryObject(orb);
    assert.equal(game.u.uconduct.literate, 1);
    assert.match(await readingOutput(messages), /feel the engraved signature.+Odin/s);
});
void test('a magic marker carries a real species-colored ink label', async () => {
    const { messages } = readingRoom();
    requirePlayingGame(game);
    const marker = await addInventoryObject(MAGIC_MARKER);
    const charges = marker.spe;
    const result = await readOrdinaryObject(marker);
    assert.equal(result.spentTime, true);
    assert.equal(marker.spe, charges);
    assert.equal(game.u.uconduct.literate, 1);
    assert.match(await readingOutput(messages), /Magic Marker\(TM\) .+ Red Ink Marker Pen\.  Water Soluble/);
});
void test('blank candy wrappers and unlabeled grease cost no time or literacy', async () => {
    const { messages } = readingRoom();
    requirePlayingGame(game);
    const candy = await addInventoryObject(CANDY_BAR, { spe: 0 });
    const grease = await addInventoryObject(CAN_OF_GREASE);
    assert.equal((await readOrdinaryObject(candy)).spentTime, false);
    assert.equal((await readOrdinaryObject(grease)).spentTime, false);
    assert.equal(game.u.uconduct.literate || 0, 0);
    assert.match(await readingOutput(messages), /wrapper is blank/);
});
void test('a printed candy wrapper can be read without eating the bar', async () => {
    const { messages } = readingRoom();
    requirePlayingGame(game);
    const candy = await addInventoryObject(CANDY_BAR);
    const result = await readOrdinaryObject(candy);
    assert.equal(result.spentTime, true);
    assert.equal(game.inventory.includes(candy), true);
    assert.equal(game.u.uconduct.literate, 1);
    assert.match(await readingOutput(messages), /The wrapper reads: ".+"\./);
});
void test('scrolls and spellbooks are left to the ordinary read command owner', async () => {
    readingRoom();
    requirePlayingGame(game);
    for (const type of [SCR_BLANK_PAPER, SPE_FORCE_BOLT]) {
        const object = await addInventoryObject(type);
        const result = await readOrdinaryObject(object);
        assert.equal(result.handled, false);
        assert.equal(game.inventory.includes(object), true);
    }
    assert.equal(game.u.uconduct.literate || 0, 0);
});
//# sourceMappingURL=readable_objects.test.js.map