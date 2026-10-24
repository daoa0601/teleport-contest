import assert from 'node:assert/strict';
import test from 'node:test';
import { heroHasInvoluntaryDelay } from '../js/command_state.js';
import { D_CLOSED, DOOR, LAVAWALL, POOL, STONE, VIBRATING_SQUARE, WATER } from '../js/const.js';
import { game } from '../js/gstate.js';
import { hurtleHero } from '../js/hero_hurtle.js';
import { resetInputState } from '../js/input.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { switchHeroTerrain } from '../js/terrain_movement.js';
import { addTrap } from './support/level-state.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const property of ['levitation', 'flying']) {
    for (const terrain of [STONE, DOOR, LAVAWALL]) {
        const name = terrain === STONE ? 'solid rock' : terrain === DOOR ? 'a closed door' : 'a lava wall';
        void test(`hurtling through ${name} blocks ${property} until the hero emerges`, async () => {
            const level = freshObjectRoom();
            grantIntrinsicProperty('passesWalls', 'outside');
            grantIntrinsicProperty(property, 'outside');
            const square = level.requireAt(11, 10);
            square.typ = terrain;
            if (terrain === DOOR)
                square.doormask = D_CLOSED;
            installPagerInput(resetInputState(), { expected: /levitate|fly|float/, limit: 4 });
            await hurtleHero(1, 0, 1);
            assert.equal(game.u.ux, 11);
            assert.equal(game.u[property], false, `${property} is blocked inside ${name}`);
            assert.match(game._pending_message, /You can't (?:levitate|fly) in here\./);
            await hurtleHero(1, 0, 1);
            assert.equal(game.u.ux, 12);
            assert.equal(game.u[property], true, `${property} resumes outside ${name}`);
            assert.match(game._pending_message, /You start (?:to float in the air|flying)[.!]/);
        });
    }
    void test(`hurtling into a water wall blocks ${property} and stops a swimming hero`, async () => {
        const level = freshObjectRoom({ hero: { swimming: true } });
        grantIntrinsicProperty(property, 'outside');
        level.requireAt(11, 10).typ = WATER;
        installPagerInput(resetInputState(), { expected: /levitate|fly|plunge/, limit: 6 });
        await hurtleHero(1, 0, 3);
        assert.equal(game.u.ux, 11, 'entering water ends the hurtle even when the hero can swim');
        assert.equal(game.u[property], false);
        assert.equal(game.u.uinwater, 1);
        assert.equal(heroHasInvoluntaryDelay(), false);
    });
}
void test('a swimming hero entering a pool stops before activating its trap', async () => {
    const level = freshObjectRoom({ hero: { swimming: true } });
    level.requireAt(11, 10).typ = POOL;
    const trap = addTrap(level, VIBRATING_SQUARE, 11, 10);
    installPagerInput(resetInputState(), { expected: /fall into|ground vibrates/, limit: 4 });
    await hurtleHero(1, 0, 3);
    assert.equal(game.u.ux, 11);
    assert.equal(game.u.uinwater, 1);
    assert.equal(trap.tseen, false, 'drown() ends the step before the trap check');
    assert.equal(heroHasInvoluntaryDelay(), false);
});
void test('a swimming rider hurtled into a pool stays in the saddle', async () => {
    const level = freshObjectRoom({ role: 'knight', hero: { swimming: true } });
    const steed = await createSaddledSteed('pony', { x: 10, y: 10 });
    game.u.usteed = steed;
    level.requireAt(11, 10).typ = POOL;
    installPagerInput(resetInputState(), { expected: /./, limit: 8 });
    await hurtleHero(1, 0, 2);
    assert.ok(game.u.usteed === steed, 'drown() lets a swimmer survive before considering dismount');
    assert.equal(game.u.ux, 11);
    assert.equal(steed.mx, 11);
    assert.equal(game.u.uinwater, 1);
});
void test('levitation restored after hurtling out of a water wall brings the hero above water', async () => {
    const level = freshObjectRoom({ hero: { swimming: true, uinwater: 1 } });
    level.requireAt(10, 10).typ = WATER;
    level.requireAt(11, 10).typ = POOL;
    grantIntrinsicProperty('levitation', 'outside');
    await switchHeroTerrain();
    installPagerInput(resetInputState(), { expected: /levitate|cork|move over/, limit: 5 });
    await hurtleHero(1, 0, 1);
    assert.equal(game.u.ux, 11);
    assert.equal(game.u.levitation, true);
    assert.equal(game.u.uinwater, 0, 'float_up() runs spot effects when levitation resumes underwater');
});
//# sourceMappingURL=hurtle_terrain.test.js.map