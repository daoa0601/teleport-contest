import assert from 'node:assert/strict';
import test from 'node:test';

import { continueCountedCommand, rhack } from '../js/cmd.js';
import { POOL } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { PICK_AXE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

// C dig.c prints the flooding liquid through hliquid(): a hallucinating hero
// gets a display-rolled name from do_name.c's hliquids[] table, with the true
// liquid included as one extra slot in the roll, so plain "water" remains a
// legal hallucinated draw.  Seed 3 draws the table's "nectar"; seed 103 lands
// on the extra slot and reads the true "water".
void test('a hallucinating hero names the flooding liquid from the display roll', async () => {
    const expectations = [
        [3n, 'nectar'],
        [103n, 'water'],
    ] as const;
    for (const [seed, liquid] of expectations) {
        const level = freshObjectRoom({
            hero: { uhp: 500, uhpmax: 500, hallucinationTurns: 50 },
        });
        // Three neighbouring pools give fillholetyp() one effective pool slot.
        for (const [x, y] of [[11, 10], [9, 10], [10, 9]] as const)
            level.requireAt(x, y).typ = POOL;
        const pick = await addInventoryObject(PICK_AXE, { spe: 0 });
        game.uwep = game.u.uwep = pick;
        const input = resetInputState();
        const paged: string[] = [];
        input.display = {
            async readKey(): Promise<number> {
                const display = requireGameDisplay(game);
                paged.push(display.grid[0]?.map(cell => cell.ch).join('').trim() ?? '');
                return ' '.charCodeAt(0);
            },
        };
        input.feed(`${pick.invlet}>`);
        initRng(seed);

        await rhack('a'.charCodeAt(0));
        for (let swing = 0; game._occupation && swing < 20; swing++)
            await continueCountedCommand();

        const flooded = paged.find(line => /As you dig, the hole fills with/.test(line));
        assert.ok(flooded, `The dig must flood: ${paged.join(' | ')}`);
        assert.match(flooded, new RegExp(`As you dig, the hole fills with ${liquid}!`));
        assert.equal(level.requireAt(10, 10).typ, POOL);
    }
});
