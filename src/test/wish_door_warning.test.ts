import assert from 'node:assert/strict';
import test from 'node:test';
import { DOOR, D_LOCKED, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { readObjectName } from '../js/objnam.js';
import { initRng } from '../js/rng.js';
import { vision_recalc } from '../js/vision.js';
import { kickDirection } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('replacing a warned door gives the town watch a fresh first warning', async () => {
    const level = freshObjectRoom({ hero: { acurr: { a: [3, 3, 3, 12, 12, 12] } } });
    level.flags.has_town = true;
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_LOCKED;
    const watchman = await createMonsterAt('watchman', 10, 11, MM_NOGRP | NO_MINVENT);
    watchman.mpeaceful = 1;
    const messages: string[] = [];
    const input = resetInputState();
    input.display = { async readKey() { messages.push(game._pending_message); return 32; } };
    initRng(1n);
    await kickDirection('l');
    assert.equal(door.doormask, D_LOCKED, 'the weak kick leaves the door intact');
    assert.match(game._pending_message, /stop damaging that door/);

    game.u.ux = 11;
    await readObjectName('wall', { wizardWish: true });
    await readObjectName('locked door', { wizardWish: true });
    game.u.ux = 10;
    vision_recalc(0);
    initRng(1n);
    await kickDirection('l');

    assert.equal(watchman.mpeaceful, 1, 'a first warning for the new door must not anger the watch');
    assert.match([...messages, game._pending_message].join('\n'), /stop damaging that door/);
});
