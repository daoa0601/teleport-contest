import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MENU_TRADITIONAL } from '../js/const.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { bindInputGate, InputGate, nhgetch } from '../js/input.js';
import { inventoryReport } from '../js/inventory_reports.js';
import { CRYSTAL_BALL, DAGGER, SPE_FORCE_BOLT } from '../js/object_data.js';
import { objectTypeKnown } from '../js/shk.js';
import { forceLearnSpell } from '../js/spell.js';
import { selectSpellToCast } from '../js/spell_menu.js';
import { promptDirection } from '../js/tty_prompts.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshMonsterAbilityRoom } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

for (const { name, key } of [
    { name: 'NUL', key: '\0' },
    { name: 'Escape', key: '\x1b' },
    { name: 'Space', key: ' ' },
]) {
    void test(`fuzzer ${name} cancels traditional spell selection before a following spell letter`, async () => {
        freshObjectRoom({ role: 'wizard', flags: { menu_style: MENU_TRADITIONAL } });
        requirePlayingGame(game);
        forceLearnSpell(SPE_FORCE_BOLT);
        game.iflags.debug_fuzzer = true;
        // Space can dismiss an erroneous retry's message before the later 'a'.
        bindInputGate(new QueuedFuzzerInput(`${key}a aX`));

        const selected = await selectSpellToCast();

        assert.equal(selected, null, 'cancellation must not select the following spell');
        assert.equal(game._pending_message, 'Never mind.');
        assert.equal(await nhgetch(), 'a'.charCodeAt(0), 'cancellation leaves the next command unread');
    });

    void test(`fuzzer ${name} cancels traditional inventory category selection before a following class symbol`, async () => {
        freshObjectRoom({ flags: { menu_style: MENU_TRADITIONAL } });
        await addInventoryObject(DAGGER);
        game.iflags.debug_fuzzer = true;
        bindInputGate(new QueuedFuzzerInput(`${key})\x1bX`));

        const action = await inventoryReport('type');

        assert.equal(action, null);
        assert.equal(await nhgetch(), ')'.charCodeAt(0), 'cancellation leaves the next command unread');
        assert.equal(requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trim(), '',
            'cancelling clears the inventory category question');
    });

    void test(`fuzzer ${name} cancels the spider ability before a following spin choice`, async () => {
        const level = freshMonsterAbilityRoom('cave spider');
        game.iflags.debug_fuzzer = true;
        bindInputGate(new QueuedFuzzerInput(`${key}sX`));

        await rhack('m'.charCodeAt(0) | 128); // Meta-m invokes #monster.

        assert.equal(level.traps.length, 0, 'cancelling must not spin a web');
        assert.equal(game.u.uundetected ?? 0, 0, 'cancelling must not hide');
        assert.equal(game.context.move, 0);
        assert.equal(await nhgetch(), 's'.charCodeAt(0), 'cancellation leaves the next command unread');
    });
}

for (const cmdassist of [false, true]) {
    void test(`fuzzer NUL cancels a direction without ${cmdassist ? 'opening assistance' : 'an invalid-direction message'}`, async () => {
        freshObjectRoom({ flags: { cmdassist } });
        game.iflags.debug_fuzzer = true;
        bindInputGate(new QueuedFuzzerInput('\0 lX'));

        const direction = await promptDirection();

        assert.equal(direction, null);
        assert.equal(game._pending_message, '', 'cancelling must not report an invalid direction');
        assert.equal(await nhgetch(), ' '.charCodeAt(0), 'cancellation leaves the next input unread');
    });
}

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
