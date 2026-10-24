import assert from 'node:assert/strict';
import test from 'node:test';
import { DB_MOAT, DB_NORTH, DBWALL, DRAWBRIDGE_UP, MM_ANGRY, NO_MINVENT, ROOM, STONE, } from '../js/const.js';
import { openDrawbridge } from '../js/dbridge.js';
import { canSeeMonster } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { monsterStatusLine } from '../js/monster_status.js';
import { initializeMonsterWormBody } from '../js/monster_worm.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { assertWormBody } from './support/worms.js';
async function wormMovedByDrawbridge(withTail = false) {
    const level = freshObjectRoom({ left: 8, right: 22, top: 6, bottom: 15,
        heroX: 12, heroY: 13 });
    for (let x = 11; x <= 13; x++) {
        for (let y = 8; y <= 10; y++)
            level.requireAt(x, y).typ = STONE;
    }
    level.requireAt(12, 9).typ = DBWALL;
    const bridge = level.requireAt(12, 10);
    bridge.typ = DRAWBRIDGE_UP;
    bridge.drawbridgemask = DB_NORTH | DB_MOAT;
    const worm = await createMonsterAt('earth elemental', 12, 9, MM_ANGRY | NO_MINVENT);
    installPagerInput(resetInputState(), { expected: /worm|bridge|turns|elemental/i, limit: 8 });
    await changeMonsterForm(worm, MONSTER_NAME.indexOf('long worm'));
    assertWormBody(worm);
    assert.equal(worm.wormSegments.length, 0);
    if (withTail) {
        level.requireAt(11, 9).typ = ROOM;
        level.requireAt(10, 9).typ = ROOM;
        initializeMonsterWormBody(worm, { segmentCount: 2, random: () => 0 });
        assert.equal(worm.wormSegments.length, 2);
    }
    assert.equal(await openDrawbridge(12, 10), true);
    assert.deepEqual([worm.mx, worm.my], [12, 10]);
    return worm;
}
void test('probing a drawbridge-shifted worm numbers its tail but finds no segment under the live head', async () => {
    const worm = await wormMovedByDrawbridge(true);
    const headStatus = await monsterStatusLine(worm);
    assert.match(headStatus, /, 0th of 3 segments/);
    for (const [index, segment] of worm.wormSegments.entries()) {
        const status = await monsterStatusLine(worm, { x: segment.x, y: segment.y });
        assert.match(status, index === 0 ? /, 2nd of 3 segments/ : /, 3rd of 3 segments/);
    }
});
for (const oldHeadVisible of [false, true]) {
    void test(`a drawbridge-shifted worm is ${oldHeadVisible ? 'known' : 'unknown'} when its stored head segment is ${oldHeadVisible ? 'lit' : 'dark'}`, async () => {
        const worm = await wormMovedByDrawbridge();
        requirePlayingGame(game);
        const oldHead = game.level.requireAt(12, 9);
        const liveHead = game.level.requireAt(12, 10);
        oldHead.lit = oldHead.waslit = oldHeadVisible;
        liveHead.lit = liveHead.waslit = !oldHeadVisible;
        vision_recalc(0);
        assert.equal(cansee(12, 9), oldHeadVisible, 'The stored segment has the intended visibility.');
        assert.equal(cansee(12, 10), !oldHeadVisible, 'The displaced head has the opposite visibility.');
        assert.equal(canSeeMonster(worm), oldHeadVisible);
    });
}
//# sourceMappingURL=monster_worm_head.test.js.map