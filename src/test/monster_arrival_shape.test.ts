import test from 'node:test';
import assert from 'node:assert/strict';

import { wearHeroAccessory } from '../js/accessory.js';
import { MIGR_EXACT_XY, MIGR_RANDOM, MON_ARRIVE_BEFORE_YOU, NO_MINVENT, NON_PM } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { migrateMonsterOffLevel, monsterArrive } from '../js/monster_migration.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { initializeMonsterWormBody } from '../js/monster_worm.js';
import { RIN_PROTECTION_FROM_SHAPE_CHANGERS } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { answerPrompts } from './support/input-boundaries.js';

void test('a migrating chameleon reports its off-map worm head before reverting and arriving without a tail', async () => {
    const { destination } = freshConnectedLevels();
    requirePlayingGame(game);
    const monster = await createMonsterAt('chameleon', 12, 10, NO_MINVENT);
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('long worm'));
    await initializeMonsterWormBody(monster, { segmentCount: 3 });
    assert.ok((monster.wormSegments?.length ?? 0) > 0);
    await migrateMonsterOffLevel(monster, game, { dst: { dnum: 0, dlevel: 2 } }, {
        mode: MIGR_EXACT_XY, coordinate: { x: 14, y: 10 },
    });
    game.level = destination;
    game.u.uz = { dnum: 0, dlevel: 2 };
    const ring = await addInventoryObject(RIN_PROTECTION_FROM_SHAPE_CHANGERS);
    await wearHeroAccessory(ring, 'uleft');

    // C dog.c:mon_arrive() restores shape before placement. In worm form,
    // mon.c:newcham() replaces the discarded head even at <0,0>, which
    // steed.c:place_monster() diagnoses before the arrival can continue.
    const input = resetInputState();
    const arrived = await answerPrompts(monsterArrive(monster, MON_ARRIVE_BEFORE_YOU, game), input, [
        { prompt: /trying to place long worm <0,0>\{chameleon\} at <0,0>[\s\S]*--More--/, keys: ' ' },
        { prompt: /Program in disorder![\s\S]*--More--/, keys: ' ' },
        { prompt: /Please report these messages to devteam@nethack.org\.--More--/, keys: ' ' },
    ]);

    assert.equal(arrived, true);
    assert.equal(monster.mnum, MONSTER_NAME.indexOf('chameleon'));
    assert.equal(monster.cham, NON_PM);
    assert.equal(monster.wormno, 0);
    assert.equal(monster.wormSegments?.length ?? 0, 0);
    assert.equal(monster.wormHead, null);
    assert.ok(monsterAtPosition(destination, monster.mx, monster.my) === monster);
});

for (const mode of [MIGR_EXACT_XY, MIGR_RANDOM]) {
    void test(`a migrating worm retains its tail after ${mode === MIGR_RANDOM ? 'random' : 'direct'} arrival placement`, async () => {
        const { destination } = freshConnectedLevels();
        requirePlayingGame(game);
        initRng(41n);
        const worm = await createMonsterAt('long worm', 12, 10, NO_MINVENT);
        await initializeMonsterWormBody(worm, { segmentCount: 4 });
        assert.equal(worm.wormSegments?.length, 4);
        await migrateMonsterOffLevel(worm, game, { dst: { dnum: 0, dlevel: 2 } }, {
            mode, coordinate: { x: 14, y: 10 },
        });
        game.level = destination;
        game.u.uz = { dnum: 0, dlevel: 2 };

        const arrived = await monsterArrive(worm, MON_ARRIVE_BEFORE_YOU, game);

        assert.equal(arrived, true);
        assert.equal(worm.mnum, MONSTER_NAME.indexOf('long worm'));
        assert.ok((worm.wormno ?? 0) > 0);
        assert.equal(worm.wormSegments?.length, 4);
        assert.equal(worm.wormHead?.x, worm.mx);
        assert.equal(worm.wormHead?.y, worm.my);
        for (const segment of worm.wormSegments ?? []) {
            assert.ok(segment.x > 0, 'Each migrated segment occupies the new level.');
            assert.ok(monsterAtPosition(destination, segment.x, segment.y) === worm);
        }
    });
}
