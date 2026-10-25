import assert from 'node:assert/strict';
import test from 'node:test';

import { continueCountedCommand, rhack } from '../js/cmd.js';
import { GRAVE, ROOM } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { PICK_AXE } from '../js/object_data.js';
import { roles } from '../js/roles.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

// C dig.c dig_up_grave(): an archeologist feels like a despicable
// grave-robber and loses three alignment points for a lawful dig.
void test('a lawful archeologist despairs while digging up a grave', async () => {
    const level = freshObjectRoom({ hero: { ualign: { type: 1, record: 0 } } });
    const archeologist = roles.find(candidate => candidate.key === 'archeologist');
    if (!archeologist) throw new Error('The archeologist role record is required');
    game.urole = archeologist;
    const grave = level.requireAt(10, 10);
    grave.typ = GRAVE;
    grave.emptygrave = 1; /* unoccupied: the role line is the assertion */
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
    initRng(1n);

    await rhack('a'.charCodeAt(0));
    for (let swing = 0; game._occupation && swing < 20; swing++)
        await continueCountedCommand();

    assert.ok(paged.some(line => /despicable grave-robber/.test(line)),
        `The grave-robber admission must page: ${paged.join(' | ')}`);
    assert.equal(game.u.ualign?.record, -3);
    assert.equal(grave.typ, ROOM);
});
