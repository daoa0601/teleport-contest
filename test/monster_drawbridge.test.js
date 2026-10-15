import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { DB_FLOOR, DB_ICE, DB_LAVA, DB_MOAT, DRAWBRIDGE_UP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { CORPSE, LARGE_BOX } from '../js/object_data.js';
import { pushKeys } from '../js/input.js';
import { floorObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const under of [DB_FLOOR, DB_ICE]) {
    void test(`a hidden monster below a raised bridge over ${under === DB_FLOOR ? 'ground' : 'ice'} is revealed under its object`, async () => {
        const level = freshObjectRoom();
        await floorObject(LARGE_BOX, 11, 10, { bknown: false, typeKnown: false });
        const spider = await createMonsterAt('cave spider', 11, 10);
        const square = level.requireAt(11, 10);
        square.typ = DRAWBRIDGE_UP;
        square.drawbridgemask = under;
        spider.mundetected = 1;
        pushKeys(' '.repeat(10));
        await rhack('l'.charCodeAt(0));
        assert.match(game._pending_message, /hiding under a large box/);
        assert.equal(spider.mundetected, 0);
    });
}
for (const under of [DB_FLOOR, DB_ICE, DB_LAVA, DB_MOAT]) {
    void test(`a monster dying below a raised bridge over underlay ${under} leaves a corpse only on ice or water`, async () => {
        const level = freshObjectRoom();
        const giant = await createMonsterAt('giant', 11, 10);
        const square = level.requireAt(11, 10);
        square.typ = DRAWBRIDGE_UP;
        square.drawbridgemask = under;
        await finishEnvironmentalMonsterDeath(giant, game, { publish: () => { } });
        assert.equal(floorObjectsAt(level, 11, 10).some(object => object.otyp === CORPSE), under === DB_ICE || under === DB_MOAT);
    });
}
//# sourceMappingURL=monster_drawbridge.test.js.map