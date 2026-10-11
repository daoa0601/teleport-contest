import test from 'node:test';
import assert from 'node:assert/strict';
import { A_INT, NO_MINVENT, WEB } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { installPagerInput } from './support/pager-input.js';
import { hitMonsterWithRay, zapRayWithObject } from '../js/zap.js';
import { WAN_MAGIC_MISSILE, WAN_DEATH, WAN_COLD, SPE_MAGIC_MISSILE, SPE_FIREBALL } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { knownObject, artifactObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { addInventoryItem } from '../js/u_init.js';
for (const [type, intelligence, expectedBonus] of [[10, 18, 1], [15, 25, 3]]) {
    void test(`spell ray type ${type} adds the caster's intelligence bonus`, async () => {
        const damages = [];
        for (const spell of [false, true]) {
            freshObjectRoom({ hero: { ulevel: 20 } });
            requirePlayingGame(game);
            game.u.acurr.a[A_INT] = game.u.amax.a[A_INT] = intelligence;
            const ant = await createMonsterAt('giant ant', 11, 10, NO_MINVENT);
            ant.mhp = ant.mhpmax = 200;
            initRng(7n);
            damages.push(await hitMonsterWithRay(ant, spell ? type : type - 10, 2));
        }
        assert.ok(damages[0] !== undefined && damages[1] !== undefined);
        assert.equal(damages[1], damages[0] + expectedBonus);
    });
}
void test('the Knight quest artifact doubles spell damage before the monster saving throw', async () => {
    const damages = [];
    for (const carriesArtifact of [false, true]) {
        freshObjectRoom({ role: 'knight', hero: { ulevel: 20 } });
        requirePlayingGame(game);
        if (carriesArtifact)
            await addInventoryItem(await artifactObject('The Magic Mirror of Merlin'));
        const ant = await createMonsterAt('giant ant', 11, 10, NO_MINVENT);
        ant.mhp = ant.mhpmax = 200;
        initRng(4n);
        damages.push(await hitMonsterWithRay(ant, 10, 2));
    }
    assert.ok(damages[0] !== undefined && damages[1] !== undefined);
    assert.equal(damages[1], 2 * damages[0]);
});
void test('monster fire breath does full damage while hero fire receives a magic saving throw', async () => {
    const damages = [];
    for (const nativeType of [-21, 21]) {
        freshObjectRoom();
        requirePlayingGame(game);
        const lich = await createMonsterAt('mind flayer', 11, 10, NO_MINVENT);
        lich.mhp = lich.mhpmax = 1000;
        installPagerInput(resetInputState(), { expected: /mind flayer.*resist|mind flayer.*burn/i, limit: 2 });
        initRng(7n);
        damages.push(await hitMonsterWithRay(lich, nativeType, 6));
    }
    assert.ok(damages[0] !== undefined && damages[1] !== undefined);
    assert.ok(damages[0] > 0);
    assert.equal(damages[1], Math.trunc(damages[0] / 2));
});
void test('chain lightning damage leaves fatal monster removal to its caller', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const ant = await createMonsterAt('giant ant', 11, 10, NO_MINVENT);
    ant.mhp = 1;
    initRng(7n);
    const damage = await hitMonsterWithRay(ant, 15, 2);
    assert.ok(damage > 1);
    assert.equal(ant.mhp, 1 - damage);
    assert.ok(game.level.monsters.includes(ant));
    assert.equal(game.u.uconduct?.killer || 0, 0);
});
void test('a vertical magic missile hits the hero and respects half spell damage', async () => {
    const losses = [];
    for (const halfSpellDamage of [false, true]) {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 100, halfSpellDamage, dx: 0, dy: 0, dz: -1 } });
        requirePlayingGame(game);
        const wand = await knownObject(WAN_MAGIC_MISSILE);
        installPagerInput(resetInputState(), { expected: /magic missile hits you|magic missiles? bounce off/i, limit: 2 });
        initRng(3n);
        await zapRayWithObject(wand);
        losses.push(100 - game.u.uhp);
    }
    assert.ok(losses[0] !== undefined && losses[1] !== undefined);
    assert.ok(losses[0] >= 2 && losses[0] <= 12);
    assert.equal(losses[1], Math.ceil(losses[0] / 2));
});
void test('a vertical death wand cannot kill a hero protected by magic resistance', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 100, antimagic: true, dx: 0, dy: 0, dz: 1 } });
    requirePlayingGame(game);
    installPagerInput(resetInputState(), { expected: /death.*hits you|You aren.t affected/i, limit: 2 });
    await zapRayWithObject(await knownObject(WAN_DEATH));
    assert.equal(game.u.uhp, 100);
    assert.equal(!!game.program_state.gameover, false);
    assert.match(game._pending_message, /You aren't affected\.$/);
});
void test('a swallowed ray uses the spell object and level instead of fixed wand dice', async () => {
    const losses = [];
    for (const type of [WAN_MAGIC_MISSILE, SPE_MAGIC_MISSILE]) {
        freshObjectRoom({ role: 'wizard', hero: { ulevel: 20, dx: 1, dy: 0, dz: 0 } });
        requirePlayingGame(game);
        const engulfer = await createMonsterAt('purple worm', 11, 10, NO_MINVENT);
        engulfer.mhp = engulfer.mhpmax = 1000;
        game.u.uswallow = 1;
        game.u.ustuck = engulfer;
        installPagerInput(resetInputState(), { expected: /magic missile.*rips into.*purple worm/i, limit: 2 });
        const object = await knownObject(type);
        initRng(3n);
        await zapRayWithObject(object);
        losses.push(1000 - engulfer.mhp);
        assert.equal(engulfer.msleeping, 0);
    }
    assert.ok(losses[0] !== undefined && losses[1] !== undefined);
    assert.ok(losses[0] <= 12);
    assert.ok(losses[1] > 12);
});
void test('an unskilled fireball crosses intervening webs and explodes at its first monster', async () => {
    const level = freshObjectRoom({ left: 7, right: 30, hero: { ulevel: 1, dx: 1, dy: 0, dz: 0 } });
    requirePlayingGame(game);
    const passedWeb = addTrap(level, WEB, 12, 10, { tseen: true });
    const burnedWeb = addTrap(level, WEB, 14, 10, { tseen: true });
    const ant = await createMonsterAt('giant ant', 14, 10, NO_MINVENT);
    ant.mhp = ant.mhpmax = 1000;
    const spell = await knownObject(SPE_FIREBALL);
    installPagerInput(resetInputState(), { expected: /Boom!|web bursts into flames|fireball|giant ant/i, limit: 4 });
    initRng(5n);
    await zapRayWithObject(spell);
    assert.ok(level.traps.includes(passedWeb));
    assert.ok(!level.traps.includes(burnedWeb));
    assert.ok(1000 - ant.mhp > 12, 'fireball explosion retains its twelve damage dice at level one');
    assert.equal(game.u.uhp, 40);
});
void test('the carried Orb of Detection blocks a vertical magic missile', async () => {
    freshObjectRoom({ role: 'archeologist', hero: { uhp: 100, uhpmax: 100, uac: 100, dx: 0, dy: 0, dz: -1 } });
    requirePlayingGame(game);
    await addInventoryItem(await artifactObject('The Orb of Detection'));
    const wand = await knownObject(WAN_MAGIC_MISSILE);
    installPagerInput(resetInputState(), { expected: /magic missile hits you|missiles bounce off/i, limit: 2 });
    initRng(3n);
    await zapRayWithObject(wand);
    assert.equal(game.u.uhp, 100);
    assert.match(game._pending_message, /The missiles bounce off!/);
});
void test('the carried Orb of Detection halves a cold ray', async () => {
    const losses = [];
    for (const carryOrb of [false, true]) {
        freshObjectRoom({ role: 'archeologist', hero: { uhp: 100, uhpmax: 100, uac: 100, dx: 0, dy: 0, dz: -1 } });
        requirePlayingGame(game);
        if (carryOrb)
            await addInventoryItem(await artifactObject('The Orb of Detection'));
        const wand = await knownObject(WAN_COLD);
        installPagerInput(resetInputState(), { expected: /bolt of cold hits you|cold.*hits you/i, limit: 2 });
        initRng(3n);
        await zapRayWithObject(wand);
        losses.push(100 - game.u.uhp);
    }
    assert.ok(losses[0] !== undefined && losses[1] !== undefined);
    assert.ok(losses[0] > 0);
    assert.equal(losses[1], Math.ceil(losses[0] / 2));
});
//# sourceMappingURL=native_ray.test.js.map