import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { initializeMonsterWormBody } from '../js/monster_worm.js';
import { relocateMonsterTo } from '../js/teleport.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('forced relocation reports an occupied square before replacing its mapped monster', async () => {
    const level = freshObjectRoom();
    const resident = await createMonsterAt('goblin', 12, 10);
    const incoming = await createMonsterAt('goblin', 14, 10);
    resident.mpeaceful = incoming.mpeaceful = 0;
    const input = resetInputState();

    await answerPrompts(relocateMonsterTo(incoming, 12, 10), input, [
        { prompt: /placing goblin <14,10> over goblin <12,10> at <12,10>, mstates:0 0 on\s+Dlvl:8 \?[\s\S]*--More--/, keys: ' ' },
        { prompt: /Program in disorder![\s\S]*--More--/, keys: ' ' },
    ]);

    assert.equal(monsterAtPosition(level, 12, 10), incoming);
    assert.equal(level.monsters.includes(resident), true, 'The overwritten monster remains on the level');
    assert.equal(resident.mx, 12, 'Overwriting a map slot leaves the old monster coordinates intact');
    await relocateMonsterTo(incoming, 15, 10);
    assert.equal(monsterAtPosition(level, 12, 10), null, 'Moving away does not reveal the overwritten monster');
    assert.equal(monsterAtPosition(level, 15, 10), incoming);
});

void test('an overwritten monster can walk again and clears the monster mapped at its old coordinates', async () => {
    const level = freshObjectRoom({ context: { mon_moving: true } });
    requirePlayingGame(game);
    const resident = await createMonsterAt('goblin', 12, 10);
    const incoming = await createMonsterAt('goblin', 14, 10);
    resident.mpeaceful = incoming.mpeaceful = 0;
    const input = resetInputState();
    await answerPrompts(relocateMonsterTo(incoming, 12, 10), input, [
        { prompt: /placing goblin[\s\S]*--More--/, keys: ' ' },
        { prompt: /Program in disorder![\s\S]*--More--/, keys: ' ' },
    ]);

    await takeMonsterTurn(resident, game);

    assert.notEqual(resident.mx, 12, 'The hostile goblin walks toward the hero');
    assert.equal(monsterAtPosition(level, resident.mx, resident.my), resident);
    assert.equal(monsterAtPosition(level, 12, 10), null);
    assert.equal(incoming.mx, 12, 'Removing a map slot does not move its former occupant');
    assert.equal(level.monsters.includes(incoming), true);
});

void test('overwriting a worm segment changes map occupancy without removing the segment from its body', async () => {
    const level = freshObjectRoom({ left: 7, right: 25 });
    const worm = await createMonsterAt('long worm', 18, 10);
    initializeMonsterWormBody(worm, { segmentCount: 3 });
    const segment = worm.wormSegments?.[0];
    assert.ok(segment, 'The live worm has a tail segment');
    const incoming = await createMonsterAt('goblin', 8, 10);
    incoming.mpeaceful = 0;
    const x = segment.x, y = segment.y;
    const input = resetInputState();
    await answerPrompts(relocateMonsterTo(incoming, x, y), input, [
        { prompt: /placing goblin[\s\S]*over .*long worm[\s\S]*--More--/, keys: ' ' },
        { prompt: /Program in disorder![\s\S]*--More--/, keys: ' ' },
    ]);

    assert.equal(monsterAtPosition(level, x, y), incoming);
    assert.equal(worm.wormSegments?.includes(segment), true);
    assert.equal(segment.x, x);
    assert.equal(segment.y, y);
    await relocateMonsterTo(incoming, 9, 10);
    assert.equal(monsterAtPosition(level, x, y), null);
    assert.equal(monsterAtPosition(level, worm.mx, worm.my), worm);
});
