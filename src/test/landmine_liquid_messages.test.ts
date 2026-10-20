import assert from 'node:assert/strict';
import test from 'node:test';
import { LANDMINE, LAVAPOOL, MOAT, NO_MINVENT } from '../js/const.js';
import { beginMonsterLandMine, finishMonsterLandMine } from '../js/landmine_trap.js';
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
    const messages: string[] = [];

    await explodeLandMine(mine, game, { seeSquare: true,
        random: limit => limit - 1,
        publish: message => { messages.push(message); },
    });

    assert.deepEqual(messages, ['The leprechaun wakes up.', 'The hole fills with water!']);
    assert.equal(sleeper.msleeping, 0);
    assert.equal(level.requireAt(12, 10).typ, MOAT);
    assert.equal(level.traps.includes(mine), false);
});

void test('a land mine still wounds a monster that its lava hole relocates', async () => {
    const level = freshObjectRoom();
    const mine = addTrap(level, LANDMINE, 12, 10);
    level.requireAt(13, 10).typ = LAVAPOOL;
    const lich = await createMonsterAt('master lich', 12, 10, NO_MINVENT);
    lich.mhp = lich.mhpmax = 98;
    const event = beginMonsterLandMine(lich, mine, game, { random: limit => limit - 1, rollOne: () => 3 });

    await finishMonsterLandMine(lich, event, game, {
        random: limit => limit - 1,
        rollOne: () => 3,
        publish: () => {},
        finishDeath: () => Promise.resolve({ survived: false }),
        forceTrapAtMonster: () => Promise.resolve(),
    });

    assert.notDeepEqual([lich.mx, lich.my], [12, 10]);
    // One point from the lava, then the mine's three.
    assert.equal(lich.mhp, 94);
});
