import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { learnObjectType, recordObjectCall, recordObjectEncounter } from '../js/object_knowledge.js';
import { MAGIC_MARKER, OBJECT_NAMES, SCR_BLANK_PAPER, SCR_ENCHANT_ARMOR, SCR_IDENTIFY, SCR_GENOCIDE, SCR_LIGHT, SPE_BLANK_PAPER, SPE_FINGER_OF_DEATH, SPE_FORCE_BOLT, SPE_NOVEL, } from '../js/object_data.js';
import { objectTypeKnown } from '../js/shk.js';
import { createMemorizedSpell } from '../js/spell.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
function writingInput(paper, name) {
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.display = { async readKey() {
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (screen.includes('--More--'))
                return 32;
            if (screen.includes('What do you want to write on?'))
                return paper.invlet.charCodeAt(0);
            assert.match(screen, /What type of (scroll|spellbook) do you want to write\?/, `Unexpected writing prompt: ${screen}`);
            if (name === null)
                return 27;
            const keys = [...name, '\n'];
            const first = keys.shift();
            assert.ok(first);
            input.feed(keys);
            return first.charCodeAt(0);
        } };
    return () => [...messages, game._pending_message].join('\n');
}
void test('applying a marker writes one identified scroll from a blank stack', async () => {
    freshPlayableRoom();
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 50, blessed: true });
    const paper = await addInventoryObject(SCR_BLANK_PAPER, { quan: 3 });
    learnObjectType(SCR_IDENTIFY);
    const output = writingInput(paper, 'scroll of identify');
    await applyInventoryObject(marker);
    const written = game.inventory.find(object => object.otyp === SCR_IDENTIFY);
    assert.ok(written, output());
    assert.equal(written.quan, 1);
    assert.equal(written.blessed, true);
    assert.equal(written.bknown, true);
    assert.equal(written.dknown, true);
    assert.equal(paper.quan, 2);
    assert.ok(marker.spe >= 37 && marker.spe <= 43, `identify used ${50 - marker.spe} charges`);
    assert.equal(game.u.uconduct?.literate, 1);
    assert.equal(game.context.move, 1);
});
void test('an initially dry marker preserves the blank and ink but records writing conduct', async () => {
    freshPlayableRoom();
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 6 });
    const paper = await addInventoryObject(SCR_BLANK_PAPER);
    const output = writingInput(paper, 'identify');
    await applyInventoryObject(marker);
    assert.match(output(), /Your marker is too dry to write that!/);
    assert.equal(marker.spe, 6);
    assert.equal(paper.where, 'inventory');
    assert.equal(game.u.uconduct?.literate, 1);
    assert.equal(game.context.move, 1);
});
void test('cancelling the writing name takes a turn and identifies blank scrolls even for a book', async () => {
    freshPlayableRoom();
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 40 });
    const paper = await addInventoryObject(SPE_BLANK_PAPER);
    writingInput(paper, null);
    await applyInventoryObject(marker);
    assert.equal(objectTypeKnown({ otyp: SCR_BLANK_PAPER }), true);
    assert.equal(marker.spe, 40);
    assert.equal(paper.where, 'inventory');
    assert.equal(game.u.uconduct?.literate || 0, 0);
    assert.equal(game.context.move, 1);
});
void test('a called scroll label can be written without identifying its actual type', async () => {
    freshPlayableRoom();
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 40 });
    const paper = await addInventoryObject(SCR_BLANK_PAPER);
    recordObjectEncounter(SCR_LIGHT);
    recordObjectCall(SCR_LIGHT, 'room lamp');
    writingInput(paper, 'room lamp');
    await applyInventoryObject(marker);
    const written = game.inventory.find(object => object.otyp === SCR_LIGHT);
    assert.ok(written);
    assert.equal(written.dknown, true);
    assert.equal(objectTypeKnown(written), false);
    assert.equal(paper.where, 'gone');
});
void test('an unrecognized spellbook cover cannot be written by description', async () => {
    freshPlayableRoom();
    game.objectDescriptions = [];
    game.objectDescriptions[SPE_FORCE_BOLT] = 'vellum';
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 40 });
    const paper = await addInventoryObject(SPE_BLANK_PAPER);
    const output = writingInput(paper, 'vellum');
    await applyInventoryObject(marker);
    assert.match(output(), /Unfortunately you don't have enough information to go on\./);
    assert.equal(marker.spe, 40);
    assert.equal(paper.where, 'inventory');
    assert.equal(game.u.uconduct?.literate || 0, 0);
});
void test('fresh spell knowledge permits writing an unidentified book with a new cover', async () => {
    freshPlayableRoom();
    game.objectDescriptions = [];
    game.objectDescriptions[SPE_FORCE_BOLT] = 'vellum';
    game.spells = [createMemorizedSpell(SPE_FORCE_BOLT, 20000, game)];
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 40, cursed: true });
    const paper = await addInventoryObject(SPE_BLANK_PAPER, { blessed: true, bknown: false });
    const output = writingInput(paper, 'force bolt');
    await applyInventoryObject(marker);
    const written = game.inventory.find(object => object.otyp === SPE_FORCE_BOLT);
    assert.ok(written, output());
    assert.equal(written.blessed, false);
    assert.equal(written.cursed, false);
    assert.equal(written.bknown, false);
    assert.match(output(), /The spellbook warps strangely, then turns into vellum\./);
    assert.ok(marker.spe >= 31 && marker.spe <= 35);
});
for (const [name, expected] of [
    ['blank paper', /You can't write that!.*It's obscene!/s],
    ['Book of the Dead', /No mere dungeon adventurer could write that\./],
    ['unobtainium', /There is no such spellbook!/],
]) {
    void test(`writing ${name} leaves the blank book and marker intact`, async () => {
        freshPlayableRoom();
        const marker = await addInventoryObject(MAGIC_MARKER, { spe: 40 });
        const paper = await addInventoryObject(SPE_BLANK_PAPER);
        const output = writingInput(paper, name);
        await applyInventoryObject(marker);
        assert.match(output(), expected);
        assert.equal(marker.spe, 40);
        assert.equal(paper.where, 'inventory');
        assert.equal(game.u.uconduct?.literate || 0, 0);
        assert.equal(game.context.move, 1);
    });
}
void test('British spelling and excess spaces are accepted for a known scroll', async () => {
    freshPlayableRoom();
    learnObjectType(SCR_ENCHANT_ARMOR);
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 40 });
    const paper = await addInventoryObject(SCR_BLANK_PAPER);
    writingInput(paper, '  scroll  of  enchant armour  ');
    await applyInventoryObject(marker);
    assert.ok(game.inventory.some(object => object.otyp === SCR_ENCHANT_ARMOR));
});
void test('novels are rejected as nonblank books before asking what to write', async () => {
    freshPlayableRoom();
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 40 });
    const paper = await addInventoryObject(SPE_NOVEL);
    const output = writingInput(paper, 'identify');
    await applyInventoryObject(marker);
    assert.match(output(), /That book is not blank!/);
    assert.equal(marker.spe, 40);
    assert.equal(game.context.move, 1);
});
void test('a blind hero cannot create braille in a known blank book', async () => {
    freshPlayableRoom({ hero: { permaBlind: true } });
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 40 });
    const paper = await addInventoryObject(SPE_BLANK_PAPER);
    const output = writingInput(paper, 'force bolt');
    await applyInventoryObject(marker);
    assert.match(output(), /Your magic marker can't create braille text\./);
    assert.equal(marker.spe, 40);
    assert.equal(game.context.move, 0);
});
void test('ink exhaustion destroys one blank scroll but leaves an unfinished blank book', async () => {
    for (const book of [false, true]) {
        freshPlayableRoom();
        const target = book ? SPE_FORCE_BOLT : SCR_IDENTIFY;
        learnObjectType(target);
        const marker = await addInventoryObject(MAGIC_MARKER, { spe: book ? 5 : 7 });
        const paper = await addInventoryObject(book ? SPE_BLANK_PAPER : SCR_BLANK_PAPER, { quan: book ? 1 : 2 });
        const output = writingInput(paper, book ? 'force bolt' : 'identify');
        await applyInventoryObject(marker);
        assert.equal(marker.spe, 0, output());
        assert.match(output(), /Your marker dries out!/);
        assert.match(output(), book ? /The spellbook is left unfinished and your writing fades\./
            : /The scroll is now useless and disappears!/);
        assert.equal(paper.where, 'inventory');
        assert.equal(paper.quan, 1);
        assert.equal(game.inventory.some(object => object.otyp === target), false);
    }
});
void test('an unknown scroll consumes ink and paper when the hero cannot write it', async () => {
    freshPlayableRoom({ hero: { uluck: -13 } });
    game.plname = 'Scribe';
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 40 });
    const paper = await addInventoryObject(SCR_BLANK_PAPER);
    const output = writingInput(paper, 'identify');
    await applyInventoryObject(marker);
    assert.match(output(), /You don't know how to write that\./);
    assert.match(output(), /You write "Scribe was here!" and the scroll disappears\./);
    assert.equal(paper.where, 'gone');
    assert.ok(marker.spe < 40);
    assert.equal(game.inventory.some(object => object.otyp === SCR_IDENTIFY), false);
});
void test('an unknown spellbook attempt fades to a diary without consuming the book', async () => {
    freshPlayableRoom({ hero: { uluck: -13 } });
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 40 });
    const paper = await addInventoryObject(SPE_BLANK_PAPER);
    const output = writingInput(paper, 'force bolt');
    await applyInventoryObject(marker);
    assert.match(output(), /You don't know how to write that\./);
    assert.match(output(), /You write in your best handwriting:  "My Diary", but it quickly fades\./);
    assert.equal(paper.where, 'inventory');
    assert.ok(marker.spe < 40);
});
void test('blind writing can destroy even a known scroll after spending ink', async () => {
    freshPlayableRoom({ hero: { permaBlind: true, uluck: -13 } });
    learnObjectType(SCR_IDENTIFY);
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 40 });
    const paper = await addInventoryObject(SCR_BLANK_PAPER);
    const output = writingInput(paper, 'identify');
    await applyInventoryObject(marker);
    assert.match(output(), /You fail to write the scroll correctly and it disappears\./);
    assert.equal(paper.where, 'gone');
    assert.ok(marker.spe < 40);
});
void test('blindness leaves an unrecognized blank scroll untouched and takes no time', async () => {
    freshPlayableRoom({ hero: { permaBlind: true } });
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 40 });
    const paper = await addInventoryObject(SCR_BLANK_PAPER, { observed: false, dknown: false });
    const output = writingInput(paper, 'identify');
    await applyInventoryObject(marker);
    assert.match(output(), /You don't know whether that scroll is blank or not\./);
    assert.equal(marker.spe, 40);
    assert.equal(paper.dknown, false);
    assert.equal(game.context.move, 0);
});
void test('slippery hands drop the marker before asking for paper', async () => {
    const level = freshPlayableRoom({ hero: { glib: true, glibTurns: 8 } });
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 40 });
    await applyInventoryObject(marker);
    assert.equal(marker.where, 'floor');
    assert.ok(level.objects[game.u.ux]?.[game.u.uy]?.includes(marker));
    assert.equal(marker.spe, 40);
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, 'The magic marker slips from your fingers.');
});
void test('an encountered scroll can be written by its label without knowing its name', async () => {
    freshPlayableRoom();
    game.objectDescriptions = [];
    game.objectDescriptions[SCR_LIGHT] = 'TEMOV';
    recordObjectEncounter(SCR_LIGHT);
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 40 });
    const paper = await addInventoryObject(SCR_BLANK_PAPER);
    writingInput(paper, 'TEMOV');
    await applyInventoryObject(marker);
    const written = game.inventory.find(object => object.otyp === SCR_LIGHT);
    assert.ok(written);
    assert.equal(written.dknown, true);
    assert.equal(objectTypeKnown(written), false);
});
void test('an unknown real scroll name yields to a conflicting unidentified called name', async () => {
    freshPlayableRoom();
    recordObjectCall(SCR_LIGHT, 'identify');
    recordObjectEncounter(SCR_LIGHT);
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 40 });
    const paper = await addInventoryObject(SCR_BLANK_PAPER);
    writingInput(paper, 'identify');
    await applyInventoryObject(marker);
    assert.ok(game.inventory.some(object => object.otyp === SCR_LIGHT));
    assert.equal(game.inventory.some(object => object.otyp === SCR_IDENTIFY), false);
});
void test('a known real scroll name wins over a conflicting called name', async () => {
    freshPlayableRoom();
    learnObjectType(SCR_IDENTIFY);
    recordObjectCall(SCR_LIGHT, 'identify');
    recordObjectEncounter(SCR_LIGHT);
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 40 });
    const paper = await addInventoryObject(SCR_BLANK_PAPER);
    writingInput(paper, 'identify');
    await applyInventoryObject(marker);
    assert.ok(game.inventory.some(object => object.otyp === SCR_IDENTIFY));
    assert.equal(game.inventory.some(object => object.otyp === SCR_LIGHT), false);
});
void test('an identified incorrectly called scroll does not replace an unknown real name', async () => {
    freshPlayableRoom({ hero: { uluck: -13 } });
    learnObjectType(SCR_LIGHT);
    recordObjectCall(SCR_LIGHT, 'identify');
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 40 });
    const paper = await addInventoryObject(SCR_BLANK_PAPER);
    const output = writingInput(paper, 'identify');
    await applyInventoryObject(marker);
    assert.match(output(), /You don't know how to write that\./);
    assert.equal(game.inventory.some(object => object.otyp === SCR_LIGHT), false);
});
void test('a failed attempt by an unseen label leaves damaged label text before consuming the scroll', async () => {
    freshPlayableRoom({ hero: { uluck: -13 } });
    game.objectDescriptions = [];
    game.objectDescriptions[SCR_LIGHT] = 'TEMOV';
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 40 });
    const paper = await addInventoryObject(SCR_BLANK_PAPER);
    const output = writingInput(paper, 'TEMOV');
    await applyInventoryObject(marker);
    assert.match(output(), /You fail to write that\./);
    assert.match(output(), /You write ".*" and the scroll disappears\./);
    assert.doesNotMatch(output(), /was here/);
    assert.equal(paper.where, 'gone');
});
void test('writing mail marks it as handwritten and costs one charge', async () => {
    freshPlayableRoom();
    const mail = OBJECT_NAMES.indexOf('mail');
    learnObjectType(mail);
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 10 });
    const paper = await addInventoryObject(SCR_BLANK_PAPER);
    const output = writingInput(paper, 'mail');
    await applyInventoryObject(marker);
    const written = game.inventory.find(object => object.otyp === mail);
    assert.ok(written, output());
    assert.equal(written.spe, 2);
    assert.equal(marker.spe, 9);
});
void test('trying to write a novel can give up or tear one blank book without spending ink', async () => {
    for (const seed of [1n, 2n, 3n, 4n]) {
        freshPlayableRoom({ seed });
        const marker = await addInventoryObject(MAGIC_MARKER, { spe: 40 });
        const paper = await addInventoryObject(SPE_BLANK_PAPER);
        const output = writingInput(paper, 'novel');
        await applyInventoryObject(marker);
        assert.match(output(), /Great Yendorian Novel|fan-fiction/);
        assert.match(output(), /You give up on the idea\.|You tear it up\./);
        assert.equal(paper.where, output().includes('You tear it up.') ? 'gone' : 'inventory');
        assert.equal(marker.spe, 40);
        assert.equal(game.u.uconduct?.literate || 0, 0);
        assert.equal(game.context.move, 1);
    }
});
void test('a lucky blind Wizard can write an unknown scroll without learning its label', async () => {
    freshPlayableRoom({ role: 'wizard', hero: { permaBlind: true, uluck: 13 } });
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 40 });
    const paper = await addInventoryObject(SCR_BLANK_PAPER);
    const output = writingInput(paper, 'identify');
    await applyInventoryObject(marker);
    const written = game.inventory.find(object => object.otyp === SCR_IDENTIFY);
    assert.ok(written, output());
    assert.equal(written.dknown, false);
    assert.equal(objectTypeKnown(written), false);
    assert.equal(paper.where, 'gone');
});
void test('almost forgotten spell knowledge lets a lucky non-Wizard write the book', async () => {
    freshPlayableRoom({ hero: { uluck: 13 } });
    game.spells = [createMemorizedSpell(SPE_FORCE_BOLT, 100, game)];
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 40 });
    const paper = await addInventoryObject(SPE_BLANK_PAPER);
    const output = writingInput(paper, 'force bolt');
    await applyInventoryObject(marker);
    assert.ok(game.inventory.some(object => object.otyp === SPE_FORCE_BOLT), output());
    assert.equal(paper.where, 'gone');
});
void test('high-cost scrolls and seventh-level books require their native minimum ink', async () => {
    for (const [type, name, minimum] of [
        [SCR_GENOCIDE, 'genocide', 15], [SPE_FINGER_OF_DEATH, 'finger of death', 35],
    ]) {
        freshPlayableRoom();
        const marker = await addInventoryObject(MAGIC_MARKER, { spe: minimum - 1 });
        const paper = await addInventoryObject(type === SCR_GENOCIDE ? SCR_BLANK_PAPER : SPE_BLANK_PAPER);
        const output = writingInput(paper, name);
        await applyInventoryObject(marker);
        assert.match(output(), /Your marker is too dry to write that!/);
        assert.equal(marker.spe, minimum - 1);
        assert.equal(paper.where, 'inventory');
    }
});
for (const penBlessing of [-1, 0, 1]) {
    for (const paperBlessing of [-1, 0, 1]) {
        void test(`writing combines marker beatitude ${penBlessing} with paper beatitude ${paperBlessing}`, async () => {
            freshPlayableRoom();
            learnObjectType(SCR_LIGHT);
            const marker = await addInventoryObject(MAGIC_MARKER, {
                spe: 40, blessed: penBlessing > 0, cursed: penBlessing < 0,
            });
            const paper = await addInventoryObject(SCR_BLANK_PAPER, {
                blessed: paperBlessing > 0, cursed: paperBlessing < 0,
            });
            writingInput(paper, 'light');
            await applyInventoryObject(marker);
            const written = game.inventory.find(object => object.otyp === SCR_LIGHT);
            assert.ok(written);
            assert.equal(written.blessed, penBlessing + paperBlessing > 0);
            assert.equal(written.cursed, penBlessing + paperBlessing < 0);
            assert.ok(marker.spe >= 33 && marker.spe <= 36);
        });
    }
}
//# sourceMappingURL=marker_writing.test.js.map