import { monsterAtPosition } from '../js/monster_location.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { wearHeroAccessory } from '../js/accessory.js';
import { M_ATTK_AGR_DIED, MM_NOGRP, MM_NOWAIT, NO_MINVENT, W_AMUL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { runMonsterAction } from '../js/monmove.js';
import { AMULET_OF_LIFE_SAVING, RIN_CONFLICT } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

const BIRTH_FLAGS = MM_NOGRP | MM_NOWAIT | NO_MINVENT;

async function conflictExplosionRoom(species: string) {
    freshObjectRoom({ hero: { ulevel: 30, uhp: 500, uhpmax: 500 } });
    requirePlayingGame(game);
    await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
    const source = await createMonsterAt(species, 11, 10, BIRTH_FLAGS);
    const target = await createMonsterAt('hill giant', 12, 10, BIRTH_FLAGS);
    source.msleeping = 0;
    source.mcanmove = 1;
    source.mcan = 0;
    target.msleeping = 0;
    target.mhp = target.mhpmax = 500;
    target.movement = 0;
    game.context.mon_moving = true;
    installPagerInput(resetInputState(), {
        expected: /(?:sphere|light) (?:explodes|reconstitutes)|Boom!|caught in the|medallion|hill giant.*(?:blinded|confused)|resists the/,
        limit: 8,
    });
    return { source, target };
}

void test('Conflict makes an elemental sphere explode into its neighbor and the hero', async () => {
    const { source, target } = await conflictExplosionRoom('flaming sphere');
    requirePlayingGame(game);
    const heroHealth = game.u.uhp;
    const targetHealth = target.mhp;
    initRng(1n);

    const action = await runMonsterAction(source, game);

    const fight = action.conflictFight;
    assert.ok(fight, 'Conflict should direct the sphere at the neighboring giant');
    assert.equal(fight.consumed, true);
    assert.notEqual(monsterAtPosition(game.level, source.mx, source.my), source);
    assert.ok(target.mhp > 0 && target.mhp < targetHealth);
    assert.ok(game.u.uhp > 0 && game.u.uhp < heroHealth);
    assert.equal(game.u.uconduct.killer ?? 0, 0);
    assert.ok(fight.attack.kind === 'monster-attack');
    assert.equal(fight.attack.aggressorDied, true);
    assert.ok((fight.attack.nativeResult ?? 0) & M_ATTK_AGR_DIED);
});

void test('a life-saved exploding sphere survives but its native death result ends the Conflict action', async () => {
    const { source, target } = await conflictExplosionRoom('flaming sphere');
    requirePlayingGame(game);
    const amulet = await knownObject(AMULET_OF_LIFE_SAVING);
    await equipMonsterObject(source, amulet, W_AMUL);
    initRng(1n);

    const action = await runMonsterAction(source, game);

    const fight = action.conflictFight;
    assert.ok(fight, 'The life-saved source must still finish its Conflict explosion');
    assert.equal(fight.consumed, true);
    assert.ok(fight.attack.kind === 'monster-attack');
    assert.ok((fight.attack.nativeResult ?? 0) & M_ATTK_AGR_DIED);
    assert.equal(fight.attack.aggressorDied, false);
    assert.ok(game.level.monsters.includes(source));
    assert.ok(source.mhp > 0);
    assert.equal(source.minvent.includes(amulet), false);
    assert.ok(target.mhp > 0 && target.mhp < 500);
    assert.ok(game.u.uhp > 0 && game.u.uhp < 500);
    assert.equal(game.u.uconduct.killer ?? 0, 0);
});

for (const species of ['yellow light', 'black light']) {
    void test(`a ${species} explodes at a Conflict target without dealing hit-point damage`, async () => {
        const { source, target } = await conflictExplosionRoom(species);
        requirePlayingGame(game);
        const targetHealth = target.mhp;
        const heroHealth = game.u.uhp;
        initRng(1n);

        const action = await runMonsterAction(source, game);

        const fight = action.conflictFight;
        assert.ok(fight, 'The light must use its explosion against its adjacent opponent');
        assert.equal(fight.consumed, true);
        assert.ok(fight.attack.kind === 'monster-attack');
        assert.ok((fight.attack.nativeResult ?? 0) & M_ATTK_AGR_DIED);
        assert.notEqual(monsterAtPosition(game.level, source.mx, source.my), source);
        assert.equal(target.mhp, targetHealth);
        assert.equal(game.u.uhp, heroHealth);
        if (species === 'yellow light') {
            assert.equal(target.mcansee, 0);
            assert.ok((target.mblinded ?? 0) > 0);
        } else {
            assert.equal(target.mconf, 1);
        }
        assert.equal(game.u.uconduct.killer ?? 0, 0);
    });
}
