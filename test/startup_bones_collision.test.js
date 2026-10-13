import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_NONAME, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { makemonAt, saveBonesLevel } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { memoryStorage } from './support/memory-storage.js';
void test('a new hero moves an ancestor off the starting stair before creating the pet', async () => {
    const storage = memoryStorage();
    const nethackrc = [
        'OPTIONS=name:Wizard,role:Valkyrie,race:human,gender:female,align:lawful',
        'OPTIONS=!legacy,!tutorial,!autopickup,pettype:none',
    ].join('\n');
    await runSegment({ storage, seed: 314, datetime: '20260830190000', moves: '', nethackrc });
    requirePlayingGame(game);
    const stair = { x: game.u.ux, y: game.u.uy };
    const ghostType = MONSTER_NAME.indexOf('ghost');
    game.in_mklev = true;
    const ancestor = await makemonAt(ghostType, stair.x, stair.y, NO_MINVENT | MM_NONAME);
    game.in_mklev = false;
    assert.ok(ancestor);
    assert.equal(saveBonesLevel(), true);
    await runSegment({
        storage, seed: 3, datetime: '20260830190000', moves: '',
        nethackrc: nethackrc.replace('pettype:none', 'pettype:dog'),
    });
    requirePlayingGame(game);
    const restored = game.level.monsters.find(monster => monster.mnum === ghostType);
    assert.ok(restored, 'the new game must load the ancestor level');
    assert.equal(game.u.ux, stair.x);
    assert.equal(game.u.uy, stair.y);
    assert.equal(monsterAtPosition(game.level, stair.x, stair.y) === null, true, 'the ancestor must leave the hero starting square');
    assert.ok(Math.max(Math.abs(restored.mx - stair.x), Math.abs(restored.my - stair.y)) <= 1);
    assert.ok(game.startingPet);
    assert.notEqual(game.startingPet, restored);
});
//# sourceMappingURL=startup_bones_collision.test.js.map