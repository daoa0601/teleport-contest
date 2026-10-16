import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { LAVAPOOL } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { heroLiquidEffects } from '../js/hack.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a blind hero feels the life-saving medallion warm after falling in lava', async () => {
    const level = freshObjectRoom({ hero: { blindTurns: 20 } });
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    level.requireAt(game.u.ux, game.u.uy).typ = LAVAPOOL;
    const messages: string[] = [];
    const input = resetInputState();
    input.display = {
        async readKey() {
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            messages.push(screen);
            assert.ok(messages.length < 16, `Unexpected lava input: ${screen}`);
            return 32;
        },
    };

    const result = await heroLiquidEffects();
    await flushPendingTopline();

    assert.equal(result?.died, false);
    assert.equal(amulet.where, 'gone');
    assert.ok(messages.some(message => message.includes('Your medallion feels warm!')));
    assert.ok(messages.every(message => !message.includes('medallion begins to glow')));
});
