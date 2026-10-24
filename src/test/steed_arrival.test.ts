import assert from 'node:assert/strict';
import test from 'node:test';

import { DISMOUNT_KNOCKED, STONE, VIBRATING_SQUARE } from '../js/const.js';
import { moveObject } from '../js/floor_object.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { punishHero } from '../js/punishment.js';
import { dismountHero } from '../js/steed.js';
import { runExtendedCommand } from './support/commands.js';
import { addTrap } from './support/level-state.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';

function ridingRoom() {
    freshObjectRoom({
        role: 'knight', hero: { ulevel: 30, uhp: 100, uhpmax: 100 },
        flags: { pickup: false, tips: false },
    });
    installPagerInput(resetInputState(), {
        expected: /mount|dungeon on|vibration|punish|off of|leg|Things that are here:|iron ball|chain/,
        limit: 12,
    });
}

function invocationLevel() {
    game.dungeons = [createDungeon({
        dname: 'Gehennom', num_dunlevs: 30, flags: { hellish: true },
    })];
    game.valley_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
    game.u.uz = { dnum: 0, dlevel: 29 };
}

void test('mounting on the invocation square announces the vibration beneath the steed', async () => {
    ridingRoom();
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    invocationLevel();
    const square = addTrap(game.level, VIBRATING_SQUARE, pony.mx, pony.my, { tseen: false });

    await runExtendedCommand('ride', 'l');

    assert.equal(game.u.usteed, pony);
    assert.equal(square.tseen, true);
    assert.equal(game.u.uevent?.uvibrated, 1);
    assert.match(game._last_message, /You feel a strange vibration beneath your pony\./);
    assert.equal(game.context.move, 1);
});

void test('dismounting onto the invocation square announces the vibration under the hero', async () => {
    ridingRoom();
    requirePlayingGame(game);
    await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    const x = game.u.ux, y = game.u.uy;
    invocationLevel();
    const square = addTrap(game.level, VIBRATING_SQUARE, x + 1, y, { tseen: false });
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if ((dx || dy) && !(dx === 1 && dy === 0))
                game.level.requireAt(x + dx, y + dy).typ = STONE;
        }
    }

    await runExtendedCommand('ride');

    assert.equal(game.u.usteed, null);
    assert.equal(game.u.ux, x + 1);
    assert.equal(square.tseen, true);
    assert.equal(game.u.uevent?.uvibrated, 1);
    assert.match(game._last_message, /You feel a strange vibration under your feet\./);
    assert.equal(game.context.move, 1);
});

void test('a dismount drags a trailing punishment ball without a walking delay', async () => {
    ridingRoom();
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    await punishHero();
    const ball = game.uball, chain = game.uchain;
    assert.ok(ball && chain);
    const x = game.u.ux, y = game.u.uy;
    await moveObject(ball, x - 2, y);
    await moveObject(chain, x - 1, y);
    game.u.dx = 1;
    game.u.dy = 0;

    const result = await dismountHero(DISMOUNT_KNOCKED);

    assert.equal(result.dismounted, true);
    assert.equal(game.u.usteed, null);
    assert.equal(game.u.ux, x + 1);
    assert.equal(pony.mx, x);
    assert.equal(ball.ox, x - 1, 'the ball follows the old chain position');
    assert.equal(chain.ox, x, 'the chain follows the old rider position');
    assert.equal(game._helplessTurns ?? 0, 0);
});
