import assert from 'node:assert/strict';
import test from 'node:test';
import { D_CLOSED, DOOR, MAGIC_TRAP, MM_ANGRY, MM_NOGRP, NO_MINVENT, SDOOR } from '../js/const.js';
import { digHole } from '../js/digging_terrain.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addTrap } from './support/level-state.js';
import { requireFixtureGame } from './support/game-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('digging into a magical trap reveals a secret door in the blast', async () => {
    const level = freshObjectRoom({ hero: { uhp: 1000, uhpmax: 1000 } });
    addTrap(level, MAGIC_TRAP, 10, 10);
    const door = level.requireAt(11, 10);
    door.typ = SDOOR;
    door.doormask = D_CLOSED;
    installPagerInput(resetInputState(), { expected: /Boom|door|blast|caught/, limit: 8 });

    await digHole({});

    assert.equal(door.typ, DOOR, 'The blast exposes the secret door.');
    assert.equal(door.doormask, D_CLOSED, 'A magical blast leaves the door intact.');
});

void test('a trap blast outside the held hero does not double damage to the holder', async () => {
    const level = freshObjectRoom({ right: 18, hero: { uhp: 1000, uhpmax: 1000 } });
    requireFixtureGame(game);
    const holder = await createMonsterAt('giant ant', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    const neighbor = await createMonsterAt('giant ant', 13, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    holder.mhp = holder.mhpmax = 1000;
    neighbor.mhp = neighbor.mhpmax = 1000;
    game.u.ustuck = holder;
    addTrap(level, MAGIC_TRAP, 12, 10);
    installPagerInput(resetInputState(), { expected: /Boom|caught|blast/, limit: 8 });

    await digHole({ coordinate: { x: 12, y: 10 } });

    assert.equal(game.u.uhp, 1000, 'The hero is outside the blast.');
    assert.ok(holder.mhp < 1000, 'The holder is inside the blast.');
    assert.equal(holder.mhp, neighbor.mhp, 'Both unresisting monsters take the same damage.');
});
