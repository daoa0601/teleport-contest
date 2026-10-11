import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_ANGRY, MM_NOTAIL, NO_MINVENT, W_ARM, W_ARMC, W_ARMF, W_ARMH } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { runMonsterAction } from '../js/monmove.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { WAN_DEATH, WAN_SPEED_MONSTER, WAN_STRIKING, OBJECT_NAMES, HELMET, IRON_SHOES, CLOAK_OF_PROTECTION } from '../js/object_data.js';
import { chargedWand, knownObject } from './support/game-objects.js';
import { objectTypeKnown } from '../js/shk.js';
import { applyWandEffect } from '../js/wand_effects.js';
import { zapRayWithObject } from '../js/zap.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { kickDirection } from './support/commands.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('kicking a detected invisible worm tail names the worm', async () => {
    freshObjectRoom({ left: 8, right: 22, top: 10, bottom: 10, heroX: 8, heroY: 10 });
    requirePlayingGame(game);
    const worm = await createMonsterAt('long worm', 14, 10,
        MM_ANGRY | MM_NOTAIL | NO_MINVENT);
    pushKeys(' '.repeat(100));
    initRng(1n);
    await runMonsterAction(worm, game);
    const tail = worm.wormSegments?.[0];
    assert.ok(tail);
    game.u.ux = tail.x + 1;
    worm.minvis = 1;
    grantIntrinsicProperty('detectMonsters', 'potion');
    vision_recalc(0);
    assert.ok(cansee(tail.x, tail.y));
    resetInputState();
    initRng(2n);

    await kickDirection('h', Array.from({ length: 40 }, () => ' '));

    assert.match(game._pending_message, /You kick the invisible long worm\./);
});

void test('detecting an invisible monster does not let the hero see a speed change', async () => {
    freshObjectRoom({ left: 8, right: 22, top: 10, bottom: 10, heroX: 8, heroY: 10 });
    requirePlayingGame(game);
    const jackal = await createMonsterAt('jackal', 12, 10, MM_ANGRY | NO_MINVENT);
    jackal.minvis = 1;
    grantIntrinsicProperty('detectMonsters', 'potion');
    pushKeys(' '.repeat(40));

    const wand = await chargedWand(WAN_SPEED_MONSTER, { typeKnown: false });
    game.u.dx = 1;
    game.u.dy = 0;
    game.u.dz = 0;
    await applyWandEffect(wand);

    assert.equal(jackal.mspeed, 2);
    assert.equal(objectTypeKnown(wand), false);
    assert.doesNotMatch(game._pending_message || '', /moving faster/);
});


void test('terse force-bolt feedback does not name even a visible target', async () => {
    freshObjectRoom({ left: 8, right: 22, top: 10, bottom: 10,
        heroX: 8, heroY: 10, flags: { verbose: false } });
    requirePlayingGame(game);
    const jackal = await createMonsterAt('jackal', 12, 10, MM_ANGRY | NO_MINVENT);
    jackal.mhp = jackal.mhpmax = 100;
    const wand = await chargedWand(WAN_STRIKING);
    pushKeys(' '.repeat(40));
    initRng(1n);

    game.u.dx = 1;
    game.u.dy = 0;
    game.u.dz = 0;
    await applyWandEffect(wand);

    assert.ok(jackal.mhp < 100);
    assert.match(game._pending_message, /^The wand hits it[.!]$/);
});

for (const perception of ['visible', 'terse', 'detected invisible']) {
    void test(`death-ray miss feedback for a ${perception} target`, async () => {
        freshObjectRoom({ left: 8, right: 30, top: 9, bottom: 11,
            flags: { verbose: perception !== 'terse' } });
        requirePlayingGame(game);
        const soldier = await createMonsterAt('soldier', 12, 10, MM_ANGRY | NO_MINVENT);
        for (const [type, slot] of [
            [OBJECT_NAMES.indexOf('plate mail'), W_ARM],
            [CLOAK_OF_PROTECTION, W_ARMC], [HELMET, W_ARMH], [IRON_SHOES, W_ARMF],
        ] satisfies [number, number][]) {
            await equipMonsterObject(soldier, await knownObject(type, { spe: 15 }), slot);
        }
        if (perception === 'detected invisible') {
            soldier.minvis = 1;
            grantIntrinsicProperty('detectMonsters', 'potion');
        }

        const hp = soldier.mhp;
        pushKeys(' '.repeat(40));
        const wand = await knownObject(WAN_DEATH);
        initRng(1n);

        game.u.dx = 1;
        game.u.dy = 0;
        game.u.dz = 0;
        await zapRayWithObject(wand);

        assert.equal(soldier.mhp, hp, 'the ray misses rather than killing the target');
        if (perception === 'detected invisible')
            assert.ok(!game._pending_message, 'the unseen miss produces no message');
        else
            assert.equal(game._pending_message,
                `The death ray misses ${perception === 'terse' ? 'it' : 'the soldier'}.`);
    });
}
