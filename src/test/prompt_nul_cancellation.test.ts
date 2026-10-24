import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { bindInputGate, InputGate, nhgetch } from '../js/input.js';
import { CRYSTAL_BALL, DAGGER } from '../js/object_data.js';
import { objectTypeKnown } from '../js/shk.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const count of ['', '3']) {
    void test(`fuzzer NUL cancels #adjust ${count ? 'and rejoins the counted stack' : 'without moving the stack'}`, async () => {
        freshObjectRoom();
        const dagger = await addInventoryObject(DAGGER, { quan: 7 });
        const source = dagger.invlet;
        game.iflags.debug_fuzzer = true;
        bindInputGate(new QueuedFuzzerInput(`${count}${source}\0X`));

        await rhack('\xe1'.charCodeAt(0));

        assert.equal(game.inventory.length, 1, 'cancelling restores the original inventory stack');
        assert.equal(dagger.invlet, source);
        assert.equal(dagger.quan, 7);
        assert.equal(game.context.move, 0);
        assert.equal(game._pending_message, 'Never mind.');
        assert.equal(await nhgetch(), 'X'.charCodeAt(0), 'cancellation leaves the next command unread');
    });
}

for (const charges of [2, 0, -1]) {
    void test(`fuzzer NUL cancels a crystal-ball search with ${charges} charges`, async () => {
        freshObjectRoom({ flags: { verbose: false }, hero: { acurr: { a: [12, 12, 12, 18, 12, 12] } } });
        const ball = await addInventoryObject(CRYSTAL_BALL, {
            blessed: true, spe: charges, known: false, typeKnown: false,
        });
        const destination = { dnum: 0, dlevel: 8, flags: { town: false }, alignment: 0 };
        game.oracle_level = destination;
        game.medusa_level = destination;
        game.stronghold_level = destination;
        game.specialLevels = new Map([['wizard1', destination]]);
        game.iflags.debug_fuzzer = true;
        bindInputGate(new QueuedFuzzerInput(`${ball.invlet}\0X`));

        await rhack('a'.charCodeAt(0));

        assert.equal(ball.spe, charges, 'cancelling does not spend a charge');
        assert.equal(game.inventory.includes(ball), true, 'cancelling does not implode a cancelled ball');
        assert.equal(objectTypeKnown(ball), false);
        assert.equal(game._helplessTurns ?? 0, 0, 'cancelling does not start gazing');
        assert.equal(game.context.move, 1);
        assert.equal(await nhgetch(), 'X'.charCodeAt(0), 'cancellation leaves the next command unread');
    });
}

// Fuzzer input reaches readchar() without keyboard NUL-to-Escape conversion.
class QueuedFuzzerInput extends InputGate {
    private readonly bytes: number[];

    constructor(keys: string) {
        super();
        this.bytes = [...keys].map(character => character.charCodeAt(0));
    }

    override readKey(): Promise<number> {
        const key = this.bytes.shift();
        if (key === undefined)
            throw new Error(`Unexpected input after NUL cancellation: ${game._pending_message}`);
        return Promise.resolve(key);
    }
}
