import test from 'node:test';
import assert from 'node:assert/strict';
import { newsym } from '../js/display.js';
import { moveObject } from '../js/floor_object.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { SCR_LIGHT } from '../js/object_data.js';
import { punishHero } from '../js/punishment.js';
import { readInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

void test('darkness forgets a punishment ball and chain which are no longer visible', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    await punishHero();
    const ball = game.uball, chain = game.uchain;
    assert.ok(ball && chain);
    await moveObject(ball, 8, 10);
    await moveObject(chain, 9, 10);
    newsym(8, 10);
    newsym(9, 10);
    assert.equal(level.requireAt(8, 10).remembered_glyph?.kind, 'object');
    assert.equal(level.requireAt(9, 10).remembered_glyph?.kind, 'object');
    const scroll = await addInventoryObject(SCR_LIGHT, { cursed: true, typeKnown: true });

    await readInventoryObject(scroll);

    assert.notEqual(level.requireAt(8, 10).remembered_glyph?.kind, 'object');
    assert.notEqual(level.requireAt(9, 10).remembered_glyph?.kind, 'object');
    assert.ok(floorObjectsAt(level, 8, 10).includes(ball));
    assert.ok(floorObjectsAt(level, 9, 10).includes(chain));
    assert.equal(game.context.move, 1);
});
