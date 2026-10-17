import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/armor.js';
import { LAVAPOOL } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { heroLiquidEffects } from '../js/hack.js';
import { resetInputState } from '../js/input.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

const LEATHER_GLOVES = 159;

// C trap.c:lava_effects() names each burning worn item with
// Yobjnam2(obj, "burst"): a single pair of gloves takes the singular verb.
void test('a worn pair of gloves bursts into flame in lava', async () => {
    const level = freshObjectRoom({ flags: { debug: true, bones: false } });
    for (let x = 7; x <= 16; x++) {
        for (let y = 6; y <= 14; y++) level.requireAt(x, y).typ = LAVAPOOL;
    }
    const gloves = await addInventoryObject(LEATHER_GLOVES, { oerodeproof: false });
    assert.ok(wearHeroArmor(gloves));
    const input = resetInputState();
    const lines: string[] = [];
    input.display = {
        async readKey() {
            const text = requireGameDisplay().grid
                .map(row => row.map(cell => cell.ch).join('')).join('\n');
            lines.push(text);
            return (text.includes('--More--') ? ' ' : 'n').charCodeAt(0);
        },
    };

    await heroLiquidEffects();

    const text = [...lines, game._pending_message].join('\n');
    assert.match(text, /Your pair of [a-z ]*gloves bursts into flame!/, text);
});
