import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { ARROW_TRAP, DOOR, D_CLOSED, D_TRAPPED } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { BELL_OF_OPENING, CHEST } from '../js/object_data.js';
import { makeBlinded } from '../js/sight_change.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
for (const kind of ['floor', 'door', 'chest']) {
    void test(`the Bell of Opening maps a detected ${kind} trap from every direction while blind`, async (t) => {
        const level = freshObjectRoom();
        const location = level.requireAt(14, 10);
        location.seenv = 0;
        if (kind === 'floor')
            addTrap(level, ARROW_TRAP, 14, 10, { tseen: false });
        else if (kind === 'door') {
            location.typ = DOOR;
            location.doormask = D_CLOSED | D_TRAPPED;
        }
        else
            await floorObject(CHEST, 14, 10, { otrapped: true });
        await makeBlinded(100, { talk: false });
        const bell = await addInventoryObject(BELL_OF_OPENING, { spe: 3 });
        const input = resetInputState();
        planInput(input, t, [
            { prompt: /What do you want to use or apply\?/, keys: bell.invlet },
        ]);
        await rhack('a'.charCodeAt(0));
        assert.equal(location.seenv, 255);
        assert.equal(location.remembered_glyph?.kind, 'trap');
        assert.match(game._pending_message, /You reveal a trap!/);
        assert.equal(bell.spe, 2);
        assert.equal(game.context.move, 1);
    });
}
//# sourceMappingURL=detection_revelation.test.js.map