import assert from 'node:assert/strict';
import test from 'node:test';

import { MM_ANGRY, MM_NOTAIL, NO_MINVENT } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { setMonsterPermanentInvisibility } from '../js/monster_invisibility.js';
import { makeMonsterInvisible } from '../js/monster_invisibility_magic.js';
import { initializeMonsterWormBody } from '../js/monster_worm.js';
import { POT_INVISIBILITY } from '../js/object_data.js';
import { hitMonsterWithSupportedPotion } from '../js/potion_hit.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { assertWormBody } from './support/worms.js';

async function visibleWorm() {
    freshObjectRoom({ right: 25 });
    const worm = await createMonsterAt('long worm', 16, 10,
        MM_ANGRY | MM_NOTAIL | NO_MINVENT);
    initializeMonsterWormBody(worm, { segmentCount: 3, random: () => 0 });
    assertWormBody(worm);
    assert.equal(worm.wormSegments.length, 3);
    worm.msleeping = 0;
    installPagerInput(resetInputState(), { expected: /worm|shards|evaporates|appears|transparent/, limit: 8 });
    for (const segment of worm.wormSegments) {
        newsym(segment.x, segment.y);
        assert.equal(glyphAt(segment.x, segment.y)?.kind, 'monster');
    }
    return worm;
}

void test('a make-invisible wand erases every visible long-worm tail segment immediately', async () => {
    const worm = await visibleWorm();

    await makeMonsterInvisible(worm);

    assert.equal(worm.minvis, 1);
    for (const segment of worm.wormSegments)
        assert.notEqual(glyphAt(segment.x, segment.y)?.kind, 'monster',
            `The invisible tail at ${segment.x},${segment.y} must disappear with its head.`);
});

for (const cursed of [false, true]) {
    void test(`an invisibility potion immediately ${cursed ? 'reveals' : 'hides'} the whole worm`, async () => {
        const worm = await visibleWorm();
        if (cursed) {
            setMonsterPermanentInvisibility(worm);
            for (const segment of worm.wormSegments) {
                newsym(segment.x, segment.y);
                assert.notEqual(glyphAt(segment.x, segment.y)?.kind, 'monster');
            }
        }
        const potion = await knownObject(POT_INVISIBILITY, { cursed });

        await hitMonsterWithSupportedPotion({ monster: worm, potion });

        assert.equal(!!worm.minvis, !cursed);
        for (const segment of worm.wormSegments)
            assert.equal(glyphAt(segment.x, segment.y)?.kind === 'monster', cursed,
                `The tail at ${segment.x},${segment.y} must share the head's visibility.`);
    });
}
