import assert from 'node:assert/strict';
import test from 'node:test';
import { ANTI_MAGIC, ARROW_TRAP, DART_TRAP, NO_MINVENT, ROCKTRAP } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { AD_MAGM } from '../js/monster_attack_types.js';
import { finishMonsterKilled } from '../js/monster_death.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { resumeDeferredMonsterTrap, triggerImmediateMonsterTrap } from '../js/monmove.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
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

for (const killedByTrap of [false, true]) {
    const behavior = killedByTrap
        ? 'anti-magic trap death refreshes the first hallucinated corpse appearance once'
        : 'ordinary monster death preserves the first hallucinated corpse appearance';
    void test(behavior, async () => {
        freshObjectRoom({ hero: { hallucinationTurns: 20 } });
        await floorObject(CORPSE, 11, 10, {
            corpsenm: MONSTER_NAME.indexOf('baby gray dragon'),
        });
        initRng(1n);
        newsym(11, 10);
        // make_corpse() shows the corpse; the anti-magic trap then refreshes it.
        if (killedByTrap) newsym(11, 10);
        const expected = glyphAt(11, 10);
        assert.ok(expected?.kind === 'object');

        const level = freshObjectRoom({ hero: { hallucinationTurns: 20 } });
        requirePlayingGame(game);
        const monster = await createMonsterAt('baby gray dragon', 11, 10, NO_MINVENT);
        monster.mhp = 1;
        // Suppress the death announcement's hallucinated monster name.
        monster.minvis = true;
        addTrap(level, ANTI_MAGIC, 11, 10, { tseen: true });
        initRng(1n);

        if (killedByTrap) {
            const action = await triggerImmediateMonsterTrap(monster, game, { rollOne: () => 4 });
            await resumeDeferredMonsterTrap(action, game, {
                random: () => 1, publish: async () => {},
            });
        } else {
            monster.mhp = 0;
            await finishMonsterKilled(monster, game, {
                damageType: AD_MAGM, cause: null,
                random: () => 1, publish: async () => {},
            });
        }

        assert.equal(monster.dead, true);
        const shown = glyphAt(11, 10);
        assert.ok(shown?.kind === 'object');
        assert.equal(shown.glyph, expected.glyph,
            'death must leave the corpse with its native number of hallucinated appearances');
    });
}
