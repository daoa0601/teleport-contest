import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { tameMonster } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { mksobj } from '../js/mklev.js';
import { SADDLE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { putSaddleOnMonster } from '../js/steed.js';
import { vision_reset_new_level } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshPlayableRoom } from './support/playable-room.js';

function freshKnightArena() {
    const level = freshPlayableRoom({ right: 14, role: 'knight' });
    vision_reset_new_level();
    initRng(46001n);
    return level;
}

async function extended(command, suffix = '') {
    pushKeys(`${command}\n${suffix}`);
    await rhack('#'.charCodeAt(0));
}

test('an animal body cannot mount a saddled pony', async () => {
    freshObjectRoom({ role: 'knight' });
    const pony = await createMonsterAt('pony', game.u.ux + 1, game.u.uy);
    tameMonster(pony, game);
    putSaddleOnMonster(knownObject(SADDLE), pony);
    installPolymorphedHero('bat');

    await extended('ride', 'l');

    assert.ok(!game.u.usteed);
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /won't fit on a saddle/);
});

test('a non-knight loses a barely tame mount before getting on', async () => {
    freshObjectRoom({ role: 'barbarian', hero: { ulevel: 30 } });
    const pony = await createMonsterAt('pony', game.u.ux + 1, game.u.uy);
    tameMonster(pony, game);
    pony.mtame = 1;
    putSaddleOnMonster(knownObject(SADDLE), pony);

    await extended('ride', 'l');

    assert.ok(!game.u.usteed);
    assert.equal(pony.mtame, 0);
    assert.equal(game.context.move, 0);
});

test('slipping from a cursed saddle damages the active monster body', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    const pony = await createMonsterAt('pony', game.u.ux + 1, game.u.uy);
    tameMonster(pony, game);
    putSaddleOnMonster(knownObject(SADDLE, { cursed: true }), pony);
    installPolymorphedHero('vampire', { hitPoints: 1 });
    const humanHealth = game.u.uhp;

    await extended('ride', 'l                ');

    assert.ok(!game.u.usteed);
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.uhp, humanHealth);
    assert.equal(game.context.move, 0);
});

test('mount and voluntary dismount preserve the live pony identity', async () => {
    const level = freshKnightArena();
    const steed = await createMonsterAt('pony', 11, 10);
    tameMonster(steed, game);
    putSaddleOnMonster(mksobj(SADDLE, true, false), steed);
    game.u.ulevel = 10;

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
        const target = await createMonsterAt('pony', 11, 10);
        tameMonster(target, game);
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
        const target = await createMonsterAt('pony', 11, 10);
        putSaddleOnMonster(mksobj(SADDLE, true, false), target);
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
        const target = await createMonsterAt('pony', 11, 10);
        tameMonster(target, game);
        const hitPointsBefore = target.mhp;

        await extended('chat', 'l');

        assert.equal(game.context.move, 1);
        assert.equal(level.monsters[0], target);
        assert.deepEqual([target.mx, target.my], [11, 10]);
        assert.equal(target.mhp, hitPointsBefore);
        assert.match(game._pending_message, /pony whickers\.$/i);
    });
