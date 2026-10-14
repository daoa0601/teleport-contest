import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { AMULET_OF_LIFE_SAVING, CHEST, CLUB, DAGGER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createStaffedShop } from './support/shop.js';

for (const lifeSaving of [false, true]) {
    void test(`disarming an exploding chest ${lifeSaving ? 'uses life saving and resumes the command' : 'kills a hero who cannot survive the blast'}`, async () => {
        freshObjectRoom({ hero: {
            uluck: -13, uhp: 1, uhpmax: 80, fumbling: true,
        } });
        requirePlayingGame(game);
        const chest = await floorObject(CHEST, 10, 10, {
            otrapped: true, tknown: true, dknown: true,
        });
        let amulet = null;
        if (lifeSaving) {
            amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
            await wearHeroAccessory(amulet, 'uamul');
        }
        const input = resetInputState();
        input.feed('untrap\n.y');
        input.beforeRead = () => input.feed(' ');
        initRng(1n);

        await rhack('#'.charCodeAt(0));

        assert.equal(chest.where, 'gone');
        assert.equal(!!game.program_state.gameover, !lifeSaving);
        assert.equal(game.u.umortality, 1);
        if (lifeSaving) {
            assert.equal(amulet?.where, 'gone');
            assert.ok(game.u.uhp > 0);
        } else assert.equal(game._deathKiller, 'exploding chest');
    });
}

void test('disarming a named chest preserves its name in the fatal explosion', async () => {
    freshObjectRoom({ hero: { uluck: -13, uhp: 1, uhpmax: 80, fumbling: true } });
    requirePlayingGame(game);
    await floorObject(CHEST, 10, 10, {
        otrapped: true, tknown: true, dknown: true, oname: 'Treasure',
    });
    const input = resetInputState();
    input.feed('untrap\n.y');
    input.beforeRead = () => input.feed(' ');
    initRng(1n);

    await rhack('#'.charCodeAt(0));

    assert.equal(game.program_state.gameover, true);
    assert.equal(game._deathKiller, 'exploding chest named Treasure');
});

for (const lifeSaving of [false, true]) {
    void test(`a shop chest explosion charges destroyed ${lifeSaving ? 'purchases before life saving' : 'stock before death and inheritance'}`, async () => {
        freshObjectRoom({
            hero: { uluck: -13, uhp: 1, uhpmax: 80, fumbling: true },
            flags: { disclose: '-i -a -v -c -o', tombstone: false, bones: false },
        });
        requirePlayingGame(game);
        const chest = await floorObject(CHEST, 10, 10, {
            initialize: false, otrapped: true, tknown: true,
        });
        const daggers = await knownObject(DAGGER, { quan: 3 });
        await addCreatedObjectToContainer(chest, daggers);
        daggers.unpaid = lifeSaving;
        const { shopkeeper } = await createStaffedShop({ bill: lifeSaving ? [
            { bo_id: daggers.o_id, bquan: 3, price: 7, useup: false },
        ] : [] });
        chest.no_charge = true;
        shopkeeper.eshk.shknam = '+TrapKeeper';
        shopkeeper.eshk.credit = 5;
        await addInventoryObject(CLUB);
        if (lifeSaving) {
            const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
            await wearHeroAccessory(amulet, 'uamul');
        }
        const input = resetInputState();
        input.feed('untrap\n.y');
        let sawDeath = false;
        const messages: string[] = [];
        input.beforeRead = () => {
            const screen = requireGameDisplay().grid
                .map(row => row.map(cell => cell.ch).join('')).join('\n');
            messages.push(game._pending_message);
            if (!screen.includes('You die...') || sawDeath) return;
            sawDeath = true;
            if (!lifeSaving) return;
            assert.equal(shopkeeper.eshk.debit, 16,
                'The 21-zorkmid purchase consumes 5 credit before the fatal damage');
            assert.equal(shopkeeper.eshk.credit, 0);
            assert.equal(shopkeeper.eshk.billct, 0);
            assert.equal(daggers.unpaid, false);
            assert.equal(daggers.where, 'gone');
        };
        installPagerInput(input, {
            expected: /disarm|set it off|explodes|credit|die|But wait|medallion|much better|possessions|Goodbye|points|You were/i,
            limit: 15,
        });
        initRng(1n);

        await rhack('#'.charCodeAt(0));
        messages.push(game._pending_message);

        assert.equal(sawDeath, true, 'The explosion must reach the death announcement');
        assert.equal(chest.where, 'gone');
        assert.equal(!!game.program_state.gameover, !lifeSaving);
        if (lifeSaving) {
            assert.equal(shopkeeper.eshk.debit, 16);
            assert.match(messages.join('\n'), /You owe 16 zorkmids for objects destroyed/);
        } else {
            assert.match(messages.join('\n'), /TrapKeeper takes all your possessions/);
            assert.doesNotMatch(messages.join('\n'), /gratefully inherits|You owe .*objects destroyed/);
        }
    });
}
