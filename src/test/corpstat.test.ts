import test from 'node:test';
import assert from 'node:assert/strict';

import {
    CORPSTAT_FEMALE,
    CORPSTAT_GENDER,
    CORPSTAT_HISTORIC,
    CORPSTAT_INIT,
    CORPSTAT_MALE,
    MM_FEMALE,
    MM_MALE,
    NO_MINVENT,
    isok,
} from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { mkcorpstat } from '../js/mklev.js';
import { createMonsterRemains, finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { petrifyMonsterImmediately } from '../js/monster_stoning.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, STATUE } from '../js/object_data.js';
import { relocateObjectRandomly } from '../js/object_teleport.js';
import { floorObjects, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [type, label] of [
    [CORPSE, 'corpse'],
    [STATUE, 'statue'],
] as const) {
    void test(`a ${label} requested at <0,0> lands on the level with its requested identity`, async () => {
        const level = freshObjectRoom({ gameplaySeed: 19n });
        requirePlayingGame(game);
        const species = MONSTER_NAME.indexOf('giant');
        const flags = CORPSTAT_INIT | CORPSTAT_FEMALE | (type === STATUE ? CORPSTAT_HISTORIC : 0);

        const object = await mkcorpstat(type, null, species, 0, 0, flags);

        assert.ok(isok(object.ox, object.oy));
        assert.ok(object.ox !== game.u.ux || object.oy !== game.u.uy);
        assert.ok(floorObjectsAt(level, object.ox, object.oy).includes(object));
        assert.equal(object.corpsenm, species);
        assert.equal(object.spe, CORPSTAT_FEMALE | (type === STATUE ? CORPSTAT_HISTORIC : 0));
    });
}

void test('an explicit corpse square is kept instead of choosing a random square', async () => {
    const level = freshObjectRoom({ gameplaySeed: 19n });
    requirePlayingGame(game);
    const species = MONSTER_NAME.indexOf('giant');

    const corpse = await mkcorpstat(CORPSE, null, species, 12, 10, CORPSTAT_INIT);

    assert.equal(corpse.ox, 12);
    assert.equal(corpse.oy, 10);
    assert.ok(floorObjectsAt(level, 12, 10).includes(corpse));
});

void test('a parked guard leaves one corpse on the level, not at its parking coordinates', async () => {
    const level = freshObjectRoom({ gameplaySeed: 19n });
    requirePlayingGame(game);
    const guard = await createMonsterAt('guard', 12, 10);
    guard.mhp = 0;
    placeMonsterAt(guard, 0, 0);

    const corpse = await createMonsterRemains(guard);
    assert.ok(corpse, 'the parked guard leaves a corpse');

    assert.equal(corpse.corpsenm, guard.mnum);
    assert.ok(isok(corpse.ox, corpse.oy));
    assert.equal(floorObjects(level).filter((object) => object.otyp === CORPSE).length, 1);
    assert.ok(floorObjectsAt(level, corpse.ox, corpse.oy).includes(corpse));
});

void test('requesting a Rider corpse does not revive it during initial placement', async () => {
    const level = freshObjectRoom({ gameplaySeed: 19n });
    requirePlayingGame(game);
    const death = MONSTER_NAME.indexOf('Death');

    const corpse = await mkcorpstat(CORPSE, null, death, 0, 0, CORPSTAT_INIT);

    assert.ok(floorObjects(level).includes(corpse));
    assert.equal(corpse.corpsenm, death);
    assert.equal(
        level.monsters.some((monster) => monster.mnum === death),
        false,
    );

    // Once creation finishes, relocation sees a Rider and revives it instead.
    await relocateObjectRandomly(corpse);

    assert.equal(floorObjects(level).includes(corpse), false);
    assert.ok(level.monsters.some((monster) => monster.mnum === death && monster.mhp > 0));
});

for (const female of [false, true]) {
    void test(`petrification records a ${female ? 'female' : 'male'} monster in its statue`, async () => {
        const level = freshObjectRoom({ gameplaySeed: 19n });
        requirePlayingGame(game);
        const monster = await createMonsterAt(
            'giant',
            12,
            10,
            NO_MINVENT | (female ? MM_FEMALE : MM_MALE),
        );
        assert.equal(!!monster.female, female);
        const publish = async () => {};

        const result = await petrifyMonsterImmediately(monster, {
            publish,
            finishDeath: (victim, options) =>
                finishEnvironmentalMonsterDeath(victim, game, { ...options, publish }),
        });

        assert.ok(result.remains, 'petrification leaves a statue');
        assert.ok(floorObjectsAt(level, 12, 10).includes(result.remains));
        assert.equal(result.remains.otyp, STATUE);
        assert.equal(
            result.remains.spe & CORPSTAT_GENDER,
            female ? CORPSTAT_FEMALE : CORPSTAT_MALE,
        );
    });
}
