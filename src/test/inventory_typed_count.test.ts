import assert from 'node:assert/strict';
import test from 'node:test';
import { GETOBJ_SUGGEST } from '../js/const.js';
import { game } from '../js/gstate.js';
import { bindInputGate, InputGate, nhgetch, resetInputState } from '../js/input.js';
import { chooseInventoryObject } from '../js/inventory_prompt.js';
import { DAGGER, GOLD_PIECE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';

void test('typed inventory counts stop at the native limit before splitting gold', async t => {
    freshObjectRoom();
    const purse = await addInventoryObject(GOLD_PIECE, { quan: 40_000 });
    const input = resetInputState();
    planInput(input, t, [{ prompt: /What do you want to drop\?/, keys: '40000$' }]);

    const selected = await chooseInventoryObject('drop', () => GETOBJ_SUGGEST, { allowCount: true });

    assert.equal(selected?.quan, 32_767);
    assert.equal(purse.quan, 7_233);
    assert.equal(game.inventory.includes(purse), true);
    assert.ok(selected && game.inventory.includes(selected));
});

void test('backspace edits the capped inventory count', async t => {
    freshObjectRoom();
    const purse = await addInventoryObject(GOLD_PIECE, { quan: 40_000 });
    const input = resetInputState();
    planInput(input, t, [{ prompt: /What do you want to drop\?/, keys: '99999\x7f$' }]);

    const selected = await chooseInventoryObject('drop', () => GETOBJ_SUGGEST, { allowCount: true });

    assert.equal(selected?.quan, 3_276);
    assert.equal(purse.quan, 36_724);
});

void test('inventory menu counts can exceed the typed-count limit', async t => {
    freshObjectRoom({ flags: { force_invmenu: true } });
    const purse = await addInventoryObject(GOLD_PIECE, { quan: 50_000 });
    const input = resetInputState();
    planInput(input, t, [{ prompt: /What do you want to drop\?[\s\S]*\(end\)/, keys: '40000$' }]);

    const selected = await chooseInventoryObject('drop', () => GETOBJ_SUGGEST, { allowCount: true });

    assert.equal(selected?.quan, 40_000);
    assert.equal(purse.quan, 10_000);
});

for (const { position, keys } of [
    { position: 'at the question', keys: [-1] },
    { position: 'after a count', keys: ['2', -1] },
]) {
    void test(`EOF cancels inventory selection ${position}`, async t => {
        freshObjectRoom();
        const dagger = await addInventoryObject(DAGGER, { quan: 5 });
        const input = resetInputState();
        planInput(input, t, [{ prompt: /What do you want to drop\?/, keys }]);

        const selected = await chooseInventoryObject('drop', () => GETOBJ_SUGGEST, { allowCount: true });

        assert.equal(selected, null);
        assert.equal(dagger.quan, 5);
        assert.equal(game.inventory.length, 1);
        assert.equal(game._pending_message, 'Never mind.');
    });
}

void test('a literal fuzzer NUL cancels a count without consuming the next command', async () => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER, { quan: 5 });
    game.iflags.debug_fuzzer = true;
    bindInputGate(new QueuedFuzzerInput('2\0X'));

    const selected = await chooseInventoryObject('drop', () => GETOBJ_SUGGEST, { allowCount: true });

    assert.equal(selected, null);
    assert.equal(dagger.quan, 5);
    assert.equal(await nhgetch(), 'X'.charCodeAt(0));
});

void test('a literal Ctrl-C retries object selection instead of cancelling it', async () => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER, { quan: 5 });
    game.iflags.debug_fuzzer = true;
    // C more() skips acknowledgments in fuzzer mode; the letter answers the retry.
    bindInputGate(new QueuedFuzzerInput(`\x03${dagger.invlet}X`));

    const selected = await chooseInventoryObject('drop', () => GETOBJ_SUGGEST, { allowCount: true });

    assert.equal(selected, dagger);
    assert.equal(dagger.quan, 5);
    assert.equal(await nhgetch(), 'X'.charCodeAt(0));
});

// Literal fuzzer bytes bypass keyboard NUL/EOF decoding in readchar().
class QueuedFuzzerInput extends InputGate {
    private readonly bytes: number[];

    constructor(keys: string) {
        super();
        this.bytes = [...keys].map(character => character.charCodeAt(0));
    }

    override readKey(): Promise<number> {
        const key = this.bytes.shift();
        if (key === undefined) throw new Error('Inventory selection exhausted its fuzzer input');
        return Promise.resolve(key);
    }
}
