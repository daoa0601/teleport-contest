import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { rhack } from '../js/cmd.js';
import { ARROW_TRAP, BEAR_TRAP, FIRE_TRAP, POOL, ROOM, TT_BEARTRAP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { heroLiquidEffects } from '../js/hack.js';
import { finishDestinationSpotEffects } from '../js/location_effects.js';
import { hurtleHero } from '../js/hero_hurtle.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { pushKeys } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING, ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPolymorphedHero } from './support/hero-state.js';
void test('failed adjacent untrapping exposes a spider that leaves its cover', async () => {
    const level = freshObjectRoom({ flags: { pickup: false } });
    installPolymorphedHero('cave spider');
    await floorObject(ROCK, 10, 10);
    game.u.uundetected = 1;
    addTrap(level, ARROW_TRAP, 11, 10, { tseen: true });
    pushKeys('untrap\nl' + ' '.repeat(10));
    initRng(2n);
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.ux, 11, 'the failed attempt moves the spider out from under the rock');
    assert.equal(game.u.uundetected, 0);
    assert.equal(game.u.umoved, true);
});
for (const lifesaving of [false, true]) {
    void test(`hurling through fire ${lifesaving ? 'continues after life saving' : 'stops at permanent death'}`, async () => {
        freshObjectRoom({ hero: { uhp: 1, uhpmax: 100 } });
        requireFixtureGame(game);
        addTrap(game.level, FIRE_TRAP, 11, 10);
        if (lifesaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        pushKeys(' '.repeat(100));
        initRng(1n);
        await hurtleHero(1, 0, 3);
        assert.equal(!!game.program_state.gameover, !lifesaving);
        assert.equal(game.u.ux, lifesaving ? 13 : 11);
        assert.equal(game.u.uy, 10);
        if (lifesaving)
            assert.ok(game.u.uhp > 0);
        else
            assert.equal(game._deathKiller, 'tower of flame');
    });
    void test(`bear-trap outcome distinguishes ${lifesaving ? 'recovery' : 'permanent death'} from travel`, async () => {
        freshObjectRoom({ hero: { uhp: 1, uhpmax: 100 } });
        requireFixtureGame(game);
        const trap = addTrap(game.level, BEAR_TRAP, 10, 10);
        if (lifesaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        pushKeys(' '.repeat(100));
        initRng(1n);
        const result = await triggerHeroTrap(trap);
        assert.equal(result.died, !lifesaving);
        assert.equal(result.shortCircuited, false);
    });
}
for (const lifesaving of [false, true]) {
    void test(`failed adjacent untrapping ${lifesaving ? 'resumes after life saving' : 'can kill the hero'}`, async () => {
        freshObjectRoom({ hero: { uhp: 1, uhpmax: 100 } });
        requireFixtureGame(game);
        addTrap(game.level, BEAR_TRAP, 11, 10, { tseen: true });
        if (lifesaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        pushKeys('untrap\nl' + ' '.repeat(100));
        initRng(2n);
        await rhack('#'.charCodeAt(0));
        assert.equal(game.u.ux, 11, 'the failed attempt pulls the hero into the trap');
        assert.equal(game.u.utraptype, TT_BEARTRAP);
        assert.equal(!!game.program_state.gameover, !lifesaving);
        assert.doesNotMatch(game._last_message, /Fortunately, you don't move/);
        if (lifesaving)
            assert.ok(game.u.uhp > 0);
        else
            assert.equal(game._deathKiller, 'bear trap');
    });
    void test(`crawling out of water reports ${lifesaving ? 'survival after life saving' : 'death at the landing trap'}`, async () => {
        const level = freshObjectRoom({ hero: { uhp: 1, uhpmax: 100 } });
        requireFixtureGame(game);
        for (let x = 9; x <= 11; x++)
            for (let y = 9; y <= 11; y++)
                level.requireAt(x, y).typ = POOL;
        level.requireAt(11, 10).typ = ROOM;
        addTrap(level, BEAR_TRAP, 11, 10);
        if (lifesaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        pushKeys(' '.repeat(100));
        initRng(1n);
        const result = await heroLiquidEffects({
            applyLandingEffects: ({ from, to }) => finishDestinationSpotEffects({
                oldx: from.x, oldy: from.y, newx: to.x, newy: to.y,
                explicitAttempt: false,
            }),
        });
        assert.equal(game.u.ux, 11);
        assert.equal(game.u.uy, 10);
        assert.ok(result !== null && result !== undefined);
        assert.equal(result.moved, true);
        assert.equal(result.died, !lifesaving);
        assert.equal(!!game.program_state.gameover, !lifesaving);
        if (lifesaving)
            assert.ok(game.u.uhp > 0);
        else
            assert.equal(game._deathKiller, 'bear trap');
    });
}
//# sourceMappingURL=hero_trap_continuation.test.js.map