import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { P_RIDING } from '../js/const.js';
import { tameMonster } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { SADDLE } from '../js/object_data.js';
import { ensureHeroSkills } from '../js/skills.js';
import { putSaddleOnMonster } from '../js/steed.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { runExtendedCommand } from './support/commands.js';
import { knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

test('an animal body cannot mount a saddled pony', async () => {
    freshObjectRoom({ role: 'knight' });
    await createSaddledSteed();
    installPolymorphedHero('bat');

    await runExtendedCommand('ride', 'l');

    assert.ok(!game.u.usteed);
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /won't fit on a saddle/);
});

test('a non-knight loses a barely tame mount before getting on', async () => {
    freshObjectRoom({ role: 'barbarian', hero: { ulevel: 30 } });
    const pony = await createSaddledSteed();
    pony.mtame = 1;

    await runExtendedCommand('ride', 'l');

    assert.ok(!game.u.usteed);
    assert.equal(pony.mtame, 0);
    assert.equal(game.context.move, 0);
});

test('slipping from a cursed saddle damages the active monster body', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    await createSaddledSteed('pony', { saddle: { cursed: true } });
    installPolymorphedHero('vampire', { hitPoints: 1 });
    const humanHealth = game.u.uhp;

    await runExtendedCommand('ride', 'l                ');

    assert.ok(!game.u.usteed);
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.uhp, humanHealth);
    assert.equal(game.context.move, 0);
});

test('mount and voluntary dismount preserve the live pony identity', async () => {
    const level = freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    const steed = await createSaddledSteed();

    await runExtendedCommand('ride', 'l');

    assert.equal(game.u.usteed, steed);
    assert.equal(level.monsters.includes(steed), false);
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /mount the saddled pony/);

    await runExtendedCommand('ride');

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
        const level = freshObjectRoom({ role: 'knight' });
        const target = await createMonsterAt('pony', 11, 10);
        tameMonster(target, game);
        const before = [game.u.ux, game.u.uy, game.u.uhp];

        await runExtendedCommand('ride', 'l');

        assert.equal(game.u.usteed, undefined);
        assert.deepEqual([game.u.ux, game.u.uy, game.u.uhp], before);
        assert.deepEqual(level.monsters, [target]);
        assert.equal(game.context.move, 0);
        assert.match(game._pending_message, /not saddled/);
    });

test('a saddled but untamed pony refuses the mount without injuring the hero',
    async () => {
        const level = freshObjectRoom({ role: 'knight' });
        const target = await createMonsterAt('pony', 11, 10);
        putSaddleOnMonster(knownObject(SADDLE), target);
        const before = [game.u.ux, game.u.uy, game.u.uhp];

        await runExtendedCommand('ride', 'l');

        assert.equal(game.u.usteed, undefined);
        assert.deepEqual([game.u.ux, game.u.uy, game.u.uhp], before);
        assert.deepEqual(level.monsters, [target]);
        assert.equal(game.context.move, 0);
        assert.match(game._pending_message, /would mind/);
    });

test('chat derives a pony response from its current tame and hunger state',
    async () => {
        const level = freshObjectRoom({ role: 'knight' });
        const target = await createMonsterAt('pony', 11, 10);
        tameMonster(target, game);
        const hitPointsBefore = target.mhp;

        await runExtendedCommand('chat', 'l');

        assert.equal(game.context.move, 1);
        assert.equal(level.monsters[0], target);
        assert.deepEqual([target.mx, target.my], [11, 10]);
        assert.equal(target.mhp, hitPointsBefore);
        assert.match(game._pending_message, /pony whickers\.$/i);
    });

test('riding moves the pony with the hero and trains riding skill', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    ensureHeroSkills(game);
    game.u.urideturns = 99;
    const practice = game.u.weaponSkills[P_RIDING].advance;

    await rhack('l'.charCodeAt(0));

    assert.equal(game.u.ux, 12);
    assert.equal(pony.mx, game.u.ux);
    assert.equal(pony.my, game.u.uy);
    assert.equal(game.u.weaponSkills[P_RIDING].advance, practice + 1);
});

test('a sleeping pony prevents walking but not an attack from the saddle', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    pony.msleeping = 1;

    await rhack('l'.charCodeAt(0));

    assert.equal(game.u.ux, 11);
    assert.match(game._pending_message, /pony won't move/);
    const foe = await createMonsterAt('lichen', 12, 10);
    foe.mpeaceful = false;
    const health = foe.mhp;

    await rhack('l'.charCodeAt(0));

    assert.ok(foe.mhp < health);
    assert.equal(game.u.usteed, pony);
});

test('changing into a bat forces a dismount even when the saddle is cursed', async () => {
    const level = freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    pony.saddle.cursed = true;
    game.flags.debug = true;
    const health = game.u.uhp;

    await runExtendedCommand('polyself', 'bat\n                ');

    assert.equal(game.u.usteed, null);
    assert.ok(level.monsters.includes(pony));
    assert.ok(game.u.ux !== pony.mx || game.u.uy !== pony.my);
    assert.equal(game.u.uhp, health);
});

test('a medium humanoid form can stay on the same pony', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    game.flags.debug = true;

    await runExtendedCommand('polyself', 'vampire\n                ');

    assert.equal(game.u.usteed, pony);
    assert.equal(pony.mx, game.u.ux);
    assert.equal(pony.my, game.u.uy);
});
