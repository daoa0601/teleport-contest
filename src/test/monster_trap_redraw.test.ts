import assert from 'node:assert/strict';
import test from 'node:test';
import { ANTI_MAGIC, ARROW_TRAP, DART_TRAP, NO_MINVENT, ROCKTRAP } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { AD_MAGM } from '../js/monster_attack_types.js';
import { finishMonsterKilled } from '../js/monster_death.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { resumeDeferredMonsterTrap, triggerImmediateMonsterTrap } from '../js/monmove.js';
import { initRng } from '../js/rng.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [type, name] of [[ARROW_TRAP, 'arrow'], [DART_TRAP, 'dart'], [ROCKTRAP, 'falling-rock']] as const) {
    for (const invisible of [false, true]) {
        void test(`an exhausted ${name} trap redraws its square beneath a ${invisible ? 'hidden' : 'visible'} victim`, async () => {
            const level = freshObjectRoom();
            requirePlayingGame(game);
            const monster = await createMonsterAt('grid bug', 12, 10, NO_MINVENT);
            monster.minvis = invisible;
            const trap = addTrap(level, type, 11, 10, { once: true, tseen: true });
            newsym(11, 10);
            assert.equal(glyphAt(11, 10)?.kind, 'trap');
            placeMonsterAt(monster, 11, 10);

            const action = await triggerImmediateMonsterTrap(monster, game, { random: () => 0 });
            await resumeDeferredMonsterTrap(action, game, { publish: async () => {} });

            assert.equal(level.traps.includes(trap), false);
            assert.equal(glyphAt(11, 10)?.kind, invisible ? 'terrain' : 'monster');
        });
    }
}

void test('anti-magic damage redraws a surviving monster over a known trap', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('baby gray dragon', 12, 10, NO_MINVENT);
    monster.mhp = monster.mhpmax = 20;
    addTrap(level, ANTI_MAGIC, 11, 10, { tseen: true });
    newsym(11, 10);
    assert.equal(glyphAt(11, 10)?.kind, 'trap');
    placeMonsterAt(monster, 11, 10);

    const action = await triggerImmediateMonsterTrap(monster, game, { rollOne: () => 4 });
    await resumeDeferredMonsterTrap(action, game, { publish: async () => {} });

    assert.equal(monster.mhp, 16);
    assert.equal(glyphAt(11, 10)?.kind, 'monster');
});

void test('lethal anti-magic damage gives the hallucinated remains another appearance after death', async () => {
    const appearances: number[] = [];
    for (const killedByTrap of [false, true]) {
        const { monster } = await freshMonsterTrapRoom(ANTI_MAGIC, {
            room: { hero: { hallucinationTurns: 20 } },
            monster: { species: 'baby gray dragon', hitPoints: 1 },
            trap: { tseen: true },
        });
        requirePlayingGame(game);
        initRng(1n);

        if (killedByTrap) {
            const action = await triggerImmediateMonsterTrap(monster, game, { rollOne: () => 4 });
            await resumeDeferredMonsterTrap(action, game, {
                random: () => 1, publish: async () => {},
            });
        } else {
            monster.mhp = 0;
            await finishMonsterKilled(monster, game, {
                damageType: AD_MAGM, cause: 'compression from an anti-magic field',
                random: () => 1, publish: async () => {},
            });
        }

        assert.equal(monster.dead, true);
        const shown = glyphAt(11, 10);
        assert.ok(shown?.kind === 'object');
        assert.ok(shown.glyph !== undefined);
        appearances.push(shown.glyph);
    }
    assert.notEqual(appearances[1], appearances[0],
        'the trap refreshes the hallucinated floor pile after monkilled() finishes');
});
