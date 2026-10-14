import assert from 'node:assert/strict';
import test from 'node:test';
import { LANDMINE, MOAT, NO_MINVENT } from '../js/const.js';
import { explodeLandMine } from '../js/landmine_explosion.js';
import { game } from '../js/gstate.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a visible landmine announces waking monsters and water filling its hole', async () => {
    const level = freshObjectRoom();
    const mine = addTrap(level, LANDMINE, 12, 10);
    level.requireAt(13, 10).typ = MOAT;
    const sleeper = await createMonsterAt('leprechaun', 14, 10, NO_MINVENT);
    sleeper.msleeping = 1;
    const messages = [];
    await explodeLandMine(mine, game, { seeSquare: true,
        random: limit => limit - 1,
        publish: message => { messages.push(message); },
    });
    assert.deepEqual(messages, ['The leprechaun wakes up.', 'The hole fills with water!']);
    assert.equal(sleeper.msleeping, 0);
    assert.equal(level.requireAt(12, 10).typ, MOAT);
    assert.equal(level.traps.includes(mine), false);
});
//# sourceMappingURL=landmine_liquid_messages.test.js.map