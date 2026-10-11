import { requireScreenRow } from './support/screen.js';
import { requirePlayingGame, requireGameDisplay } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { rhack } from '../js/cmd.js';
import { THRONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import {
    AMULET_OF_LIFE_SAVING, CORPSE, DIAMOND, RIN_TELEPORT_CONTROL,
} from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a throne teleport completes destination pickup without an at-will cost', async () => {
    freshObjectRoom({ flags: { tips: false, pickup: true } });
    requirePlayingGame(game);
    game.level.requireAt(10, 10).typ = THRONE;
    const ring = await addInventoryObject(RIN_TELEPORT_CONTROL);
    await wearHeroAccessory(ring, 'uleft');
    const gem = await floorObject(DIAMOND, 12, 10);
    const hunger = game.u.uhunger;
    const energy = game.u.uen;
    initRng(25n);
    const input = resetInputState();
    const keys = [...'sit\nll.'];
    input.beforeRead = () => {
        const row = requireScreenRow(0);
        assert.ok(row);
        const top = row.map(cell => cell.ch).join('');
        if (top.includes('--More--')) input.feed(' ');
        else {
            const key = keys.shift();
            assert.ok(key !== undefined, `Unexpected input request: ${top}`);
            input.feed(key);
        }
    };

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.ux, 12);
    assert.equal(game.u.uy, 10);
    assert.equal(game.inventory.includes(gem), true);
    assert.equal(game.u.uhunger, hunger);
    assert.equal(game.u.uen, energy);
});

for (const lifeSaving of [false, true]) {
    void test(`a throne teleport ${lifeSaving ? 'survives' : 'dies from'} contact at its destination`, async () => {
        freshObjectRoom({ flags: { tips: false, pickup: false } });
        requirePlayingGame(game);
        game.level.requireAt(10, 10).typ = THRONE;
        game.flags.disclose = '-i -a -v -c -o';
        await wearHeroAccessory(await addInventoryObject(RIN_TELEPORT_CONTROL), 'uleft');
        let amulet;
        if (lifeSaving) {
            amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
            await wearHeroAccessory(amulet, 'uamul');
        }
        await floorObject(CORPSE, 12, 10, {
            initialize: false, corpsenm: MONSTER_NAME.indexOf('cockatrice'),
        });
        setHeroBlindnessTurns(20);
        initRng(25n);
        const input = resetInputState();
        const keys = [...'sit\nll.'];
        const messages: string[] = [];
        let reads = 0;
        input.beforeRead = () => {
            const screen = requireGameDisplay().grid.map(row =>
                row.map(cell => cell.ch).join('')).join('\n');
            assert.ok(++reads < 80, `Unexpected input loop: ${screen}`);
            messages.push(game._pending_message || '');
            input.feed(screen.includes('--More--') ? ' ' : keys.shift() || ' ');
        };

        await rhack('#'.charCodeAt(0));

        assert.equal(game.u.ux, 12);
        assert.equal(game.u.uy, 10);
        assert.equal(game.u.umortality, 1);
        assert.equal(!!game.program_state.gameover, !lifeSaving);
        assert.match(messages.join('\n'), /cockatrice corpse/);
        if (lifeSaving) {
            assert.ok(amulet != null, 'Expected amulet to be initialized');
            assert.equal(amulet.where, 'gone');
            assert.ok(game.u.uhp > 0);
        } else {
            assert.equal(game.level.requireAt(10, 10).typ, THRONE);
            assert.doesNotMatch(messages.join('\n'), /puff of logic/);
        }
    });
}
