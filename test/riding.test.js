import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { vision_reset_new_level } from '../js/vision.js';
import { liveMonster } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';

function freshKnightArena() {
    const level = freshPlayableRoom({ right: 14, role: 'knight' });
    vision_reset_new_level();
    initRng(46001n);
    return level;
}

function pony(overrides = {}) {
    return liveMonster({
        mnum: 100,
        name: 'pony',
        x: 11,
        y: 10,
        hitPoints: 8,
        mtame: 20,
        mpeaceful: true,
        pet: true,
        saddled: true,
        edog: { hungrytime: 1001 },
        ...overrides,
    });
}

async function extended(command, suffix = '') {
    pushKeys(`${command}\n${suffix}`);
    await rhack('#'.charCodeAt(0));
}

test('mount and voluntary dismount preserve the live pony identity', async () => {
    const level = freshKnightArena();
    const steed = pony();
    level.monsters = [steed];

    await extended('ride', 'l');

    assert.equal(game.u.usteed, steed);
    assert.equal(level.monsters.includes(steed), false);
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /mount the saddled pony/);

    await extended('ride');

    assert.equal(game.u.usteed, null);
    assert.equal(level.monsters.filter(monster => monster === steed).length, 1);
    assert.deepEqual([steed.mx, steed.my], [11, 10]);
    assert.equal(
        Math.abs(game.u.ux - steed.mx) + Math.abs(game.u.uy - steed.my),
        1,
    );
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /pony with no name/);
});

test('an unsaddled pony rejects riding without time or state mutation',
    async () => {
        const level = freshKnightArena();
        const target = pony({ saddled: false });
        level.monsters = [target];
        const before = [game.u.ux, game.u.uy, game.u.uhp];

        await extended('ride', 'l');

        assert.equal(game.u.usteed, undefined);
        assert.deepEqual([game.u.ux, game.u.uy, game.u.uhp], before);
        assert.deepEqual(level.monsters, [target]);
        assert.equal(game.context.move, 0);
        assert.match(game._pending_message, /not saddled/);
    });

test('a saddled but untamed pony refuses the mount without injuring the hero',
    async () => {
        const level = freshKnightArena();
        const target = pony({ mtame: 0, pet: false });
        level.monsters = [target];
        const before = [game.u.ux, game.u.uy, game.u.uhp];

        await extended('ride', 'l');

        assert.equal(game.u.usteed, undefined);
        assert.deepEqual([game.u.ux, game.u.uy, game.u.uhp], before);
        assert.deepEqual(level.monsters, [target]);
        assert.equal(game.context.move, 0);
        assert.match(game._pending_message, /would mind/);
    });

test('chat derives a pony response from its current tame and hunger state',
    async () => {
        const level = freshKnightArena();
        const target = pony();
        level.monsters = [target];

        await extended('chat', 'l');

        assert.equal(game.context.move, 1);
        assert.equal(level.monsters[0], target);
        assert.deepEqual([target.mx, target.my, target.mhp], [11, 10, 8]);
        assert.match(game._pending_message, /pony whickers\.$/i);
    });
