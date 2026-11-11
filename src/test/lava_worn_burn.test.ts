import assert from 'node:assert/strict';
import test from 'node:test';
import { OBJECT_NAMES, SCR_IDENTIFY, SPE_FORCE_BOLT } from '../js/object_data.js';
import { wearHeroArmor } from '../js/do_wear.js';

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
    const level = await freshObjectRoom({ flags: { debug: true, bones: false } });
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

void test('falling into fatal lava preserves four items already in use by their callers', async () => {
    const level = await freshObjectRoom({ flags: { bones: false } });
    level.requireAt(10, 10).typ = LAVAPOOL;
    const items = [
        await addInventoryObject(SCR_IDENTIFY),
        await addInventoryObject(SPE_FORCE_BOLT),
        await addInventoryObject(OBJECT_NAMES.indexOf('T-shirt')),
        await addInventoryObject(OBJECT_NAMES.indexOf('low boots')),
    ];
    for (const item of items) item.in_use = true;

    const result = await heroLiquidEffects({
        publish: async () => {},
        die: async () => { game.program_state.gameover = true; },
    });

    assert.equal(result?.died, true);
    for (const item of items) {
        assert.ok(game.inventory.includes(item), `In-use item ${item.otyp} must remain available to its caller`);
        assert.equal(item.in_use, true);
    }
});
