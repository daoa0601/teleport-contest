import test from 'node:test';
import assert from 'node:assert/strict';
import { DBWALL, DB_MOAT, DB_NORTH, DOOR, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP } from '../js/const.js';
import { closeDrawbridge, openDrawbridge } from '../js/dbridge.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { moveObject, placeCreatedObject } from '../js/floor_object.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { BELL_OF_OPENING, ROCK, SACK } from '../js/object_data.js';
import { punishHero } from '../js/punishment.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { knownObject, untimedCorpse } from './support/game-objects.js';
import { freshGameplayRoom } from './support/playable-room.js';
function bridgeRoom(open = false) {
    const level = freshGameplayRoom();
    const bridge = level.requireAt(12, 10);
    bridge.typ = open ? DRAWBRIDGE_DOWN : DRAWBRIDGE_UP;
    bridge.drawbridgemask = DB_NORTH | DB_MOAT;
    level.requireAt(12, 9).typ = open ? DOOR : DBWALL;
    pushKeys(' '.repeat(100));
    return level;
}
void test('a lowering drawbridge preserves invocation tools and frees crushed container contents', async () => {
    const level = bridgeRoom();
    const bell = placeCreatedObject(await knownObject(BELL_OF_OPENING), 12, 10);
    const sack = placeCreatedObject(await knownObject(SACK), 12, 10);
    const rock = await knownObject(ROCK);
    await addCreatedObjectToContainer(sack, rock);
    await openDrawbridge(12, 10);
    assert.equal(level.objects[12]?.[10]?.includes(bell), true);
    assert.equal(bell.where, 'floor');
    assert.equal(sack.where, 'gone');
    assert.equal(rock.where, 'gone');
});
void test('a rising drawbridge destroys a punishment ball and releases the hero', async () => {
    bridgeRoom(true);
    await punishHero();
    const ball = game.uball;
    const chain = game.uchain;
    assert.ok(ball);
    assert.ok(chain);
    await moveObject(ball, 12, 10);
    await closeDrawbridge(12, 10);
    assert.equal(ball.where, 'gone');
    assert.equal(chain.where, 'gone');
    assert.equal(game.u.punished, false);
    assert.equal(game.uball, null);
    assert.equal(game.uchain, null);
});
void test('a lowering drawbridge revives a Rider before destroying the floor pile', async () => {
    const level = bridgeRoom();
    const death = MONSTER_NAME.indexOf('Death');
    const corpse = placeCreatedObject(await untimedCorpse(death), 12, 10);
    await openDrawbridge(12, 10);
    assert.equal(corpse.where, 'gone');
    assert.equal(level.monsters.some(monster => monster.mnum === death && monster.mhp > 0), true);
});
//# sourceMappingURL=dbridge_objects.test.js.map