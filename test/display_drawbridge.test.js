import test from 'node:test';
import assert from 'node:assert/strict';
import { DB_FLOOR, DB_ICE, DRAWBRIDGE_UP, POOL } from '../js/const.js';
import { canSenseMonster, glyphAt, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const under of [DB_FLOOR, DB_ICE]) {
    void test(`an underwater hero does not sense a monster on underlay ${under} below a raised bridge`, async () => {
        const level = freshObjectRoom({ hero: { underwater: true, detectMonsters: true } });
        level.requireAt(10, 10).typ = POOL;
        const monster = await createMonsterAt('giant', 11, 10);
        const square = level.requireAt(11, 10);
        square.typ = DRAWBRIDGE_UP;
        square.drawbridgemask = under;
        game.u.uinwater = 1;
        assert.equal(canSenseMonster(monster), false);
    });
}
void test('a gas cloud does not obscure a monster on inaccessible dry ground below a raised bridge', async () => {
    const level = freshObjectRoom();
    await createMonsterAt('giant', 14, 10);
    const square = level.requireAt(14, 10);
    square.typ = DRAWBRIDGE_UP;
    square.drawbridgemask = DB_FLOOR;
    level.regions = [{ kind: 'gas-cloud', heroInside: false, visible: true, heroFault: false,
            damage: 0, ttl: 3, cells: [{ x: 14, y: 10 }], monsterIds: [] }];
    newsym(14, 10);
    assert.equal(glyphAt(14, 10)?.kind, 'monster');
});
//# sourceMappingURL=display_drawbridge.test.js.map