import assert from 'node:assert/strict';
import test from 'node:test';
import { LAVAPOOL } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { heroLiquidEffects } from '../js/hack.js';
import { resetInputState } from '../js/input.js';
import { propertyIsActive, propertyTimeout } from '../js/properties.js';
import { freshObjectRoom } from './support/object-room.js';

void test('two lava refusals without a safe landing grant five turns to escape', async () => {
    const level = freshObjectRoom({ flags: { debug: true, bones: false } });
    for (let x = 7; x <= 16; x++) {
        for (let y = 6; y <= 14; y++) level.requireAt(x, y).typ = LAVAPOOL;
    }
    const input = resetInputState();
    let refusals = 0;
    input.display = {
        async readKey() {
            const text = requireGameDisplay().grid
                .map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (text.includes('--More--')) return ' '.charCodeAt(0);
            assert.match(text, /Die\? \[yn\]/);
            assert.ok(++refusals <= 2, 'Lava recovery must stop after two death refusals');
            return 'n'.charCodeAt(0);
        },
    };

    const result = await heroLiquidEffects();

    assert.equal(result?.died, false);
    assert.equal(refusals, 2);
    assert.equal(!!game.program_state.gameover, false);
    assert.ok((game.u.uhp ?? 0) > 0);
    assert.equal(propertyIsActive('fireResistance'), true);
    assert.equal(propertyTimeout('fireResistance'), 5);
    assert.equal(propertyIsActive('waterWalking'), true);
    assert.equal(propertyTimeout('waterWalking'), 5);
    assert.equal(game.u.utrap ?? 0, 0);
});
