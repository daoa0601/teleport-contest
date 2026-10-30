import assert from 'node:assert/strict';
import test from 'node:test';

import { PIT, WEB } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CLUB } from '../js/object_data.js';
import { kickDirection } from './support/commands.js';
import { floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell, requireScreenRow } from './support/screen.js';

for (const [type, name] of [[PIT, 'pit'], [WEB, 'web']] as const) {
    void test(`kicking an object in a hidden ${name} reveals the trap before refusing the kick`, async () => {
        const level = await freshObjectRoom({ hero: { utrap: 0 } });
        const trap = addTrap(level, type, 11, 10, { tseen: false });
        const club = await floorObject(CLUB, 11, 10, { initialize: false });
        await newsym(11, 10);
        await flush_screen(1);
        const input = resetInputState();
        let discoveries = 0;
        input.display = {
            async readKey(): Promise<number> {
                discoveries++;
                assert.equal(requireScreenRow(0).map(cell => cell.ch).join('').trimEnd(),
                    `You find a ${name}.--More--`);
                assert.equal(requireScreenCell(9, 11).ch, '@');
                assert.equal(requireScreenCell(10, 11).ch, type === WEB ? '"' : '^');
                assert.equal(requireScreenCell(11, 11).ch, ' ', 'The discovery temporarily clears nearby terrain.');
                return 32;
            },
        };

        await kickDirection('l');

        assert.equal(discoveries, 1, 'The obscured discovery requires acknowledgment.');
        assert.equal(trap.tseen, true);
        assert.equal(game.u.utrap, 0, 'Finding the neighboring trap does not move the hero into it.');
        assert.equal(game.u.ux, 10);
        assert.equal(club.ox, 11);
        assert.equal(club.where, 'floor');
        assert.equal(game.context.move, 1);
        assert.equal(game._pending_message, `You can't kick something that's in a ${name}!`);
    });
}
