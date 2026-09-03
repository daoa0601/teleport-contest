import test from 'node:test';
import assert from 'node:assert/strict';

import {
    beginMonsterSpitAttack, finishHeroSpitHit, resolveMonsterSpitFlight,
} from '../js/monster_spit.js';
import { W_AMUL, W_ARMH } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING, HELMET } from '../js/object_data.js';
import { resolveRangedRetaliation } from '../js/dogmove.js';
import { quietMonsterActionRng } from '../js/monmove.js';
import { addInventoryObject } from './support/game-objects.js';
import { wearHeroObject } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { addMonsterToLevel } from './support/monsters.js';
import {
    freshRangedCombatRoom, rangedMonster, rangedPet, rangedTarget,
} from './support/ranged-combat.js';

test('a black naga can spit acid at another monster', () => {
    freshObjectRoom({ heroX: 15, heroY: 12 });
    const naga = addMonsterToLevel(rangedMonster('black naga'));
    const target = addMonsterToLevel(rangedTarget());

    const spit = beginMonsterSpitAttack(naga, target.mx, target.my, {
        random: () => 0,
    });
    resolveMonsterSpitFlight(naga, spit, game, {
        random: () => 1,
        rollOne: () => 1,
    });

    assert.equal(target.mhp, 10);
    assert.deepEqual([naga.mx, naga.my], [9, 10]);
});

test('acid venom does not hurt an acid-resistant monster', () => {
    freshObjectRoom({ heroX: 15, heroY: 12 });
    const naga = addMonsterToLevel(rangedMonster('black naga'));
    const dragon = addMonsterToLevel(rangedTarget('yellow dragon'));

    const spit = beginMonsterSpitAttack(naga, dragon.mx, dragon.my, {
        random: () => 0,
    });
    resolveMonsterSpitFlight(naga, spit, game, {
        random: () => 1,
        rollOne: () => 1,
    });

    assert.equal(dragon.mhp, 12);
});

test('blinding venom cannot blind an eyeless monster', () => {
    freshObjectRoom({ heroX: 15, heroY: 12 });
    const cobra = addMonsterToLevel(rangedMonster('cobra'));
    const cube = addMonsterToLevel(rangedTarget('gelatinous cube'));

    const spit = beginMonsterSpitAttack(cobra, cube.mx, cube.my, {
        random: () => 0,
    });
    resolveMonsterSpitFlight(cobra, spit, game, {
        random: () => 1,
        rollOne: () => 1,
    });

    assert.equal(cube.mcansee, 1);
    assert.equal(cube.mblinded, undefined);
});

test('life saving rescues the hero from fatal acid venom', async () => {
    freshRangedCombatRoom({
        heroX: 12,
        heroY: 10,
        gameplaySeed: 1n,
    });
    const amulet = wearHeroObject(
        addInventoryObject(AMULET_OF_LIFE_SAVING),
        'uamul',
        W_AMUL,
    );
    game.u.uhp = 1;
    const naga = addMonsterToLevel(rangedMonster('black naga'));
    const spit = beginMonsterSpitAttack(
        naga, game.u.ux, game.u.uy, { random: () => 0 },
    );
    resolveMonsterSpitFlight(naga, spit, game, {
        random: () => 1,
        rollOne: () => 1,
    });
    pushKeys(' '.repeat(12));

    const died = await finishHeroSpitHit(spit, game);

    assert.equal(died, false);
    assert.ok(game.u.uhp > 0);
    assert.equal(game.inventory.includes(amulet), false);
});

test('a visored helmet blocks blinding venom', () => {
    freshRangedCombatRoom({
        heroX: 12,
        heroY: 10,
        gameplaySeed: 1n,
    });
    game.objectDescriptions[HELMET] = 'visored helmet';
    wearHeroObject(
        addInventoryObject(HELMET),
        'uarmh',
        W_ARMH,
    );
    const cobra = addMonsterToLevel(rangedMonster('cobra'));
    const spit = beginMonsterSpitAttack(
        cobra, game.u.ux, game.u.uy, { random: () => 0 },
    );

    resolveMonsterSpitFlight(cobra, spit, game, {
        random: () => 1,
        rollOne: () => 1,
    });

    assert.equal(game.u.blindTurns ?? 0, 0);
    assert.equal(game.u.ucreamed ?? 0, 0);
});

test('a tame black naga spits at a distant monster instead of moving', () => {
    freshRangedCombatRoom({ gameplaySeed: 3n });
    const naga = addMonsterToLevel(rangedPet('black naga'));
    const target = addMonsterToLevel(rangedTarget());

    const action = quietMonsterActionRng(naga, game);
    resolveMonsterSpitFlight(naga, action.movement.spitAttack, game);

    assert.deepEqual([naga.mx, naga.my], [9, 10]);
    assert.ok(target.mhp < 12);
    assert.equal(naga.edog.hungrytime, 995);
});

test('a cobra can spit back after a ranged attack', async () => {
    freshObjectRoom({ heroX: 15, heroY: 12, gameplaySeed: 7n });
    const pet = addMonsterToLevel(rangedPet('orc', { edog: {} }));
    const cobra = addMonsterToLevel(rangedTarget('cobra', {
        hitPoints: 30,
    }));

    await resolveRangedRetaliation(pet, cobra, game, {
        publish: async () => {},
        finishMonsterKill: async () => {},
    });

    assert.equal(pet.mcansee, 0);
    assert.ok(pet.mblinded > 0);
});
