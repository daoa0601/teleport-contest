import assert from 'node:assert/strict';
import test from 'node:test';
import { M_AP_MONSTER, M_AP_NOTHING, M_AP_OBJECT, M_AP_TYPE, MM_NOGRP, MM_NOWAIT, MON_OFFMAP, NO_MINVENT, PIT } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { detachMonsterFromLevel } from '../js/monster_level_departure.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { initializeMonsterWormBody } from '../js/monster_worm.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { BOULDER } from '../js/object_data.js';
import { couldsee, vision_note_blocker_change, vision_recalc } from '../js/vision.js';
import { floorObject } from './support/game-objects.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
const BIRTH_FLAGS = MM_NOGRP | MM_NOWAIT | NO_MINVENT;
async function messageLine() {
    await flush_screen();
    return requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
}
void test('detachment removes occupancy while preserving departure coordinates and health', async () => {
    const level = freshObjectRoom();
    const monster = await createMonsterAt('little dog', 11, 10, BIRTH_FLAGS);
    const hp = monster.mhp;
    monster.mtrapped = 1;
    await detachMonsterFromLevel(monster);
    assert.equal(level.monsters.includes(monster), false);
    assert.equal(monsterAtPosition(level, 11, 10), null);
    assert.equal(monster.mx, 11);
    assert.equal(monster.my, 10);
    assert.equal(monster.mhp, hp);
    assert.equal(monster.mtrapped, 0);
});
void test('a departing holder releases the hero without expulsion or landing prose', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('owlbear', 11, 10, BIRTH_FLAGS);
    game.u.ustuck = monster;
    monster.mspec_used = 0;
    await detachMonsterFromLevel(monster);
    assert.equal(game.u.ustuck, null);
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.uy, 10);
    assert.ok(monster.mspec_used === 1 || monster.mspec_used === 2);
    assert.equal(await messageLine(), '');
});
void test('a departing engulfer releases the hero onto its old square', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('purple worm', 11, 10, BIRTH_FLAGS);
    game.u.ustuck = monster;
    game.u.uswallow = 1;
    game.u.uswldtim = 6;
    await detachMonsterFromLevel(monster);
    assert.equal(game.u.ustuck, null);
    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.uswldtim, 0);
    assert.equal(game.u.ux, 11);
    assert.equal(game.u.uy, 10);
    assert.equal(await messageLine(), '');
});
void test('a boulder fills a vacated pit without striking the departing monster', async () => {
    const level = freshObjectRoom();
    const monster = await createMonsterAt('little dog', 11, 10, BIRTH_FLAGS);
    const trap = addTrap(level, PIT, 11, 10, { tseen: true });
    // A trapped occupant can hold up a boulder until it leaves the square.
    const boulder = await floorObject(BOULDER, 11, 10);
    monster.mtrapped = 1;
    const hp = monster.mhp;
    await detachMonsterFromLevel(monster);
    assert.equal(level.traps.includes(trap), false);
    assert.equal(floorObjectsAt(level, 11, 10).includes(boulder), false);
    assert.equal(monster.mhp, hp);
    assert.equal(await messageLine(), 'The boulder fills a pit.');
});
void test('a mapped departing mimic loses its light-blocking object disguise', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('large mimic', 11, 10, BIRTH_FLAGS);
    monster.m_ap_type = M_AP_OBJECT;
    monster.mappearance = BOULDER;
    monster.mundetected = 1;
    vision_note_blocker_change(11, 10);
    vision_recalc(0);
    assert.equal(couldsee(12, 10), false);
    await detachMonsterFromLevel(monster);
    vision_recalc(0);
    assert.equal(M_AP_TYPE(monster), M_AP_NOTHING);
    assert.equal(monster.mundetected, 0);
    assert.equal(couldsee(12, 10), true);
});
void test('a mapped monster disguise survives departure', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('large mimic', 11, 10, BIRTH_FLAGS);
    monster.m_ap_type = M_AP_MONSTER;
    monster.mappearance = MONSTER_NAME.indexOf('little dog');
    await detachMonsterFromLevel(monster);
    assert.equal(M_AP_TYPE(monster), M_AP_MONSTER);
    assert.equal(monster.mappearance, MONSTER_NAME.indexOf('little dog'));
});
void test('an unmapped actor keeps its saved disguise and does not fill its old pit', async () => {
    const level = freshObjectRoom();
    const monster = await createMonsterAt('large mimic', 11, 10, BIRTH_FLAGS);
    monster.mstate = MON_OFFMAP;
    monster.m_ap_type = M_AP_OBJECT;
    monster.mappearance = BOULDER;
    monster.mundetected = 1;
    const trap = addTrap(level, PIT, 11, 10, { tseen: true });
    const boulder = await floorObject(BOULDER, 11, 10);
    await detachMonsterFromLevel(monster);
    assert.equal(level.monsters.includes(monster), false);
    assert.equal(M_AP_TYPE(monster), M_AP_OBJECT);
    assert.equal(monster.mappearance, BOULDER);
    assert.equal(monster.mundetected, 1);
    assert.ok(level.traps.includes(trap));
    assert.ok(floorObjectsAt(level, 11, 10).includes(boulder));
    assert.equal(await messageLine(), '');
});
void test('detaching a worm removes its tail from occupied map squares', async () => {
    const level = freshObjectRoom({ left: 3, right: 24, top: 3, bottom: 17 });
    const worm = await createMonsterAt('long worm', 15, 10, BIRTH_FLAGS);
    initializeMonsterWormBody(worm, { segmentCount: 3 });
    const squares = worm.wormSegments?.filter(segment => segment.x > 0) ?? [];
    assert.ok(squares.length > 0, 'The worm needs a placed tail');
    await detachMonsterFromLevel(worm);
    assert.equal(level.monsters.includes(worm), false);
    for (const square of squares)
        assert.equal(monsterAtPosition(level, square.x, square.y), null);
    assert.equal(worm.mx, 15);
    assert.equal(worm.my, 10);
});
void test('departure forgets only the polearm target that left the level', async () => {
    freshObjectRoom();
    const first = await createMonsterAt('little dog', 11, 10, BIRTH_FLAGS);
    const second = await createMonsterAt('kitten', 12, 10, BIRTH_FLAGS);
    game.context.polearm = { hitmonId: second.m_id };
    await detachMonsterFromLevel(first);
    assert.equal(game.context.polearm.hitmonId, second.m_id);
    await detachMonsterFromLevel(second);
    assert.equal(game.context.polearm.hitmonId, null);
});
//# sourceMappingURL=monster_level_departure.test.js.map