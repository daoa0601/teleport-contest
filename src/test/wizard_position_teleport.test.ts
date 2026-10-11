import { installPagerInput } from './support/pager-input.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { BEAR_TRAP, PIT, TT_BEARTRAP, TT_PIT } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { DIAMOND } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

async function teleportTo(keys: string) {
    const input = resetInputState();
    installPagerInput(input, { expected: /diamond|pit|bear trap|teleport|materialize in a different location/i, limit: 4 });
    const pager = input.display;
    assert.ok(pager);
    let choosingDestination = true;
    input.display = {
        async readKey() {
            if (!choosingDestination) return pager.readKey();
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.match(screen, /Where do you want to be teleported/);
            choosingDestination = false;
            const first = keys[0];
            assert.ok(first);
            input.feed(keys.slice(1));
            return first.charCodeAt(0);
        },
    };
    await rhack(20);
    assert.equal(choosingDestination, false, 'Teleport must request a destination');
}

for (const [terrain, trapType, holdType] of [
    ['room', null, null], ['pit', PIT, TT_PIT], ['bear trap', BEAR_TRAP, TT_BEARTRAP],
] as const) {
    void test(`wizard position teleport applies pickup and landing effects over a ${terrain}`, async () => {
        freshObjectRoom({
            left: 10, right: trapType === null ? 12 : 11, top: 10, bottom: 10,
            flags: { debug: true, pickup: true },
        });
        requirePlayingGame(game);
        game._travelTipShown = true;
        const x = trapType === null ? 12 : 11;
        const gem = await floorObject(DIAMOND, x, 10);
        if (trapType !== null) {
            // Neither square is a safe destination. The random fallback may
            // use a trap only after exhausting untrapped floor squares.
            addTrap(game.level, trapType, 10, 10);
            addTrap(game.level, trapType, x, 10);
        }
        const hunger = game.u.uhunger;
        await teleportTo('l'.repeat(x - 10) + '.');

        assert.deepEqual([game.u.ux, game.u.uy], [x, 10]);
        assert.ok(game.inventory.includes(gem));
        assert.equal(game.u.uhunger, hunger - 100);
        assert.equal(game.context.move, 1);
        if (trapType !== null) {
            assert.ok((game.u.utrap ?? 0) > 0);
            assert.equal(game.u.utraptype, holdType);
        }
    });
}

for (const cancelFirst of [false, true]) {
    void test(`controlled teleport recalls a travel destination${cancelFirst ? ' after cancellation' : ''}`, async () => {
        freshObjectRoom({ flags: { debug: true, tips: false } });
        requirePlayingGame(game);
        pushKeys('lll.');
        await rhack('_'.charCodeAt(0));
        assert.equal(game.u.ux, 11, 'the first travel step leaves the target ahead');
        if (cancelFirst) {
            await teleportTo('\x1b');
        }
        await teleportTo('.');

        assert.equal(game.u.ux, 13);
        assert.equal(game.u.uy, 10);
    });
}
