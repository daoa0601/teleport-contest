import assert from 'node:assert/strict';
import test from 'node:test';
import { farlookLocationDescription } from '../js/pager.js';
import { map_invisible, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { mapVicinity } from '../js/detect.js';
import { SPE_CLAIRVOYANCE } from '../js/object_data.js';
import { uninitializedObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('a remembered unseen monster is just an unseen creature to a blind hero', async () => {
    await freshObjectRoom();
    const x = game.u.ux + 2, y = game.u.uy;
    await map_invisible(x, y);
    assert.equal(await farlookLocationDescription(x, y), 'remembered, unseen, creature');
    game.u.monsterDetectionTurns = 20;
    assert.equal(await farlookLocationDescription(x, y), 'remembered, unseen, creature', 'ordinary monster detection does not use clairvoyance wording');
    game.u.blindTurns = 20;
    assert.equal(await farlookLocationDescription(x, y), 'unseen creature');
});
void test('clairvoyance describes an unseen creature while browsing and restores remembered wording afterwards', async () => {
    const level = await freshObjectRoom({ flags: { tips: false, verbose: false } });
    level.flags.hero_memory = false;
    const x = game.u.ux + 2, y = game.u.uy;
    const monster = await createMonsterAt('orc', x, y);
    monster.minvis = true;
    await newsym(x, y);
    const spell = await uninitializedObject(SPE_CLAIRVOYANCE);
    const input = resetInputState();
    const mapping = mapVicinity(spell);
    try {
        await input.waitUntilBlocked();
        input.feed('ll');
        await input.waitUntilBlocked();
        assert.equal(requireScreenRow(0).map(cell => cell.ch).join('').trim(), 'unseen creature');
    }
    finally {
        input.feed('\x1b');
        await mapping;
    }
    await map_invisible(x, y);
    assert.equal(await farlookLocationDescription(x, y), 'remembered, unseen, creature');
});
//# sourceMappingURL=unseen_creature_description.test.js.map