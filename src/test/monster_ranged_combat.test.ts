import { monsterAtPosition } from '../js/monster_location.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    M_ATTK_DEF_DIED, M_ATTK_HIT, MM_ANGRY, MM_NOGRP, MM_NOMSG,
    MM_NOWAIT, NO_MINVENT, W_WEP,
} from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { attackMonsterWithMonster } from '../js/monmove.js';
import { DAGGER } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

const TEST_MONSTER_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOMSG | MM_NOWAIT | NO_MINVENT;
const maximumDice = (count: number, sides: number) => count * sides;
const nonzeroRoll = (range: number) => Math.min(1, range - 1);

async function rangedCombatants(species: string, adjacent = false) {
    const level = freshObjectRoom({
        left: 2, right: 40, top: 2, bottom: 18, heroX: 10, heroY: 14,
        context: { mon_moving: true }, flags: { verbose: true },
    });
    requirePlayingGame(game);
    const source = await createMonsterAt(species, 10, 10, TEST_MONSTER_FLAGS);
    const target = await createMonsterAt('orc', adjacent ? 11 : 14, 10, TEST_MONSTER_FLAGS);
    source.mhp = source.mhpmax = 100;
    target.mhp = target.mhpmax = 1000;
    installPagerInput(resetInputState(), {
        expected: /breathes|blast|bites|hits|misses|claws|spits|venom|blinded|throws|dagger|killed|destroyed|wields/i,
        limit: 24,
    });
    return { source, target, level };
}

void test('the common monster attack loop launches distant breath and applies its ray damage', async () => {
    const { source, target } = await rangedCombatants('red dragon');
    requirePlayingGame(game);

    const attack = await attackMonsterWithMonster(source, target, {
        state: game, random: nonzeroRoll, rollOne: () => 1, rollDice: maximumDice,
    });

    assert.ok(attack.kind === 'monster-attack');
    assert.equal(attack.nativeResult, M_ATTK_HIT);
    assert.ok(target.mhp < 1000);
    assert.equal(source.mspec_used, 9);
    assert.equal(game.u.uhp, game.u.uhpmax);
});

void test('a lethal breath becomes a defender-death result rather than retaining HIT', async () => {
    const { source, target, level } = await rangedCombatants('red dragon');
    requirePlayingGame(game);
    target.mhp = 1;

    const attack = await attackMonsterWithMonster(source, target, {
        state: game, random: nonzeroRoll, rollOne: () => 1, rollDice: maximumDice,
    });

    assert.ok(attack.kind === 'monster-attack');
    assert.equal(attack.nativeResult, M_ATTK_DEF_DIED);
    assert.equal(attack.struck, false);
    assert.equal(attack.defenderDied, true);
    assert.notEqual(monsterAtPosition(level, target.mx, target.my), target);
    assert.equal(game.u.uconduct.killer || 0, 0);
});

for (const species of ['red dragon', 'cobra']) {
    void test(`adjacent ${species} combat uses contact without spending breath or venom nutrition`, async () => {
        const { source, target } = await rangedCombatants(species, true);
        requirePlayingGame(game);
        initializePet(source, { state: game });
        const pet = source.edog;
        assert.ok(pet);
        const hungerBefore = pet.hungrytime;

        const attack = await attackMonsterWithMonster(source, target, {
            state: game, random: range => range === 7 ? 0 : nonzeroRoll(range),
            rollOne: () => 1, rollDice: maximumDice,
        });

        assert.ok(attack.kind === 'monster-attack');
        assert.equal(attack.nativeResult, M_ATTK_HIT);
        assert.ok(target.mhp < 1000, 'The adjacent contact attacks still hit');
        assert.equal(source.mspec_used || 0, 0);
        assert.equal(pet.hungrytime, hungerBefore);
        assert.equal(target.mblinded || 0, 0, 'A cobra does not spit at point-blank range');
    });
}

void test('a distant cobra uses its spit slot after skipping its unreachable bite', async () => {
    const { source, target } = await rangedCombatants('cobra');
    requirePlayingGame(game);

    const attack = await attackMonsterWithMonster(source, target, {
        state: game, random: range => range === 4 ? 0 : nonzeroRoll(range),
        rollOne: () => 1, rollDice: maximumDice,
    });

    assert.ok(attack.kind === 'monster-attack');
    assert.equal(attack.nativeResult, M_ATTK_HIT);
    assert.equal(target.mhp, 1000);
    assert.equal(target.mcansee, 0);
    assert.ok((target.mblinded ?? 0) > 0);
});

for (const intercepted of [false, true]) {
    void test(`a two-attack thrower ${intercepted ? 'stops aiming after a bystander intercepts the dagger' : 'can use its second slot while the target remains at bhitpos'}`, async () => {
        const { source, target } = await rangedCombatants('ettin');
        requirePlayingGame(game);
        const daggers = await equipMonsterObject(source,
            await knownObject(DAGGER, { quan: 4, spe: 0, cursed: false }), W_WEP);
        const bystander = intercepted
            ? await createMonsterAt('pony', 12, 10, TEST_MONSTER_FLAGS) : null;
        if (bystander) bystander.mhp = bystander.mhpmax = 1000;

        const attack = await attackMonsterWithMonster(source, target, {
            state: game, random: nonzeroRoll, rollOne: () => 1, rollDice: maximumDice,
        });

        assert.ok(attack.kind === 'monster-attack');
        assert.equal(attack.nativeResult, M_ATTK_HIT);
        assert.equal(daggers.quan, intercepted ? 3 : 2);
        if (bystander) {
            assert.ok(bystander.mhp < 1000);
            assert.equal(target.mhp, 1000);
            assert.equal(game.bhitpos.x, bystander.mx);
            assert.equal(game.bhitpos.y, bystander.my);
        } else {
            assert.ok(target.mhp < 1000);
            assert.equal(game.bhitpos.x, target.mx);
            assert.equal(game.bhitpos.y, target.my);
        }
    });
}

void test('a fatal first throw drops HIT and stops the second native weapon attack', async () => {
    const { source, target, level } = await rangedCombatants('ettin');
    requirePlayingGame(game);
    const daggers = await equipMonsterObject(source,
        await knownObject(DAGGER, { quan: 4, spe: 0, cursed: false }), W_WEP);
    target.mhp = 1;

    const attack = await attackMonsterWithMonster(source, target, {
        state: game, random: nonzeroRoll, rollOne: () => 1, rollDice: maximumDice,
    });

    assert.ok(attack.kind === 'monster-attack');
    assert.equal(attack.nativeResult, M_ATTK_DEF_DIED);
    assert.equal(attack.struck, false);
    assert.equal(daggers.quan, 3);
    assert.notEqual(monsterAtPosition(level, target.mx, target.my), target);
    assert.equal(game.u.uconduct.killer || 0, 0);
});

void test('a breath ray restores the common caller aim even when that aim started on the attacker', async () => {
    const { source, target } = await rangedCombatants('red dragon');
    requirePlayingGame(game);

    const attack = await attackMonsterWithMonster(source, target, {
        state: game, random: nonzeroRoll, rollOne: () => 1, rollDice: maximumDice,
        target: { x: source.mx, y: source.my, notOnHead: false },
    });

    assert.ok(attack.kind === 'monster-attack');
    assert.equal(attack.nativeResult, M_ATTK_HIT);
    assert.ok(target.mhp < 1000);
    assert.equal(game.bhitpos.x, source.mx);
    assert.equal(game.bhitpos.y, source.my);
    assert.equal(game.notonhead, false);
});
